import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import type { Role } from '@/types/domain';
import { useAuth } from '@/store/auth';
import { hasRole } from '@/utils/rbac';

interface RequireRoleProps {
  role?: Role;
  children: ReactNode;
}

export function RequireRole({ role, children }: RequireRoleProps) {
  const user = useAuth((s) => s.user);
  const loc = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  if (role && !hasRole(user.role, role)) {
    return (
      <div className="mx-auto mt-10 max-w-md rounded-card border border-surface-border bg-white p-6 text-center">
        <h2 className="text-base font-semibold text-ink">Недостаточно прав</h2>
        <p className="mt-2 text-xs text-ink-muted">
          Текущая роль не позволяет открыть данный раздел. Переключите роль через панель слева (демо).
        </p>
      </div>
    );
  }
  return <>{children}</>;
}
