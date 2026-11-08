import { describe, it, expect } from "vitest";
import { resolveAppMode } from "../../src/services/music/modeResolver.js";
import type { AppConfig } from "../../src/config/env.js";

const baseConfig: AppConfig = {
  grokApiKey: null,
  grokModel: "grok-2-latest",
  geminiApiKey: null,
  geminiModel: "gemini-flash-latest",
  openaiApiKey: null,
  openaiModel: "gpt-4o-mini",
  spotifyClientId: null,
  spotifyClientSecret: null,
  spotifyRedirectUri: "http://127.0.0.1:4000/api/spotify/callback",
  frontendUrl: "http://127.0.0.1:5173",
  spotifyTokenFile: "dummy",
};

describe("modeResolver", () => {
  it("resolves to mock mode when no credentials are provided", () => {
    const credState = { grokValid: null, geminiValid: null, openaiValid: null, spotifyValid: null };
    const res = resolveAppMode(baseConfig, credState, null);

    expect(res.searchMode).toBe("mock");
    expect(res.interpretMode).toBe("mock");
    expect(res.status.missing.length).toBeGreaterThan(0);
  });

  it("enables live interpretMode and prioritizes Grok when configured", () => {
    const config = { ...baseConfig, grokApiKey: "xai-test-key", geminiApiKey: "fake-gemini-key" };
    const credState = { grokValid: true, geminiValid: true, openaiValid: null, spotifyValid: null };
    const res = resolveAppMode(config, credState, null);

    expect(res.interpretMode).toBe("live");
    expect(res.searchMode).toBe("mock"); // search still needs Spotify
    expect(res.status.activeProvider).toBe("grok");
  });

  it("enables live interpretMode when only Gemini is configured", () => {
    const config = { ...baseConfig, geminiApiKey: "fake-gemini-key" };
    const credState = { grokValid: null, geminiValid: true, openaiValid: null, spotifyValid: null };
    const res = resolveAppMode(config, credState, null);

    expect(res.interpretMode).toBe("live");
    expect(res.searchMode).toBe("mock"); // search still needs Spotify
    expect(res.status.activeProvider).toBe("gemini");
  });

  it("enables live searchMode when both Gemini and Spotify are authorized", () => {
    const config = {
      ...baseConfig,
      geminiApiKey: "fake-gemini-key",
      spotifyClientId: "sp-id",
      spotifyClientSecret: "sp-sec",
    };
    const credState = { grokValid: null, geminiValid: true, openaiValid: null, spotifyValid: true };
    const mockAuth = {
      isAuthorized: () => true,
    } as any;

    const res = resolveAppMode(config, credState, mockAuth);
    expect(res.searchMode).toBe("live");
    expect(res.interpretMode).toBe("live");
    expect(res.status.missing).toEqual([]);
  });
});

