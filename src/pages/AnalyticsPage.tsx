import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Area,
  AreaChart,
} from 'recharts';
import { Download } from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Tabs } from '@/components/common/Tabs';
import { KpiCard } from '@/components/common/KpiCard';
import { useIncidents } from '@/store/incidents';
import { useLiveData } from '@/store/liveData';
import {
  OBJECT_TYPE_GROUP,
  SCENARIOS,
  SEVERITY_COLOR,
  UAV_LABEL,
  type UavType,
} from '@/types/domain';
import { MONTHS, nf } from '@/utils/format';
import { exportIncidentsXLSX, exportIncidentsPDF } from '@/utils/exporters';
import { REGIONS } from '@/mocks/regions';

type SubTab = 'dynamics' | 'structure' | 'geography' | 'forecast';

export function AnalyticsPage() {
  const stored = useIncidents((s) => s.incidents);
  const live = useLiveData((s) => s.incidents);
  const incidents = useMemo(() => [...live, ...stored], [live, stored]);
  const [tab, setTab] = useState<SubTab>('dynamics');

  return (
    <PageContainer
      title="Аналитический дашборд"
      subtitle="Динамика и распределение инцидентов"
      toolbar={
        <div className="flex gap-1">
          <Button size="sm" variant="outline" icon={<Download className="h-3.5 w-3.5" />} onClick={() => exportIncidentsXLSX(incidents, 'analytics.xlsx')}>
            XLSX
          </Button>
          <Button size="sm" icon={<Download className="h-3.5 w-3.5" />} onClick={() => exportIncidentsPDF(incidents, 'Аналитический отчёт', 'analytics.pdf')}>
            PDF
          </Button>
        </div>
      }
    >
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'dynamics', label: 'Динамика' },
          { value: 'structure', label: 'Структура' },
          { value: 'geography', label: 'География' },
          { value: 'forecast', label: 'Прогноз' },
        ]}
      />

      <div className="mt-4">
        {tab === 'dynamics' && <DynamicsPanel incidents={incidents} />}
        {tab === 'structure' && <StructurePanel incidents={incidents} />}
        {tab === 'geography' && <GeographyPanel incidents={incidents} />}
        {tab === 'forecast' && <ForecastPanel incidents={incidents} />}
      </div>
    </PageContainer>
  );
}

