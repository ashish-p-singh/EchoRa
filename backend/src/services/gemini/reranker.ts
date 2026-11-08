import type { GeminiClient } from "./geminiClient.js";
import type { MusicIntent } from "../../types/intent.js";
import type { DiscoveryMode } from "../../types/discovery.js";
import type { Track } from "../../types/track.js";
import { logger } from "../../utils/logger.js";
import { normalizeSongTitle } from "../music/fusion.js";

const RERANKER_TIMEOUT_MS = 4500;

export function isMashupOrMix(track: Track): boolean {
  const text = `${track.name} ${track.artists.join(" ")} ${track.album}`.toLowerCase();
  return (
    text.includes("mashup") ||
    text.includes("mash up") ||
    text.includes("mash-up") ||
    text.includes("dj mix") ||
    text.includes("vdj") ||
    text.includes("lofi mix") ||
    text.includes("lo-fi mix") ||
    text.includes("chill mix") ||
    text.includes("remix") ||
    text.includes("medley") ||
    text.includes("club mix")
  );
}

/**
 * Detects whether a track is purely instrumental, karaoke, background score, or theme music.
 */
export function isInstrumentalTrack(track: Track): boolean {
  const title = track.name.toLowerCase();
  const album = (track.album || "").toLowerCase();
  const artists = track.artists.join(" ").toLowerCase();
  const fullText = `${title} ${artists} ${album}`;

  if (
    fullText.includes("instrumental") ||
    fullText.includes("karaoke") ||
    fullText.includes("backing track") ||
    fullText.includes("minus one")
  ) {
    return true;
  }

  const bgmOrScorePatterns = [
    /\b(bgm|original score|background score|film score|soundtrack score)\b/i,
    /\btheme\s+(music|tune|track|song)\b/i,
    /\b(flute|violin|sitar|piano|guitar|saxophone|shehnai|accordion|mandolin|cello|harp)\s+theme\b/i,
    /[-–—]\s*(theme|bgm|score|instrumental|karaoke)\b/i,
    /\((theme|bgm|score|instrumental|karaoke|original score|background score)\)/i,
    /\[(theme|bgm|score|instrumental|karaoke|original score|background score)\]/i,
  ];

  for (const pattern of bgmOrScorePatterns) {
    if (pattern.test(title) || pattern.test(album)) {
      return true;
    }
  }

  if (
    artists === "instrumental" ||
    artists.includes("karaoke") ||
    artists.includes("the piano guys") ||
    artists.includes("piano dreamers")
  ) {
    return true;
  }

  return false;
}

/**
 * Checks whether the user explicitly requested instrumental music in their prompt or intent.
 */
export function userWantsInstrumental(prompt: string, intent?: MusicIntent): boolean {
  if (intent?.vocals === "instrumental_preferred") return true;
  const p = prompt.toLowerCase();
  const keywords = [
    /\binstrumental\b/i,
    /\bbgm\b/i,
    /\bscore\b/i,
    /\bsoundtrack score\b/i,
    /\bpiano only\b/i,
    /\bguitar only\b/i,
    /\bacoustic only\b/i,
    /\bflute only\b/i,
    /\bviolin only\b/i,
    /\bno vocals\b/i,
    /\bno singing\b/i,
    /\bwithout vocals\b/i,
    /\bwithout lyrics\b/i,
    /\bwithout words\b/i,
    /\bno words\b/i,
    /\blofi\b/i,
    /\blo-fi\b/i,
    /\bambient\b/i,
    /\bclassical\b/i,
    /\borchestral\b/i,
    /\bkaraoke\b/i,
  ];
  return keywords.some((pattern) => pattern.test(p));
}

