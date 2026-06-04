import { NavLink } from 'react-router-dom';
import {
  Activity,
  BarChart3,
  Bell,
  Building2,
  CheckCircle2,
  ClipboardList,
  FileText,
  Home,
  List,
  Map,
  Radio,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '@/store/auth';
import { useLiveData } from '@/store/liveData';
import { useBackend } from '@/store/backendData';
import type { Role } from '@/types/domain';
import { ROLE_LABEL } from '@/types/domain';
import { canSee } from '@/utils/rbac';
import { cn } from '@/utils/cn';
import { relativeMin } from '@/utils/format';
import { useMemo } from 'react';

const NAV: Array<{ to: string; label: string; icon: typeof Home; roles: Role[] }> = [
  { to: '/dashboard', label: 'Главная', icon: Home, roles: ['analyst'] },
  { to: '/map', label: 'Карта', icon: Map, roles: ['analyst'] },
  { to: '/incidents', label: 'Инциденты', icon: List, roles: ['analyst'] },
  { to: '/analytics', label: 'Аналитика', icon: BarChart3, roles: ['analyst'] },
  { to: '/reports', label: 'Отчёты', icon: FileText, roles: ['analyst'] },
  { to: '/verification', label: 'Верификация', icon: CheckCircle2, roles: ['expert'] },
  { to: '/objects', label: 'Объекты ТЭК', icon: Building2, roles: ['analyst'] },
  { to: '/subscriptions', label: 'Подписки', icon: Bell, roles: ['analyst'] },
  { to: '/sources', label: 'Источники', icon: Radio, roles: ['admin'] },
  { to: '/dictionaries', label: 'Справочники', icon: ClipboardList, roles: ['admin'] },
  { to: '/audit', label: 'Журнал', icon: ShieldCheck, roles: ['admin'] },
];

export function Sidebar() {
  const { user, switchRole } = useAuth();
  const visible = useMemo(() => NAV.filter((n) => canSee(user?.role, n.roles)), [user?.role]);
  const liveStatus = useLiveData((s) => s.status);
  const liveLast = useLiveData((s) => s.lastUpdate);
  const liveCount = useLiveData((s) => s.incidents.length);
  const refresh = useLiveData((s) => s.refresh);
  const backendStatus = useBackend((s) => s.status);
  const backendCount = useBackend((s) => s.incidents.length);

  const statusDot =
    liveStatus === 'ok'
      ? 'bg-emerald-500'
      : liveStatus === 'loading'
        ? 'bg-orange-500 animate-pulse'
        : liveStatus === 'error'
          ? 'bg-red-600'
          : 'bg-zinc-400';

  const statusLabel =
    liveStatus === 'ok'
      ? 'Активен'
      : liveStatus === 'loading'
        ? 'Сбор…'
        : liveStatus === 'error'
          ? 'Ошибка'
          : 'Готов';

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

      <div className="mx-3 mb-3 space-y-2">
        <div className="rounded-card bg-brand-50 p-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-brand-700">Сбор данных</span>
            <span className={cn('flex h-2 w-2 rounded-full', statusDot)} />
          </div>
          <div className="mt-1 flex items-center gap-1 text-[10px] text-ink-muted">
            <Activity className="h-3 w-3" />
            {statusLabel} • {liveCount} live
          </div>
          <div className="mt-1 flex items-center justify-between text-[10px] text-ink-muted">
            <span>{liveLast ? `Цикл: ${relativeMin(liveLast)}` : 'Ещё не запускался'}</span>
            <button
              onClick={() => void refresh()}
              className="rounded p-0.5 text-brand-600 hover:bg-white"
              title="Обновить сейчас"
            >
              <RefreshCw className={cn('h-3 w-3', liveStatus === 'loading' && 'animate-spin')} />
            </button>
          </div>
        </div>
        {/* Статус backend подключения */}
        <div className="rounded-card border border-surface-border bg-white p-2.5">
          <div className="flex items-center justify-between text-[10px]">
            <span className="font-semibold text-ink">Backend (БД)</span>
            <span
              className={cn(
                'flex h-2 w-2 rounded-full',
                backendStatus === 'ok'
                  ? 'bg-emerald-500'
                  : backendStatus === 'connecting' || backendStatus === 'waking'
                    ? 'bg-orange-500 animate-pulse'
                    : backendStatus === 'error'
                      ? 'bg-red-600'
                      : 'bg-zinc-400',
              )}
            />
          </div>
          <div className="mt-0.5 text-[10px] text-ink-muted">
            {backendStatus === 'ok' && `${backendCount} в БД`}
            {backendStatus === 'waking' && 'Пробуждение Render…'}
            {backendStatus === 'connecting' && 'Синхронизация…'}
            {backendStatus === 'error' && 'Недоступен'}
            {backendStatus === 'disabled' && 'Не настроен (VITE_API_URL)'}
            {backendStatus === 'idle' && 'Готов'}
          </div>
        </div>
      </div>
    </aside>
  );
}
