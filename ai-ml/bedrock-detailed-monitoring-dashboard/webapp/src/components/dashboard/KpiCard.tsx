import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KpiCardProps {
  title: string;
  value: string;
  subValue?: string;
  change?: number;
  icon?: React.ReactNode;
}

export function KpiCard({ title, value, subValue, change, icon }: KpiCardProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon && <span className="text-primary">{icon}</span>}
        <span>{title}</span>
      </div>
      <div className="mt-2 text-2xl font-bold text-foreground">{value}</div>
      <div className="mt-1 flex items-center gap-2 text-xs">
        {change !== undefined && (
          <span
            className={cn(
              'flex items-center gap-0.5 font-medium',
              change >= 0 ? 'text-green-500' : 'text-red-500'
            )}
          >
            {change >= 0 ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            {Math.abs(change).toFixed(1)}%
          </span>
        )}
        {subValue && <span className="text-muted-foreground">{subValue}</span>}
      </div>
    </div>
  );
}
