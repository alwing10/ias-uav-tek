import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import { Edit, FileText, History, Printer, RotateCcw } from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Tabs } from '@/components/common/Tabs';
import { Modal } from '@/components/common/Modal';
import {
  IncidentStatusBadge,
  SeverityBadge,
  VerificationBadge,
} from '@/components/common/StatusBadge';
import { useIncidents } from '@/store/incidents';
import { useLiveData } from '@/store/liveData';
import { useBackend } from '@/store/backendData';
import {
  OBJECT_TYPE_GROUP,
  OBJECT_TYPE_LABEL,
  SEVERITY_LABEL,
  UAV_LABEL,
  type Severity,
  type UavType,
} from '@/types/domain';
import { useAuth } from '@/store/auth';
import { hasRole } from '@/utils/rbac';
import { formatDateTime, formatDate } from '@/utils/format';
import { exportIncidentsPDF } from '@/utils/exporters';

type DetailTab = 'overview' | 'sources' | 'attrs' | 'history' | 'related';

export function IncidentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { incidents: stored, updateAttributes } = useIncidents();
  const live = useLiveData((s) => s.incidents);
  const backendIncidents = useBackend((s) => s.incidents);
  const incidents = useMemo(() => {
    const all = [...live, ...backendIncidents, ...stored];
    const seen = new Set<string>();
    return all.filter((i) => (seen.has(i.id) ? false : (seen.add(i.id), true)));
  }, [live, backendIncidents, stored]);
  const incident = incidents.find((i) => i.id === id);
  const user = useAuth((s) => s.user);
  const [tab, setTab] = useState<DetailTab>('overview');
  const [editOpen, setEditOpen] = useState(false);
  const [reclassOpen, setReclassOpen] = useState(false);

  if (!incident) {
    return (
      <PageContainer title="Инцидент не найден">
        <Card>
          <p className="text-sm text-ink-muted">
            Инцидент с идентификатором <b>{id}</b> отсутствует.{' '}
            <button onClick={() => navigate('/incidents')} className="text-brand-600 hover:underline">
              Вернуться к реестру
            </button>
          </p>
        </Card>
      </PageContainer>
    );
  }

  const related = useMemo(
    () =>
      incidents
        .filter((i) => i.id !== incident.id && (i.objectId === incident.objectId || i.regionCode === incident.regionCode))
        .slice(0, 6),
    [incident, incidents],
  );

  const canEdit = hasRole(user?.role, 'expert');

  return (
    <PageContainer
      title=""
      toolbar={null}
    >
      <div className="mb-2 text-xs text-ink-muted">
        <Link to="/incidents" className="hover:underline">
          Инциденты
        </Link>{' '}
        / {new Date(incident.datetime).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })} / {incident.id}
      </div>

      <Card padding="md">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-ink">{incident.id}</h1>
            <div className="mt-1 text-sm text-ink">{incident.description.slice(0, 120)}</div>
            <div className="mt-1 text-xs text-ink-muted">
              {incident.region} • {formatDateTime(incident.datetime)} МСК
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              <SeverityBadge severity={incident.severity} />
              <IncidentStatusBadge status={incident.status} />
              <VerificationBadge status={incident.verified} />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() => exportIncidentsPDF([incident], `Карточка инцидента ${incident.id}`, `${incident.id}.pdf`)}
                icon={<FileText className="h-3.5 w-3.5" />}
              >
                Экспорт PDF
              </Button>
              {canEdit && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setReclassOpen(true)}
                  icon={<RotateCcw className="h-3.5 w-3.5" />}
                >
                  Переклассиф.
                </Button>
              )}
              {canEdit && (
                <Button size="sm" variant="outline" onClick={() => setEditOpen(true)} icon={<Edit className="h-3.5 w-3.5" />}>
                  Редактировать
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => window.print()} icon={<Printer className="h-3.5 w-3.5" />}>
                Печать
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <Tabs
        className="mt-4"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'overview', label: 'Обзор' },
          { value: 'sources', label: 'Источники', count: incident.sources.length },
          { value: 'attrs', label: 'Атрибуты' },
          { value: 'history', label: 'История изменений' },
          { value: 'related', label: 'Связанные', count: related.length },
        ]}
      />

      {tab === 'overview' && (
        <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
          <Card className="lg:col-span-2" title="Описание инцидента">
            <p className="text-sm text-ink">{incident.description}</p>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <div className="mb-1 text-[10px] font-semibold uppercase text-ink-muted">
                  Место инцидента ({incident.coordinates.lat.toFixed(4)}°N, {incident.coordinates.lon.toFixed(4)}°E)
                </div>
                <div className="h-44 overflow-hidden rounded">
                  <MapContainer
                    center={[incident.coordinates.lat, incident.coordinates.lon]}
                    zoom={9}
                    scrollWheelZoom={false}
                    className="h-full w-full"
                  >
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    <CircleMarker
                      center={[incident.coordinates.lat, incident.coordinates.lon]}
                      radius={10}
                      pathOptions={{ color: '#fff', fillColor: '#D32F2F', fillOpacity: 0.85, weight: 2 }}
                    >
                      <Popup>{incident.objectName}</Popup>
                    </CircleMarker>
                  </MapContainer>
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-sm font-semibold text-ink">Классификация</h3>
                <ClassifRow label="Тип объекта ТЭК" value={OBJECT_TYPE_GROUP[incident.objectType]} confidence={incident.classificationConfidence} />
                <ClassifRow label="Категория объекта" value={`${incident.objectCategory} категория опасности`} confidence={incident.classificationConfidence - 0.05} />
                <ClassifRow label="Тип БПЛА" value={UAV_LABEL[incident.uavType]} confidence={incident.classificationConfidence - 0.08} />
                <ClassifRow label="Сценарий применения" value={incident.scenario} confidence={incident.classificationConfidence - 0.12} />
                <ClassifRow label="Тяжесть" value={SEVERITY_LABEL[incident.severity]} confidence={1} />
              </div>
            </div>

            <h3 className="mt-5 text-sm font-semibold text-ink">Последствия</h3>
            <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
              <Consequence label="Пострадавшие" value={`${incident.casualties} чел.`} ok={incident.casualties === 0} />
              <Consequence label="Разрушения" value={incident.destruction ? 'Зафиксированы' : 'Не зафиксированы'} ok={!incident.destruction} />
              <Consequence
                label="Сбой работы объекта"
                value={incident.operationDisrupted ? 'Зафиксирован' : 'Не зафиксирован'}
                ok={!incident.operationDisrupted}
              />
              <Consequence label="Возгорание" value={incident.fire ? 'Зафиксировано' : 'Не зафиксировано'} ok={!incident.fire} />
            </div>

            <div className="mt-4 space-y-1 text-xs text-ink-muted">
              <div>
                Время реакции: {incident.reactionTimeSec ?? '—'} сек. • Дистанция поражения:{' '}
                {incident.hitDistanceM ?? '—'} м • Средство нейтрализации: {incident.neutralization ?? '—'}
              </div>
              <div>
                Зарегистрирован: {formatDateTime(incident.registeredAt)}
                {incident.verifiedAt && incident.verifiedBy && (
                  <>
                    {' '}
                    • Верифицирован: {formatDateTime(incident.verifiedAt)} (эксп. {incident.verifiedBy})
                  </>
                )}
              </div>
            </div>
          </Card>

          <div className="space-y-3">
            <Card title={`Источники (${incident.sources.length})`}>
              {incident.sources.map((s, i) => (
                <div key={i} className="mb-2 rounded bg-surface p-2 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ background: s.confidence > 0.85 ? '#2E7D32' : s.confidence > 0.7 ? '#F57C00' : '#D32F2F' }}
                      />
                      <span className="font-semibold text-ink">{s.name}</span>
                    </div>
                    <span className="text-ink-muted">конф. {s.confidence.toFixed(2)}</span>
                  </div>
                  <div className="mt-1 text-[11px] text-ink-muted">
                    Текст {s.text.length} симв.
                    {s.hasPhoto && ' • фото'}
                    {s.hasVideo && ' • видео'}
                  </div>
                </div>
              ))}
            </Card>
            <Card title="Исходный текст">
              <div className="rounded bg-surface p-3 font-mono text-[11px] leading-relaxed text-ink">
                {incident.sources[0]?.text || incident.description}
              </div>
              {incident.sources[0]?.url ? (
                <a
                  href={incident.sources[0].url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block text-xs text-brand-600 hover:underline"
                >
                  Открыть оригинал в новом окне →
                </a>
              ) : (
                <button className="mt-2 text-xs text-brand-600 hover:underline">
                  Открыть полную версию →
                </button>
              )}
            </Card>
          </div>
        </div>
      )}

      {tab === 'sources' && (
        <Card className="mt-3" title="Все источники">
          <table className="w-full text-xs">
            <thead className="bg-surface text-ink-muted">
              <tr>
                <th className="px-3 py-2 text-left">Источник</th>
                <th className="px-3 py-2 text-left">Тип</th>
                <th className="px-3 py-2 text-left">Confidence</th>
                <th className="px-3 py-2 text-left">Достоверность</th>
              </tr>
            </thead>
            <tbody>
              {incident.sources.map((s, i) => (
                <tr key={i} className="border-t border-surface-border">
                  <td className="px-3 py-2 font-semibold">{s.name}</td>
                  <td className="px-3 py-2">{s.type}</td>
                  <td className="px-3 py-2">{s.confidence.toFixed(2)}</td>
                  <td className="px-3 py-2">
                    <div className="h-2 w-32 rounded bg-surface">
                      <div
                        className="h-full rounded"
                        style={{
                          width: `${s.confidence * 100}%`,
                          background: s.confidence > 0.85 ? '#2E7D32' : s.confidence > 0.7 ? '#F57C00' : '#D32F2F',
                        }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {tab === 'attrs' && (
        <Card className="mt-3" title="Извлечённые атрибуты">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <Attr label="ID" value={incident.id} />
            <Attr label="Регистрация" value={formatDateTime(incident.registeredAt)} />
            <Attr label="Дата инцидента" value={formatDateTime(incident.datetime)} />
            <Attr label="Регион" value={incident.region} />
            <Attr label="Объект" value={incident.objectName} />
            <Attr label="Тип объекта" value={OBJECT_TYPE_LABEL[incident.objectType]} />
            <Attr label="Категория" value={incident.objectCategory} />
            <Attr label="Тип БПЛА" value={UAV_LABEL[incident.uavType]} />
            <Attr label="Сценарий" value={incident.scenario} />
            <Attr label="Ущерб" value={`${incident.damage}/10`} />
            <Attr label="Тяжесть" value={SEVERITY_LABEL[incident.severity]} />
            <Attr label="Координаты" value={`${incident.coordinates.lat.toFixed(4)}, ${incident.coordinates.lon.toFixed(4)}`} />
          </dl>
        </Card>
      )}

      {tab === 'history' && (
        <Card className="mt-3" title="История изменений">
          <ul className="space-y-3 text-sm">
            <HistoryItem icon={<History className="h-3.5 w-3.5" />} when={formatDateTime(incident.registeredAt)} who="система" what="Создан автоматически из источника" />
            <HistoryItem icon={<History className="h-3.5 w-3.5" />} when={formatDateTime(incident.registeredAt)} who="классификатор v1.4" what={`Классифицирован: ${UAV_LABEL[incident.uavType]}, ${SEVERITY_LABEL[incident.severity]}`} />
            {incident.verified === 'verified' && (
              <HistoryItem icon={<History className="h-3.5 w-3.5" />} when={formatDateTime(incident.verifiedAt!)} who={incident.verifiedBy!} what="Верифицирован" />
            )}
          </ul>
        </Card>
      )}

      {tab === 'related' && (
        <Card className="mt-3" title="Связанные инциденты">
          {related.length === 0 ? (
            <p className="text-xs text-ink-muted">Связанных инцидентов не найдено</p>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-surface text-ink-muted">
                <tr>
                  <th className="px-3 py-2 text-left">ID</th>
                  <th className="px-3 py-2 text-left">Дата</th>
                  <th className="px-3 py-2 text-left">Объект</th>
                  <th className="px-3 py-2 text-left">Тяжесть</th>
                </tr>
              </thead>
              <tbody>
                {related.map((r) => (
                  <tr key={r.id} className="border-t border-surface-border hover:bg-brand-50">
                    <td className="px-3 py-2 font-semibold text-brand-700">
                      <Link to={`/incidents/${r.id}`}>{r.id}</Link>
                    </td>
                    <td className="px-3 py-2">{formatDate(r.datetime)}</td>
                    <td className="px-3 py-2">{r.objectName}</td>
                    <td className="px-3 py-2">
                      <SeverityBadge severity={r.severity} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {/* Модал — редактирование */}
      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title={`Редактирование ${incident.id}`}
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Отмена
            </Button>
            <Button onClick={() => setEditOpen(false)}>Сохранить</Button>
          </>
        }
      >
        <div className="space-y-3 text-sm">
          <label className="block">
            <span className="text-xs font-semibold text-ink-muted">Тяжесть</span>
            <select
              value={incident.severity}
              onChange={(e) => updateAttributes(incident.id, { severity: e.target.value as Severity })}
              className="mt-1 h-9 w-full rounded border border-surface-border px-2"
            >
              {(['low', 'medium', 'high', 'critical'] as Severity[]).map((v) => (
                <option key={v} value={v}>
                  {SEVERITY_LABEL[v]}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-ink-muted">Уровень ущерба: {incident.damage}</span>
            <input
              type="range"
              min={0}
              max={10}
              value={incident.damage}
              onChange={(e) => updateAttributes(incident.id, { damage: +e.target.value })}
              className="mt-1 w-full"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-ink-muted">Описание</span>
            <textarea
              value={incident.description}
              onChange={(e) => updateAttributes(incident.id, { description: e.target.value })}
              rows={4}
              className="mt-1 w-full rounded border border-surface-border p-2 text-sm"
            />
          </label>
        </div>
      </Modal>

      {/* Модал — переклассификация */}
      <Modal
        open={reclassOpen}
        onClose={() => setReclassOpen(false)}
        title="Переклассификация"
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setReclassOpen(false)}>
              Отмена
            </Button>
            <Button onClick={() => setReclassOpen(false)}>Запустить</Button>
          </>
        }
      >
        <p className="text-sm text-ink">
          Запуск повторной классификации текущей версией модели. Затронуты атрибуты: тип объекта,
          тип БПЛА, тяжесть.
        </p>
        <label className="mt-3 block">
          <span className="text-xs font-semibold text-ink-muted">Тип БПЛА</span>
          <select
            defaultValue={incident.uavType}
            onChange={(e) => updateAttributes(incident.id, { uavType: e.target.value as UavType })}
            className="mt-1 h-9 w-full rounded border border-surface-border px-2"
          >
            {(Object.keys(UAV_LABEL) as UavType[]).map((v) => (
              <option key={v} value={v}>
                {UAV_LABEL[v]}
              </option>
            ))}
          </select>
        </label>
      </Modal>
    </PageContainer>
  );
}

function ClassifRow({ label, value, confidence }: { label: string; value: string; confidence: number }) {
  return (
    <div className="mt-1">
      <div className="text-[10px] font-semibold uppercase text-ink-muted">{label}</div>
      <div className="flex items-center gap-2 text-sm text-ink">
        <span className="flex-1">{value}</span>
        <div className="h-1.5 w-24 rounded bg-surface">
          <div className="h-full rounded bg-brand-600" style={{ width: `${Math.max(0, confidence) * 100}%` }} />
        </div>
        <span className="w-9 text-right text-[10px] text-ink-muted">{Math.round(Math.max(0, confidence) * 100)}%</span>
      </div>
    </div>
  );
}

function Consequence({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="rounded bg-surface p-2">
      <div className="text-[10px] font-semibold uppercase text-ink-muted">{label}</div>
      <div className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-ink">
        <span className={`h-2 w-2 rounded-full ${ok ? 'bg-emerald-500' : 'bg-red-600'}`} />
        {value}
      </div>
    </div>
  );
}

function Attr({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase text-ink-muted">{label}</dt>
      <dd className="text-sm text-ink">{value}</dd>
    </div>
  );
}

function HistoryItem({ icon, when, who, what }: { icon: React.ReactNode; when: string; who: string; what: string }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-1 flex h-6 w-6 items-center justify-center rounded-full bg-brand-50 text-brand-700">{icon}</span>
      <div>
        <div className="text-xs text-ink-muted">{when} • {who}</div>
        <div className="text-sm text-ink">{what}</div>
      </div>
    </li>
  );
}
