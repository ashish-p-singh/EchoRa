import { useState } from 'react';
import { Terminal, Copy, Check, X, Layers } from 'lucide-react';
import type { SearchResponse } from '../types';

interface GeneratedQueriesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  data: SearchResponse;
}

export function GeneratedQueriesDialog({
  isOpen,
  onClose,
  data,
}: GeneratedQueriesDialogProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!isOpen) return null;

  const multi = data.intent.multiQueries;
  const queries = [
    {
      key: 'mood',
      label: 'Mood Facet (Atmosphere & Emotion)',
      query: multi?.moodQuery || data.queries.primary,
      icon: '✨',
      desc: 'Captures acoustic tone, feelings, and tempo intent',
    },
    {
      key: 'genre',
      label: 'Genre Facet (Spotify Syntax & Styles)',
      query: multi?.genreQuery || (data.intent.genre.length > 0 ? `genre:"${data.intent.genre.join('" genre:"')}"` : 'genre:pop'),
      icon: '🎸',
      desc: 'Targeted Spotify tags, subgenres, and decade filters',
    },
    {
      key: 'context',
      label: 'Context Facet (Setting & Activity)',
      query: multi?.contextQuery || (data.intent.activity ? `${data.intent.activity} focus ambient` : 'focus ambient'),
      icon: '🌙',
      desc: 'Situational search (study, late night, workout, driving)',
    },
    {
      key: 'primary',
      label: 'Primary / Combined Query',
      query: data.queries.primary,
      icon: '🔍',
      desc: 'Unified query fallback used across candidate search',
    },
  ];

  const handleCopy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1800);
    } catch {
      // Fallback
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        className="glass-panel w-full max-w-xl p-5 sm:p-6 rounded-2xl border border-white/15 shadow-2xl bg-surface/95 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan/15 border border-cyan/30 flex items-center justify-center text-cyan">
              <Terminal className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-display font-semibold text-base text-text flex items-center gap-2">
                Generated Spotify Queries
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan/10 text-cyan border border-cyan/25">
                  RRF Multi-Search
                </span>
              </h2>
              <p className="text-xs text-text-dim">
                Exact queries dispatched in parallel by Gemini to Spotify
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-dim hover:text-text hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Active Constraints Badges */}
        {(data.intent.language || data.intent.era) && (
          <div className="flex flex-wrap items-center gap-2 mb-3 p-2.5 rounded-xl bg-cyan/5 border border-cyan/20 text-xs">
            {data.intent.language && (
              <span className="px-2 py-0.5 rounded-md bg-cyan/15 text-cyan font-semibold flex items-center gap-1">
                🌐 Language: <span className="capitalize">{data.intent.language}</span>
              </span>
            )}
            {data.intent.era && (
              <span className="px-2 py-0.5 rounded-md bg-amber/15 text-amber font-semibold flex items-center gap-1">
                📅 Era: {data.intent.era}
              </span>
            )}
            <span className="px-2 py-0.5 rounded-md bg-white/5 text-text-faint text-[11px] ml-auto">
              🛡️ Pure Studio Cuts (Max 1-2 mixes)
            </span>
          </div>
        )}

        {/* Sonic & Emotional Profile */}
        {data.intent.sonicProfile && (
          <div className="p-3 mb-4 rounded-xl bg-violet/5 border border-violet/20 text-xs space-y-1.5">
            <div className="font-semibold text-violet flex items-center gap-1.5 text-xs">
              <span>🎧</span> Sonic Profile (Deep Emotional & Acoustic Nuance)
            </div>
            {data.intent.sonicProfile.emotionalSubtext && (
              <div className="text-text-dim text-[11px]">
                <span className="text-text font-medium">Subtext:</span> {data.intent.sonicProfile.emotionalSubtext}
              </div>
            )}
            {data.intent.sonicProfile.vocalStyle && (
              <div className="text-text-dim text-[11px]">
                <span className="text-text font-medium">Vocals:</span> {data.intent.sonicProfile.vocalStyle}
              </div>
            )}
            <div className="flex flex-wrap gap-1.5 text-[11px] text-text-faint pt-0.5">
              {data.intent.sonicProfile.harmonicMode && (
                <span className="px-2 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/25 text-purple-300 font-medium">
                  🎵 Mode: {data.intent.sonicProfile.harmonicMode}
                </span>
              )}
              {data.intent.sonicProfile.production && (
                <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-text-dim">
                  🎛️ {data.intent.sonicProfile.production}
                </span>
              )}
              {data.intent.sonicProfile.tempoDescription && (
                <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-text-dim">
                  ⏱️ {data.intent.sonicProfile.tempoDescription}
                </span>
              )}
              {data.intent.sonicProfile.instruments && data.intent.sonicProfile.instruments.length > 0 && (
                <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-text-dim">
                  🎻 {data.intent.sonicProfile.instruments.join(', ')}
                </span>
              )}
            </div>
            {data.intent.sonicProfile.antiSonicAura && (
              <div className="pt-1.5 border-t border-white/5 flex flex-wrap items-center gap-1.5 text-[10px] text-rose-300">
                <span className="font-semibold text-rose-400">🚫 Disqualified:</span>
                {data.intent.sonicProfile.antiSonicAura.forbiddenVibes?.map((v) => (
                  <span key={v} className="px-1.5 py-0.5 rounded bg-rose-500/10 border border-rose-500/20">
                    {v}
                  </span>
                ))}
                {data.intent.sonicProfile.antiSonicAura.forbiddenInstruments?.map((i) => (
                  <span key={i} className="px-1.5 py-0.5 rounded bg-rose-500/10 border border-rose-500/20">
                    {i}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Queries List */}
        <div className="space-y-3.5">
          {queries.map((item) => (
            <div
              key={item.key}
              className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 hover:border-white/20 transition-all"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-text flex items-center gap-1.5">
                  <span>{item.icon}</span>
                  {item.label}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(item.key, item.query)}
                  className="glass-pill px-2.5 py-1 text-[11px] text-text-dim hover:text-text hover:bg-white/10 transition-all flex items-center gap-1.5 border border-white/10 cursor-pointer"
                >
                  {copiedKey === item.key ? (
                    <>
                      <Check className="w-3 h-3 text-live-status" />
                      <span className="text-live-status font-medium">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>

              <div className="p-2.5 rounded-lg bg-black/40 border border-white/5 font-mono text-xs text-cyan-light select-all break-words">
                {item.query}
              </div>

              <p className="text-[11px] text-text-faint mt-1.5">
                {item.desc}
              </p>
            </div>
          ))}
        </div>

        {/* Footer info */}
        <div className="mt-5 pt-3.5 border-t border-white/10 flex items-center justify-between text-xs text-text-faint">
          <span className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-violet" />
            Ranked & fused with Reciprocal Rank Fusion ($k=60$)
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-text font-medium text-xs transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
