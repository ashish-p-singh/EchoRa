import { AppError } from "../utils/AppError.js";
import { logger } from "../utils/logger.js";
import type { GeminiClient, GenerateJsonRequest } from "./gemini/geminiClient.js";

export interface AIProviderTier {
  name: "grok" | "gemini" | "openai";
  client: GeminiClient;
  onValidity?: (valid: boolean) => void;
}

/**
 * Creates a prioritized multi-tier AI client.
 * Calls providers in strict order (e.g. Grok -> Gemini -> OpenAI).
 * If a provider fails due to credits, rate limits, or transient errors,
 * it marks validity, logs the fallback, and seamlessly tries the next provider.
 */
export function createTieredAIClient(providers: AIProviderTier[]): GeminiClient {
  return {
    async generateJson(req: GenerateJsonRequest): Promise<string> {
      let lastError: unknown;

      for (let i = 0; i < providers.length; i++) {
        const provider = providers[i]!;
        try {
          const result = await provider.client.generateJson(req);
          provider.onValidity?.(true);
          return result;
        } catch (error) {
          lastError = error;
          provider.onValidity?.(false);

          const errorMessage = error instanceof Error ? error.message : String(error);
          const nextProvider = providers[i + 1]?.name;

          if (nextProvider) {
            logger.warn(
              `[AIClient Tier] ${provider.name.toUpperCase()} failed (${errorMessage}). Automatically falling back to ${nextProvider.toUpperCase()}.`,
            );
          } else {
            logger.warn(
              `[AIClient Tier] ${provider.name.toUpperCase()} failed (${errorMessage}). No further fallback providers available.`,
            );
          }
        }
      }

      throw lastError instanceof AppError
        ? lastError
        : new AppError("GEMINI_UNAVAILABLE", { cause: lastError });
    },
  };
}

