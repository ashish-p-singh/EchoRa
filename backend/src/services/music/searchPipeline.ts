import type { MusicIntent } from "../../types/intent.js";
import type { Track } from "../../types/track.js";
import type { SearchResponse } from "../../types/api.js";
import type { DiscoveryContext } from "../../types/discovery.js";
import type { IntentExtractor } from "../gemini/intentExtractor.js";
import type { SpotifySearch } from "../spotify/spotifySearch.js";
import { generateQueries } from "./queryGenerator.js";
import { defaultDiscoveryProcessor } from "./discoveryProcessor.js";
import { BACKEND_MOCK_TRACKS, getMockIntent } from "./mockMusic.js";
import { fuseTrackLists } from "./fusion.js";
import { createSemanticReranker, type SemanticReranker } from "../gemini/reranker.js";
import { logger } from "../../utils/logger.js";

export interface SearchPipelineOptions {
  intentExtractor: IntentExtractor | null;
  spotifySearch: SpotifySearch | null;
  reranker?: SemanticReranker | null;
}

export function createSearchPipeline({
  intentExtractor,
  spotifySearch,
  reranker,
}: SearchPipelineOptions) {
  const activeReranker = reranker ?? createSemanticReranker(null);

  return {
    async interpret(
      prompt: string,
      mode: "mock" | "live",
      discoveryContext?: DiscoveryContext,
      signal?: AbortSignal,
    ): Promise<{ mode: "mock" | "live"; intent: MusicIntent; notice?: string }> {
      const fallbackContext: DiscoveryContext = discoveryContext ?? {
        discoveryMode: "FAMILIAR",
        preferences: { favoriteGenres: [], favoriteArtists: [], dislikedGenres: [], dislikedArtists: [] },
        rawPrompt: prompt,
      };

      if (mode === "mock" || !intentExtractor) {
        const rawIntent = getMockIntent(prompt);
        const discoveryResult = defaultDiscoveryProcessor.process(fallbackContext, rawIntent);
        return {
          mode: "mock",
          intent: discoveryResult.adjustedIntent,
          notice: "Interpreted using mock simulation (Gemini not configured or unavailable).",
        };
      }
      const rawIntent = await intentExtractor(prompt, signal, fallbackContext);
      const discoveryResult = defaultDiscoveryProcessor.process(fallbackContext, rawIntent);
      return {
        mode: "live",
        intent: discoveryResult.adjustedIntent,
      };
    },

    async search(
      prompt: string,
      mode: "mock" | "live",
      missingReasons: string[],
      discoveryContext?: DiscoveryContext,
      signal?: AbortSignal,
    ): Promise<SearchResponse> {
      const fallbackContext: DiscoveryContext = discoveryContext ?? {
        discoveryMode: "FAMILIAR",
        preferences: { favoriteGenres: [], favoriteArtists: [], dislikedGenres: [], dislikedArtists: [] },
        rawPrompt: prompt,
      };

      if (mode === "mock" || !intentExtractor || !spotifySearch) {
        const rawIntent = getMockIntent(prompt);
        const discoveryResult = defaultDiscoveryProcessor.process(fallbackContext, rawIntent);
        const queries = generateQueries(discoveryResult.adjustedIntent, discoveryResult);
        const notice = missingReasons.length > 0 
          ? `Operating in Mock Mode: ${missingReasons.join(" ")}`
          : "Operating in Mock Mode with sample tracks.";
        return {
          mode: "mock",
          discoveryMode: discoveryResult.mode,
          intent: discoveryResult.adjustedIntent,
          queries,
          tracks: BACKEND_MOCK_TRACKS,
          notice,
        };
      }

      // Live mode
      // 1. Gemini extracts intent and 3 specialized Spotify queries with mode awareness
      const rawIntent = await intentExtractor(prompt, signal, fallbackContext);

      // 2. Discovery Preference Processor processes preferences & mode
      const discoveryResult = defaultDiscoveryProcessor.process(fallbackContext, rawIntent);
      const activeIntent = discoveryResult.adjustedIntent;

      // 3. Synthesize queries: use Gemini's multiQueries if present; fallback to queryGenerator
      const baseQueries = generateQueries(activeIntent, discoveryResult);
      const queryList: string[] = [];

      if (activeIntent.multiQueries) {
        if (activeIntent.multiQueries.moodQuery) queryList.push(activeIntent.multiQueries.moodQuery);
        if (activeIntent.multiQueries.genreQuery) queryList.push(activeIntent.multiQueries.genreQuery);
        if (activeIntent.multiQueries.contextQuery) queryList.push(activeIntent.multiQueries.contextQuery);
      }
      if (queryList.length === 0) {
        queryList.push(baseQueries.primary);
      }

      // If user specifically requested a song title, ensure exact song search query is prioritized
      if (activeIntent.trackTitle) {
        const titleQuery = activeIntent.artist
          ? `${activeIntent.trackTitle} ${activeIntent.artist}`
          : activeIntent.trackTitle;
        if (!queryList.some((q) => q.toLowerCase().includes(activeIntent.trackTitle!.toLowerCase()))) {
          queryList.unshift(titleQuery);
        }
      }

      function cleanSpotifyQuery(q: string, lang?: string | null): string {
        let cleaned = q.replace(/\bNOT\s+("[^"]*"|[^\s]+)/gi, "").trim();
        cleaned = cleaned.replace(/genre:"bollywood"/gi, "bollywood");
        cleaned = cleaned.replace(/genre:bollywood/gi, "bollywood");
        cleaned = cleaned.replace(/\s+/g, " ").trim();

        if (lang?.toLowerCase() === "hindi" && !cleaned.toLowerCase().includes("hindi") && !cleaned.toLowerCase().includes("bollywood")) {
          cleaned = `bollywood ${cleaned}`;
        }
        return cleaned;
      }

      const finalizedQueries = queryList.map((q) => cleanSpotifyQuery(q, activeIntent.language));
      const masterQueryStr = cleanSpotifyQuery(
        activeIntent.multiQueries?.masterQuery || baseQueries.primary,
        activeIntent.language,
      );

      // 4. Parallel Spotify Retrieval across query facets (15 tracks per facet = 45 candidates)
      const searchPromises = finalizedQueries.map(async (q) => {
        try {
          const tracks = await spotifySearch.searchTracks(q, 15, signal);
          logger.info(`[SpotifySearch] Query "${q}" returned ${tracks.length} tracks. Top: ${tracks.slice(0, 3).map(t => t.name).join(", ")}`);
          return tracks;
        } catch (err) {
          logger.warn(`Spotify search for "${q}" failed:`, err);
          return [] as Track[];
        }
      });
      const rawTrackLists = await Promise.all(searchPromises);

      // 5. In-Memory Reciprocal Rank Fusion (< 2ms)
      let fusedCandidates = fuseTrackLists(rawTrackLists, { maxCandidates: 35 });

      // Safety fallback: if fused candidates are sparse (< 10), search master query
      if (fusedCandidates.length < 10) {
        try {
          logger.info(`[SpotifySearch] Candidate pool sparse (${fusedCandidates.length}). Executing master fallback: "${masterQueryStr}"`);
          const fallbackTracks = await spotifySearch.searchTracks(masterQueryStr, 15, signal);
          const seenIds = new Set(fusedCandidates.map((t) => t.id));
          for (const t of fallbackTracks) {
            if (!seenIds.has(t.id)) {
              fusedCandidates.push(t);
              seenIds.add(t.id);
            }
          }
        } catch (err) {
          logger.warn(`[SpotifySearch] Master fallback search for "${masterQueryStr}" failed:`, err);
        }
      }

      const candidatesToUse = fusedCandidates.length > 0 ? fusedCandidates : BACKEND_MOCK_TRACKS.slice(0, 10);

      // 6. Gemini Semantic Reranker (with safety timeout and mode awareness)
      const finalTracks = await activeReranker.rerank(
        prompt,
        activeIntent,
        candidatesToUse,
        discoveryResult.mode,
        signal,
      );

      return {
        mode: "live",
        discoveryMode: discoveryResult.mode,
        intent: activeIntent,
        queries: {
          primary: masterQueryStr,
          alternatives: finalizedQueries,
        },
        tracks: finalTracks,
      };
    },
  };
}
