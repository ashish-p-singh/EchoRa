import { useState } from 'react';
import type { StatusResponse } from '../types';
import { StatusPopover } from './StatusPopover';

interface ModePillProps {
  status: StatusResponse | null;
}

export function ModePill({ status }: ModePillProps) {
  const [isOpen, setIsOpen] = useState(false);

  const isLive = status?.mode === 'live';
  const providerName =
    status?.activeProvider && status.activeProvider !== 'mock'
      ? status.activeProvider === 'grok'
        ? 'Grok'
        : status.activeProvider === 'gemini'
          ? 'Gemini'
          : status.activeProvider === 'openai'
            ? 'OpenAI'
            : status.activeProvider
      : null;
  const label = isLive ? (providerName ? `Live · ${providerName}` : 'Live') : 'Mock';

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="glass-pill px-3 py-1.5 flex items-center gap-2 text-xs font-medium text-text-dim hover:text-text hover:bg-white/[0.08] transition-all cursor-pointer border border-white/10"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label={`System status: ${label} mode. Click to view details.`}
      >
        {/* Pulsing Colored Dot */}
        <span className="relative flex h-2 w-2">
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
              isLive ? 'bg-live-status' : 'bg-mock-status'
            }`}
          />
          <span
            className={`relative inline-flex rounded-full h-2 w-2 ${
              isLive ? 'bg-live-status' : 'bg-mock-status'
            }`}
          />
        </span>
        <span className="font-semibold text-text">{label}</span>
      </button>

      <StatusPopover status={status} isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </div>
  );
}

