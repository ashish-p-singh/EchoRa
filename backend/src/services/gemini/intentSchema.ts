import { z } from "zod";
import {
  ENERGY_LEVELS,
  TEMPO_PREFERENCES,
  TIME_CONTEXTS,
  VOCAL_PREFERENCES,
  type Energy,
  type MusicIntent,
  type Tempo,
  type TimeContext,
  type VocalPreference,
} from "../../types/intent.js";

const MAX_GENRES = 3;

const cleanText = (val: unknown, maxLen = 40): string | null => {
  if (typeof val !== "string") return null;
  const s = val.toLowerCase().replace(/\s+/g, " ").trim().slice(0, maxLen);
  if (!s || s === "null" || s === "none" || s === "unspecified" || s === "any") return null;
  return s;
};

const cleanEnum = <T extends readonly string[]>(val: unknown, allowed: T): T[number] | null => {
  if (typeof val !== "string") return null;
  const s = val.toLowerCase().trim().replace(/[\s-]+/g, "_");
  return (allowed as readonly string[]).includes(s) ? (s as T[number]) : null;
};

const cleanGenreArray = (val: unknown): string[] => {
  if (!Array.isArray(val)) return [];
  const items = val
    .filter((g): g is string => typeof g === "string")
    .map((g) => g.toLowerCase().replace(/\s+/g, " ").trim().slice(0, 30))
    .filter((g) => g && g !== "none" && g !== "null" && g !== "unspecified");
  return [...new Set(items)].slice(0, MAX_GENRES);
};

/**
 * Raw response structure returned by Gemini.
 * Supports both the new categorized schema ({ explicit, inferred, optional })
 * and fallback parsing for flat schemas.
 */
export const geminiRawResponseSchema = z.object({
  explicit: z
    .object({
      mood: z.unknown().optional(),
      activity: z.unknown().optional(),
      energy: z.unknown().optional(),
      tempo: z.unknown().optional(),
      genre: z.unknown().optional(),
      vocals: z.unknown().optional(),
      time_context: z.unknown().optional(),
      language: z.unknown().optional(),
      era: z.unknown().optional(),
      track_title: z.unknown().optional(),
      trackTitle: z.unknown().optional(),
      artist: z.unknown().optional(),
    })
    .optional(),
  inferred: z
    .object({
      mood: z.unknown().optional(),
      activity: z.unknown().optional(),
      energy: z.unknown().optional(),
      tempo: z.unknown().optional(),
      vocals: z.unknown().optional(),
      time_context: z.unknown().optional(),
      language: z.unknown().optional(),
      era: z.unknown().optional(),
      track_title: z.unknown().optional(),
      trackTitle: z.unknown().optional(),
      artist: z.unknown().optional(),
    })
    .optional(),
  optional: z
    .object({
      genre: z.unknown().optional(),
    })
    .optional(),
  queries: z
    .object({
      moodQuery: z.unknown().optional(),
      genreQuery: z.unknown().optional(),
      contextQuery: z.unknown().optional(),
      masterQuery: z.unknown().optional(),
    })
    .optional(),
  sonicProfile: z
    .object({
      instruments: z.unknown().optional(),
      production: z.unknown().optional(),
      tempoDescription: z.unknown().optional(),
      emotionalSubtext: z.unknown().optional(),
      harmonicMode: z.unknown().optional(),
      vocalStyle: z.unknown().optional(),
      antiSonicAura: z
        .object({
          forbiddenInstruments: z.unknown().optional(),
          forbiddenVibes: z.unknown().optional(),
        })
        .optional(),
    })
    .optional(),
  // Flat legacy fields fallback
  mood: z.unknown().optional(),
  activity: z.unknown().optional(),
  energy: z.unknown().optional(),
  tempo: z.unknown().optional(),
  genre: z.unknown().optional(),
  vocals: z.unknown().optional(),
  time_context: z.unknown().optional(),
  language: z.unknown().optional(),
  era: z.unknown().optional(),
  track_title: z.unknown().optional(),
  trackTitle: z.unknown().optional(),
  artist: z.unknown().optional(),
});

