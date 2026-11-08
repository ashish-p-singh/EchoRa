import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ExternalLink,
  Music,
  X,
  Disc3,
  Clock,
  Heart,
  Ban,
  Copy,
  Check,
  Sparkles,
  Headphones,
} from 'lucide-react';
import type { Track } from '../types';
import { formatDuration } from '../lib/format';
import { SpotifyIcon } from './ConnectSpotifyButton';
import { PreviewButton } from './PreviewButton';
import {
  getStoredProfile,
  addPreference,
  removePreference,
} from '../services/preferenceStorage';

interface SongDetailsDialogProps {
  track: Track;
  onClose: () => void;
  isPreviewPlaying?: boolean;
  previewProgress?: number;
  onTogglePreview?: (track: Track) => void;
}

export function SongDetailsDialog({
  track,
  onClose,
  isPreviewPlaying = false,
  previewProgress = 0,
  onTogglePreview,
}: SongDetailsDialogProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const shouldReduceMotion = useReducedMotion();

  const [profile, setProfile] = useState(() => getStoredProfile());
  const [copied, setCopied] = useState(false);

  const artists = track.artists?.length ? track.artists : ['Unknown Artist'];
  const primaryArtist = artists[0];
  const artistText = artists.join(', ');
  const durationText = formatDuration(track.durationMs);

  const isFavoriteArtist = profile.preferences.favoriteArtists.some(
    (a) => a.toLowerCase() === primaryArtist.toLowerCase(),
  );
  const isDislikedArtist = profile.preferences.dislikedArtists.some(
    (a) => a.toLowerCase() === primaryArtist.toLowerCase(),
  );

  useEffect(() => {
    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [onClose]);

  const handleToggleFavorite = () => {
    if (!primaryArtist || primaryArtist === 'Unknown Artist') return;
    if (isFavoriteArtist) {
      setProfile(removePreference('favoriteArtists', primaryArtist));
    } else {
      if (isDislikedArtist) {
        removePreference('dislikedArtists', primaryArtist);
      }
      setProfile(addPreference('favoriteArtists', primaryArtist));
    }
  };

  const handleToggleDislike = () => {
    if (!primaryArtist || primaryArtist === 'Unknown Artist') return;
    if (isDislikedArtist) {
      setProfile(removePreference('dislikedArtists', primaryArtist));
    } else {
      if (isFavoriteArtist) {
        removePreference('favoriteArtists', primaryArtist);
      }
      setProfile(addPreference('dislikedArtists', primaryArtist));
    }
  };

  const handleCopySpotifyLink = async () => {
    try {
      await navigator.clipboard.writeText(track.spotifyUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback ignored
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop matching PreferencesModal */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: shouldReduceMotion ? 0.1 : 0.2 }}
        onMouseDown={onClose}
        className="fixed inset-0 bg-ink/80 backdrop-blur-md"
      />

      {/* Modal Window matching PreferencesModal */}
      <motion.section
        role="dialog"
        aria-modal="true"
        aria-labelledby="song-detail-title"
        initial={{
          opacity: 0,
          scale: shouldReduceMotion ? 1 : 0.95,
          y: shouldReduceMotion ? 0 : 15,
        }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{
          opacity: 0,
          scale: shouldReduceMotion ? 1 : 0.95,
          y: shouldReduceMotion ? 0 : 15,
        }}
        transition={
          shouldReduceMotion
            ? { duration: 0.12 }
            : { type: 'spring', damping: 26, stiffness: 340 }
        }
        className="relative w-full max-w-lg glass-panel bg-ink/90 border border-white/15 p-6 rounded-2xl shadow-glass-elevated z-10 flex flex-col max-h-[85vh] overflow-hidden"
      >
        {/* Structured Header Bar */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-violet/20 border border-violet/30 flex items-center justify-center text-violet">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <p className="font-display font-bold text-base sm:text-lg text-text leading-tight">
                Track Inspector
              </p>
              <p className="text-xs text-text-dim">
                Detailed metadata, preview & taste personalization
              </p>
            </div>
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close song details"
            className="w-8 h-8 rounded-full flex items-center justify-center text-text-dim hover:text-text hover:bg-white/10 transition-colors cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto space-y-4 py-4 pr-0.5">
          {/* Hero Track Showcase Card */}
          <div className="relative rounded-xl bg-white/[0.04] border border-white/10 p-4 flex items-center gap-4 overflow-hidden">
            {/* Subtle Ambient Mood Glow */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-10 -top-10 w-40 h-40 rounded-full opacity-25 blur-2xl"
              style={{
                background:
                  'radial-gradient(circle, var(--mood-primary, #8B5CF6), transparent 70%)',
              }}
            />

            {/* Compact Refined Album Cover */}
            <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden shrink-0 bg-white/[0.04] border border-white/15 flex items-center justify-center shadow-lg">
              {track.albumArtUrl ? (
                <img
                  src={track.albumArtUrl}
                  alt={`${track.album} album cover`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-tr from-violet/30 to-cyan/30 flex items-center justify-center">
                  <Music className="w-8 h-8 text-text-dim" />
                </div>
              )}

              {track.previewUrl && onTogglePreview && (
                <PreviewButton
                  isPlaying={isPreviewPlaying}
                  progress={isPreviewPlaying ? previewProgress : 0}
                  onToggle={() => onTogglePreview(track)}
                />
              )}
            </div>

            {/* Track Title & Primary Info */}
            <div className="flex-1 min-w-0 z-10">
              <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-violet/20 border border-violet/30 text-violet-light">
                  <Disc3 className="w-2.5 h-2.5" />
                  <span>Spotify Catalog</span>
                </span>
                {track.previewUrl && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-cyan/15 border border-cyan/30 text-cyan">
                    <Headphones className="w-2.5 h-2.5" />
                    <span>30s Preview</span>
                  </span>
                )}
              </div>

              <h2
                id="song-detail-title"
                className="font-display font-bold text-base sm:text-lg text-text leading-snug line-clamp-2"
                title={track.name}
              >
                {track.name}
              </h2>

              <p
                className="text-xs sm:text-sm font-medium text-text-dim truncate mt-1"
                title={artistText}
              >
                {artistText}
              </p>
            </div>
          </div>

          {/* AI Match Reason Callout */}
          {track.matchReason && (
            <div className="p-3 rounded-xl bg-violet/10 border border-violet/25 flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-violet shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <span className="block text-[10px] font-semibold uppercase tracking-wider text-violet-light">
                  AI Vibe Match Reason
                </span>
                <p className="text-xs text-text-dim mt-0.5 leading-relaxed">
                  {track.matchReason}
                </p>
              </div>
            </div>
          )}

          {/* Structured Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* Album Box */}
            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 flex items-start gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-violet/15 border border-violet/25 flex items-center justify-center text-violet-light shrink-0 mt-0.5">
                <Disc3 className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="block text-[10px] font-semibold uppercase tracking-wider text-text-faint">
                  Album Release
                </span>
                <span
                  className="block text-xs font-medium text-text truncate mt-0.5"
                  title={track.album || 'Unknown album'}
                >
                  {track.album || 'Unknown album'}
                  {track.releaseYear ? ` (${track.releaseYear})` : ''}
                </span>
              </div>
            </div>

            {/* Duration & Audio Format Box */}
            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 flex items-start gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-cyan/15 border border-cyan/25 flex items-center justify-center text-cyan shrink-0 mt-0.5">
                <Clock className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="block text-[10px] font-semibold uppercase tracking-wider text-text-faint">
                  Track Length
                </span>
                <div className="flex items-center gap-1.5 mt-0.5 text-xs font-medium text-text">
                  <span className="font-mono">{durationText || 'Full Track'}</span>
                  <span className="text-white/20">•</span>
                  <span className="text-text-dim truncate">
                    {track.previewUrl ? 'Preview Ready' : 'Full Stream'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Artist Credits Pills */}
          <div className="space-y-1.5">
            <span className="block text-xs font-medium text-text-dim">
              Featured Artists
            </span>
            <div className="flex flex-wrap gap-1.5">
              {artists.map((artist) => (
                <span
                  key={artist}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-white/10 border border-white/15 text-text"
                >
                  {artist}
                </span>
              ))}
            </div>
          </div>

          {/* Taste Signal Actions (Matching PreferencesModal Tab Buttons) */}
          {primaryArtist && primaryArtist !== 'Unknown Artist' && (
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-text-dim">
                  Artist Taste Preference ({primaryArtist})
                </span>
                <span className="text-[11px] text-text-faint">
                  Applies to Familiar & Balanced modes
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleToggleFavorite}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    isFavoriteArtist
                      ? 'bg-violet/20 border border-violet/40 text-violet-light'
                      : 'bg-white/5 text-text-dim hover:text-text hover:bg-white/10 border border-white/10'
                  }`}
                >
                  <Heart
                    className={`w-3.5 h-3.5 ${isFavoriteArtist ? 'fill-current' : ''}`}
                  />
                  <span>
                    {isFavoriteArtist ? 'Favorited Artist' : 'Favorite Artist'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleToggleDislike}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    isDislikedArtist
                      ? 'bg-magenta/20 border border-magenta/40 text-pink-300'
                      : 'bg-white/5 text-text-dim hover:text-text hover:bg-white/10 border border-white/10'
                  }`}
                >
                  <Ban className="w-3.5 h-3.5" />
                  <span>
                    {isDislikedArtist ? 'Excluded Artist' : 'Exclude Artist'}
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Structured Footer Bar matching PreferencesModal */}
        <div className="pt-4 border-t border-white/10 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleCopySpotifyLink}
            className="text-xs text-text-dim hover:text-text flex items-center gap-1.5 transition-colors cursor-pointer py-1.5"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-spotify" />
                <span className="text-spotify font-medium">Link copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Track Link</span>
              </>
            )}
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-medium text-text transition-colors cursor-pointer"
            >
              Done
            </button>

            <a
              href={track.spotifyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-1.5 rounded-lg bg-spotify/20 hover:bg-spotify/30 border border-spotify/40 text-spotify text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-spotify"
            >
              <SpotifyIcon className="w-3.5 h-3.5 text-spotify" />
              <span>Listen on Spotify</span>
              <ExternalLink className="w-3 h-3 opacity-80" />
            </a>
          </div>
        </div>
      </motion.section>
    </div>
  );
}
