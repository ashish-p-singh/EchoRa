import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createGrokClient } from "../../src/services/grok/grokClient.js";
import { createTieredAIClient } from "../../src/services/tieredAIClient.js";
import type { GeminiClient } from "../../src/services/gemini/geminiClient.js";
import { AppError } from "../../src/utils/AppError.js";

describe("grokClient", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("calls xAI chat completions endpoint and returns content on success", () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({ mood: "peaceful", energy: "low" }),
            },
          },
        ],
      }),
    } as any);

    const client = createGrokClient("xai-test-key", "grok-2-latest");
    return client
      .generateJson({
        userText: "ambient study music",
        systemInstruction: "Extract intent",
        jsonSchema: {},
      })
      .then((res) => {
        expect(JSON.parse(res)).toEqual({ mood: "peaceful", energy: "low" });
        expect(globalThis.fetch).toHaveBeenCalledWith(
          "https://api.x.ai/v1/chat/completions",
          expect.objectContaining({
            method: "POST",
            headers: expect.objectContaining({
              Authorization: "Bearer xai-test-key",
            }),
          }),
        );
      });
  });

  it("throws GEMINI_AUTH_FAILED on permission-denied / insufficient credits", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({
        code: "permission-denied",
        error: "Your newly created team doesn't have any credits or licenses yet.",
      }),
    } as any);

    const client = createGrokClient("xai-test-key", "grok-2-latest");

    await expect(
      client.generateJson({
        userText: "ambient study music",
        systemInstruction: "Extract intent",
        jsonSchema: {},
      }),
    ).rejects.toThrowError(AppError);
  });
});

describe("tieredAIClient", () => {
  it("uses Grok first when healthy", async () => {
    const grokMock: GeminiClient = {
      generateJson: vi.fn().mockResolvedValue(JSON.stringify({ provider: "grok" })),
    };
    const geminiMock: GeminiClient = {
      generateJson: vi.fn().mockResolvedValue(JSON.stringify({ provider: "gemini" })),
    };

    const tiered = createTieredAIClient([
      { name: "grok", client: grokMock },
      { name: "gemini", client: geminiMock },
    ]);

    const res = await tiered.generateJson({
      userText: "test",
      systemInstruction: "instruction",
      jsonSchema: {},
    });

    expect(JSON.parse(res)).toEqual({ provider: "grok" });
    expect(grokMock.generateJson).toHaveBeenCalledTimes(1);
    expect(geminiMock.generateJson).not.toHaveBeenCalled();
  });

  it("falls back to Gemini when Grok fails", async () => {
    const grokMock: GeminiClient = {
      generateJson: vi.fn().mockRejectedValue(new AppError("GEMINI_AUTH_FAILED", { message: "No credits" })),
    };
    const geminiMock: GeminiClient = {
      generateJson: vi.fn().mockResolvedValue(JSON.stringify({ provider: "gemini" })),
    };

    let grokValid: boolean | null = null;
    let geminiValid: boolean | null = null;

    const tiered = createTieredAIClient([
      { name: "grok", client: grokMock, onValidity: (v) => { grokValid = v; } },
      { name: "gemini", client: geminiMock, onValidity: (v) => { geminiValid = v; } },
    ]);

    const res = await tiered.generateJson({
      userText: "test",
      systemInstruction: "instruction",
      jsonSchema: {},
    });

    expect(JSON.parse(res)).toEqual({ provider: "gemini" });
    expect(grokMock.generateJson).toHaveBeenCalledTimes(1);
    expect(geminiMock.generateJson).toHaveBeenCalledTimes(1);
    expect(grokValid).toBe(false);
    expect(geminiValid).toBe(true);
  });
});