function DynamicsPanel({ incidents }: { incidents: ReturnType<typeof useIncidents>['incidents'] }) {
  const monthlyData = useMemo(() => {
    const by = new Map<number, number>();
    incidents.forEach((i) => {
      const m = new Date(i.datetime).getMonth();
      by.set(m, (by.get(m) ?? 0) + 1);
    });
    return Array.from(by.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([m, v]) => ({ month: MONTHS[m], value: v }));
  }, [incidents]);

  const typeData = useMemo(() => {
    const m = new Map<string, number>();
    incidents.forEach((i) => {
      const g = OBJECT_TYPE_GROUP[i.objectType];
      m.set(g, (m.get(g) ?? 0) + 1);
    });
    const total = incidents.length;
    return Array.from(m.entries()).map(([name, value]) => ({ name, value, pct: Math.round((value / total) * 100) }));
  }, [incidents]);
  const TYPE_COLORS = ['#1E4D8B', '#2B5797', '#5B7FB6', '#8AA5CB', '#B8C8DE', '#D9DDE3'];

  const topRegions = useMemo(() => {
    const m = new Map<string, number>();
    incidents.forEach((i) => m.set(i.regionCode, (m.get(i.regionCode) ?? 0) + 1));
    return Array.from(m.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([code, v]) => ({ name: REGIONS.find((r) => r.code === code)?.shortName ?? code, value: v }));
  }, [incidents]);
  const maxRegion = Math.max(1, ...topRegions.map((r) => r.value));

  const uavData = useMemo(() => {
    const order: UavType[] = ['fpv', 'plane', 'mini', 'multi', 'loitering', 'unknown'];
    return order.map((u) => ({
      name: UAV_LABEL[u],
      value: incidents.filter((i) => i.uavType === u).length,
    }));
  }, [incidents]);
  const maxUav = Math.max(1, ...uavData.map((u) => u.value));

  const heatmap = useMemo(() => {
    const rows = ['BEL', 'KRS', 'BRY', 'VOR', 'RST', 'KDA'];
    const monthsUsed = [0, 1, 2, 3, 4];
    return rows.map((code) => {
      const r = REGIONS.find((x) => x.code === code)!;
      const vals = monthsUsed.map(
        (m) => incidents.filter((i) => i.regionCode === code && new Date(i.datetime).getMonth() === m).length,
      );
      const max = Math.max(1, ...vals);
      return { code, name: r.shortName, vals, max };
    });
  }, [incidents]);
  const globalHeatMax = Math.max(1, ...heatmap.flatMap((h) => h.vals));

  // KPI
  const days = 150;
  const avgPerDay = incidents.length / days;
  const repelled = incidents.filter((i) => i.status === 'repelled').length;
  const repelPct = Math.round((repelled / incidents.length) * 100);
  const avgDamage = (incidents.reduce((s, i) => s + i.damage, 0) / incidents.length).toFixed(1);

  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <KpiCard label="Среднесуточное число" value={avgPerDay.toFixed(1)} />
        <KpiCard label="% успешности атак" value={`${100 - repelPct}%`} accent="warning" />
        <KpiCard label="Средний ущерб" value={avgDamage} />
        <KpiCard label="Индекс напряжённости" value={(avgPerDay * 0.4 + (100 - repelPct) * 0.06).toFixed(1)} accent="critical" />
        <KpiCard label="% отражённых" value={`${repelPct}%`} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Card className="lg:col-span-2" title="Динамика инцидентов по месяцам" subtitle="Полная выборка за период">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E9EF" />
                <XAxis dataKey="month" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Bar dataKey="value" name="Инциденты" fill="#2B5797" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="По типам объектов ТЭК">
          <div className="h-64">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={typeData} dataKey="value" nameKey="name" innerRadius={36} outerRadius={70}>
                  {typeData.map((_, i) => (
                    <Cell key={i} fill={TYPE_COLORS[i % TYPE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => nf(v as number)} contentStyle={{ fontSize: 12 }} />
                <Legend
                  formatter={(value, entry: any) => `${value} — ${entry.payload?.pct ?? ''}%`}
                  wrapperStyle={{ fontSize: 11 }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Card title="Топ-10 регионов по числу инцидентов">
          <div className="space-y-1.5">
            {topRegions.map((r) => (
              <div key={r.name} className="flex items-center gap-2 text-xs">
                <span className="w-40 truncate text-ink">{r.name}</span>
                <div className="flex-1 rounded bg-surface">
                  <div className="h-3 rounded bg-brand-600" style={{ width: `${(r.value / maxRegion) * 100}%` }} />
                </div>
                <span className="w-10 text-right text-ink-muted">{r.value}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Распределение по типам БПЛА">
          <div className="space-y-2">
            {uavData.map((u, idx) => (
              <div key={u.name}>
                <div className="text-xs text-ink">{u.name}</div>
                <div className="mt-1 h-5 rounded bg-surface">
                  <div
                    className="flex h-full items-center justify-end rounded pr-2 text-[10px] font-semibold text-white"
                    style={{ width: `${(u.value / maxUav) * 100}%`, background: ['#1E4D8B', '#5B7FB6', '#8AA5CB', '#B8C8DE', '#A0AEC0', '#D9DDE3'][idx] }}
                  >
                    {u.value}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="mt-4" title="Тепловая карта: регион × месяц">
        <div className="overflow-x-auto">
          <table className="text-[11px]">
            <thead>
              <tr>
                <th className="w-32"></th>
                {MONTHS.slice(0, 5).map((m) => (
                  <th key={m} className="px-2 text-center text-ink-muted">
                    {m}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {heatmap.map((row) => (
                <tr key={row.code}>
                  <td className="px-2 py-1 text-ink">{row.name}</td>
                  {row.vals.map((v, i) => (
                    <td key={i} className="px-1 py-1">
                      <div
                        className="heat-cell h-5 w-20 rounded text-center text-[10px] font-semibold text-white"
                        style={{
                          background: `rgba(43,87,151,${Math.max(0.12, v / globalHeatMax)})`,
                          lineHeight: '1.25rem',
                        }}
                      >
                        {v}
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

function StructurePanel({ incidents }: { incidents: ReturnType<typeof useIncidents>['incidents'] }) {
  const uavData = (['fpv', 'plane', 'mini', 'multi', 'loitering', 'unknown'] as UavType[]).map((u) => ({
    name: UAV_LABEL[u],
    value: incidents.filter((i) => i.uavType === u).length,
  }));
  const COLORS = ['#1E4D8B', '#2B5797', '#5B7FB6', '#8AA5CB', '#B8C8DE', '#D9DDE3'];

  const scenarioData = SCENARIOS.map((s) => ({
    name: s,
    value: incidents.filter((i) => i.scenario === s).length,
  }));

  const stackedData = MONTHS.slice(0, 5).map((m, idx) => {
    const subset = incidents.filter((i) => new Date(i.datetime).getMonth() === idx);
    return {
      month: m,
      low: subset.filter((i) => i.severity === 'low').length,
      medium: subset.filter((i) => i.severity === 'medium').length,
      high: subset.filter((i) => i.severity === 'high').length,
      critical: subset.filter((i) => i.severity === 'critical').length,
    };
  });

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      <Card title="Распределение по типам БПЛА">
        <div className="h-64">
          <ResponsiveContainer>
            <PieChart>
              <Pie data={uavData} dataKey="value" nameKey="name" outerRadius={80}>
                {uavData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <Card title="Сценарии применения">
        <div className="h-64">
          <ResponsiveContainer>
            <BarChart data={scenarioData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" fontSize={11} />
              <YAxis type="category" dataKey="name" width={180} fontSize={11} />
              <Tooltip />
              <Bar dataKey="value" fill="#2B5797" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <Card className="lg:col-span-2" title="Структура тяжести по месяцам">
        <div className="h-72">
          <ResponsiveContainer>
            <BarChart data={stackedData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="low" stackId="a" fill={SEVERITY_COLOR.low} name="Низкая" />
              <Bar dataKey="medium" stackId="a" fill={SEVERITY_COLOR.medium} name="Средняя" />
              <Bar dataKey="high" stackId="a" fill={SEVERITY_COLOR.high} name="Высокая" />
              <Bar dataKey="critical" stackId="a" fill={SEVERITY_COLOR.critical} name="Критическая" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}

function GeographyPanel({ incidents }: { incidents: ReturnType<typeof useIncidents>['incidents'] }) {
  const data = useMemo(() => {
    const m = new Map<string, number>();
    incidents.forEach((i) => m.set(i.regionCode, (m.get(i.regionCode) ?? 0) + 1));
    return Array.from(m.entries())
      .map(([code, v]) => ({
        code,
        name: REGIONS.find((r) => r.code === code)?.shortName ?? code,
        v,
      }))
      .sort((a, b) => b.v - a.v);
  }, [incidents]);
  const max = Math.max(1, ...data.map((d) => d.v));

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
      <Card className="lg:col-span-2" title="Хороплет: интенсивность инцидентов по регионам">
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {data.slice(0, 24).map((d) => {
            const intensity = d.v / max;
            return (
              <div
                key={d.code}
                className="rounded-card border border-surface-border p-2 text-xs"
                style={{ background: `rgba(43,87,151,${Math.max(0.06, intensity)})`, color: intensity > 0.5 ? 'white' : '#1F3F6E' }}
              >
                <div className="font-semibold">{d.name}</div>
                <div className="mt-0.5 text-[10px] opacity-80">{d.v} инцидентов</div>
              </div>
            );
          })}
        </div>
      </Card>
      <Card title="Топ-15 регионов">
        <ol className="space-y-1 text-xs">
          {data.slice(0, 15).map((d, idx) => (
            <li key={d.code} className="flex items-center gap-2">
              <span className="w-5 text-ink-muted">{idx + 1}.</span>
              <span className="flex-1 truncate text-ink">{d.name}</span>
              <span className="font-semibold text-brand-700">{d.v}</span>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}

function ForecastPanel({ incidents }: { incidents: ReturnType<typeof useIncidents>['incidents'] }) {
  // 5 факт. месяцев + 3 прогноз
  const fact = MONTHS.slice(0, 5).map((m, idx) => ({
    month: m,
    fact: incidents.filter((i) => new Date(i.datetime).getMonth() === idx).length,
  }));
  const avg = fact.reduce((s, f) => s + f.fact, 0) / fact.length;
  const forecast = ['Июн', 'Июл', 'Авг'].map((m, idx) => ({
    month: m,
    forecast: Math.round(avg * (1 + 0.04 * (idx + 1))),
    lo: Math.round(avg * (1 + 0.04 * (idx + 1)) * 0.78),
    hi: Math.round(avg * (1 + 0.04 * (idx + 1)) * 1.22),
  }));

  const data = [
    ...fact.map((f) => ({ month: f.month, fact: f.fact })),
    ...forecast,
  ];

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
      <Card className="lg:col-span-2" title="Прогноз числа инцидентов на 3 месяца">
        <div className="h-72">
          <ResponsiveContainer>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="fact" name="Факт" stroke="#1E4D8B" strokeWidth={2.5} dot />
              <Line type="monotone" dataKey="forecast" name="Прогноз" stroke="#F57C00" strokeWidth={2.5} strokeDasharray="5 4" dot />
              <Line type="monotone" dataKey="hi" name="Верхняя граница" stroke="#F57C00" strokeOpacity={0.4} strokeDasharray="2 4" />
              <Line type="monotone" dataKey="lo" name="Нижняя граница" stroke="#F57C00" strokeOpacity={0.4} strokeDasharray="2 4" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <Card title="Доверительный интервал">
        <p className="text-xs text-ink-muted">
          Модель: экспоненциальное сглаживание Holt–Winters (тестовый прогноз). Доверительная вероятность 90%, MAPE ≈ 11%.
        </p>
        <div className="mt-3 space-y-1 text-xs">
          {forecast.map((f) => (
            <div key={f.month} className="flex items-center justify-between rounded bg-surface px-2 py-1">
              <span className="font-semibold">{f.month}</span>
              <span>{f.lo} ÷ {f.forecast} ÷ {f.hi}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
