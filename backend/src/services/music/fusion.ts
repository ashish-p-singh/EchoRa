import type { Track } from "../../types/track.js";

export interface FusionOptions {
  /** Smoothing constant in RRF formula (standard default is 60) */
  k?: number;
  /** Maximum candidate tracks to return */
  maxCandidates?: number;
}

/**
 * Normalizes a song title by stripping movie tags, parentheticals, and remaster suffixes.
 * E.g., 'Tum Hi Ho (From "Aashiqui 2")' and 'Tum Hi Ho' both normalize to 'tumhiho'.
 */
export function normalizeSongTitle(name: string): string {
  if (!name) return "";
  let cleaned = name.toLowerCase();

  // Strip parentheticals or brackets: (From "..."), [From "..."], (Remastered), (Original Motion Picture Soundtrack), etc.
  cleaned = cleaned.replace(/\s*[\(\[][^\)\]]*[\)\]]/gi, "");

  // Strip trailing " - From ...", " - Original ...", " - Movie ...", " - Title Track"
  cleaned = cleaned.replace(/\s+-\s+(from|original|soundtrack|remastered|movie|theme|title track|single|deluxe|version).*/gi, "");

  // Strip non-alphanumeric characters
  cleaned = cleaned.replace(/[^a-z0-9]/g, "");

  return cleaned.trim();
}

/**
 * Merges and ranks track lists from multiple parallel queries using Reciprocal Rank Fusion (RRF).
 * Formula: RRF(d) = sum_{q in Q} 1 / (k + rank_q(d))
 *
 * Tracks that appear across multiple query angles (e.g. both mood and genre queries)
 * receive higher consensus rank. Duplicate tracks (including movie soundtrack copies) are unified.
 */
export function fuseTrackLists(
  trackLists: Track[][],
  options: FusionOptions = {},
): Track[] {
  const k = options.k ?? 60;
  const maxCandidates = options.maxCandidates ?? 20;

  const scoreMap = new Map<string, { track: Track; score: number; occurrences: number }>();
  const titleToKey = new Map<string, string>();

  for (const list of trackLists) {
    if (!Array.isArray(list)) continue;
    for (let rank = 0; rank < list.length; rank++) {
      const track = list[rank];
      if (!track || !track.id) continue;

      const normTitle = normalizeSongTitle(track.name);
      // Check if already mapped by Spotify ID or by normalized song title
      const existingKey = scoreMap.has(track.id)
        ? track.id
        : normTitle && normTitle.length >= 3
          ? titleToKey.get(normTitle)
          : undefined;

      const existing = existingKey ? scoreMap.get(existingKey) : undefined;
      const points = 1 / (k + rank + 1);

      if (existing) {
        existing.score += points;
        existing.occurrences += 1;
        // Preserve richest track metadata if art or preview was previously null
        if (!existing.track.albumArtUrl && track.albumArtUrl) {
          existing.track.albumArtUrl = track.albumArtUrl;
        }
        if (!existing.track.previewUrl && track.previewUrl) {
          existing.track.previewUrl = track.previewUrl;
        }
        // If existing is an instrumental/karaoke copy and incoming is vocal, let vocal take over
        const isExistingInst = /\b(instrumental|karaoke|bgm|score|theme)\b/i.test(existing.track.name);
        const isIncomingInst = /\b(instrumental|karaoke|bgm|score|theme)\b/i.test(track.name);
        if (isExistingInst && !isIncomingInst) {
          existing.track = { ...track };
        } else if (track.name.length < existing.track.name.length && !track.name.includes("(")) {
          // If the new track has cleaner/shorter name without parentheses, prefer it
          existing.track.name = track.name;
        }
      } else {
        scoreMap.set(track.id, {
          track: { ...track },
          score: points,
          occurrences: 1,
        });
        if (normTitle && normTitle.length >= 3) {
          titleToKey.set(normTitle, track.id);
        }
      }
    }
  }

  return Array.from(scoreMap.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, maxCandidates)
    .map((item) => item.track);
}

