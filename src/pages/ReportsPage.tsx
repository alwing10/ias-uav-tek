import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { FileText, Plus, Save } from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { useIncidents } from '@/store/incidents';
import { OBJECT_TYPE_LABEL, SEVERITY_LABEL, UAV_LABEL, type ObjectType, type Severity, type UavType } from '@/types/domain';
import { MONTHS, formatDate, nf, todayISO, daysAgoISO } from '@/utils/format';
import { exportAnalyticReport } from '@/utils/exporters';
import { REGIONS } from '@/mocks/regions';

interface SavedTemplate {
  id: string;
  name: string;
  config: ReportConfig;
}

interface ReportConfig {
  period: { from: string; to: string };
  region: string;
  objectType: ObjectType | 'all';
  uavType: UavType | 'all';
  severity: Severity | 'all';
  onlyVerified: boolean;
  sections: {
    titlePage: boolean;
    kpi: boolean;
    map: boolean;
    dynamics: boolean;
    topRegions: boolean;
    byUav: boolean;
    fullTable: boolean;
    sourcesAppendix: boolean;
  };
  format: 'pdf' | 'xlsx' | 'docx';
}

const DEFAULT_CONFIG: ReportConfig = {
  period: { from: daysAgoISO(90), to: todayISO() },
  region: 'all',
  objectType: 'all',
  uavType: 'all',
  severity: 'all',
  onlyVerified: true,
  sections: {
    titlePage: true,
    kpi: true,
    map: true,
    dynamics: true,
    topRegions: true,
    byUav: true,
    fullTable: false,
    sourcesAppendix: false,
  },
  format: 'pdf',
};

