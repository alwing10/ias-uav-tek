import { NavLink } from 'react-router-dom';
import {
  Activity,
  BarChart3,
  Building2,
  CheckCircle2,
  ClipboardList,
  FileText,
  Home,
  List,
  Map,
  Radio,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '@/store/auth';
import type { Role } from '@/types/domain';
import { ROLE_LABEL } from '@/types/domain';
import { canSee } from '@/utils/rbac';
import { cn } from '@/utils/cn';
import { useMemo, useState, useEffect } from 'react';

const NAV: Array<{ to: string; label: string; icon: typeof Home; roles: Role[] }> = [
  { to: '/dashboard', label: 'Главная', icon: Home, roles: ['analyst'] },
  { to: '/map', label: 'Карта', icon: Map, roles: ['analyst'] },
  { to: '/incidents', label: 'Инциденты', icon: List, roles: ['analyst'] },
  { to: '/analytics', label: 'Аналитика', icon: BarChart3, roles: ['analyst'] },
  { to: '/reports', label: 'Отчёты', icon: FileText, roles: ['analyst'] },
  { to: '/verification', label: 'Верификация', icon: CheckCircle2, roles: ['expert'] },
  { to: '/objects', label: 'Объекты ТЭК', icon: Building2, roles: ['analyst'] },
  { to: '/sources', label: 'Источники', icon: Radio, roles: ['admin'] },
  { to: '/dictionaries', label: 'Справочники', icon: ClipboardList, roles: ['admin'] },
  { to: '/audit', label: 'Журнал', icon: ShieldCheck, roles: ['admin'] },
];

export function Sidebar() {
  const { user, switchRole } = useAuth();
  const visible = useMemo(() => NAV.filter((n) => canSee(user?.role, n.roles)), [user?.role]);
  const [tick, setTick] = useState(2);

  useEffect(() => {
    const i = setInterval(() => setTick((t) => (t > 10 ? 1 : t + 1)), 60_000);
    return () => clearInterval(i);
  }, []);

  return (
    <aside className="fixed left-0 top-14 z-40 flex h-[calc(100vh-3.5rem)] w-[220px] flex-col border-r border-surface-border bg-white">
      <nav className="scrollbar-thin flex-1 overflow-y-auto py-2">
        {visible.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'relative flex items-center gap-3 px-5 py-2.5 text-sm font-medium transition',
                isActive ? 'bg-brand-50 text-brand-700' : 'text-ink hover:bg-surface',
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && <span className="absolute inset-y-0 left-0 w-0.5 bg-brand-600" />}
                <item.icon className="h-4 w-4" />
                <span>{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-surface-border p-3">
        <div className="text-[10px] font-semibold uppercase text-ink-muted">Демо: роль</div>
        <select
          value={user?.role ?? 'analyst'}
          onChange={(e) => switchRole(e.target.value as Role)}
          className="mt-1 h-8 w-full rounded border border-surface-border bg-white px-2 text-xs"
        >
          <option value="analyst">{ROLE_LABEL.analyst}</option>
          <option value="expert">{ROLE_LABEL.expert}</option>
          <option value="admin">{ROLE_LABEL.admin}</option>
        </select>
      </div>

      <div className="mx-3 mb-3 rounded-card bg-brand-50 p-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-brand-700">Сбор данных</span>
          <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
        </div>
        <div className="mt-1 flex items-center gap-1 text-[10px] text-ink-muted">
          <Activity className="h-3 w-3" />
          Последний цикл: {tick} мин назад
        </div>
      </div>
    </aside>
  );
}