const SITUATION_TO_CANONICAL_MOOD: Record<string, { mood: string; activity?: string }> = {
  breakup: { mood: "sad", activity: "breakup" },
  heartbreak: { mood: "sad", activity: "breakup" },
  heartbroken: { mood: "sad", activity: "breakup" },
  grief: { mood: "sad", activity: "grieving" },
  gym: { mood: "energetic", activity: "workout" },
  workout: { mood: "energetic", activity: "workout" },
  running: { mood: "energetic", activity: "running" },
  exercise: { mood: "energetic", activity: "workout" },
  study: { mood: "focused", activity: "studying" },
  studying: { mood: "focused", activity: "studying" },
  coding: { mood: "focused", activity: "coding" },
  work: { mood: "focused", activity: "working" },
  working: { mood: "focused", activity: "working" },
  sleep: { mood: "peaceful", activity: "sleeping" },
  sleeping: { mood: "peaceful", activity: "sleeping" },
  bedtime: { mood: "peaceful", activity: "sleeping" },
  party: { mood: "energetic", activity: "partying" },
  partying: { mood: "energetic", activity: "partying" },
  club: { mood: "energetic", activity: "partying" },
  wedding: { mood: "romantic", activity: "wedding" },
  date: { mood: "romantic", activity: "date" },
  rain: { mood: "melancholic", activity: "rainy day" },
  rainy: { mood: "melancholic", activity: "rainy day" },
  driving: { mood: "calm", activity: "driving" },
  drive: { mood: "calm", activity: "driving" },
};

/**
 * Transforms categorized preferences into the consolidated MusicIntent with prioritized breakdown.
 */
