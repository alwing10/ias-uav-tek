import { cn } from '@/utils/cn';

interface Tab<T extends string> {
  value: T;
  label: string;
  count?: number;
}

interface TabsProps<T extends string> {
  tabs: Tab<T>[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}

export function Tabs<T extends string>({ tabs, value, onChange, className }: TabsProps<T>) {
  return (
    <div className={cn('flex border-b border-surface-border', className)}>
      {tabs.map((t) => (
        <button
          key={t.value}
          onClick={() => onChange(t.value)}
          className={cn(
            'relative px-4 py-2 text-xs font-semibold transition',
            value === t.value ? 'text-brand-700' : 'text-ink-muted hover:text-ink',
          )}
        >
          {t.label}
          {typeof t.count === 'number' && <span className="ml-1 text-ink-muted">({t.count})</span>}
          {value === t.value && <span className="absolute inset-x-0 -bottom-px h-0.5 bg-brand-600" />}
        </button>
      ))}
    </div>
  );
}
