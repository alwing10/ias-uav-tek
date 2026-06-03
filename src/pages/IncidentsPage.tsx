import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, FileSpreadsheet, FileText, Plus, RotateCcw, Settings2 } from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Modal } from '@/components/common/Modal';
import { MultiSelect } from '@/components/common/MultiSelect';
import {
  SeverityBadge,
  IncidentStatusBadge,
  VerificationBadge,
} from '@/components/common/StatusBadge';
import { CategoryBadge } from '@/components/common/CategoryBadge';
import { REGIONS } from '@/mocks/regions';
import { useIncidents } from '@/store/incidents';
import { useLiveData } from '@/store/liveData';
import { useBackend } from '@/store/backendData';
import {
  OBJECT_TYPE_LABEL,
  SEVERITY_LABEL,
  UAV_LABEL,
  type ObjectCategory,
  type ObjectType,
  type Severity,
  type UavType,
  type VerificationStatus,
  type Incident,
} from '@/types/domain';
import { formatDateTime, nf, pluralize } from '@/utils/format';
import { exportIncidentsCSV, exportIncidentsPDF, exportIncidentsXLSX } from '@/utils/exporters';
import { OBJECTS } from '@/mocks/objects';

interface ColumnDef {
  key: string;
  label: string;
  visible: boolean;
}

const DEFAULT_COLUMNS: ColumnDef[] = [
  { key: 'idx', label: '№', visible: true },
  { key: 'datetime', label: 'Дата/Время', visible: true },
  { key: 'object', label: 'Объект', visible: true },
  { key: 'category', label: 'Категория', visible: true },
  { key: 'region', label: 'Регион', visible: true },
  { key: 'uav', label: 'Тип БПЛА', visible: true },
  { key: 'damage', label: 'Ущерб', visible: true },
  { key: 'severity', label: 'Тяжесть', visible: true },
  { key: 'status', label: 'Статус', visible: true },
];

type SortKey = 'datetime' | 'damage' | 'severity' | 'object' | 'region';

