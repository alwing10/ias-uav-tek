import { X } from 'lucide-react';
import { useEffect } from 'react';
import type { ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const SIZE = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-3xl',
  xl: 'max-w-5xl',
};

export function Modal({ open, onClose, title, children, footer, size = 'md' }: ModalProps) {
  useEffect(() => {
    const off = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (open) document.addEventListener('keydown', off);
    return () => document.removeEventListener('keydown', off);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 p-4" onMouseDown={onClose}>
      <div
        className={`relative w-full ${SIZE[size]} max-h-[90vh] overflow-hidden rounded-card bg-white shadow-xl`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-surface-border px-5 py-3">
          <h3 className="text-base font-semibold text-ink">{title}</h3>
          <button onClick={onClose} className="rounded p-1 text-ink-muted hover:bg-surface hover:text-ink" aria-label="Закрыть">
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="scrollbar-thin max-h-[70vh] overflow-y-auto p-5">{children}</div>
        {footer && <footer className="flex justify-end gap-2 border-t border-surface-border bg-surface px-5 py-3">{footer}</footer>}
      </div>
    </div>
  );
}
