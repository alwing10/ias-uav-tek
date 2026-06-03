import { cn } from '@/utils/cn';
import type { ReactNode } from 'react';

interface CardProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  toolbar?: ReactNode;
  children: ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md';
}

export function Card({ title, subtitle, toolbar, children, className, padding = 'md' }: CardProps) {
  return (
    <section className={cn('rounded-card border border-surface-border bg-surface-card shadow-card', className)}>
      {(title || toolbar) && (
        <header className="flex items-center justify-between gap-3 border-b border-surface-border px-4 py-3">
          <div>
            {title && <h2 className="text-sm font-semibold text-ink">{title}</h2>}
            {subtitle && <p className="text-xs text-ink-muted">{subtitle}</p>}
          </div>
          {toolbar}
        </header>
      )}
      <div className={cn(padding === 'md' && 'p-4', padding === 'sm' && 'p-3', padding === 'none' && '')}>
        {children}
      </div>
    </section>
  );
}
