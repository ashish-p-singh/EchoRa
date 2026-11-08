import { AppError } from "../../utils/AppError.js";
import { logger } from "../../utils/logger.js";
import type { CameraAnalysisResponse } from "../../types/camera.js";
import {
  VISION_SYSTEM_INSTRUCTION,
  cleanBase64,
  type GeminiVisionService,
} from "../gemini/geminiVision.js";

export const GROK_VISION_MODELS = [
  "grok-2-vision-1212",
  "grok-vision-beta",
  "grok-2-vision",
] as const;

export function createGrokVisionService(
  apiKey: string,
  preferredModel: string = "grok-2-vision-1212",
): GeminiVisionService {
  return {
    async analyzeExpression(
      base64Image: string,
      mimeType: string = "image/jpeg",
      signal?: AbortSignal,
    ): Promise<CameraAnalysisResponse> {
      const models = [...new Set([preferredModel, ...GROK_VISION_MODELS])];
      const cleaned = cleanBase64(base64Image);
      const dataUrl = `data:${mimeType};base64,${cleaned}`;
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
                  content: `${VISION_SYSTEM_INSTRUCTION}\nReturn JSON with: expression (string), confidence ("HIGH"|"MEDIUM"|"LOW"), image_quality ("GOOD"|"FAIR"|"POOR"), visual_observations (string[]), music_direction (string|null).`,
                },
                {
                  role: "user",
                  content: [
                    {
                      type: "text",
                      text: "Analyze the facial expression in this camera frame and suggest an appropriate music direction.",
                    },
                    {
                      type: "image_url",
                      image_url: { url: dataUrl },
                    },
                  ],
                },
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
                : `Grok Vision returned HTTP ${response.status}.`,
              detail: detailMessage,
            });
          }

          const body = (await response.json()) as {
            choices?: Array<{ message?: { content?: string | null } }>;
          };

          const content = body.choices?.[0]?.message?.content;
          if (!content) {
            throw new AppError("GEMINI_INVALID_RESPONSE", {
              detail: `Grok Vision model ${model} returned empty content`,
            });
          }

          const parsed = JSON.parse(content) as CameraAnalysisResponse;
          return {
            expression: parsed.expression || "neutral-looking",
            confidence: parsed.confidence || "MEDIUM",
            image_quality: parsed.image_quality || "FAIR",
            visual_observations: Array.isArray(parsed.visual_observations)
              ? parsed.visual_observations
              : [],
            music_direction: parsed.music_direction ?? null,
          };
        } catch (error) {
          lastError = error;
          if (error instanceof AppError && error.code === "GEMINI_AUTH_FAILED") {
            throw error;
          }
          logger.warn(`Grok Vision model ${model} failed; trying fallback: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      throw lastError instanceof AppError
        ? lastError
        : new AppError("GEMINI_UNAVAILABLE", { cause: lastError });
    },
  };
}

