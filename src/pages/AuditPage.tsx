import { useMemo, useState } from 'react';
import { Download, Search } from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Select } from '@/components/common/Select';
import { AUDIT } from '@/mocks/audit';
import { ROLE_LABEL } from '@/types/domain';
import { formatDateTime, nf } from '@/utils/format';
import * as XLSX from 'xlsx';

export function AuditPage() {
  const [from, setFrom] = useState('2026-04-01');
  const [to, setTo] = useState('2026-05-29');
  const [user, setUser] = useState('');
  const [action, setAction] = useState('');
  const [search, setSearch] = useState('');

  const actions = useMemo(() => Array.from(new Set(AUDIT.map((a) => a.action))), []);
  const users = useMemo(() => Array.from(new Set(AUDIT.map((a) => a.user))), []);

  const filtered = useMemo(() => {
    return AUDIT.filter((a) => {
      const d = new Date(a.datetime);
      if (d < new Date(from) || d > new Date(to + 'T23:59:59')) return false;
      if (user && a.user !== user) return false;
      if (action && a.action !== action) return false;
      if (search && !a.object.toLowerCase().includes(search.toLowerCase()) && !a.user.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [from, to, user, action, search]);

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
      subtitle="Все действия пользователей и системы"
      toolbar={
        <Button size="sm" variant="outline" icon={<Download className="h-3.5 w-3.5" />} onClick={exportXlsx}>
          Экспорт XLSX
        </Button>
      }
    >
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
            {filtered.slice(0, 200).map((a, idx) => (
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
