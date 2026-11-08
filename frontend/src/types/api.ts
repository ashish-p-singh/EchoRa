/**
 * API contract types shared by the UI and the data clients.
 * These mirror the backend response shapes so the mock client can be
 * swapped for the real HTTP client without touching UI components.
 */

import type { DiscoveryMode } from "./discovery";

export type Energy = "low" | "medium" | "high";
export type Tempo = "slow" | "medium" | "fast" | "any";
export type VocalPreference = "instrumental_preferred" | "vocals_preferred" | "any";
export type TimeContext = "morning" | "afternoon" | "evening" | "late_night" | "any";

export interface MusicIntent {
  mood: string;
  activity: string | null;
  energy: Energy;
  tempo: Tempo;
  genre: string[];
  vocals: VocalPreference;
  time_context: TimeContext;
  language?: string | null;
  era?: string | null;
  trackTitle?: string | null;
  artist?: string | null;
  sonicProfile?: {
    instruments?: string[];
    production?: string | null;
    tempoDescription?: string | null;
    emotionalSubtext?: string | null;
    harmonicMode?: 'minor' | 'major' | 'modal_dissonant' | null;
    vocalStyle?: string | null;
    antiSonicAura?: {
      forbiddenInstruments?: string[];
      forbiddenVibes?: string[];
    };
  };
  multiQueries?: {
    moodQuery: string;
    genreQuery: string;
    contextQuery: string;
    masterQuery?: string;
  };
}

export interface Track {
  id: string;
  name: string;
  artists: string[];
  album: string;
  albumArtUrl: string | null;
  durationMs: number | null;
  spotifyUrl: string;
  previewUrl: string | null;
  releaseYear?: number | null;
  matchReason?: string | null;
}

export type AppMode = "mock" | "live";

export interface SearchQueries {
  primary: string;
  alternatives: string[];
}

export interface SearchResponse {
  mode: AppMode;
  discoveryMode?: DiscoveryMode;
  intent: MusicIntent;
  queries: SearchQueries;
  tracks: Track[];
  /** Optional human-readable notice, e.g. why the app is in mock mode. */
  notice?: string;
  provider?: 'grok' | 'gemini' | 'openai' | 'mock';
}

export interface StatusResponse {
  mode: AppMode;
  interpretMode: AppMode;
  grok?: { configured: boolean; valid: boolean | null };
  gemini: { configured: boolean; valid: boolean | null };
  openai: { configured: boolean; valid: boolean | null };
  spotify: { configured: boolean; valid: boolean | null; authorized: boolean };
  activeProvider?: "grok" | "gemini" | "openai" | "mock";
  missing: string[];
}