export function buildPrioritizedIntent(raw: z.infer<typeof geminiRawResponseSchema>): MusicIntent {
  const exp = raw.explicit ?? {};
  const inf = raw.inferred ?? {};
  const opt = raw.optional ?? {};

  // 1. Mood & Activity Normalization (map situations like "breakup" -> mood: "sad", activity: "breakup")
  let expMood = cleanText(exp.mood ?? raw.mood);
  let infMood = cleanText(inf.mood);
  let expActivity = cleanText(exp.activity ?? raw.activity);
  let infActivity = cleanText(inf.activity);

  if (expMood && SITUATION_TO_CANONICAL_MOOD[expMood]) {
    const mapping = SITUATION_TO_CANONICAL_MOOD[expMood]!;
    if (!expActivity && mapping.activity) expActivity = mapping.activity;
    expMood = mapping.mood;
  }
  if (infMood && SITUATION_TO_CANONICAL_MOOD[infMood]) {
    const mapping = SITUATION_TO_CANONICAL_MOOD[infMood]!;
    if (!infActivity && mapping.activity) infActivity = mapping.activity;
    infMood = mapping.mood;
  }

  const finalMood = expMood ?? infMood ?? "any";
  const moodBreakdown = expMood
    ? { value: expMood, source: "explicit" as const, priority: "high" as const }
    : infMood
      ? { value: infMood, source: "inferred" as const, priority: "medium" as const }
      : { value: null, source: "unspecified" as const, priority: "none" as const };

  // 2. Activity
  const finalActivity = expActivity ?? infActivity ?? null;
  const activityBreakdown = expActivity
    ? { value: expActivity, source: "explicit" as const, priority: "high" as const }
    : infActivity
      ? { value: infActivity, source: "inferred" as const, priority: "medium" as const }
      : { value: null, source: "unspecified" as const, priority: "none" as const };

  // 3. Vocals
  const expVocals = cleanEnum(exp.vocals ?? raw.vocals, VOCAL_PREFERENCES);
  const infVocals = cleanEnum(inf.vocals, VOCAL_PREFERENCES);
  const finalVocals = (expVocals ?? infVocals ?? "any") as VocalPreference;
  const vocalsBreakdown = expVocals && expVocals !== "any"
    ? { value: expVocals, source: "explicit" as const, priority: "medium_high" as const }
    : infVocals && infVocals !== "any"
      ? { value: infVocals, source: "inferred" as const, priority: "medium" as const }
      : { value: null, source: "unspecified" as const, priority: "none" as const };

  // 4. Energy
  const expEnergy = cleanEnum(exp.energy ?? raw.energy, ENERGY_LEVELS);
  const infEnergy = cleanEnum(inf.energy, ENERGY_LEVELS);
  const finalEnergy = (expEnergy ?? infEnergy ?? "medium") as Energy;
  const energyBreakdown = expEnergy
    ? { value: expEnergy, source: "explicit" as const, priority: "medium_high" as const }
    : infEnergy
      ? { value: infEnergy, source: "inferred" as const, priority: "low" as const }
      : { value: null, source: "unspecified" as const, priority: "none" as const };

  // 5. Tempo
  const expTempo = cleanEnum(exp.tempo ?? raw.tempo, TEMPO_PREFERENCES);
  const infTempo = cleanEnum(inf.tempo, TEMPO_PREFERENCES);
  const finalTempo = (expTempo ?? infTempo ?? "any") as Tempo;
  const tempoBreakdown = expTempo && expTempo !== "any"
    ? { value: expTempo, source: "explicit" as const, priority: "medium_high" as const }
    : infTempo && infTempo !== "any"
      ? { value: infTempo, source: "inferred" as const, priority: "low" as const }
      : { value: null, source: "unspecified" as const, priority: "none" as const };

  // 6. Genre
  const expGenres = cleanGenreArray(exp.genre ?? (raw.genre && !exp.genre ? raw.genre : undefined));
  const optGenres = cleanGenreArray(opt.genre);
  const mergedGenres = expGenres.length > 0 ? expGenres : optGenres;
  const genreBreakdown = expGenres.length > 0
    ? { value: expGenres, source: "explicit" as const, priority: "medium_high" as const }
    : optGenres.length > 0
      ? { value: optGenres, source: "optional" as const, priority: "low" as const }
      : { value: [] as string[], source: "unspecified" as const, priority: "none" as const };

  // 7. Time Context
  const expTime = cleanEnum(exp.time_context ?? raw.time_context, TIME_CONTEXTS);
  const infTime = cleanEnum(inf.time_context, TIME_CONTEXTS);
  const finalTime = (expTime ?? infTime ?? "any") as TimeContext;
  const timeBreakdown = expTime && expTime !== "any"
    ? { value: expTime, source: "explicit" as const, priority: "medium" as const }
    : infTime && infTime !== "any"
      ? { value: infTime, source: "inferred" as const, priority: "low" as const }
      : { value: null, source: "unspecified" as const, priority: "none" as const };

  // 8. Language, Era, Song & Artist Constraints
  const finalLanguage = cleanText(exp.language ?? raw.language ?? inf.language);
  const finalEra = cleanText(exp.era ?? raw.era ?? inf.era);
  const finalTrackTitle = cleanText(exp.track_title ?? (exp as Record<string, unknown>).trackTitle ?? raw.track_title ?? (raw as Record<string, unknown>).trackTitle);
  const finalArtist = cleanText(exp.artist ?? raw.artist);

  // 9. Multi Queries & Master Fallback
  const rawQ = raw.queries;
  const qMood = typeof rawQ?.moodQuery === "string" ? rawQ.moodQuery.trim() : null;
  const qGenre = typeof rawQ?.genreQuery === "string" ? rawQ.genreQuery.trim() : null;
  const qContext = typeof rawQ?.contextQuery === "string" ? rawQ.contextQuery.trim() : null;
  const qMaster = typeof rawQ?.masterQuery === "string" ? rawQ.masterQuery.trim() : undefined;
  const multiQueries = qMood && qGenre && qContext
    ? {
        moodQuery: qMood,
        genreQuery: qGenre,
        contextQuery: qContext,
        masterQuery: qMaster,
      }
    : undefined;

  // 10. Sonic Profile & Anti-Sonic Aura for Deep Reranking
  const rawSonic = raw.sonicProfile;
  let harmonicMode: "minor" | "major" | "modal_dissonant" | null = null;
  if (typeof rawSonic?.harmonicMode === "string") {
    const hm = rawSonic.harmonicMode.toLowerCase().trim();
    if (hm.includes("minor")) harmonicMode = "minor";
    else if (hm.includes("major")) harmonicMode = "major";
    else if (hm.includes("modal") || hm.includes("dissonant")) harmonicMode = "modal_dissonant";
  }

  const rawAnti = rawSonic?.antiSonicAura;
  let forbiddenVibes = Array.isArray(rawAnti?.forbiddenVibes)
    ? rawAnti!.forbiddenVibes.filter((v): v is string => typeof v === "string").slice(0, 5)
    : [];

  // Strictly disallow pure instrumental and background score unless user explicitly requested instrumental
  if (finalVocals !== "instrumental_preferred") {
    const instVibes = ["pure instrumental", "background score", "karaoke"];
    for (const iv of instVibes) {
      if (!forbiddenVibes.some((v) => v.toLowerCase().includes(iv))) {
        forbiddenVibes.push(iv);
      }
    }
  }

  const antiSonicAura = {
    forbiddenInstruments: Array.isArray(rawAnti?.forbiddenInstruments)
      ? rawAnti!.forbiddenInstruments.filter((i): i is string => typeof i === "string").slice(0, 5)
      : undefined,
    forbiddenVibes: forbiddenVibes.length > 0 ? forbiddenVibes : undefined,
  };

  const sonicProfile = rawSonic
    ? {
        instruments: Array.isArray(rawSonic.instruments)
          ? rawSonic.instruments.filter((i): i is string => typeof i === "string").slice(0, 4)
          : undefined,
        production: cleanText(rawSonic.production, 60),
        tempoDescription: cleanText(rawSonic.tempoDescription, 60),
        emotionalSubtext: cleanText(rawSonic.emotionalSubtext, 80),
        harmonicMode,
        vocalStyle: cleanText(rawSonic.vocalStyle, 80),
        antiSonicAura: (antiSonicAura?.forbiddenInstruments?.length || antiSonicAura?.forbiddenVibes?.length)
          ? antiSonicAura
          : undefined,
      }
    : undefined;

  return {
    mood: finalMood,
    activity: finalActivity,
    energy: finalEnergy,
    tempo: finalTempo,
    genre: mergedGenres,
    vocals: finalVocals,
    time_context: finalTime,
    language: finalLanguage,
    era: finalEra,
    trackTitle: finalTrackTitle,
    artist: finalArtist,
    sonicProfile,
    multiQueries,
    breakdown: {
      mood: moodBreakdown,
      activity: activityBreakdown,
      energy: energyBreakdown,
      tempo: tempoBreakdown,
      genre: genreBreakdown,
      vocals: vocalsBreakdown,
      time_context: timeBreakdown,
    },
  };
}

