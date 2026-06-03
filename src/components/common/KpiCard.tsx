import { cn } from '@/utils/cn';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';

interface KpiCardProps {
  label: string;
  value: string | number;
  hint?: string;
  trend?: { delta: number; positive?: boolean };
  accent?: 'default' | 'critical' | 'warning';
}

export function KpiCard({ label, value, hint, trend, accent = 'default' }: KpiCardProps) {
  return (
    <div className="rounded-card border border-surface-border bg-surface-card p-4 shadow-card">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">{label}</div>
      <div
        className={cn(
          'mt-2 text-3xl font-bold leading-none',
          accent === 'critical' && 'text-red-700',
          accent === 'warning' && 'text-orange-600',
          accent === 'default' && 'text-brand-600',
        )}
      >
        {value}
      </div>
      <div className="mt-2 flex items-center gap-1 text-xs text-ink-muted">
        {trend &&
          (trend.positive ? (
            <ArrowUpRight className="h-3.5 w-3.5 text-emerald-600" />
          ) : (
            <ArrowDownRight className="h-3.5 w-3.5 text-red-600" />
          ))}
        {trend && (
          <span className={cn(trend.positive ? 'text-emerald-600' : 'text-red-600')}>
            {trend.delta > 0 ? '+' : ''}
            {trend.delta}%
          </span>
        )}
        {hint && <span>{hint}</span>}
      </div>
    </div>
  );
}
