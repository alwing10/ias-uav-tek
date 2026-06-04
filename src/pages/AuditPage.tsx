import { useMemo, useState, useEffect } from 'react';
import { Download, RefreshCw, Search } from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Select } from '@/components/common/Select';
// Демо-моки журнала аудита убраны вместе с другой синтетикой —
// журнал показывает только реальные события с backend.
import { ROLE_LABEL, type AuditEvent } from '@/types/domain';
import { formatDateTime, nf, todayISO, daysAgoISO } from '@/utils/format';
import * as XLSX from 'xlsx';
import { fetchAudit } from '@/services/backendApi';
import { useBackend } from '@/store/backendData';

export function AuditPage() {
  const backendEnabled = useBackend((s) => s.enabled);
  const backendStatus = useBackend((s) => s.status);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [from, setFrom] = useState(daysAgoISO(60));
  const [to, setTo] = useState(todayISO());
  const [user, setUser] = useState('');
  const [action, setAction] = useState('');
  const [search, setSearch] = useState('');

  async function refresh() {
    setLoading(true);
    try {
      if (backendEnabled) {
        const real = await fetchAudit();
        setEvents(real);
      } else {
        setEvents([]);
      }
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    // Каждую минуту обновляем
    const t = setInterval(() => void refresh(), 60_000);
    return () => clearInterval(t);
  }, [backendEnabled]);

  const actions = useMemo(() => Array.from(new Set(events.map((a) => a.action))), [events]);
  const users = useMemo(() => Array.from(new Set(events.map((a) => a.user))), [events]);

  const filtered = useMemo(() => {
    return events.filter((a) => {
      const d = new Date(a.datetime);
      if (d < new Date(from) || d > new Date(to + 'T23:59:59')) return false;
      if (user && a.user !== user) return false;
      if (action && a.action !== action) return false;
      if (
        search &&
        !a.object.toLowerCase().includes(search.toLowerCase()) &&
        !a.user.toLowerCase().includes(search.toLowerCase())
      )
        return false;
      return true;
    });
  }, [events, from, to, user, action, search]);

  function exportXlsx() {
    const rows = filtered.map((a) => ({
      Дата: formatDateTime(a.datetime),
      Пользователь: a.user,
      Роль: ROLE_LABEL[a.role],
      Действие: a.action,
      Объект: a.object,
      IP: a.ip,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Журнал');
    XLSX.writeFile(wb, 'audit.xlsx');
  }

  return (
    <PageContainer
      title="Журнал аудита"
      subtitle={
        backendEnabled
          ? `Реальные события из backend: ${nf(events.length)}`
          : 'Backend не подключён — журнал недоступен'
      }
      toolbar={
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={() => void refresh()} disabled={loading} icon={<RefreshCw className={loading ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} />}>
            Обновить
          </Button>
          <Button size="sm" variant="outline" icon={<Download className="h-3.5 w-3.5" />} onClick={exportXlsx}>
            Экспорт XLSX
          </Button>
        </div>
      }
    >
      {backendEnabled && backendStatus === 'ok' && (
        <div className="mb-3 flex items-center gap-2 rounded-card border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
          События записываются в реальном времени: каждая верификация, создание
          инцидента, изменение подписки сохраняется в SQLite на backend.
        </div>
      )}

      <Card padding="sm" className="mb-3">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
          <div>
            <span className="block text-[10px] font-semibold uppercase text-ink-muted">Период от</span>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="h-8 w-full rounded border border-surface-border px-2 text-xs"
            />
          </div>
          <div>
            <span className="block text-[10px] font-semibold uppercase text-ink-muted">Период до</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="h-8 w-full rounded border border-surface-border px-2 text-xs"
            />
          </div>
          <Select label="Пользователь" value={user} onChange={(e) => setUser(e.target.value)}>
            <option value="">Все</option>
            {users.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </Select>
          <Select label="Действие" value={action} onChange={(e) => setAction(e.target.value)}>
            <option value="">Все</option>
            {actions.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </Select>
          <div>
            <span className="block text-[10px] font-semibold uppercase text-ink-muted">Поиск</span>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-ink-muted" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="по объекту/пользователю"
                className="h-8 w-full rounded border border-surface-border bg-white pl-6 pr-2 text-xs"
              />
            </div>
          </div>
        </div>
      </Card>

      <Card padding="none" title={`Найдено событий: ${nf(filtered.length)}`}>
        <table className="w-full text-xs">
          <thead className="bg-surface text-ink-muted">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Время</th>
              <th className="px-3 py-2 text-left font-semibold">Пользователь</th>
              <th className="px-3 py-2 text-left font-semibold">Роль</th>
              <th className="px-3 py-2 text-left font-semibold">Действие</th>
              <th className="px-3 py-2 text-left font-semibold">Объект</th>
              <th className="px-3 py-2 text-left font-semibold">IP</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 300).map((a, idx) => (
              <tr key={a.id} className={`border-t border-surface-border ${idx % 2 === 1 ? 'bg-surface/40' : ''}`}>
                <td className="px-3 py-2 text-ink-muted">{formatDateTime(a.datetime)}</td>
                <td className="px-3 py-2 font-semibold">{a.user}</td>
                <td className="px-3 py-2">{ROLE_LABEL[a.role]}</td>
                <td className="px-3 py-2">{a.action}</td>
                <td className="px-3 py-2 font-mono text-[11px] text-ink-muted">{a.object}</td>
                <td className="px-3 py-2 font-mono text-[11px] text-ink-muted">{a.ip}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </PageContainer>
  );
}
