import { useState, useEffect, useRef, useMemo } from 'react';
import { Bell, ChevronDown, LogOut, Search } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/store/auth';
import { ROLE_LABEL } from '@/types/domain';
import { useIncidents } from '@/store/incidents';
import { useBackend } from '@/store/backendData';
import { useLiveData } from '@/store/liveData';
import { OBJECTS } from '@/mocks/objects';

type OpenMenu = null | 'search' | 'bell' | 'user';

export function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);

  const stored = useIncidents((s) => s.incidents);
  const live = useLiveData((s) => s.incidents);
  const backend = useBackend((s) => s.incidents);
  // Объединяем источники для поиска
  const allIncidents = useMemo(() => {
    const all = [...live, ...backend, ...stored];
    const seen = new Set<string>();
    return all.filter((i) => (seen.has(i.id) ? false : (seen.add(i.id), true)));
  }, [live, backend, stored]);

  const searchRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  // Закрываем меню при клике вне любого из трёх блоков.
  // Используем CLICK (а не mousedown) — иначе вложенные кнопки не успевают
  // обработать клик до закрытия меню.
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const t = e.target as Node;
      const insideAny =
        searchRef.current?.contains(t) ||
        bellRef.current?.contains(t) ||
        userRef.current?.contains(t);
      if (!insideAny) setOpenMenu(null);
    }
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  function go(to: string) {
    setOpenMenu(null);
    setSearch('');
    navigate(to);
  }

  function handleLogout() {
    setOpenMenu(null);
    logout();
    // navigate('/login') не обязателен — RequireRole сам сделает редирект,
    // но добавим явный для надёжности
    navigate('/login', { replace: true });
  }

  const q = search.trim().toLowerCase();
  const results =
    q.length >= 2
      ? [
          ...allIncidents
            .filter(
              (i) =>
                i.id.toLowerCase().includes(q) ||
                i.region.toLowerCase().includes(q) ||
                i.objectName.toLowerCase().includes(q),
            )
            .slice(0, 6)
            .map((i) => ({
              type: 'Инцидент' as const,
              id: i.id,
              label: i.id,
              sub: `${i.region}, ${i.objectName}`,
              to: `/incidents/${i.id}`,
            })),
          ...OBJECTS.filter(
            (o) => o.name.toLowerCase().includes(q) || o.region.toLowerCase().includes(q),
          )
            .slice(0, 4)
            .map((o) => ({
              type: 'Объект' as const,
              id: o.id,
              label: o.name,
              sub: `${o.region}, ${o.id}`,
              to: `/objects/${o.id}`,
            })),
        ]
      : [];

  const pending = allIncidents.filter((i) => i.verified === 'pending' || i.verified === 'new').length;
  const critical = allIncidents.filter((i) => i.severity === 'critical').length;
  const notifications = [
    { id: 'n1', label: `${pending} инцидентов в очереди верификации`, to: '/verification' },
    { id: 'n2', label: `${critical} критических событий за период`, to: '/incidents' },
    { id: 'n3', label: 'Подписки на email-уведомления', to: '/subscriptions' },
  ];

  return (
    <header className="fixed inset-x-0 top-0 z-50 flex h-14 items-center gap-4 bg-brand-500 px-5 text-white">
      <Link to="/dashboard" className="flex items-center gap-3" onClick={() => setOpenMenu(null)}>
        <div className="flex h-7 w-7 items-center justify-center rounded bg-white/15 text-xs font-bold">ИАС</div>
        <h1 className="hidden text-[15px] font-semibold lg:block">
          Модуль мониторинга инцидентов с применением БПЛА в отношении объектов ТЭК
        </h1>
        <h1 className="text-[14px] font-semibold lg:hidden">ИАС мониторинга</h1>
      </Link>

      {/* Поиск */}
      <div ref={searchRef} className="relative ml-auto w-80 max-w-[40vw]">
        <div className="flex h-8 items-center gap-2 rounded-full bg-white/15 px-3">
          <Search className="h-3.5 w-3.5 text-white/80" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setOpenMenu('search');
            }}
            onFocus={() => setOpenMenu('search')}
            placeholder="Поиск по инцидентам, объектам, регионам..."
            className="w-full bg-transparent text-xs text-white outline-none placeholder:text-white/70"
          />
        </div>
        {openMenu === 'search' && results.length > 0 && (
          <div className="absolute inset-x-0 top-10 z-50 max-h-80 overflow-y-auto rounded border border-surface-border bg-white text-ink shadow-lg">
            {results.map((r) => (
              <button
                key={r.type + r.id}
                type="button"
                onClick={() => go(r.to)}
                className="block w-full px-3 py-2 text-left text-xs hover:bg-brand-50"
              >
                <div className="font-semibold text-brand-700">
                  {r.type}: {r.label}
                </div>
                <div className="text-ink-muted">{r.sub}</div>
              </button>
            ))}
          </div>
        )}
        {openMenu === 'search' && q.length >= 2 && results.length === 0 && (
          <div className="absolute inset-x-0 top-10 z-50 rounded border border-surface-border bg-white p-3 text-xs text-ink-muted shadow-lg">
            Ничего не найдено по запросу «{search}»
          </div>
        )}
      </div>

      {/* Уведомления */}
      <div ref={bellRef} className="relative">
        <button
          type="button"
          onClick={() => setOpenMenu((m) => (m === 'bell' ? null : 'bell'))}
          className="relative flex h-7 w-7 items-center justify-center rounded-full bg-white/15 hover:bg-white/25"
          aria-label="Уведомления"
        >
          <Bell className="h-3.5 w-3.5" />
          <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-600 text-[9px] font-bold">
            {notifications.length}
          </span>
        </button>
        {openMenu === 'bell' && (
          <div className="absolute right-0 top-10 z-50 w-80 rounded border border-surface-border bg-white text-ink shadow-lg">
            <div className="border-b border-surface-border px-3 py-2 text-xs font-semibold">Уведомления</div>
            {notifications.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => go(n.to)}
                className="block w-full px-3 py-2 text-left text-xs hover:bg-brand-50"
              >
                {n.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Профиль и выход */}
      {user && (
        <div ref={userRef} className="relative">
          <button
            type="button"
            onClick={() => setOpenMenu((m) => (m === 'user' ? null : 'user'))}
            className="flex items-center gap-2 rounded-full bg-white/15 px-2 py-1 hover:bg-white/25"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/30 text-[11px] font-semibold">
              {user.avatarInitials}
            </span>
            <span className="text-xs font-medium">{ROLE_LABEL[user.role]}</span>
            <ChevronDown className="h-3 w-3" />
          </button>
          {openMenu === 'user' && (
            <div className="absolute right-0 top-10 z-50 w-56 rounded border border-surface-border bg-white text-ink shadow-lg">
              <div className="border-b border-surface-border px-3 py-2 text-xs">
                <div className="font-semibold">{user.name}</div>
                <div className="text-ink-muted">{user.email}</div>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-brand-50"
              >
                <LogOut className="h-3.5 w-3.5" /> Выйти
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