export function isTargetEra(track: Track, era: string | null | undefined): boolean {
  if (!era) return true;
  if (!track.releaseYear) return true; // keep if year unknown
  const e = era.toLowerCase();
  if (e.includes("90") || e.includes("1990")) {
    return track.releaseYear >= 1989 && track.releaseYear <= 2001;
  }
  if (e.includes("80") || e.includes("1980")) {
    return track.releaseYear >= 1979 && track.releaseYear <= 1991;
  }
  if (e.includes("70") || e.includes("1970")) {
    return track.releaseYear >= 1969 && track.releaseYear <= 1981;
  }
  if (e.includes("2000") || e.includes("00s")) {
    return track.releaseYear >= 1999 && track.releaseYear <= 2011;
  }
  return true;
}

export function isLanguageMatch(track: Track, language: string | null | undefined): boolean {
  if (!language) return true;
  const lang = language.toLowerCase();
  const fullText = `${track.name} ${track.artists.join(" ")} ${track.album}`.toLowerCase();

  if (lang === "hindi" || lang === "bollywood" || lang === "punjabi") {
    // Known non-Indian / Western leakage indicators
    const isWesternLeak =
      fullText.includes("dexter") ||
      fullText.includes("lil hann") ||
      fullText.includes("omen") ||
      fullText.includes("vlap") ||
      fullText.includes("trap beats") ||
      fullText.includes("drill beats") ||
      fullText.includes("country music");
    if (isWesternLeak) return false;

    // Non-Hindi regional language leaks
    if (lang === "hindi" || lang === "bollywood") {
      const isRegionalLeak =
        fullText.includes("malayalam") ||
        fullText.includes("telugu") ||
        fullText.includes("tamil") ||
        fullText.includes("kannada") ||
        fullText.includes("sreeraagamo") ||
        fullText.includes("pavithram");
      if (isRegionalLeak) return false;
    }
  } else if (lang === "russian") {
    // Purge non-Russian leaks (e.g. Indian/Western tracks that merely have 'Russian' in their title)
    const isLeak =
      fullText.includes("the weeknd") ||
      fullText.includes("key glock") ||
      fullText.includes("abbott & costello") ||
      fullText.includes("dhanda nyoliwala") ||
      fullText.includes("sidhu moose wala") ||
      fullText.includes("pravesh lion") ||
      fullText.includes("lucky thakur") ||
      fullText.includes("mahi jangid") ||
      fullText.includes("khush romana") ||
      fullText.includes("iann dior") ||
      fullText.includes("yak slid") ||
      fullText.includes("lil ") ||
      fullText.includes("trap beats") ||
      fullText.includes("drill beats") ||
      fullText.includes("young boy");
    if (isLeak) return false;
  } else if (lang === "spanish" || lang === "latin") {
    const isWesternLeak =
      fullText.includes("lil ") ||
      fullText.includes("drill beats") ||
      fullText.includes("country music");
    if (isWesternLeak) return false;
  }
  return true;
}

export function balanceTracks(
  tracks: Track[],
  maxMashups: number,
  era?: string | null,
  language?: string | null,
  allowInstrumental: boolean = true,
): Track[] {
  let mashupCount = 0;
  const targetEraTracks: Track[] = [];
  const otherEraTracks: Track[] = [];
  const seenTitles = new Set<string>();

  for (const t of tracks) {
    if (!allowInstrumental && isInstrumentalTrack(t)) continue;
    if (!isLanguageMatch(t, language)) continue;

    const norm = normalizeSongTitle(t.name) || t.name.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 15);
    if (seenTitles.has(norm)) continue;
    seenTitles.add(norm);

    const isMash = isMashupOrMix(t);
    if (isMash && mashupCount >= maxMashups) continue;
    if (isMash) mashupCount++;

    if (isTargetEra(t, era)) {
      targetEraTracks.push(t);
    } else {
      otherEraTracks.push(t);
    }
  }

  // Strict Era Gate: if an era was explicitly requested, NEVER append other-era tracks
  if (era) {
    return targetEraTracks.slice(0, 10);
  }

  const combined = [...targetEraTracks, ...otherEraTracks];
  return combined.slice(0, 10);
}