export function ReportsPage() {
  const [config, setConfig] = useState<ReportConfig>(DEFAULT_CONFIG);
  const [templates, setTemplates] = useState<SavedTemplate[]>([
    { id: 't1', name: 'Ежемесячный (KPI + Динамика + Топ-10)', config: DEFAULT_CONFIG },
    { id: 't2', name: 'Полный отчёт за квартал (с реестром)', config: { ...DEFAULT_CONFIG, sections: { ...DEFAULT_CONFIG.sections, fullTable: true, sourcesAppendix: true } } },
  ]);
  const incidents = useIncidents((s) => s.incidents);

  const filtered = useMemo(() => {
    return incidents.filter((i) => {
      const d = new Date(i.datetime);
      if (d < new Date(config.period.from) || d > new Date(config.period.to + 'T23:59:59')) return false;
      if (config.region !== 'all' && i.regionCode !== config.region) return false;
      if (config.objectType !== 'all' && i.objectType !== config.objectType) return false;
      if (config.uavType !== 'all' && i.uavType !== config.uavType) return false;
      if (config.severity !== 'all' && i.severity !== config.severity) return false;
      if (config.onlyVerified && i.verified !== 'verified') return false;
      return true;
    });
  }, [incidents, config]);

  const monthlyData = useMemo(() => {
    const by = new Map<number, number>();
    filtered.forEach((i) => {
      const m = new Date(i.datetime).getMonth();
      by.set(m, (by.get(m) ?? 0) + 1);
    });
    return Array.from(by.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([m, v]) => ({ month: MONTHS[m], value: v }));
  }, [filtered]);

  const stats = useMemo(() => {
    const crit = filtered.filter((i) => i.severity === 'critical').length;
    const regions = new Set(filtered.map((i) => i.regionCode)).size;
    return { total: filtered.length, crit, regions };
  }, [filtered]);

  function generate() {
    void exportAnalyticReport(
      {
        title: 'АНАЛИТИЧЕСКИЙ ОТЧЁТ',
        period: `${formatDate(config.period.from)} – ${formatDate(config.period.to)}`,
        filters: {},
        sections: config.sections,
        format: config.format,
      },
      filtered,
    );
  }

  function saveTemplate() {
    const name = prompt('Название шаблона:');
    if (!name) return;
    setTemplates((ts) => [...ts, { id: `t${Date.now()}`, name, config }]);
  }

  function setSection(key: keyof ReportConfig['sections'], v: boolean) {
    setConfig((c) => ({ ...c, sections: { ...c.sections, [key]: v } }));
  }

  return (
    <PageContainer title="Конструктор отчёта" subtitle="Параметры выборки и оформления → предпросмотр">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[360px_1fr]">
        <Card title="1. Параметры выборки" padding="md">
          <div className="space-y-3 text-sm">
            <div>
              <span className="block text-[10px] font-semibold uppercase text-ink-muted">Период</span>
              <div className="mt-1 grid grid-cols-2 gap-1.5">
                <input
                  type="date"
                  value={config.period.from}
                  onChange={(e) => setConfig((c) => ({ ...c, period: { ...c.period, from: e.target.value } }))}
                  className="h-8 rounded border border-surface-border px-2 text-xs"
                />
                <input
                  type="date"
                  value={config.period.to}
                  onChange={(e) => setConfig((c) => ({ ...c, period: { ...c.period, to: e.target.value } }))}
                  className="h-8 rounded border border-surface-border px-2 text-xs"
                />
              </div>
            </div>
            <label className="block">
              <span className="block text-[10px] font-semibold uppercase text-ink-muted">Регион</span>
              <select
                value={config.region}
                onChange={(e) => setConfig((c) => ({ ...c, region: e.target.value }))}
                className="mt-1 h-8 w-full rounded border border-surface-border px-2 text-xs"
              >
                <option value="all">Все</option>
                {REGIONS.map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="block text-[10px] font-semibold uppercase text-ink-muted">Тип объекта</span>
              <select
                value={config.objectType}
                onChange={(e) => setConfig((c) => ({ ...c, objectType: e.target.value as ObjectType | 'all' }))}
                className="mt-1 h-8 w-full rounded border border-surface-border px-2 text-xs"
              >
                <option value="all">Все</option>
                {(Object.keys(OBJECT_TYPE_LABEL) as ObjectType[]).map((v) => (
                  <option key={v} value={v}>
                    {OBJECT_TYPE_LABEL[v]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="block text-[10px] font-semibold uppercase text-ink-muted">Тип БПЛА</span>
              <select
                value={config.uavType}
                onChange={(e) => setConfig((c) => ({ ...c, uavType: e.target.value as UavType | 'all' }))}
                className="mt-1 h-8 w-full rounded border border-surface-border px-2 text-xs"
              >
                <option value="all">Все</option>
                {(Object.keys(UAV_LABEL) as UavType[]).map((v) => (
                  <option key={v} value={v}>
                    {UAV_LABEL[v]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="block text-[10px] font-semibold uppercase text-ink-muted">Тяжесть</span>
              <select
                value={config.severity}
                onChange={(e) => setConfig((c) => ({ ...c, severity: e.target.value as Severity | 'all' }))}
                className="mt-1 h-8 w-full rounded border border-surface-border px-2 text-xs"
              >
                <option value="all">Все</option>
                {(['low', 'medium', 'high', 'critical'] as Severity[]).map((v) => (
                  <option key={v} value={v}>
                    {SEVERITY_LABEL[v]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={config.onlyVerified}
                onChange={(e) => setConfig((c) => ({ ...c, onlyVerified: e.target.checked }))}
              />
              Только верифицированные инциденты
            </label>
          </div>

          <h3 className="mt-5 text-sm font-semibold text-ink">2. Содержание отчёта</h3>
          <div className="mt-2 space-y-1.5 text-xs">
            <SectionCheck label="Титульный лист" checked={config.sections.titlePage} onChange={(v) => setSection('titlePage', v)} />
            <SectionCheck label="Сводные показатели (KPI)" checked={config.sections.kpi} onChange={(v) => setSection('kpi', v)} />
            <SectionCheck label="Карта инцидентов" checked={config.sections.map} onChange={(v) => setSection('map', v)} />
            <SectionCheck label="Динамика по месяцам" checked={config.sections.dynamics} onChange={(v) => setSection('dynamics', v)} />
            <SectionCheck label="Топ-10 регионов" checked={config.sections.topRegions} onChange={(v) => setSection('topRegions', v)} />
            <SectionCheck label="Распределение по типам БПЛА" checked={config.sections.byUav} onChange={(v) => setSection('byUav', v)} />
            <SectionCheck label="Таблица всех инцидентов" checked={config.sections.fullTable} onChange={(v) => setSection('fullTable', v)} />
            <SectionCheck label="Приложение: исходные сообщения" checked={config.sections.sourcesAppendix} onChange={(v) => setSection('sourcesAppendix', v)} />
          </div>

          <div className="mt-4">
            <span className="block text-[10px] font-semibold uppercase text-ink-muted">Формат:</span>
            <div className="mt-1 flex gap-1.5">
              {(['pdf', 'xlsx', 'docx'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setConfig((c) => ({ ...c, format: f }))}
                  className={`h-7 flex-1 rounded text-xs font-semibold ${
                    config.format === f ? 'bg-brand-600 text-white' : 'border border-surface-border text-ink hover:bg-brand-50'
                  }`}
                >
                  {f.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <Button onClick={generate} variant="danger" className="mt-4 w-full" icon={<FileText className="h-4 w-4" />}>
            Сформировать отчёт
          </Button>
          <Button onClick={saveTemplate} variant="ghost" size="sm" className="mt-2 w-full" icon={<Save className="h-3.5 w-3.5" />}>
            Сохранить как шаблон
          </Button>
        </Card>

        {/* Предпросмотр */}
        <Card
          title="Предпросмотр"
          toolbar={<span className="text-xs text-ink-muted">1 / 4</span>}
          padding="md"
        >
          <div className="bg-white p-8 shadow-card" style={{ fontFamily: 'Times New Roman, serif' }}>
            {config.sections.titlePage && (
              <>
                <h1 className="text-center text-2xl font-bold text-ink">АНАЛИТИЧЕСКИЙ ОТЧЁТ</h1>
                <p className="mt-2 text-center text-base text-ink">об инцидентах с применением БПЛА</p>
                <p className="text-center text-base text-ink">в отношении объектов ТЭК</p>
                <p className="mt-4 text-center text-sm text-ink-muted">
                  Период: {formatDate(config.period.from)} – {formatDate(config.period.to)}
                </p>
                <hr className="my-5 border-surface-border" />
              </>
            )}

            {config.sections.kpi && (
              <div className="mb-5 grid grid-cols-3 gap-3">
                <div className="rounded bg-brand-50 p-3 text-center">
                  <div className="text-[10px] font-semibold uppercase text-ink-muted">ВСЕГО</div>
                  <div className="mt-1 text-2xl font-bold text-brand-700">{nf(stats.total)}</div>
                </div>
                <div className="rounded bg-brand-50 p-3 text-center">
                  <div className="text-[10px] font-semibold uppercase text-ink-muted">КРИТИЧ.</div>
                  <div className="mt-1 text-2xl font-bold text-brand-700">{nf(stats.crit)}</div>
                </div>
                <div className="rounded bg-brand-50 p-3 text-center">
                  <div className="text-[10px] font-semibold uppercase text-ink-muted">РЕГИОНОВ</div>
                  <div className="mt-1 text-2xl font-bold text-brand-700">{nf(stats.regions)}</div>
                </div>
              </div>
            )}

            {config.sections.dynamics && monthlyData.length > 0 && (
              <div className="mb-4 rounded bg-surface p-3">
                <div className="text-xs font-semibold text-ink-muted">Рис. 1. Динамика инцидентов</div>
                <div className="mt-2 h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" fontSize={10} />
                      <YAxis fontSize={10} />
                      <Tooltip />
                      <Bar dataKey="value" fill="#2B5797" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            <p className="mt-4 text-sm leading-relaxed text-ink">
              За отчётный период зарегистрировано <b>{nf(stats.total)}</b> инцидентов. Преимущественно
              фиксируются попытки атак БПЛА типа FPV ({Math.round(
                (filtered.filter((i) => i.uavType === 'fpv').length / Math.max(1, filtered.length)) * 100,
              )}
              %) и самолётного типа ({Math.round(
                (filtered.filter((i) => i.uavType === 'plane').length / Math.max(1, filtered.length)) * 100,
              )}
              %). Максимальная плотность инцидентов наблюдается в приграничных субъектах РФ.
            </p>
          </div>
        </Card>
      </div>

      <Card className="mt-4" title="Сохранённые шаблоны отчётов">
        <ul className="divide-y divide-surface-border text-sm">
          {templates.map((t) => (
            <li key={t.id} className="flex items-center justify-between py-2">
              <span>{t.name}</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setConfig(t.config)}>
                  Загрузить
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setTemplates((ts) => ts.filter((x) => x.id !== t.id))}>
                  Удалить
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </PageContainer>
  );
}

function SectionCheck({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 hover:bg-brand-50">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="text-ink">{label}</span>
    </label>
  );
}
