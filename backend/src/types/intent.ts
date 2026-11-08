/**
 * Structured intent extracted from the user's natural-language request.
 * Produced by the Gemini service from the user's prompt ONLY.
 */
export const ENERGY_LEVELS = ["low", "medium", "high"] as const;
export const TEMPO_PREFERENCES = ["slow", "medium", "fast", "any"] as const;
export const VOCAL_PREFERENCES = ["instrumental_preferred", "vocals_preferred", "any"] as const;
export const TIME_CONTEXTS = ["morning", "afternoon", "evening", "late_night", "any"] as const;

export type Energy = (typeof ENERGY_LEVELS)[number];
export type Tempo = (typeof TEMPO_PREFERENCES)[number];
export type VocalPreference = (typeof VOCAL_PREFERENCES)[number];
export type TimeContext = (typeof TIME_CONTEXTS)[number];

/** Priority levels for extracted preferences */
export const PRIORITY_LEVELS = ["high", "medium_high", "medium", "low", "none"] as const;
export type PriorityLevel = (typeof PRIORITY_LEVELS)[number];

export interface CategorizedPreference<T> {
  value: T;
  source: "explicit" | "inferred" | "optional" | "unspecified";
  priority: PriorityLevel;
}

export interface AntiSonicAura {
  /** Instruments strictly banned from this vibe (e.g. ["phonk cowbell", "trap 808s", "loud brass"]) */
  forbiddenInstruments?: string[];
  /** Musical energy or sub-genres strictly banned (e.g. ["party dance track", "club remix", "theatrical belting"]) */
  forbiddenVibes?: string[];
}

export interface SonicProfile {
  /** Target instruments or acoustic textures, e.g. ["nylon guitar", "felt piano"] */
  instruments?: string[];
  /** Production texture, e.g. "warm analog acoustic" or "cold reverb synth" */
  production?: string | null;
  /** Tempo description, e.g. "slow unhurried cadence" */
  tempoDescription?: string | null;
  /** Emotional subtext, e.g. "quiet bittersweet nostalgic longing" */
  emotionalSubtext?: string | null;
  /** Harmonic key emotion: minor (melancholic/sad/serious), major (bright/joyful), modal_dissonant (haunting) */
  harmonicMode?: "minor" | "major" | "modal_dissonant" | null;
  /** Vocal style & delivery (e.g. "intimate, breathy, melodic; NO loud theatrical belting or aggressive rap") */
  vocalStyle?: string | null;
  /** Negative audio constraints that disqualify candidate songs */
  antiSonicAura?: AntiSonicAura;
}

export interface MultiQueries {
  moodQuery: string;
  genreQuery: string;
  contextQuery: string;
  masterQuery?: string;
}

/**
 * Enhanced intent representation distinguishing explicit, inferred, and optional preferences
 * while maintaining backward compatibility with the frontend MusicIntent contract.
 */
export interface MusicIntent {
  /** Primary mood, e.g. "calm", "peaceful", or "any" if not stated */
  mood: string;
  /** Activity/context, e.g. "studying", null when not mentioned */
  activity: string | null;
  energy: Energy;
  tempo: Tempo;
  /** 0-3 lowercase genre keywords */
  genre: string[];
  vocals: VocalPreference;
  time_context: TimeContext;

  /** Explicitly stated or strongly implied language (e.g. "hindi", "punjabi", "spanish") */
  language?: string | null;
  /** Explicitly stated or strongly implied era / decade (e.g. "1990s", "80s", "retro") */
  era?: string | null;

  /** Specific track title if user is looking for a particular song */
  trackTitle?: string | null;
  /** Specific artist if user is looking for a particular artist */
  artist?: string | null;

  /** Acoustic and emotional sonic profile for semantic depth reranking */
  sonicProfile?: SonicProfile;

  /** Multi-facet Spotify queries authored directly by the semantic engine */
  multiQueries?: MultiQueries;

  /** Detailed classification & prioritization breakdown (internal & intelligence engine) */
  breakdown?: {
    mood: CategorizedPreference<string | null>;
    activity: CategorizedPreference<string | null>;
    energy: CategorizedPreference<Energy | null>;
    tempo: CategorizedPreference<Tempo | null>;
    genre: CategorizedPreference<string[]>;
    vocals: CategorizedPreference<VocalPreference | null>;
    time_context: CategorizedPreference<TimeContext | null>;
  };
}