function buildRerankerSystemInstruction(discoveryMode: DiscoveryMode = "FAMILIAR"): string {
  const modeContext =
    discoveryMode === "EXPLORE"
      ? "Discovery Mode is EXPLORE: Prioritize fresh, lesser-known, textured tracks, and hidden gems that nail the emotional nuance over obvious top-40 chart hits."
      : discoveryMode === "BALANCED"
        ? "Discovery Mode is BALANCED: Balance well-loved iconic tracks with tasteful, high-quality adjacent discoveries."
        : "Discovery Mode is FAMILIAR: Prioritize definitive, widely celebrated, and iconic staples of that mood and style.";

  return `You are ECHORA's Semantic Music Reranker.
Given a user prompt, semantic listening intent (mood, energy, tempo, vocals preference, time context, language, era), sonic texture profile (instruments, production, tempo feel, emotional subtext), active discovery mode, and a candidate pool of tracks, select and rank the TOP 10 tracks that best embody the emotional and acoustic nuance.

${modeContext}

STRICT SELECTION RULES:
1. STRICT NO-INSTRUMENTAL RULE:
   - Unless user explicitly requested instrumental tracks (e.g. 'instrumental', 'bgm', 'score', 'piano only', 'lofi beats', 'ambient without vocals'):
     * Strictly DISQUALIFY and REJECT all purely instrumental tracks, background scores (BGM), karaoke versions, and theme tunes without lyrics.
     * All selected tracks MUST feature genuine vocal singing with lyrics.
2. VIBE PURITY (NO ARTIFICIAL PLAYLIST JOURNEYS):
   - DO NOT sequence as a playlist journey (no welcome tracks, warmups, or comedowns).
   - EVERY SINGLE TRACK in the top 10 MUST be an immediate, direct, high-affinity match for the requested mood and sonic texture.
   - Reject superficial keyword matches (e.g. upbeat dance songs that merely have 'sad' or 'rain' in their title).
2. STRICT ERA FILTER:
   - If user requested an era (e.g. '1990s' or '90s'), inspect the candidate's 'releaseYear'.
   - Tracks MUST be from that era (for 90s, releaseYear MUST be between 1990 and 1999).
   - REJECT tracks released in recent years (2010s, 2020s) and older decades (1960s, 1970s).
3. STRICT LANGUAGE & CULTURAL ORIGIN:
   - If user requested a language (e.g. 'hindi'):
     * Tracks MUST be genuinely in that language or from that musical culture (Bollywood, Hindi film, Indian indie).
     * Songs with English words in their title (e.g. 'Love You Zindagi', 'Acoustic', 'Tonight') ARE ACCEPTABLE IF the song/artist is genuinely Hindi/Indian.
     * PURE Western/English rap, hip-hop, pop, or unrelated regional songs (e.g. Malayalam, Tamil, Telugu unless Hindi requested) MUST BE STRICTLY ELIMINATED.
   - If user requested 'russian', 'spanish', 'japanese', or other language, tracks must genuinely belong to that culture.
4. ANTI-SONIC AURA & VOCAL STYLE DISQUALIFICATION:
   - Inspect each candidate against the provided 'antiSonicAura' (forbiddenInstruments and forbiddenVibes) and 'vocalStyle'.
   - DISQUALIFY any candidate track that features forbidden instruments (e.g. trap 808s, phonk cowbells, high-tempo synthesized dance beats) or forbidden vibes (e.g. party dance tracks, club remixes, aggressive drill, theatrical drama belting), even if the song title contains the search keyword!
   - Ensure vocal delivery matches 'vocalStyle' (e.g. if the user wants quiet, peaceful acoustic music, discard loud theatrical shouting, upbeat party singing, or high-energy drama).
5. ORIGINAL VS MASHUP BALANCE:
   - Prioritize authentic original artist/film soundtrack versions (at least 8 out of 10 tracks).
   - Allow AT MOST 1 or 2 tasteful mashups or chill mixes in the entire final 10; NEVER allow mashups or DJ edits to dominate.
6. SPECIFIC SONG TITLE / ARTIST PRIORITY:
   - If the user explicitly requested a specific song title (e.g. 'Tum Hi Ho') or artist, find that track in the candidate pool and place it at RANK #1!
   - Follow with the closest authentic acoustic/original companion tracks or soundtrack tracks from the same film/artist.
7. NO REPEATED / DUPLICATE SONGS:
   - NEVER select the exact same song more than once, even if Spotify lists it under different albums (e.g. single version vs movie soundtrack album vs compilation). Every selected track must be a distinct musical composition.
8. Select up to 10 best-matching tracks in order of emotional and acoustic affinity.
9. For each selected track, provide a concise, evocative 'matchReason' (1 brief sentence, max 15 words) explaining why its instrumentation, tempo, or texture fits the user's vibe and discovery mode.
10. Output strict JSON matching the schema.`;
}

