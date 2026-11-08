import type { Track } from "../../types/track.js";

/** Subset of the Spotify track object we read. Every field is treated as optional. */
export interface SpotifyTrackObject {
  id?: string | null;
  name?: string | null;
  duration_ms?: number | null;
  preview_url?: string | null;
  is_playable?: boolean;
  external_urls?: { spotify?: string | null } | null;
  artists?: Array<{ name?: string | null } | null> | null;
  album?: {
    name?: string | null;
    release_date?: string | null;
    images?: Array<{ url?: string | null; width?: number | null; height?: number | null } | null> | null;
  } | null;
}

const PREFERRED_IMAGE_SIZE = 300;

/** Picks the image closest to ~300px (Spotify returns 640/300/64 variants). */
function pickImage(images: NonNullable<SpotifyTrackObject["album"]>["images"]): string | null {
  const valid = (images ?? []).filter((img): img is { url: string; width?: number | null } => Boolean(img?.url));
  if (valid.length === 0) return null;
  const sorted = [...valid].sort(
    (a, b) =>
      Math.abs((a.width ?? PREFERRED_IMAGE_SIZE) - PREFERRED_IMAGE_SIZE) -
      Math.abs((b.width ?? PREFERRED_IMAGE_SIZE) - PREFERRED_IMAGE_SIZE),
  );
  return sorted[0]!.url;
}

/**
 * Maps a raw Spotify track to our Track shape, tolerating missing metadata.
 * Returns null for unusable items (no id) or tracks not playable in the user's market.
 */
export function mapSpotifyTrack(raw: SpotifyTrackObject | null | undefined): Track | null {
  if (!raw?.id) return null;
  if (raw.is_playable === false) return null;

  const artists = (raw.artists ?? [])
    .map((a) => a?.name?.trim())
    .filter((name): name is string => Boolean(name));

  const rawDate = raw.album?.release_date;
  let releaseYear: number | null = null;
  if (rawDate && typeof rawDate === "string") {
    const yr = parseInt(rawDate.slice(0, 4), 10);
    if (!isNaN(yr) && yr > 1900 && yr < 2100) {
      releaseYear = yr;
    }
  }

  return {
    id: raw.id,
    name: raw.name?.trim() || "Unknown title",
    artists,
    album: raw.album?.name?.trim() || "Unknown album",
    albumArtUrl: pickImage(raw.album?.images),
    durationMs: typeof raw.duration_ms === "number" && raw.duration_ms >= 0 ? raw.duration_ms : null,
    spotifyUrl: raw.external_urls?.spotify || `https://open.spotify.com/track/${raw.id}`,
    previewUrl: raw.preview_url || null,
    releaseYear,
  };
}

