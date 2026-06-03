import { ChevronDown, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/utils/cn';

interface Option<T extends string> {
  value: T;
  label: string;
}

interface MultiSelectProps<T extends string> {
  label?: string;
  options: Option<T>[];
  value: T[];
  onChange: (v: T[]) => void;
  placeholder?: string;
}

export function MultiSelect<T extends string>({
  label,
  options,
  value,
  onChange,
  placeholder = 'Все',
}: MultiSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const off = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', off);
    return () => document.removeEventListener('mousedown', off);
  }, []);

  function toggle(v: T) {
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  }

  const display = value.length === 0 ? placeholder : value.length <= 2 ? options.filter((o) => value.includes(o.value)).map((o) => o.label).join(', ') : `Выбрано: ${value.length}`;

  return (
    <div ref={ref} className="relative">
      {label && <span className="mb-1 block text-[10px] font-semibold uppercase text-ink-muted">{label}</span>}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-8 w-full items-center justify-between rounded border border-surface-border bg-white px-2 text-xs text-ink hover:border-brand-600"
      >
        <span className={cn('truncate', value.length === 0 && 'text-ink-muted')}>{display}</span>
        <ChevronDown className="h-3.5 w-3.5 text-ink-muted" />
      </button>
      {value.length > 0 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onChange([]);
          }}
          className="absolute right-6 top-7 text-ink-muted hover:text-ink"
          title="Очистить"
        >
          <X className="h-3 w-3" />
        </button>
      )}
      {open && (
        <div className="scrollbar-thin absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded border border-surface-border bg-white shadow-lg">
          {options.map((o) => (
            <label
              key={o.value}
              className={cn(
                'flex cursor-pointer items-center gap-2 px-2 py-1 text-xs hover:bg-brand-50',
                value.includes(o.value) && 'bg-brand-50',
              )}
            >
              <input type="checkbox" checked={value.includes(o.value)} onChange={() => toggle(o.value)} />
              <span className="text-ink">{o.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