const RERANKER_JSON_SCHEMA = {
  type: "object",
  properties: {
    rankedTracks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          matchReason: { type: "string", description: "Brief 1-sentence reason why this track fits the vibe" },
        },
        required: ["id", "matchReason"],
      },
    },
  },
  required: ["rankedTracks"],
  additionalProperties: false,
} as const;

interface RerankerResponse {
  rankedTracks?: Array<{ id: string; matchReason: string }>;
}

export interface PreferenceProfile {
  favoriteArtists?: string[];
  dislikedArtists?: string[];
  familiarityWeight?: number;
}

export interface SemanticReranker {
  rerank(
    prompt: string,
    intent: MusicIntent,
    candidates: Track[],
    discoveryMode?: DiscoveryMode,
    signal?: AbortSignal,
    userPreferences?: PreferenceProfile,
  ): Promise<Track[]>;
}

export function createSemanticReranker(geminiClient: GeminiClient | null): SemanticReranker {
  return {
    async rerank(
      prompt: string,
      intent: MusicIntent,
      candidates: Track[],
      discoveryMode: DiscoveryMode = "FAMILIAR",
      signal?: AbortSignal,
      userPreferences?: PreferenceProfile,
    ): Promise<Track[]> {
      if (!candidates || candidates.length === 0) return [];
      const allowInstrumental = userWantsInstrumental(prompt, intent);
      const promptWantsMashup = prompt.toLowerCase().includes("mashup") || prompt.toLowerCase().includes("mix");
      const MAX_MASHUPS = promptWantsMashup ? 10 : 2;

      if (!geminiClient || candidates.length <= 1) {
        const balanced = balanceTracks(candidates, MAX_MASHUPS, intent.era, intent.language, allowInstrumental);
        return balanced.map((t) => ({
          ...t,
          matchReason: t.matchReason || `Matches ${intent.mood || "selected"} mood and acoustic style.`,
        }));
      }

      // Enforce 4500ms safety timeout
      const timeout = AbortSignal.timeout(RERANKER_TIMEOUT_MS);
      const abortSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;

      // Prioritize exact song title matches at top of candidate list if user searched for a specific song
      let sortedCandidates = [...candidates];
      if (intent.trackTitle) {
        const titleLower = intent.trackTitle.toLowerCase();
        sortedCandidates.sort((a, b) => {
          const aMatch = a.name.toLowerCase().includes(titleLower) ? 1 : 0;
          const bMatch = b.name.toLowerCase().includes(titleLower) ? 1 : 0;
          return bMatch - aMatch;
        });
      }

      // Filter out pure instrumental tracks before sending candidate pool to Gemini unless user asked for instrumental
      let eligibleCandidates = allowInstrumental
        ? sortedCandidates
        : sortedCandidates.filter((t) => !isInstrumentalTrack(t));
      if (eligibleCandidates.length < 5) {
        eligibleCandidates = sortedCandidates;
      }

      try {
        const candidatePayload = eligibleCandidates.slice(0, 20).map((t, idx) => ({
          id: t.id,
          title: t.name,
          artists: t.artists.join(", "),
          album: t.album,
          releaseYear: t.releaseYear ?? "unknown",
          candidateRank: idx + 1,
        }));

        const userText = JSON.stringify({
          userPrompt: prompt,
          discoveryMode,
          intent: {
            mood: intent.mood,
            activity: intent.activity,
            energy: intent.energy,
            tempo: intent.tempo,
            vocals: intent.vocals,
            timeContext: intent.time_context,
            genres: intent.genre,
            language: intent.language,
            era: intent.era,
            trackTitle: intent.trackTitle,
            artist: intent.artist,
          },
          sonicProfile: intent.sonicProfile,
          userPreferences: userPreferences ?? undefined,
          candidates: candidatePayload,
        });

        const rawJson = await geminiClient.generateJson({
          userText,
          systemInstruction: buildRerankerSystemInstruction(discoveryMode),
          jsonSchema: RERANKER_JSON_SCHEMA,
          signal: abortSignal,
        });

        const parsed = JSON.parse(rawJson) as RerankerResponse;
        const rankedIds = parsed.rankedTracks || [];

        if (!Array.isArray(rankedIds) || rankedIds.length === 0) {
          logger.warn("[Reranker] Received empty rankedTracks from model. Preserving candidate order.");
          const balanced = balanceTracks(candidates, MAX_MASHUPS, intent.era, intent.language, allowInstrumental);
          return balanced.map((t) => ({
            ...t,
            matchReason: t.matchReason || `Selected for ${intent.mood || "acoustic"} profile.`,
          }));
        }

        const candidateMap = new Map<string, Track>();
        candidates.forEach((t) => candidateMap.set(t.id, t));

        const rerankedList: Track[] = [];
        const seenIds = new Set<string>();
        const seenTitles = new Set<string>();
        let mashupCount = 0;

        for (const item of rankedIds) {
          const matched = candidateMap.get(item.id);
          if (matched && !seenIds.has(item.id)) {
            if (!allowInstrumental && isInstrumentalTrack(matched)) continue;
            if (!isLanguageMatch(matched, intent.language)) continue;
            if (!isTargetEra(matched, intent.era)) continue;

            const norm = normalizeSongTitle(matched.name) || matched.name.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 15);
            if (seenTitles.has(norm)) continue;

            const isMash = isMashupOrMix(matched);
            if (isMash && mashupCount >= MAX_MASHUPS) continue;
            if (isMash) mashupCount++;

            seenIds.add(item.id);
            seenTitles.add(norm);
            rerankedList.push({
              ...matched,
              matchReason: item.matchReason?.trim() || `Matches ${intent.mood || "selected"} mood.`,
            });
          }
        }

        // Fill up to 10 from original candidates respecting era, language, and instrumental preference
        if (rerankedList.length < 10) {
          const remainingCandidates = candidates.filter((t) => !seenIds.has(t.id) && (allowInstrumental || !isInstrumentalTrack(t)));
          const balancedRemaining = balanceTracks(
            remainingCandidates,
            MAX_MASHUPS - mashupCount,
            intent.era,
            intent.language,
            allowInstrumental,
          );
          for (const track of balancedRemaining) {
            const norm = normalizeSongTitle(track.name) || track.name.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 15);
            if (seenTitles.has(norm)) continue;
            seenTitles.add(norm);
            seenIds.add(track.id);
            rerankedList.push({
              ...track,
              matchReason: track.matchReason || `Matches ${intent.mood || "acoustic"} profile.`,
            });
            if (rerankedList.length >= 10) break;
          }
        }

        return rerankedList.slice(0, 10);
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        logger.warn(`[Reranker] Semantic reranker skipped or timed out (${errorMsg}). Using balanced candidate ranking.`);
        const balanced = balanceTracks(candidates, MAX_MASHUPS, intent.era, intent.language, allowInstrumental);
        return balanced.map((t) => ({
          ...t,
          matchReason: t.matchReason || `Matches ${intent.mood || "selected"} mood and acoustic style.`,
        }));
      }
    },
  };
}
