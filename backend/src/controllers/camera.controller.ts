import type { Request, Response, NextFunction } from "express";
import type { ValidatedCameraImage } from "../middleware/validateImagePayload.js";
import type { GeminiVisionService } from "../services/gemini/geminiVision.js";
import type { AppConfig } from "../config/env.js";
import { AppError } from "../utils/AppError.js";

export function createCameraController(
  config: AppConfig,
  visionService: GeminiVisionService | null,
) {
  return {
    async analyze(req: Request<unknown, unknown, ValidatedCameraImage>, res: Response, next: NextFunction) {
      try {
        if ((!config.geminiApiKey && !config.grokApiKey) || !visionService) {
          throw new AppError("GEMINI_AUTH_FAILED", {
            message: "Vision AI key (Grok or Gemini) is not configured for camera vision analysis. Run `npm run setup` first.",
          });
        }

        const { image, mimeType } = req.body;
        const result = await visionService.analyzeExpression(image, mimeType);
        res.json(result);
      } catch (err) {
        next(err);
      }
    },
  };
}

