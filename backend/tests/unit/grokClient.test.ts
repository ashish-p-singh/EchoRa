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
  it("uses primary provider (Gemini) first when healthy", async () => {
    const geminiMock: GeminiClient = {
      generateJson: vi.fn().mockResolvedValue(JSON.stringify({ provider: "gemini" })),
    };
    const grokMock: GeminiClient = {
      generateJson: vi.fn().mockResolvedValue(JSON.stringify({ provider: "grok" })),
    };

    const tiered = createTieredAIClient([
      { name: "gemini", client: geminiMock },
      { name: "grok", client: grokMock },
    ]);

    const res = await tiered.generateJson({
      userText: "test",
      systemInstruction: "instruction",
      jsonSchema: {},
    });

    expect(JSON.parse(res)).toEqual({ provider: "gemini" });
    expect(geminiMock.generateJson).toHaveBeenCalledTimes(1);
    expect(grokMock.generateJson).not.toHaveBeenCalled();
  });

  it("falls back to Grok (2nd preference) when Gemini fails", async () => {
    const geminiMock: GeminiClient = {
      generateJson: vi.fn().mockRejectedValue(new AppError("GEMINI_AUTH_FAILED", { message: "Quota reached" })),
    };
    const grokMock: GeminiClient = {
      generateJson: vi.fn().mockResolvedValue(JSON.stringify({ provider: "grok" })),
    };

    let geminiValid: boolean | null = null;
    let grokValid: boolean | null = null;

    const tiered = createTieredAIClient([
      { name: "gemini", client: geminiMock, onValidity: (v) => { geminiValid = v; } },
      { name: "grok", client: grokMock, onValidity: (v) => { grokValid = v; } },
    ]);

    const res = await tiered.generateJson({
      userText: "test",
      systemInstruction: "instruction",
      jsonSchema: {},
    });

    expect(JSON.parse(res)).toEqual({ provider: "grok" });
    expect(geminiMock.generateJson).toHaveBeenCalledTimes(1);
    expect(grokMock.generateJson).toHaveBeenCalledTimes(1);
    expect(geminiValid).toBe(false);
    expect(grokValid).toBe(true);
  });
});
