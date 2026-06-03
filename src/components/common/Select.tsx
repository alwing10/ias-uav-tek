import { cn } from '@/utils/cn';
import type { SelectHTMLAttributes } from 'react';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
}

export function Select({ label, className, children, ...rest }: SelectProps) {
  return (
    <label className="block">
      {label && <span className="mb-1 block text-[10px] font-semibold uppercase text-ink-muted">{label}</span>}
      <select
        className={cn(
          'h-8 w-full rounded border border-surface-border bg-white px-2 text-xs text-ink focus:border-brand-600 focus:outline-none',
          className,
        )}
        {...rest}
      >
        {children}
      </select>
    </label>
  );
}
