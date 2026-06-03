import type { ObjectCategory } from '@/types/domain';
import { cn } from '@/utils/cn';

const CLASS: Record<ObjectCategory, string> = {
  I: 'bg-red-100 text-red-700 border border-red-200',
  II: 'bg-yellow-100 text-yellow-800 border border-yellow-200',
  III: 'bg-zinc-100 text-zinc-700 border border-zinc-200',
};

export function CategoryBadge({ category, className }: { category: ObjectCategory; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold',
        CLASS[category],
        className,
      )}
    >
      {category}
    </span>
  );
}
