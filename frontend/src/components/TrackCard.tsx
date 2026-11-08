import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Music, ExternalLink } from 'lucide-react';
import type { Track } from '../types';
import { formatDuration } from '../lib/format';
import { SpotifyIcon } from './ConnectSpotifyButton';
import { PreviewButton } from './PreviewButton';

interface TrackCardProps {
  track: Track;
  isPreviewPlaying?: boolean;
  activePreviewId?: string | null;
  previewProgress: number;
  onTogglePreview: (track: Track) => void;
  onSelectTrack: (track: Track) => void;
}

export const TrackCard = memo(function TrackCard({
  track,
  isPreviewPlaying: isPreviewPlayingProp,
  activePreviewId,
  previewProgress,
  onTogglePreview,
  onSelectTrack,
}: TrackCardProps) {
  const shouldReduceMotion = useReducedMotion();
  const [artLoaded, setArtLoaded] = useState(false);
  const [artFailed, setArtFailed] = useState(false);

  const cardRef = useRef<HTMLDivElement>(null);
  const rectRef = useRef<DOMRect | null>(null);
  const rafRef = useRef<number | null>(null);

  const isPreviewPlaying =
    typeof isPreviewPlayingProp === 'boolean'
      ? isPreviewPlayingProp
      : activePreviewId === track.id;
  const durationText = formatDuration(track.durationMs);
  const artistText = track.artists?.join(', ') || 'Unknown Artist';

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  const handleMouseEnter = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (shouldReduceMotion) return;
      rectRef.current = e.currentTarget.getBoundingClientRect();
    },
    [shouldReduceMotion]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (shouldReduceMotion || !cardRef.current) return;
      const clientX = e.clientX;
      const clientY = e.clientY;

      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }

      rafRef.current = requestAnimationFrame(() => {
        const el = cardRef.current;
        if (!el) return;
        const rect = rectRef.current ?? el.getBoundingClientRect();
        rectRef.current = rect;

        const x = clientX - rect.left;
        const y = clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        // Subtle 4 degrees tilt via CSS custom properties (zero React re-renders)
        const rX = ((y - centerY) / (centerY || 1)) * -4;
        const rY = ((x - centerX) / (centerX || 1)) * 4;

        el.style.setProperty('--rx', `${rX.toFixed(2)}deg`);
        el.style.setProperty('--ry', `${rY.toFixed(2)}deg`);
        rafRef.current = null;
      });
    },
    [shouldReduceMotion]
  );

  const handleMouseLeave = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    rectRef.current = null;
    if (cardRef.current) {
      cardRef.current.style.setProperty('--rx', '0deg');
      cardRef.current.style.setProperty('--ry', '0deg');
    }
  }, []);

  const handleToggle = useCallback(() => {
    onTogglePreview(track);
  }, [onTogglePreview, track]);

  return (
    <motion.div
      ref={cardRef}
      variants={{
        hidden: shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.98 },
        visible: shouldReduceMotion
          ? { opacity: 1, transition: { duration: 0.12 } }
          : { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', damping: 26, stiffness: 320 } },
      }}
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`relative group${shouldReduceMotion ? '' : ' tilt-card'}${
        isPreviewPlaying ? ' conic-active' : ''
      }`}
    >
      {/* Rotating Conic Aurora Glow Behind Card on Hover / Playing (Paused when idle) */}
      <div
        className={`absolute -inset-[1.5px] rounded-[22px] overflow-hidden -z-10 pointer-events-none transition-all duration-500 group-hover:-translate-y-1 ${
          isPreviewPlaying
            ? 'opacity-50'
            : 'opacity-0 group-hover:opacity-40'
        }`}
      >
        <div className="w-[200%] h-[200%] -translate-x-1/4 -translate-y-1/4 animate-conic mood-conic-aurora blur-[6px]" />
      </div>

      {/* Main Apple Liquid Glass Card */}
      <article
        onClick={() => onSelectTrack(track)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelectTrack(track);
          }
        }}
        tabIndex={0}
        role="button"
        aria-label={`View details for ${track.name} by ${artistText}`}
        className="apple-glass-card p-3.5 flex items-center gap-3.5 relative overflow-hidden cursor-pointer select-none group-hover:-translate-y-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan"
      >
        {/* Soft Moving Mood-Responsive Aurora Animation in Card Background on Hover / Playing */}
        <div
          className={`pointer-events-none absolute inset-0 overflow-hidden rounded-[20px] transition-opacity duration-500 ${
            isPreviewPlaying
              ? 'opacity-30'
              : 'opacity-0 group-hover:opacity-25'
          }`}
        >
          <div className="w-[200%] h-[200%] -translate-x-1/4 -translate-y-1/4 animate-conic mood-conic-aurora blur-[16px]" />
        </div>

        {/* Top-edge specular glossy highlight overlay */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/[0.08] via-transparent to-transparent opacity-80 group-hover:opacity-100 transition-opacity" />

        {/* Album Art (88x88) with Specular Rim */}
        <div className="relative z-10 w-[88px] h-[88px] rounded-[16px] overflow-hidden shrink-0 bg-white/[0.04] border border-white/15 flex items-center justify-center shadow-md">
          {track.albumArtUrl && !artFailed ? (
            <img
              src={track.albumArtUrl}
              alt={track.name}
              loading="lazy"
              decoding="async"
              onLoad={() => setArtLoaded(true)}
              onError={() => setArtFailed(true)}
              className={`w-full h-full object-cover transition-opacity duration-300 ${
                artLoaded ? 'opacity-100' : 'opacity-0'
              }`}
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-tr from-violet/30 to-cyan/30 flex items-center justify-center">
              <Music className="w-6 h-6 text-text-dim" />
            </div>
          )}

          {/* Centered Audio Preview Play/Pause button */}
          {track.previewUrl && (
            <PreviewButton
              isPlaying={isPreviewPlaying}
              progress={isPreviewPlaying ? previewProgress : 0}
              onToggle={handleToggle}
            />
          )}
        </div>

        {/* Track Details */}
        <div className="flex-1 min-w-0 flex flex-col justify-between h-[88px] py-0.5 z-10">
          <div>
            {/* Track Name */}
            <h3
              className="font-display font-semibold text-sm sm:text-base text-text truncate group-hover:text-white transition-colors"
              title={track.name}
            >
              {track.name}
            </h3>

            {/* Artists */}
            <p className="text-xs text-text-dim truncate mt-0.5 group-hover:text-text transition-colors" title={artistText}>
              {artistText}
            </p>

            {/* Match Reason or Album Name */}
            <p className="text-[11px] text-text-faint truncate mt-0.5" title={track.matchReason || track.album}>
              {track.matchReason ? `✨ ${track.matchReason}` : track.album}
            </p>
          </div>

          {/* Bottom Actions: Release year & Duration badges & Open in Spotify link */}
          <div className="flex items-center justify-between gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-1.5 overflow-hidden">
              {track.releaseYear && (
                <span className="font-mono text-[10px] text-text-faint bg-white/[0.05] border border-white/10 px-2 py-0.5 rounded-full shrink-0">
                  {track.releaseYear}
                </span>
              )}
              {durationText ? (
                <span className="font-mono text-[10px] text-text-faint bg-white/[0.05] border border-white/10 px-2 py-0.5 rounded-full shrink-0">
                  {durationText}
                </span>
              ) : null}
            </div>

            <a
              href={track.spotifyUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Open "${track.name}" on Spotify`}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-spotify/15 hover:bg-spotify/25 text-spotify text-[11px] font-semibold transition-all border border-spotify/30 hover:border-spotify/50 hover:scale-[1.03] active:scale-[0.98] shadow-sm"
            >
              <SpotifyIcon className="w-3 h-3 text-spotify" />
              <span>Spotify</span>
              <ExternalLink className="w-2.5 h-2.5 opacity-70" />
            </a>
          </div>
        </div>
      </article>
    </motion.div>
  );
});
