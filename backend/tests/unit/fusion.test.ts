import { describe, it, expect } from "vitest";
import { fuseTrackLists } from "../../src/services/music/fusion.js";
import type { Track } from "../../src/types/track.js";

const makeTrack = (id: string, name: string): Track => ({
  id,
  name,
  artists: ["Artist " + id],
  album: "Album " + id,
  albumArtUrl: null,
  durationMs: 180000,
  spotifyUrl: `https://open.spotify.com/track/${id}`,
  previewUrl: null,
});

describe("Reciprocal Rank Fusion (fusion.ts)", () => {
  it("merges and deduplicates tracks from multiple query lists", () => {
    const listA = [makeTrack("1", "Song 1"), makeTrack("2", "Song 2")];
    const listB = [makeTrack("2", "Song 2"), makeTrack("3", "Song 3")];

    const fused = fuseTrackLists([listA, listB]);
    expect(fused.map((t) => t.id)).toEqual(["2", "1", "3"]);
    // "2" appeared in both lists, so its RRF score must be highest!
    expect(fused[0]?.id).toBe("2");
  });

  it("handles empty lists gracefully", () => {
    const fused = fuseTrackLists([[], []]);
    expect(fused).toEqual([]);
  });

  it("caps results at maxCandidates", () => {
    const list = Array.from({ length: 30 }, (_, i) => makeTrack(String(i), `Song ${i}`));
    const fused = fuseTrackLists([list], { maxCandidates: 10 });
    expect(fused.length).toBe(10);
    expect(fused[0]?.id).toBe("0");
  });

  it("preserves richest metadata when merging duplicates", () => {
    const trackNoArt: Track = { ...makeTrack("1", "Song 1"), albumArtUrl: null };
    const trackWithArt: Track = { ...makeTrack("1", "Song 1"), albumArtUrl: "https://art.jpg", previewUrl: "https://preview.mp3" };

    const fused = fuseTrackLists([[trackNoArt], [trackWithArt]]);
    expect(fused[0]?.albumArtUrl).toBe("https://art.jpg");
    expect(fused[0]?.previewUrl).toBe("https://preview.mp3");
  });

  it("unifies duplicate songs with movie soundtrack parentheticals (e.g. Tum Hi Ho)", () => {
    const trackOriginal = makeTrack("sp1", "Tum Hi Ho");
    const trackMovie = makeTrack("sp2", "Tum Hi Ho (From \"Aashiqui 2\")");

    const fused = fuseTrackLists([[trackOriginal], [trackMovie]]);
    expect(fused.length).toBe(1); // Merged into 1 unified track!
    expect(fused[0]?.name).toBe("Tum Hi Ho");
  });
});

