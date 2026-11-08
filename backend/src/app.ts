import express, { type Express } from "express";
import type { AppConfig } from "./config/env.js";
import { loadConfig } from "./config/env.js";
import { registerSecret } from "./utils/logger.js";
import { createCredentialState } from "./services/credentialState.js";
import { createFileTokenStore, type TokenStore } from "./services/spotify/tokenStore.js";
import { createSpotifyAuth, type SpotifyAuth } from "./services/spotify/spotifyAuth.js";
import { createSpotifySearch, type SpotifySearch } from "./services/spotify/spotifySearch.js";
import { createGeminiClient } from "./services/gemini/geminiClient.js";
import { createGrokClient } from "./services/grok/grokClient.js";
import { createOpenAIClient } from "./services/openai/openaiClient.js";
import { createTieredAIClient, type AIProviderTier } from "./services/tieredAIClient.js";
import { createIntentExtractor, type IntentExtractor } from "./services/gemini/intentExtractor.js";
import { createMusicController } from "./controllers/music.controller.js";
import { createSemanticReranker } from "./services/gemini/reranker.js";
import { createSpotifyController } from "./controllers/spotify.controller.js";
import { createStatusController } from "./controllers/status.controller.js";
import { createCameraController } from "./controllers/camera.controller.js";
import { createGeminiVisionService, type GeminiVisionService } from "./services/gemini/geminiVision.js";
import { createGrokVisionService } from "./services/grok/grokVision.js";
import { logger } from "./utils/logger.js";
import { createTransitionPlanner } from "./services/transition/transitionPlanner.js";
import { createStageIntentGenerator } from "./services/transition/stageIntentGenerator.js";
import { createPlaylistAssembler } from "./services/transition/playlistAssembler.js";
import { createTransitionController } from "./controllers/transition.controller.js";
import { createTransitionRouter } from "./routes/transition.routes.js";
import { createMusicRouter } from "./routes/music.routes.js";
import { createSpotifyRouter } from "./routes/spotify.routes.js";
import { createStatusRouter } from "./routes/status.routes.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";

export interface AppDependencies {
  config?: AppConfig;
  tokenStore?: TokenStore;
  spotifyAuth?: SpotifyAuth | null;
  spotifySearch?: SpotifySearch | null;
  intentExtractor?: IntentExtractor | null;
  visionService?: GeminiVisionService | null;
}

export function createApp(deps: AppDependencies = {}): Express {
  const config = deps.config ?? loadConfig();

  // Register secrets for redaction in logs
  registerSecret(config.grokApiKey);
  registerSecret(config.geminiApiKey);
  registerSecret(config.openaiApiKey);
  registerSecret(config.spotifyClientId);
  registerSecret(config.spotifyClientSecret);

  const credState = createCredentialState();

  // Initialize Spotify Auth & Store if configured
  let spotifyAuth: SpotifyAuth | null = deps.spotifyAuth ?? null;
  if (!spotifyAuth && config.spotifyClientId && config.spotifyClientSecret) {
    const tokenStore = deps.tokenStore ?? createFileTokenStore(config.spotifyTokenFile);
    spotifyAuth = createSpotifyAuth({
      clientId: config.spotifyClientId,
      clientSecret: config.spotifyClientSecret,
      redirectUri: config.spotifyRedirectUri,
      tokenStore,
      onClientValidity: (valid) => {
        credState.spotifyValid = valid;
      },
    });
  }

  // Initialize Spotify Search if auth exists
  let spotifySearch: SpotifySearch | null = deps.spotifySearch ?? null;
  if (!spotifySearch && spotifyAuth) {
    spotifySearch = createSpotifySearch({ auth: spotifyAuth });
  }

  // Initialize AI Provider Clients in Tiered Preference Order:
  // 1. Gemini - Top preference (Primary Provider)
  // 2. Grok (xAI) - Secondary preference (2nd priority)
  // 3. OpenAI - Tertiary fallback
  const geminiClient = config.geminiApiKey ? createGeminiClient(config.geminiApiKey, config.geminiModel) : null;
  const grokClient = config.grokApiKey ? createGrokClient(config.grokApiKey, config.grokModel) : null;
  const openaiClient = config.openaiApiKey ? createOpenAIClient(config.openaiApiKey, config.openaiModel) : null;

  const aiProviders: AIProviderTier[] = [];
  if (geminiClient) {
    aiProviders.push({
      name: "gemini",
      client: geminiClient,
      onValidity: (valid) => {
        credState.geminiValid = valid;
      },
    });
  }
  if (grokClient) {
    aiProviders.push({
      name: "grok",
      client: grokClient,
      onValidity: (valid) => {
        credState.grokValid = valid;
      },
    });
  }
  if (openaiClient) {
    aiProviders.push({
      name: "openai",
      client: openaiClient,
      onValidity: (valid) => {
        credState.openaiValid = valid;
      },
    });
  }

  const tieredAIClient = aiProviders.length > 0 ? createTieredAIClient(aiProviders) : null;

  // Initialize Intent Extractor
  let intentExtractor: IntentExtractor | null = deps.intentExtractor ?? null;
  if (!intentExtractor && tieredAIClient) {
    intentExtractor = createIntentExtractor(tieredAIClient);
  }

  // Initialize Vision Service (Gemini Vision 1st priority with Grok Vision fallback)
  let visionService: GeminiVisionService | null = deps.visionService ?? null;
  if (!visionService) {
    const geminiVision = config.geminiApiKey ? createGeminiVisionService(config.geminiApiKey, config.geminiModel) : null;
    const grokVision = config.grokApiKey ? createGrokVisionService(config.grokApiKey) : null;

    if (geminiVision && grokVision) {
      visionService = {
        async analyzeExpression(base64Image, mimeType, signal) {
          try {
            const res = await geminiVision.analyzeExpression(base64Image, mimeType, signal);
            credState.geminiValid = true;
            return res;
          } catch (err) {
            credState.geminiValid = false;
            logger.warn(
              `[Vision Tier] Gemini Vision failed (${err instanceof Error ? err.message : String(err)}). Falling back to Grok Vision.`,
            );
            const res = await grokVision.analyzeExpression(base64Image, mimeType, signal);
            credState.grokValid = true;
            return res;
          }
        },
      };
    } else if (geminiVision) {
      visionService = geminiVision;
    } else if (grokVision) {
      visionService = grokVision;
    }
  }

  const transitionPlanner = createTransitionPlanner(tieredAIClient);
  const stageIntentGenerator = createStageIntentGenerator(tieredAIClient);
  const playlistAssembler = createPlaylistAssembler(spotifySearch);
  const transitionController = createTransitionController(
    transitionPlanner,
    stageIntentGenerator,
    playlistAssembler,
  );

  const musicController = createMusicController(config, credState, spotifyAuth, {
    intentExtractor,
    spotifySearch,
    reranker: createSemanticReranker(tieredAIClient),
  });
  const spotifyController = createSpotifyController(config, spotifyAuth);
  const statusController = createStatusController(config, credState, spotifyAuth);
  const cameraController = createCameraController(config, visionService);

  const app = express();
  app.disable("x-powered-by");
  // 5mb limit to support base64 image frames
  app.use(express.json({ limit: "5mb" }));

  // Mount API endpoints
  app.use("/api/music", createMusicRouter(musicController, cameraController));
  app.use("/api/transition", createTransitionRouter(transitionController));
  app.use("/api/spotify", createSpotifyRouter(spotifyController));
  app.use("/api", createStatusRouter(statusController));

  // Health check
  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  // 404 & Centralized Error Handler
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
