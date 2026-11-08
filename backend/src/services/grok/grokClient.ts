import { AppError } from "../../utils/AppError.js";
import type { GeminiClient, GenerateJsonRequest } from "../gemini/geminiClient.js";
import { logger } from "../../utils/logger.js";

export const GROK_FALLBACK_MODELS = [
  "grok-2-latest",
  "grok-2-1212",
  "grok-beta",
  "grok-2",
] as const;

/**
 * Grok (xAI) OpenAI-compatible client.
 * Implements the same GeminiClient interface for seamless swapping and tiering.
 */
export function createGrokClient(apiKey: string, preferredModel: string = "grok-2-latest"): GeminiClient {
  return {
    async generateJson({ userText, systemInstruction, jsonSchema, signal }: GenerateJsonRequest): Promise<string> {
      const models = [...new Set([preferredModel, ...GROK_FALLBACK_MODELS])];
      let lastError: unknown;

      for (const model of models) {
        try {
          const timeoutSignal = AbortSignal.timeout(25000);
          const effectiveSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;

          const response = await fetch("https://api.x.ai/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model,
              temperature: 0.2,
              response_format: { type: "json_object" },
              messages: [
                {
                  role: "system",
                  content: `${systemInstruction}\nReturn only a valid JSON object matching this schema: ${JSON.stringify(jsonSchema)}`,
                },
                { role: "user", content: userText },
              ],
            }),
            signal: effectiveSignal,
          });

          if (!response.ok) {
            const body = (await response.json().catch(() => ({}))) as {
              error?: string | { message?: string; code?: string };
              code?: string;
              message?: string;
            };

            const detailMessage =
              typeof body.error === "string"
                ? body.error
                : body.error?.message || body.message || `HTTP ${response.status}`;

            const isAuthOrQuota =
              response.status === 401 ||
              response.status === 403 ||
              body.code === "permission-denied" ||
              /credits|licenses|quota|unauthorized|forbidden/i.test(detailMessage);

            const code = isAuthOrQuota ? "GEMINI_AUTH_FAILED" : "GEMINI_UNAVAILABLE";
            throw new AppError(code, {
              message: isAuthOrQuota
                ? "The Grok (xAI) API key was rejected or has insufficient credits."
                : `Grok API returned HTTP ${response.status}.`,
              detail: detailMessage,
            });
          }

          const body = (await response.json()) as {
            choices?: Array<{ message?: { content?: string | null } }>;
          };

          const content = body.choices?.[0]?.message?.content;
          if (!content) {
            throw new AppError("GEMINI_INVALID_RESPONSE", {
              detail: `Grok model ${model} returned an empty response`,
            });
          }

          return content;
        } catch (error) {
          lastError = error;
          if (error instanceof AppError && error.code === "GEMINI_AUTH_FAILED") {
            // Auth or credit issue across this API key won't be fixed by changing Grok model
            throw error;
          }
          logger.warn(`Grok model ${model} failed; trying next fallback model: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      throw lastError instanceof AppError
        ? lastError
        : new AppError("GEMINI_UNAVAILABLE", { cause: lastError });
    },
  };
}

