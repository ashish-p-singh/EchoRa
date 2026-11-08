import type { AppConfig } from "../../config/env.js";
import type { CredentialState } from "../credentialState.js";
import type { SpotifyAuth } from "../spotify/spotifyAuth.js";
import type { AppMode, StatusResponse } from "../../types/api.js";

export interface ModeResolution {
  searchMode: AppMode;
  interpretMode: AppMode;
  status: StatusResponse;
}

export function resolveAppMode(
  config: AppConfig,
  credState: CredentialState,
  spotifyAuth: SpotifyAuth | null,
): ModeResolution {
  const grokConfigured = Boolean(config.grokApiKey);
  const geminiConfigured = Boolean(config.geminiApiKey);
  const openaiConfigured = Boolean(config.openaiApiKey);
  const aiReady =
    (grokConfigured && credState.grokValid !== false) ||
    (geminiConfigured && credState.geminiValid !== false) ||
    (openaiConfigured && credState.openaiValid !== false);
  const spotifyConfigured = Boolean(config.spotifyClientId && config.spotifyClientSecret);
  const spotifyAuthorized = Boolean(spotifyAuth?.isAuthorized());

  const missing: string[] = [];
  if (!aiReady) {
    if (!grokConfigured && !geminiConfigured && !openaiConfigured) {
      missing.push("AI provider API key (Grok, Gemini, or OpenAI) is not configured.");
    } else {
      if (grokConfigured && credState.grokValid === false) {
        missing.push("Grok (xAI) API key was rejected or has insufficient credits.");
      }
      if (geminiConfigured && credState.geminiValid === false) {
        missing.push("Gemini API key was rejected by the API.");
      }
      if (openaiConfigured && credState.openaiValid === false) {
        missing.push("OpenAI API key was rejected by the API.");
      }
    }
  }

  if (!spotifyConfigured) {
    missing.push("Spotify Client ID / Secret are not configured.");
  } else if (credState.spotifyValid === false) {
    missing.push("Spotify credentials were rejected by Spotify.");
  } else if (!spotifyAuthorized) {
    missing.push("Spotify authorization required. Click 'Connect Spotify'.");
  }

  const aiProviderReady = aiReady;
  const spotifyReady = spotifyConfigured && credState.spotifyValid !== false && spotifyAuthorized;

  const interpretMode: AppMode = aiProviderReady ? "live" : "mock";
  const searchMode: AppMode = aiProviderReady && spotifyReady ? "live" : "mock";

  const activeProvider =
    grokConfigured && credState.grokValid !== false
      ? "grok"
      : geminiConfigured && credState.geminiValid !== false
        ? "gemini"
        : openaiConfigured && credState.openaiValid !== false
          ? "openai"
          : "mock";

  const status: StatusResponse = {
    mode: searchMode,
    interpretMode,
    grok: {
      configured: grokConfigured,
      valid: credState.grokValid,
    },
    gemini: {
      configured: geminiConfigured,
      valid: credState.geminiValid,
    },
    openai: { configured: openaiConfigured, valid: credState.openaiValid },
    spotify: {
      configured: spotifyConfigured,
      valid: credState.spotifyValid,
      authorized: spotifyAuthorized,
    },
    activeProvider,
    missing,
  };

  return {
    searchMode,
    interpretMode,
    status,
  };
}
