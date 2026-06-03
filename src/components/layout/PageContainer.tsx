import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

interface PageContainerProps {
  title: string;
  subtitle?: string;
  toolbar?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function PageContainer({ title, subtitle, toolbar, children, className }: PageContainerProps) {
  return (
    <div className={cn('mx-auto w-full max-w-[1320px] px-6 py-5', className)}>
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">{title}</h1>
          {subtitle && <p className="mt-1 text-xs text-ink-muted">{subtitle}</p>}
        </div>
        {toolbar && <div className="flex items-center gap-2">{toolbar}</div>}
      </div>
      {children}
    </div>
  );
}
