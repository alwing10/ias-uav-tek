import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChevronDown, MapPin } from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { KpiCard } from '@/components/common/KpiCard';
import { Card } from '@/components/common/Card';
import {
  SeverityBadge,
  IncidentStatusBadge,
  VerificationBadge,
} from '@/components/common/StatusBadge';
import { useIncidents } from '@/store/incidents';
import { useLiveData } from '@/store/liveData';
import {
  OBJECT_TYPE_GROUP,
  SEVERITY_COLOR,
  SEVERITY_LABEL,
  UAV_LABEL,
  type Severity,
} from '@/types/domain';
import { formatDate, MONTHS, nf } from '@/utils/format';
import { REGIONS } from '@/mocks/regions';

const PERIODS = [
  { value: '7d', label: '7 дн', days: 7 },
  { value: '30d', label: '30 дн', days: 30 },
  { value: '90d', label: '90 дн', days: 90 },
  { value: 'year', label: 'Год', days: 365 },
  { value: 'custom', label: 'Произвольный', days: 365 },
] as const;

const NOW = new Date('2026-05-29T12:00:00Z');

export function DashboardPage() {
  const [period, setPeriod] = useState<(typeof PERIODS)[number]['value']>('year');
  const stored = useIncidents((s) => s.incidents);
  const live = useLiveData((s) => s.incidents);
  const liveStatus = useLiveData((s) => s.status);
  // Объединяем сохранённые и live в один поток. Live идут первыми (свежие сверху).
  const incidents = useMemo(() => [...live, ...stored], [live, stored]);

  const days = PERIODS.find((p) => p.value === period)!.days;
  const from = new Date(NOW.getTime() - days * 24 * 3600_000);
  const prevFrom = new Date(NOW.getTime() - 2 * days * 24 * 3600_000);

  const current = useMemo(
    () => incidents.filter((i) => new Date(i.datetime) >= from && new Date(i.datetime) <= NOW),
    [incidents, days],
  );
  const previous = useMemo(
    () => incidents.filter((i) => new Date(i.datetime) >= prevFrom && new Date(i.datetime) < from),
    [incidents, days],
  );

  const total = current.length;
  const critical = current.filter((i) => i.severity === 'critical').length;
  const unverified = current.filter((i) => i.verified === 'pending' || i.verified === 'new').length;
  const monthFromNow = new Date(NOW.getTime() - 30 * 24 * 3600_000);
  const lastMonth = current.filter((i) => new Date(i.datetime) >= monthFromNow).length;

  const totalDelta = previous.length === 0 ? 0 : Math.round(((total - previous.length) / previous.length) * 100);
  const critDelta =
    previous.filter((i) => i.severity === 'critical').length === 0
      ? 0
      : Math.round(
          ((critical - previous.filter((i) => i.severity === 'critical').length) /
            previous.filter((i) => i.severity === 'critical').length) *
            100,
        );

  // Распределение по тяжести
  const sevData = (['low', 'medium', 'high', 'critical'] as Severity[]).map((s) => ({
    severity: s,
    label: SEVERITY_LABEL[s],
    value: current.filter((i) => i.severity === s).length,
    color: SEVERITY_COLOR[s],
  }));
  const maxSev = Math.max(1, ...sevData.map((s) => s.value));

  // Динамика по месяцам
  const monthlyData = useMemo(() => {
    const byMonth = new Map<number, number>();
    current.forEach((i) => {
      const m = new Date(i.datetime).getMonth();
      byMonth.set(m, (byMonth.get(m) ?? 0) + 1);
    });
    return Array.from(byMonth.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([m, n]) => ({ month: MONTHS[m], value: n }));
  }, [current]);

  // Структура по типам ТЭК
  const typeData = useMemo(() => {
    const m = new Map<string, number>();
    current.forEach((i) => {
      const g = OBJECT_TYPE_GROUP[i.objectType];
      m.set(g, (m.get(g) ?? 0) + 1);
    });
    return Array.from(m.entries()).map(([name, value]) => ({ name, value }));
  }, [current]);
  const TYPE_COLORS = ['#1E4D8B', '#2B5797', '#5B7FB6', '#8AA5CB', '#B8C8DE', '#D9DDE3'];

  const recent = current.slice(0, 8);

  // География (упрощённая карта РФ — простая SVG-подложка с маркерами)
  const regionsAgg = useMemo(() => {
    const m = new Map<string, { count: number; crit: number }>();
    current.forEach((i) => {
      const v = m.get(i.regionCode) ?? { count: 0, crit: 0 };
      v.count += 1;
      if (i.severity === 'critical' || i.severity === 'high') v.crit += 1;
      m.set(i.regionCode, v);
    });
    return Array.from(m.entries())
      .map(([code, v]) => {
        const r = REGIONS.find((x) => x.code === code)!;
        return { code, ...v, name: r.shortName, lat: r.center.lat, lon: r.center.lon };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 80);
  }, [current]);

  return (
    <PageContainer
      title="Сводная панель"
      subtitle="Текущая оперативная обстановка по инцидентам ТЭК"
      toolbar={
        <div className="flex items-center gap-1 rounded border border-surface-border bg-white p-0.5 text-xs">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`rounded px-2 py-1 ${
                period === p.value ? 'bg-brand-600 text-white' : 'text-ink hover:bg-brand-50'
              }`}
            >
              {p.label}
            </button>
          ))}
          <span className="ml-2 hidden items-center gap-1 pr-2 text-ink-muted md:flex">
            {formatDate(from.toISOString())} — {formatDate(NOW.toISOString())}
            <ChevronDown className="h-3 w-3" />
          </span>
        </div>
      }
    >
      {live.length > 0 && (
        <div className="mb-3 flex items-center gap-2 rounded-card border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
          <b>Live-режим активен:</b> подгружено <b>{live.length}</b> реальных событий из открытых
          источников (GDELT 2.0 + RSS российских СМИ). Обновление каждые 10 минут.
        </div>
      )}
      {live.length === 0 && liveStatus === 'error' && (
        <div className="mb-3 flex items-center gap-2 rounded-card border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-800">
          <span className="flex h-2 w-2 rounded-full bg-orange-500" />
          Не удалось загрузить реальные данные из источников. Показаны только демо-данные.
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard
          label="Всего инцидентов"
          value={nf(total)}
          trend={{ delta: totalDelta, positive: totalDelta >= 0 }}
          hint=" к прошлому периоду"
        />
        <KpiCard label="За месяц" value={nf(lastMonth)} hint={`из ${nf(total)} за период`} />
        <KpiCard
          label="Критических"
          value={nf(critical)}
          accent="critical"
          trend={{ delta: critDelta, positive: critDelta >= 0 }}
          hint=" к прошлому периоду"
        />
        <KpiCard
          label="Неверифицированных"
          value={nf(unverified)}
          accent="warning"
          hint="в очереди эксперта"
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Card
          className="lg:col-span-2"
          title="Геораспределение за период"
          subtitle="Размер маркера — число инцидентов в регионе"
        >
          <div className="relative h-[260px] overflow-hidden rounded bg-[#E8EEF5]">
            {/* Простая силуэтная подложка РФ */}
            <svg viewBox="0 0 800 260" className="absolute inset-0 h-full w-full">
              <path
                d="M 20 160 Q 200 80 420 100 T 760 130 L 780 200 Q 600 230 360 220 T 60 230 Z"
                fill="#C7D2DE"
                stroke="#9AA8B8"
              />
            </svg>
            {regionsAgg.map((r) => {
              // Преобразуем lat/lon в SVG-координаты приблизительно
              const x = ((r.lon - 20) / 160) * 760 + 20;
              const y = 260 - ((r.lat - 41) / 30) * 200;
              const size = Math.max(4, Math.min(22, 3 + Math.sqrt(r.count) * 1.6));
              const color = r.crit > r.count * 0.4 ? SEVERITY_COLOR.critical : r.crit > 0 ? SEVERITY_COLOR.high : '#1E4D8B';
              return (
                <div
                  key={r.code}
                  className="absolute rounded-full border border-white/70 shadow"
                  style={{
                    left: `${(x / 800) * 100}%`,
                    top: `${(y / 260) * 100}%`,
                    width: size,
                    height: size,
                    background: color,
                    opacity: 0.78,
                    transform: 'translate(-50%, -50%)',
                  }}
                  title={`${r.name}: ${r.count}`}
                />
              );
            })}
            <div className="absolute bottom-2 left-3 flex items-center gap-3 text-[10px] text-ink-muted">
              <Legend2 color={SEVERITY_COLOR.critical} label="Критический" />
              <Legend2 color={SEVERITY_COLOR.high} label="Высокий" />
              <Legend2 color={SEVERITY_COLOR.medium} label="Средний" />
              <Legend2 color={SEVERITY_COLOR.low} label="Низкий" />
            </div>
          </div>
        </Card>

        <Card title="Распределение по тяжести">
          <div className="space-y-3">
            {sevData.map((s) => (
              <div key={s.severity}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-ink">{s.label}</span>
                  <span className="text-ink-muted">{nf(s.value)}</span>
                </div>
                <div className="h-3 overflow-hidden rounded bg-surface">
                  <div
                    className="h-full rounded"
                    style={{ width: `${(s.value / maxSev) * 100}%`, background: s.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Card className="lg:col-span-2" title="Динамика по месяцам">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E9EF" />
                <XAxis dataKey="month" stroke="#6B7280" fontSize={11} />
                <YAxis stroke="#6B7280" fontSize={11} />
                <Tooltip
                  contentStyle={{ fontSize: 12, border: '1px solid #D9DDE3' }}
                  labelStyle={{ fontWeight: 600 }}
                />
                <Bar dataKey="value" name="Инциденты" fill="#2B5797" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Структура по типам ТЭК">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={typeData}
                  innerRadius={40}
                  outerRadius={70}
                  paddingAngle={2}
                  dataKey="value"
                  nameKey="name"
                >
                  {typeData.map((_, i) => (
                    <Cell key={i} fill={TYPE_COLORS[i % TYPE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v: number) => nf(v as number)}
                  contentStyle={{ fontSize: 12, border: '1px solid #D9DDE3' }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card
        className="mt-4"
        title="Последние инциденты"
        toolbar={
          <Link to="/incidents" className="text-xs text-brand-600 hover:underline">
            Открыть все →
          </Link>
        }
        padding="none"
      >
        <table className="w-full text-xs">
          <thead className="bg-surface text-ink-muted">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">ID</th>
              <th className="px-3 py-2 text-left font-semibold">Дата</th>
              <th className="px-3 py-2 text-left font-semibold">Регион</th>
              <th className="px-3 py-2 text-left font-semibold">Объект</th>
              <th className="px-3 py-2 text-left font-semibold">Тип БПЛА</th>
              <th className="px-3 py-2 text-left font-semibold">Тяжесть</th>
              <th className="px-3 py-2 text-left font-semibold">Источник</th>
              <th className="px-3 py-2 text-left font-semibold">Статус</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((i, idx) => (
              <tr
                key={i.id}
                className={`border-t border-surface-border hover:bg-brand-50 ${
                  idx % 2 === 1 ? 'bg-surface/40' : ''
                }`}
              >
                <td className="px-3 py-2 font-semibold text-brand-700">
                  <Link to={`/incidents/${i.id}`} className="inline-flex items-center gap-1">
                    {i.id}
                    {i.id.startsWith('LIVE-') && (
                      <span className="rounded bg-emerald-100 px-1 text-[9px] font-semibold uppercase text-emerald-700">
                        live
                      </span>
                    )}
                  </Link>
                </td>
                <td className="px-3 py-2">{formatDate(i.datetime)}</td>
                <td className="px-3 py-2">{REGIONS.find((r) => r.code === i.regionCode)?.shortName}</td>
                <td className="px-3 py-2 max-w-[200px] truncate">
                  <MapPin className="mr-1 inline h-3 w-3 text-ink-muted" />
                  {i.objectName}
                </td>
                <td className="px-3 py-2">{UAV_LABEL[i.uavType]}</td>
                <td className="px-3 py-2">
                  <SeverityBadge severity={i.severity} />
                </td>
                <td className="px-3 py-2 text-ink-muted">{i.sources[0]?.name}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1">
                    <IncidentStatusBadge status={i.status} />
                    <VerificationBadge status={i.verified} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </PageContainer>
  );
}

function Legend2({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}
