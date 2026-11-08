import { memo, useState } from 'react';
import {
  AudioWaveform,
  Zap,
  Activity,
  Gauge,
  Tags,
  Mic2,
  Clock,
  Sun,
  Sunset,
  Moon,
  Sparkles,
  ChevronDown,
  Terminal,
} from 'lucide-react';
import type { SearchResponse } from '../types';
import { IntentTile } from './IntentTile';
import { QueryLine } from './QueryLine';
import { GeneratedQueriesDialog } from './GeneratedQueriesDialog';

interface IntentPanelProps {
  data: SearchResponse;
  userPrompt: string;
  onCopyNotice?: () => void;
}

export const IntentPanel = memo(function IntentPanel({ data, userPrompt, onCopyNotice }: IntentPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isQueriesDialogOpen, setIsQueriesDialogOpen] = useState(false);
  const { intent, mode } = data;
  const breakdown = intent.breakdown;

  // Provider label and badge styling
  const getProviderInfo = () => {
    if (mode !== 'live') {
      return {
        name: 'Mock Simulation',
        shortBadge: 'Mock Mode',
        fullBadge: 'Mock Mode',
        badgeClass: 'bg-mock-status/15 text-mock-status border-mock-status/30',
      };
    }
    const prov = data.provider || 'grok';
    if (prov === 'grok') {
      return {
        name: 'Grok API',
        shortBadge: 'Live · Grok API',
        fullBadge: 'Live AI · Grok API (xAI)',
        badgeClass: 'bg-emerald-400/15 text-emerald-300 border-emerald-400/30',
      };
    }
    if (prov === 'gemini') {
      return {
        name: 'Gemini API',
        shortBadge: 'Live · Gemini API',
        fullBadge: 'Live AI · Google Gemini API',
        badgeClass: 'bg-live-status/15 text-live-status border-live-status/30',
      };
    }
    if (prov === 'openai') {
      return {
        name: 'OpenAI API',
        shortBadge: 'Live · OpenAI API',
        fullBadge: 'Live AI · OpenAI API',
        badgeClass: 'bg-cyan/15 text-cyan border-cyan/30',
      };
    }
    return {
      name: 'Live AI',
      shortBadge: 'Live AI',
      fullBadge: 'Live AI',
      badgeClass: 'bg-live-status/15 text-live-status border-live-status/30',
    };
  };

  const providerInfo = getProviderInfo();

  // Time context icon mapping
  const renderTimeContent = () => {
    const time = intent.time_context;
    if (!time || time === 'any') {
      return <span className="text-text-faint text-xs">Open</span>;
    }

    let icon = <Clock className="w-3.5 h-3.5 text-cyan" />;
    let label = 'Anytime';

    if (time === 'morning') {
      icon = <Sun className="w-3.5 h-3.5 text-amber" />;
      label = 'Morning';
    } else if (time === 'afternoon') {
      icon = <Sun className="w-3.5 h-3.5 text-amber" />;
      label = 'Afternoon';
    } else if (time === 'evening') {
      icon = <Sunset className="w-3.5 h-3.5 text-magenta" />;
      label = 'Evening';
    } else if (time === 'late_night') {
      icon = <Moon className="w-3.5 h-3.5 text-violet" />;
      label = 'Late Night';
    }

    return (
      <span className="flex items-center gap-1.5 text-sm font-medium text-text">
        {icon} {label}
      </span>
    );
  };

  // Vocals content mapping
  const renderVocalsContent = () => {
    const vocals = intent.vocals;
    if (!vocals || vocals === 'any') {
      return <span className="text-text-faint text-xs">Open</span>;
    }
    const isInstrumental = vocals === 'instrumental_preferred';
    return (
      <span className="text-sm font-medium text-text flex items-center gap-1.5">
        <Mic2 className={`w-3.5 h-3.5 ${isInstrumental ? 'text-violet' : 'text-magenta'}`} />
        {isInstrumental ? 'Instrumental' : 'Vocals'}
      </span>
    );
  };

  // Tempo pulse period: slow=1.6s, medium=0.9s, fast=0.5s, any=static
  const getTempoPulseDuration = () => {
    if (intent.tempo === 'slow') return '1.6s';
    if (intent.tempo === 'medium') return '0.9s';
    if (intent.tempo === 'fast') return '0.5s';
    return '0s';
  };

  // Energy segments: low=1, medium=2, high=3 filled
  const getEnergySegments = () => {
    if (intent.energy === 'low') return 1;
    if (intent.energy === 'high') return 3;
    return 2;
  };

  const energyLevel = getEnergySegments();

  return (
    <div className="mb-8">
      <div className="flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          aria-expanded={isExpanded}
          aria-controls="how-i-heard-you-panel"
          onClick={() => setIsExpanded((expanded) => !expanded)}
          className="glass-pill inline-flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold text-text hover:bg-white/[0.08] border border-white/10 transition-all cursor-pointer"
        >
          <AudioWaveform className="w-4 h-4 mood-accent-text" />
          <span>How I heard you</span>
          <span
            className={`text-[11px] px-2 py-0.5 rounded-full font-medium border flex items-center gap-1 ${providerInfo.badgeClass}`}
          >
            <Sparkles className="w-2.5 h-2.5" />
            {providerInfo.shortBadge}
          </span>
          <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
        </button>

        <button
          type="button"
          onClick={() => setIsQueriesDialogOpen(true)}
          className="glass-pill inline-flex items-center gap-2 px-3.5 py-2.5 text-sm font-semibold text-cyan hover:bg-cyan/15 border border-cyan/30 transition-all cursor-pointer"
        >
          <Terminal className="w-4 h-4 text-cyan" />
          <span>View Generated Queries</span>
        </button>
      </div>

      <GeneratedQueriesDialog
        isOpen={isQueriesDialogOpen}
        onClose={() => setIsQueriesDialogOpen(false)}
        data={data}
      />

      {isExpanded && <div id="how-i-heard-you-panel" className="glass-panel mt-3 p-5 sm:p-6 rounded-card border border-white/10 shadow-glass">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-white/[0.08] mb-4">
        <div className="flex items-center gap-2">
          <h2 className="font-display font-semibold text-sm sm:text-base text-text">
            How I heard you
          </h2>
        </div>

        {/* Mode & Active API Provider badge */}
        <span
          className={`text-xs px-2.5 py-1 rounded-full font-semibold border flex items-center gap-1.5 ${providerInfo.badgeClass}`}
        >
          <Sparkles className="w-3 h-3" />
          {providerInfo.fullBadge}
        </span>
      </div>

      {/* User's Original Prompt as Quote */}
      {userPrompt && (
        <blockquote className="text-sm sm:text-base text-text-dim italic mb-5 pl-3 border-l-2 border-violet/50 leading-relaxed font-normal">
          &ldquo;{userPrompt}&rdquo;
        </blockquote>
      )}

      <div className="mood-surface rounded-2xl border border-white/10 px-4 py-3 mb-4 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="text-[10px] uppercase tracking-[0.16em] text-text-faint font-semibold">
          Your listening mood
        </span>
        <span className="text-sm font-display font-semibold capitalize text-text">
          {intent.mood || 'Open'}
        </span>
        {intent.activity && <span className="text-xs text-text-dim">for {intent.activity}</span>}
        {intent.language && <span className="text-xs text-cyan font-medium capitalize">· {intent.language}</span>}
        {intent.era && <span className="text-xs text-amber font-medium">· {intent.era}</span>}
        {intent.time_context && intent.time_context !== 'any' && (
          <span className="text-xs text-text-dim">· {intent.time_context.replace('_', ' ')}</span>
        )}
      </div>

      {/* Grid of 7 Intent Tiles (2 cols on mobile, 4 on desktop) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-4">
        {/* 1. Mood */}
        <IntentTile
          index={0}
          icon={<Sparkles className="w-3.5 h-3.5" />}
          label="Mood"
          source={breakdown?.mood?.source}
          priority={breakdown?.mood?.priority}
        >
          <span className="text-sm font-semibold capitalize text-text">
            {intent.mood || 'Open'}
          </span>
        </IntentTile>

        {/* 2. Activity */}
        <IntentTile
          index={1}
          icon={<Activity className="w-3.5 h-3.5" />}
          label="Activity"
          source={breakdown?.activity?.source}
          priority={breakdown?.activity?.priority}
        >
          <span className="text-sm font-medium capitalize text-text">
            {intent.activity || <span className="text-text-faint text-xs">Open</span>}
          </span>
        </IntentTile>

        {/* 3. Energy */}
        <IntentTile
          index={2}
          icon={<Zap className="w-3.5 h-3.5" />}
          label="Energy"
          source={breakdown?.energy?.source}
          priority={breakdown?.energy?.priority}
        >
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold capitalize text-text min-w-[50px]">
              {intent.energy}
            </span>
            <div className="flex items-center gap-1">
              {[1, 2, 3].map((seg) => (
                <div
                  key={seg}
                  className={`w-4 h-2 rounded-sm transition-all ${
                    seg <= energyLevel
                      ? 'bg-gradient-to-r from-cyan to-magenta shadow-sm'
                      : 'bg-white/10'
                  }`}
                />
              ))}
            </div>
          </div>
        </IntentTile>

        {/* 4. Tempo */}
        <IntentTile
          index={3}
          icon={<Gauge className="w-3.5 h-3.5" />}
          label="Tempo"
          source={breakdown?.tempo?.source}
          priority={breakdown?.tempo?.priority}
        >
          <div className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full bg-cyan inline-block"
              style={{
                animation:
                  intent.tempo !== 'any'
                    ? `pulse ${getTempoPulseDuration()} ease-in-out infinite`
                    : 'none',
              }}
            />
            <span className="text-sm font-medium capitalize text-text">
              {intent.tempo || 'Open'}
            </span>
          </div>
        </IntentTile>

        {/* 5. Genres */}
        <IntentTile
          index={4}
          icon={<Tags className="w-3.5 h-3.5" />}
          label="Genres"
          source={breakdown?.genre?.source}
          priority={breakdown?.genre?.priority}
        >
          <div className="flex flex-wrap items-center gap-1">
            {intent.genre && intent.genre.length > 0 ? (
              intent.genre.map((g, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 rounded-md bg-white/[0.06] text-text text-xs font-medium border border-white/5"
                >
                  {g}
                </span>
              ))
            ) : (
              <span className="text-text-faint text-xs">Open</span>
            )}
          </div>
        </IntentTile>

        {/* 6. Vocals */}
        <IntentTile
          index={5}
          icon={<Mic2 className="w-3.5 h-3.5" />}
          label="Vocals"
          source={breakdown?.vocals?.source}
          priority={breakdown?.vocals?.priority}
        >
          {renderVocalsContent()}
        </IntentTile>

        {/* 7. Time Context */}
        <IntentTile
          index={6}
          icon={<Clock className="w-3.5 h-3.5" />}
          label="Time Context"
          source={breakdown?.time_context?.source}
          priority={breakdown?.time_context?.priority}
        >
          {renderTimeContent()}
        </IntentTile>
      </div>

      {/* Spotify Search Queries Generated */}
      {data.queries && (
        <QueryLine
          primary={data.queries.primary}
          alternatives={data.queries.alternatives}
          onCopyNotice={onCopyNotice}
        />
      )}

      </div>}
    </div>
  );
});
