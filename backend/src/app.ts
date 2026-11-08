import express, { type Express } from "express";
import type { AppConfig } from "./config/env.js";
import { loadConfig } from "./config/env.js";
import { registerSecret } from "./utils/logger.js";
import { createCredentialState } from "./services/credentialState.js";
import { createFileTokenStore, type TokenStore } from "./services/spotify/tokenStore.js";
import { createSpotifyAuth, type SpotifyAuth } from "./services/spotify/spotifyAuth.js";
import { createSpotifySearch, type SpotifySearch } from "./services/spotify/spotifySearch.js";
import { createGeminiClient } from "./services/gemini/geminiClient.js";
import { createOpenAIClient } from "./services/openai/openaiClient.js";
import { createIntentExtractor, type IntentExtractor } from "./services/gemini/intentExtractor.js";
import { parseIntent } from "./services/gemini/intentExtractor.js";
import { INTENT_SYSTEM_INSTRUCTION } from "./services/gemini/prompt.js";
import { MUSIC_INTENT_JSON_SCHEMA } from "./services/gemini/intentSchema.js";
import { createMusicController } from "./controllers/music.controller.js";
import { createSemanticReranker } from "./services/gemini/reranker.js";
import { createSpotifyController } from "./controllers/spotify.controller.js";
import { createStatusController } from "./controllers/status.controller.js";
import { createCameraController } from "./controllers/camera.controller.js";
import { createGeminiVisionService, type GeminiVisionService } from "./services/gemini/geminiVision.js";
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

  // Initialize Gemini Intent Extractor if key exists
  let intentExtractor: IntentExtractor | null = deps.intentExtractor ?? null;
  let visionService: GeminiVisionService | null = deps.visionService ?? null;
  let geminiClient: ReturnType<typeof createGeminiClient> | null = null;
  const openaiClient = config.openaiApiKey ? createOpenAIClient(config.openaiApiKey, config.openaiModel) : null;

  if (config.geminiApiKey) {
    geminiClient = createGeminiClient(config.geminiApiKey, config.geminiModel);
    if (!intentExtractor) {
      intentExtractor = createIntentExtractor(geminiClient, {
        onKeyValidity: (valid) => {
          credState.geminiValid = valid;
        },
      });
    }

    if (!visionService) {
      visionService = createGeminiVisionService(config.geminiApiKey, config.geminiModel);
    }
  }

  if (openaiClient) {
    const geminiExtractor = intentExtractor;
    intentExtractor = async (prompt, signal) => {
      try {
        if (!geminiExtractor) throw new Error("Gemini provider is not configured");
        return await geminiExtractor(prompt, signal);
      } catch {
        // Gemini is unavailable or rejected; continue with OpenAI as the provider fallback.
      }
      try {
        const raw = await openaiClient.generateJson({ userText: prompt, systemInstruction: INTENT_SYSTEM_INSTRUCTION, jsonSchema: MUSIC_INTENT_JSON_SCHEMA, signal });
        credState.openaiValid = true;
        return parseIntent(raw);
      } catch (error) {
        if (error instanceof Error && /OpenAI API key was rejected/i.test(error.message)) credState.openaiValid = false;
        throw error;
      }
    };
  }

  const transitionPlanner = createTransitionPlanner(geminiClient);
  const stageIntentGenerator = createStageIntentGenerator(geminiClient);
  const playlistAssembler = createPlaylistAssembler(spotifySearch);
  const transitionController = createTransitionController(
    transitionPlanner,
    stageIntentGenerator,
    playlistAssembler,
  );

  const musicController = createMusicController(config, credState, spotifyAuth, {
    intentExtractor,
    spotifySearch,
    reranker: createSemanticReranker(geminiClient),
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
