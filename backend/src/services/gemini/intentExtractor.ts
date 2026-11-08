import type { MusicIntent } from "../../types/intent.js";
import type { DiscoveryContext } from "../../types/discovery.js";
import { AppError } from "../../utils/AppError.js";
import { logger } from "../../utils/logger.js";
import type { GeminiClient } from "./geminiClient.js";
import { MUSIC_INTENT_JSON_SCHEMA, musicIntentSchema } from "./intentSchema.js";
import { INTENT_SYSTEM_INSTRUCTION, buildIntentSystemInstruction } from "./prompt.js";

const MAX_ATTEMPTS = 2;

/** Strips optional ```json fences some models add despite JSON mode. */
function stripCodeFences(text: string): string {
  const match = text.trim().match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match?.[1] ?? text.trim();
}

/**
 * Parses and validates Gemini's raw output.
 * Throws GEMINI_INVALID_RESPONSE if it is not a JSON object.
 */
export function parseIntent(rawText: string): MusicIntent {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripCodeFences(rawText));
  } catch {
    throw new AppError("GEMINI_INVALID_RESPONSE", { detail: "Gemini returned non-JSON output" });
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new AppError("GEMINI_INVALID_RESPONSE", { detail: "Gemini returned JSON that is not an object" });
  }
  const result = musicIntentSchema.safeParse(parsed);
  if (!result.success) {
    throw new AppError("GEMINI_INVALID_RESPONSE", { detail: `Intent validation failed: ${result.error.message}` });
  }
  return result.data;
}

export interface IntentExtractorHooks {
  /** Called after a successful Gemini call or an auth failure (to track key validity). */
  onKeyValidity?: (valid: boolean) => void;
}

export type IntentExtractor = (
  prompt: string,
  signal?: AbortSignal,
  discoveryContext?: DiscoveryContext,
) => Promise<MusicIntent>;

/**
 * Creates the intent extractor. Input is the user's prompt and optional discovery context.
 * Retries once on malformed output or transient unavailability.
 */
export function createIntentExtractor(client: GeminiClient, hooks: IntentExtractorHooks = {}): IntentExtractor {
  return async (prompt, signal, discoveryContext) => {
    let lastError: AppError | undefined;
    const systemInstruction = discoveryContext?.discoveryMode
      ? buildIntentSystemInstruction(discoveryContext.discoveryMode)
      : INTENT_SYSTEM_INSTRUCTION;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const raw = await client.generateJson({
          userText: prompt,
          systemInstruction,
          jsonSchema: MUSIC_INTENT_JSON_SCHEMA,
          signal,
        });
        hooks.onKeyValidity?.(true);
        return parseIntent(raw);
      } catch (err) {
        const appError = err instanceof AppError ? err : new AppError("INTERNAL_ERROR", { cause: err });
        if (appError.code === "GEMINI_AUTH_FAILED") hooks.onKeyValidity?.(false);

        const retryable = appError.code === "GEMINI_INVALID_RESPONSE" || appError.code === "GEMINI_UNAVAILABLE";
        lastError = appError;
        if (!retryable || attempt === MAX_ATTEMPTS || signal?.aborted) throw appError;
        logger.warn(`Gemini attempt ${attempt} failed (${appError.code}); retrying`);
      }
    }

    throw lastError ?? new AppError("INTERNAL_ERROR");
  };
}

