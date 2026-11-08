import type { MusicIntent } from "./intent.js";
import type { Track } from "./track.js";
import type { DiscoveryMode } from "./discovery.js";

export type AppMode = "mock" | "live";

export interface SearchQueries {
  primary: string;
  alternatives: string[];
}

export interface InterpretResponse {
  mode: AppMode;
  intent: MusicIntent;
  notice?: string;
}

export interface SearchResponse {
  mode: AppMode;
  discoveryMode?: DiscoveryMode;
  intent: MusicIntent;
  queries: SearchQueries;
  tracks: Track[];
  notice?: string;
}

export interface StatusResponse {
  /** Mode used by POST /api/music/search. */
  mode: AppMode;
  /** Mode used by POST /api/music/interpret (only needs an AI provider). */
  interpretMode: AppMode;
  grok?: { configured: boolean; valid: boolean | null };
  gemini: { configured: boolean; valid: boolean | null };
  openai: { configured: boolean; valid: boolean | null };
  spotify: { configured: boolean; valid: boolean | null; authorized: boolean };
  /** Active primary AI provider: grok (top priority) | gemini | openai | mock */
  activeProvider?: "grok" | "gemini" | "openai" | "mock";
  /** Human-readable list of missing credentials / steps. Empty in live mode. */
  missing: string[];
}

export interface ErrorResponse {
  error: { code: string; message: string };
}

