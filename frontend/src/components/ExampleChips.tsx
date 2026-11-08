import { memo } from 'react';
import { motion } from 'framer-motion';

export interface ExamplePromptOption {
  label: string;
  prompt: string;
}

const EXAMPLE_CHIPS: ExamplePromptOption[] = [
  {
    label: '🌧 Rainy day focus',
    prompt: 'Rainy day focus',
  },
  {
    label: '🏋 Gym power-up',
    prompt: 'Gym power-up',
  },
  {
    label: '🌙 Late-night calm',
    prompt: 'Late-night calm',
  },
  {
    label: '☀️ Sunny road trip',
    prompt: 'Sunny road trip',
  },
  {
    label: '💔 Heartbreak hours',
    prompt: 'Heartbreak hours',
  },
];

interface ExampleChipsProps {
  onSelect: (prompt: string) => void;
  disabled?: boolean;
}

export const ExampleChips = memo(function ExampleChips({ onSelect, disabled = false }: ExampleChipsProps) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 pt-3">
      {EXAMPLE_CHIPS.map((chip, index) => (
        <motion.button
          key={chip.label}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(chip.prompt)}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: index * 0.08, ease: 'easeOut' }}
          whileHover={{ scale: 1.04, y: -1 }}
          whileTap={{ scale: 0.96 }}
          className="glass-pill px-3.5 py-1.5 text-xs text-text-dim hover:text-white hover:bg-gradient-to-r hover:from-violet-500/15 hover:via-magenta/10 hover:to-cyan-500/15 hover:border-violet-400/40 hover:shadow-[0_0_16px_rgba(139,92,246,0.35)] transition-all cursor-pointer border border-white/5"
          aria-label={`Prompt example: ${chip.label}`}
        >
          {chip.label}
        </motion.button>
      ))}
    </div>
  );
});
