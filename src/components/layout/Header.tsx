import { useState, useEffect, useRef } from 'react';
import { Bell, ChevronDown, LogOut, Search } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/store/auth';
import { ROLE_LABEL } from '@/types/domain';
import { useIncidents } from '@/store/incidents';
import { OBJECTS } from '@/mocks/objects';

export function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const incidents = useIncidents((s) => s.incidents);

  useEffect(() => {
    const off = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) {
        setOpen(false);
        setUserMenu(false);
        setBellOpen(false);
      }
    };
    document.addEventListener('mousedown', off);
    return () => document.removeEventListener('mousedown', off);
  }, []);

  const q = search.trim().toLowerCase();
  const results =
    q.length >= 2
      ? [
          ...incidents
            .filter((i) => i.id.toLowerCase().includes(q) || i.region.toLowerCase().includes(q) || i.objectName.toLowerCase().includes(q))
            .slice(0, 6)
            .map((i) => ({ type: 'Инцидент' as const, id: i.id, label: i.id, sub: `${i.region}, ${i.objectName}`, to: `/incidents/${i.id}` })),
          ...OBJECTS.filter((o) => o.name.toLowerCase().includes(q) || o.region.toLowerCase().includes(q))
            .slice(0, 4)
            .map((o) => ({ type: 'Объект' as const, id: o.id, label: o.name, sub: `${o.region}, ${o.id}`, to: `/objects/${o.id}` })),
        ]
      : [];

  const notifications = [
    { id: 'n1', label: `${incidents.filter((i) => i.verified === 'pending').length} инцидентов в очереди верификации`, to: '/verification' },
    { id: 'n2', label: `${incidents.filter((i) => i.severity === 'critical').slice(0, 1).length > 0 ? 'Критические события за период' : 'Нет новых критических'}`, to: '/incidents?severity=critical' },
    { id: 'n3', label: 'Ошибки парсеров: 2', to: '/sources' },
  ];

  return (
    <header className="fixed inset-x-0 top-0 z-50 flex h-14 items-center gap-4 bg-brand-500 px-5 text-white">
      <Link to="/dashboard" className="flex items-center gap-3">
        <div className="flex h-7 w-7 items-center justify-center rounded bg-white/15 text-xs font-bold">ИАС</div>
        <h1 className="hidden text-[15px] font-semibold lg:block">
          Модуль мониторинга инцидентов с применением БПЛА в отношении объектов ТЭК
        </h1>
        <h1 className="text-[14px] font-semibold lg:hidden">ИАС мониторинга</h1>
      </Link>

      <div ref={ref} className="relative ml-auto w-80 max-w-[40vw]">
        <div className="flex h-8 items-center gap-2 rounded-full bg-white/15 px-3">
          <Search className="h-3.5 w-3.5 text-white/80" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder="Поиск по инцидентам, объектам, регионам..."
            className="w-full bg-transparent text-xs text-white outline-none placeholder:text-white/70"
          />
        </div>
        {open && results.length > 0 && (
          <div className="absolute inset-x-0 top-10 z-50 rounded border border-surface-border bg-white text-ink shadow-lg">
            {results.map((r) => (
              <button
                key={r.type + r.id}
                onClick={() => {
                  navigate(r.to);
                  setOpen(false);
                  setSearch('');
                }}
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
      </div>

      <div className="relative">
        <button
          onClick={() => setBellOpen((b) => !b)}
          className="relative flex h-7 w-7 items-center justify-center rounded-full bg-white/15 hover:bg-white/25"
          aria-label="Уведомления"
        >
          <Bell className="h-3.5 w-3.5" />
          <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-600 text-[9px] font-bold">
            {notifications.length}
          </span>
        </button>
        {bellOpen && (
          <div className="absolute right-0 top-10 z-50 w-80 rounded border border-surface-border bg-white text-ink shadow-lg">
            <div className="border-b border-surface-border px-3 py-2 text-xs font-semibold">Уведомления</div>
            {notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => {
                  navigate(n.to);
                  setBellOpen(false);
                }}
                className="block w-full px-3 py-2 text-left text-xs hover:bg-brand-50"
              >
                {n.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {user && (
        <div className="relative">
          <button
            onClick={() => setUserMenu((m) => !m)}
            className="flex items-center gap-2 rounded-full bg-white/15 px-2 py-1 hover:bg-white/25"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/30 text-[11px] font-semibold">
              {user.avatarInitials}
            </span>
            <span className="text-xs font-medium">{ROLE_LABEL[user.role]}</span>
            <ChevronDown className="h-3 w-3" />
          </button>
          {userMenu && (
            <div className="absolute right-0 top-10 z-50 w-56 rounded border border-surface-border bg-white text-ink shadow-lg">
              <div className="border-b border-surface-border px-3 py-2 text-xs">
                <div className="font-semibold">{user.name}</div>
                <div className="text-ink-muted">{user.email}</div>
              </div>
              <button
                onClick={() => {
                  logout();
                  navigate('/login');
                }}
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
