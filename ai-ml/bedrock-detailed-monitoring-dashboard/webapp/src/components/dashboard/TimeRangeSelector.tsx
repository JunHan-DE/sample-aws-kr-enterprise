'use client';

import type { TimeRange } from '@/lib/types/metrics';
import { cn } from '@/lib/utils';

const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: '1h', label: '1h' },
  { value: '6h', label: '6h' },
  { value: '24h', label: '24h' },
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
  { value: 'custom', label: 'Custom' },
];

interface TimeRangeSelectorProps {
  value: TimeRange;
  onChange: (range: TimeRange) => void;
  customStart?: string;
  customEnd?: string;
  onCustomChange?: (start: string, end: string) => void;
}

export function TimeRangeSelector({ value, onChange, customStart, customEnd, onCustomChange }: TimeRangeSelectorProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex gap-1 rounded-lg border border-border bg-muted p-1">
        {TIME_RANGES.map((range) => (
          <button
            key={range.value}
            onClick={() => onChange(range.value)}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              value === range.value
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            )}
          >
            {range.label}
          </button>
        ))}
      </div>
      {value === 'custom' && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={customStart ?? ''}
            onChange={(e) => onCustomChange?.(e.target.value, customEnd ?? '')}
            className="rounded-md border border-border bg-card px-2 py-1.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary"
          />
          <span className="text-sm text-muted-foreground">to</span>
          <input
            type="date"
            value={customEnd ?? ''}
            onChange={(e) => onCustomChange?.(customStart ?? '', e.target.value)}
            className="rounded-md border border-border bg-card px-2 py-1.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      )}
    </div>
  );
}
