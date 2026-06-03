import type { Severity, VerificationStatus, IncidentStatus } from '@/types/domain';
import { SEVERITY_LABEL, STATUS_LABEL, VERIFICATION_LABEL } from '@/types/domain';
import { cn } from '@/utils/cn';

const SEVERITY_CLASS: Record<Severity, string> = {
  low: 'bg-emerald-100 text-emerald-700',
  medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
};

const VERIFICATION_CLASS: Record<VerificationStatus, string> = {
  new: 'bg-brand-50 text-brand-600',
  pending: 'bg-orange-100 text-orange-700',
  verified: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-zinc-200 text-zinc-600',
};

const STATUS_CLASS: Record<IncidentStatus, string> = {
  destroyed: 'bg-red-100 text-red-700',
  damaged: 'bg-orange-100 text-orange-700',
  repelled: 'bg-emerald-100 text-emerald-700',
};

export function SeverityBadge({ severity, className }: { severity: Severity; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
        SEVERITY_CLASS[severity],
        className,
      )}
    >
      {SEVERITY_LABEL[severity]}
    </span>
  );
}

export function VerificationBadge({ status, className }: { status: VerificationStatus; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
        VERIFICATION_CLASS[status],
        className,
      )}
    >
      {VERIFICATION_LABEL[status]}
    </span>
  );
}

export function IncidentStatusBadge({ status, className }: { status: IncidentStatus; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
        STATUS_CLASS[status],
        className,
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