export function IncidentsPage() {
  const { incidents: stored, addIncident } = useIncidents();
  const live = useLiveData((s) => s.incidents);
  const backendIncidents = useBackend((s) => s.incidents);
  const incidents = useMemo(() => {
    const all = [...live, ...backendIncidents, ...stored];
    const seen = new Set<string>();
    return all.filter((i) => (seen.has(i.id) ? false : (seen.add(i.id), true)));
  }, [live, backendIncidents, stored]);
  const [period, setPeriod] = useState<{ from: string; to: string }>({ from: '2026-01-01', to: '2026-05-29' });
  const [regions, setRegions] = useState<string[]>([]);
  const [categories, setCategories] = useState<ObjectCategory[]>([]);
  const [uavs, setUavs] = useState<UavType[]>([]);
  const [verifs, setVerifs] = useState<VerificationStatus[]>([]);
  const [sevs, setSevs] = useState<Severity[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [sortKey, setSortKey] = useState<SortKey>('datetime');
  const [sortAsc, setSortAsc] = useState(false);
  const [openCols, setOpenCols] = useState(false);
  const [openAdd, setOpenAdd] = useState(false);
  const [columns, setColumns] = useState<ColumnDef[]>(DEFAULT_COLUMNS);

  const filtered = useMemo(() => {
    return incidents.filter((i) => {
      const d = new Date(i.datetime);
      if (d < new Date(period.from) || d > new Date(period.to + 'T23:59:59')) return false;
      if (regions.length && !regions.includes(i.regionCode)) return false;
      if (categories.length && !categories.includes(i.objectCategory)) return false;
      if (uavs.length && !uavs.includes(i.uavType)) return false;
      if (verifs.length && !verifs.includes(i.verified)) return false;
      if (sevs.length && !sevs.includes(i.severity)) return false;
      return true;
    });
  }, [incidents, period, regions, categories, uavs, verifs, sevs]);

  const sorted = useMemo(() => {
    const SEV_ORD: Record<Severity, number> = { low: 0, medium: 1, high: 2, critical: 3 };
    return [...filtered].sort((a, b) => {
      let r = 0;
      if (sortKey === 'datetime') r = a.datetime < b.datetime ? -1 : a.datetime > b.datetime ? 1 : 0;
      if (sortKey === 'damage') r = a.damage - b.damage;
      if (sortKey === 'severity') r = SEV_ORD[a.severity] - SEV_ORD[b.severity];
      if (sortKey === 'object') r = a.objectName.localeCompare(b.objectName, 'ru');
      if (sortKey === 'region') r = a.region.localeCompare(b.region, 'ru');
      return sortAsc ? r : -r;
    });
  }, [filtered, sortKey, sortAsc]);

  const pageItems = sorted.slice((page - 1) * pageSize, page * pageSize);
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortAsc((s) => !s);
    else {
      setSortKey(k);
      setSortAsc(false);
    }
  }

  function clearFilters() {
    setRegions([]);
    setCategories([]);
    setUavs([]);
    setVerifs([]);
    setSevs([]);
  }

  const stats = useMemo(() => {
    const x = { dest: 0, dmg: 0, repel: 0 };
    filtered.forEach((i) => {
      if (i.status === 'destroyed') x.dest++;
      else if (i.status === 'damaged') x.dmg++;
      else x.repel++;
    });
    return x;
  }, [filtered]);

  return (
    <PageContainer
      title="Реестр инцидентов"
      subtitle={`Многокритериальная фильтрация и сортировка ${nf(filtered.length)} ${pluralize(filtered.length, [
        'инцидента',
        'инцидентов',
        'инцидентов',
      ])}`}
      toolbar={
        <>
          <Button onClick={() => setOpenAdd(true)} size="sm" icon={<Plus className="h-3.5 w-3.5" />}>
            Добавить
          </Button>
          <div className="flex">
            <Button
              size="sm"
              variant="outline"
              onClick={() => exportIncidentsXLSX(sorted)}
              icon={<FileSpreadsheet className="h-3.5 w-3.5" />}
              className="rounded-r-none"
            >
              XLSX
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => exportIncidentsCSV(sorted)}
              className="rounded-none border-l-0"
            >
              CSV
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => exportIncidentsPDF(sorted, 'Реестр инцидентов')}
              icon={<FileText className="h-3.5 w-3.5" />}
              className="rounded-l-none border-l-0"
            >
              PDF
            </Button>
          </div>
          <Button size="sm" variant="ghost" onClick={() => setOpenCols(true)} icon={<Settings2 className="h-3.5 w-3.5" />}>
            Колонки
          </Button>
        </>
      }
    >
      <Card padding="sm" className="mb-3">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
          <div>
            <span className="block text-[10px] font-semibold uppercase text-ink-muted">Период от</span>
            <input
              type="date"
              value={period.from}
              onChange={(e) => setPeriod((p) => ({ ...p, from: e.target.value }))}
              className="h-8 w-full rounded border border-surface-border px-2 text-xs"
            />
          </div>
          <div>
            <span className="block text-[10px] font-semibold uppercase text-ink-muted">Период до</span>
            <input
              type="date"
              value={period.to}
              onChange={(e) => setPeriod((p) => ({ ...p, to: e.target.value }))}
              className="h-8 w-full rounded border border-surface-border px-2 text-xs"
            />
          </div>
          <MultiSelect
            label="Регион"
            value={regions}
            onChange={setRegions}
            options={REGIONS.map((r) => ({ value: r.code, label: r.shortName }))}
          />
          <MultiSelect
            label="Категория"
            value={categories}
            onChange={setCategories}
            options={[
              { value: 'I' as const, label: 'I — крит.' },
              { value: 'II' as const, label: 'II — пов.' },
              { value: 'III' as const, label: 'III — станд.' },
            ]}
          />
          <MultiSelect
            label="Тип БПЛА"
            value={uavs}
            onChange={setUavs}
            options={(Object.keys(UAV_LABEL) as UavType[]).map((v) => ({ value: v, label: UAV_LABEL[v] }))}
          />
          <MultiSelect
            label="Тяжесть"
            value={sevs}
            onChange={setSevs}
            options={(['low', 'medium', 'high', 'critical'] as Severity[]).map((v) => ({
              value: v,
              label: SEVERITY_LABEL[v],
            }))}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-ink-muted">
          <span>
            Найдено: <b className="text-ink">{nf(filtered.length)}</b> • Поражено:{' '}
            <b className="text-red-700">{nf(stats.dest)}</b> • Повреждено:{' '}
            <b className="text-orange-700">{nf(stats.dmg)}</b> • Отражено:{' '}
            <b className="text-emerald-700">{nf(stats.repel)}</b> • Сортировка: дата {sortAsc ? '↑' : '↓'}
          </span>
          <Button size="sm" variant="ghost" onClick={clearFilters} icon={<RotateCcw className="h-3 w-3" />}>
            Очистить
          </Button>
        </div>
      </Card>

      <Card padding="none">
        <div className="scrollbar-thin overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-surface text-ink-muted">
              <tr>
                {columns
                  .filter((c) => c.visible)
                  .map((c) => (
                    <th
                      key={c.key}
                      onClick={() => {
                        const sk = c.key === 'object' ? 'object' : c.key === 'region' ? 'region' : c.key === 'damage' ? 'damage' : c.key === 'severity' ? 'severity' : 'datetime';
                        toggleSort(sk as SortKey);
                      }}
                      className="cursor-pointer px-3 py-2 text-left font-semibold hover:text-ink"
                    >
                      {c.label}
                    </th>
                  ))}
              </tr>
            </thead>
            <tbody>
              {pageItems.map((i, idx) => (
                <tr
                  key={i.id}
                  className={`border-t border-surface-border hover:bg-brand-50 ${
                    idx % 2 === 1 ? 'bg-surface/40' : ''
                  }`}
                >
                  {columns.find((c) => c.key === 'idx')?.visible && (
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
                  )}
                  {columns.find((c) => c.key === 'datetime')?.visible && <td className="px-3 py-2 text-ink-muted">{formatDateTime(i.datetime)}</td>}
                  {columns.find((c) => c.key === 'object')?.visible && (
                    <td className="max-w-[260px] truncate px-3 py-2">{i.objectName}</td>
                  )}
                  {columns.find((c) => c.key === 'category')?.visible && (
                    <td className="px-3 py-2">
                      <CategoryBadge category={i.objectCategory} />
                    </td>
                  )}
                  {columns.find((c) => c.key === 'region')?.visible && <td className="px-3 py-2">{REGIONS.find((r) => r.code === i.regionCode)?.shortName}</td>}
                  {columns.find((c) => c.key === 'uav')?.visible && <td className="px-3 py-2">{UAV_LABEL[i.uavType]}</td>}
                  {columns.find((c) => c.key === 'damage')?.visible && (
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 rounded bg-surface">
                          <div
                            className="h-full rounded"
                            style={{
                              width: `${(i.damage / 10) * 100}%`,
                              background:
                                i.damage >= 7 ? '#D32F2F' : i.damage >= 4 ? '#F57C00' : '#388E3C',
                            }}
                          />
                        </div>
                        <span className="text-ink-muted">{i.damage}</span>
                      </div>
                    </td>
                  )}
                  {columns.find((c) => c.key === 'severity')?.visible && (
                    <td className="px-3 py-2">
                      <SeverityBadge severity={i.severity} />
                    </td>
                  )}
                  {columns.find((c) => c.key === 'status')?.visible && (
                    <td className="px-3 py-2">
                      <div className="flex flex-col gap-1">
                        <IncidentStatusBadge status={i.status} />
                        <VerificationBadge status={i.verified} />
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-surface-border px-3 py-2 text-xs">
          <span className="text-ink-muted">
            Страница {page} из {totalPages} • {nf(sorted.length)} записей
          </span>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.max(1, p - 1))}>
              ← Назад
            </Button>
            <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
              Вперёд →
            </Button>
          </div>
        </div>
      </Card>

      {/* Модал — настройка колонок */}
      <Modal open={openCols} onClose={() => setOpenCols(false)} title="Видимость колонок" size="sm">
        <div className="space-y-2">
          {columns.map((c, idx) => (
            <label key={c.key} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={c.visible}
                onChange={() => {
                  const copy = [...columns];
                  copy[idx] = { ...copy[idx]!, visible: !copy[idx]!.visible };
                  setColumns(copy);
                }}
              />
              {c.label}
            </label>
          ))}
        </div>
      </Modal>

      {/* Модал — добавление инцидента */}
      <AddIncidentModal
        open={openAdd}
        onClose={() => setOpenAdd(false)}
        onAdd={(incident) => addIncident(incident)}
      />
    </PageContainer>
  );
}

function AddIncidentModal({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (i: Incident) => void;
}) {
  const [form, setForm] = useState({
    datetime: new Date().toISOString().slice(0, 16),
    regionCode: REGIONS[0]!.code,
    objectId: OBJECTS[0]!.id,
    uavType: 'fpv' as UavType,
    severity: 'medium' as Severity,
    damage: 3,
    description: '',
  });
  const [err, setErr] = useState<string | null>(null);

  function submit() {
    if (!form.description.trim()) {
      setErr('Введите описание инцидента');
      return;
    }
    const obj = OBJECTS.find((o) => o.id === form.objectId)!;
    const region = REGIONS.find((r) => r.code === form.regionCode)!;
    const id = `INC-${Math.floor(2500 + Math.random() * 7499)}`;
    onAdd({
      id,
      datetime: new Date(form.datetime).toISOString(),
      region: region.name,
      regionCode: region.code,
      objectId: obj.id,
      objectName: obj.name,
      objectType: obj.type,
      objectCategory: obj.category,
      uavType: form.uavType,
      severity: form.severity,
      status: form.damage >= 7 ? 'destroyed' : form.damage >= 3 ? 'damaged' : 'repelled',
      damage: form.damage,
      casualties: 0,
      description: form.description,
      coordinates: obj.coordinates,
      sources: [{ name: 'Ручной ввод', type: 'api', confidence: 1, text: form.description }],
      verified: 'new',
      classificationConfidence: 1,
      scenario: 'Прямая атака (поражение цели)',
      registeredAt: new Date().toISOString(),
      fire: false,
      destruction: form.damage >= 7,
      operationDisrupted: form.damage >= 5,
    });
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Новый инцидент"
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button onClick={submit}>Создать</Button>
        </>
      }
    >
      {err && <div className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{err}</div>}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <label className="block">
          <span className="text-xs font-semibold text-ink-muted">Дата и время</span>
          <input
            type="datetime-local"
            value={form.datetime}
            onChange={(e) => setForm((f) => ({ ...f, datetime: e.target.value }))}
            className="mt-1 h-9 w-full rounded border border-surface-border px-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-ink-muted">Регион</span>
          <select
            value={form.regionCode}
            onChange={(e) => setForm((f) => ({ ...f, regionCode: e.target.value }))}
            className="mt-1 h-9 w-full rounded border border-surface-border px-2 text-sm"
          >
            {REGIONS.map((r) => (
              <option key={r.code} value={r.code}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block col-span-2">
          <span className="text-xs font-semibold text-ink-muted">Объект ТЭК</span>
          <select
            value={form.objectId}
            onChange={(e) => setForm((f) => ({ ...f, objectId: e.target.value }))}
            className="mt-1 h-9 w-full rounded border border-surface-border px-2 text-sm"
          >
            {OBJECTS.filter((o) => o.regionCode === form.regionCode).slice(0, 100).map((o) => (
              <option key={o.id} value={o.id}>
                {o.name} ({OBJECT_TYPE_LABEL[o.type]})
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-ink-muted">Тип БПЛА</span>
          <select
            value={form.uavType}
            onChange={(e) => setForm((f) => ({ ...f, uavType: e.target.value as UavType }))}
            className="mt-1 h-9 w-full rounded border border-surface-border px-2 text-sm"
          >
            {(Object.keys(UAV_LABEL) as UavType[]).map((v) => (
              <option key={v} value={v}>
                {UAV_LABEL[v]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-ink-muted">Тяжесть</span>
          <select
            value={form.severity}
            onChange={(e) => setForm((f) => ({ ...f, severity: e.target.value as Severity }))}
            className="mt-1 h-9 w-full rounded border border-surface-border px-2 text-sm"
          >
            {(['low', 'medium', 'high', 'critical'] as Severity[]).map((v) => (
              <option key={v} value={v}>
                {SEVERITY_LABEL[v]}
              </option>
            ))}
          </select>
        </label>
        <label className="block col-span-2">
          <span className="text-xs font-semibold text-ink-muted">Уровень ущерба: {form.damage}</span>
          <input
            type="range"
            min={0}
            max={10}
            value={form.damage}
            onChange={(e) => setForm((f) => ({ ...f, damage: +e.target.value }))}
            className="mt-1 w-full"
          />
        </label>
        <label className="block col-span-2">
          <span className="text-xs font-semibold text-ink-muted">Описание</span>
          <textarea
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            rows={4}
            className="mt-1 w-full rounded border border-surface-border p-2 text-sm"
          />
        </label>
      </div>
    </Modal>
  );
}