export const musicIntentSchema = geminiRawResponseSchema.transform(buildPrioritizedIntent);

/**
 * JSON Schema sent to Gemini (structured output).
 */
export const MUSIC_INTENT_JSON_SCHEMA = {
  type: "object",
  properties: {
    explicit: {
      type: "object",
      properties: {
        mood: { type: ["string", "null"], description: "Mood words directly stated by the user, or null" },
        activity: { type: ["string", "null"], description: "Activity/setting directly stated by user, or null" },
        energy: { type: ["string", "null"], enum: [...ENERGY_LEVELS, null] },
        tempo: { type: ["string", "null"], enum: [...TEMPO_PREFERENCES, null] },
        genre: { type: "array", items: { type: "string" }, description: "Only genres explicitly named by user" },
        vocals: { type: ["string", "null"], enum: ["instrumental_preferred", "vocals_preferred", null] },
        time_context: { type: ["string", "null"], enum: [...TIME_CONTEXTS, null] },
        language: { type: ["string", "null"], description: "Explicit language or culture, e.g. 'hindi', 'punjabi', 'spanish', or null" },
        era: { type: ["string", "null"], description: "Explicit era/decade, e.g. '1990s', '80s', '2000s', or null" },
        track_title: { type: ["string", "null"], description: "Specific song title if named in prompt (e.g. 'Tum Hi Ho', 'Kesariya'), or null" },
        artist: { type: ["string", "null"], description: "Specific artist if named in prompt (e.g. 'Arijit Singh', 'Coldplay'), or null" },
      },
      required: ["mood", "activity", "energy", "tempo", "genre", "vocals", "time_context", "language", "era", "track_title", "artist"],
    },
    inferred: {
      type: "object",
      properties: {
        mood: { type: ["string", "null"], description: "Mood reasonably inferred from context, or null" },
        activity: { type: ["string", "null"], description: "Activity reasonably inferred, or null" },
        energy: { type: ["string", "null"], enum: [...ENERGY_LEVELS, null] },
        tempo: { type: ["string", "null"], enum: [...TEMPO_PREFERENCES, null] },
        vocals: { type: ["string", "null"], enum: ["instrumental_preferred", "vocals_preferred", null] },
        time_context: { type: ["string", "null"], enum: [...TIME_CONTEXTS, null] },
        language: { type: ["string", "null"], description: "Language reasonably inferred from terms/script, or null" },
        era: { type: ["string", "null"], description: "Era reasonably inferred from context, or null" },
      },
      required: ["mood", "activity", "energy", "tempo", "vocals", "time_context", "language", "era"],
    },
    optional: {
      type: "object",
      properties: {
        genre: {
          type: "array",
          items: { type: "string" },
          maxItems: MAX_GENRES,
          description: "Optional suggested genres fitting the vibe, not requested by user",
        },
      },
      required: ["genre"],
    },
    queries: {
      type: "object",
      properties: {
        moodQuery: { type: "string", description: "Query capturing acoustic texture and instrumentation, with language if stated" },
        genreQuery: { type: "string", description: "Query with micro-genre and year:YYYY-YYYY operators, with language if stated" },
        contextQuery: { type: "string", description: "Query capturing curator phrasing and atmosphere, with language if stated" },
        masterQuery: { type: "string", description: "Concise rock-solid fallback query combining core genre, era, and language" },
      },
      required: ["moodQuery", "genreQuery", "contextQuery", "masterQuery"],
    },
    sonicProfile: {
      type: "object",
      properties: {
        instruments: {
          type: "array",
          items: { type: "string" },
          maxItems: 4,
          description: "Dominant instruments fitting this state (e.g. 'nylon guitar', 'felt piano', 'analog synth')",
        },
        production: {
          type: ["string", "null"],
          description: "Production texture (e.g. 'warm analog acoustic', 'lo-fi tape hiss', 'cold reverb')",
        },
        tempoDescription: {
          type: ["string", "null"],
          description: "Tempo cadence (e.g. 'slow unhurried 70bpm', 'moderate walking pace')",
        },
        emotionalSubtext: {
          type: ["string", "null"],
          description: "Concise emotional subtext (e.g. 'quiet bittersweet late-night solitude')",
        },
        harmonicMode: {
          type: ["string", "null"],
          enum: ["minor", "major", "modal_dissonant", null],
          description: "Harmonic key emotion: minor (melancholic/sad), major (joyful/bright), modal_dissonant (haunting/doomer)",
        },
        vocalStyle: {
          type: ["string", "null"],
          description: "Vocal delivery character (e.g. 'intimate, breathy melodic delivery; NO loud theatrical belting')",
        },
        antiSonicAura: {
          type: "object",
          properties: {
            forbiddenInstruments: {
              type: "array",
              items: { type: "string" },
              maxItems: 5,
              description: "Instruments strictly banned (e.g. ['phonk cowbell', 'trap 808s', 'loud brass fanfare'])",
            },
            forbiddenVibes: {
              type: "array",
              items: { type: "string" },
              maxItems: 5,
              description: "Musical vibes strictly banned (e.g. ['party dance track', 'club remix', 'theatrical belting'])",
            },
          },
          required: ["forbiddenInstruments", "forbiddenVibes"],
        },
      },
      required: ["instruments", "production", "tempoDescription", "emotionalSubtext", "harmonicMode", "vocalStyle", "antiSonicAura"],
    },
  },
  required: ["explicit", "inferred", "optional", "queries", "sonicProfile"],
  additionalProperties: false,
} as const;
