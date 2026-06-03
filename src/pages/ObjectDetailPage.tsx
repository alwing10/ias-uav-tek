import { Link, useNavigate, useParams } from 'react-router-dom';
import { MapContainer, TileLayer, CircleMarker } from 'react-leaflet';
import { PageContainer } from '@/components/layout/PageContainer';
import { Card } from '@/components/common/Card';
import { CategoryBadge } from '@/components/common/CategoryBadge';
import { SeverityBadge } from '@/components/common/StatusBadge';
import { OBJECTS } from '@/mocks/objects';
import { useIncidents } from '@/store/incidents';
import { OBJECT_TYPE_LABEL } from '@/types/domain';
import { formatDateTime } from '@/utils/format';

export function ObjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const obj = OBJECTS.find((o) => o.id === id);
  const navigate = useNavigate();
  const incidents = useIncidents((s) => s.incidents.filter((i) => i.objectId === id));

  if (!obj) {
    return (
      <PageContainer title="Объект не найден">
        <Card>
          <p className="text-sm text-ink-muted">
            Объект <b>{id}</b> отсутствует.{' '}
            <button onClick={() => navigate('/objects')} className="text-brand-600 hover:underline">
              К реестру
            </button>
          </p>
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title={obj.name}
      subtitle={`${obj.id} • ${OBJECT_TYPE_LABEL[obj.type]} • ${obj.region}`}
    >
      <div className="mb-3 text-xs text-ink-muted">
        <Link to="/objects" className="hover:underline">
          Объекты ТЭК
        </Link>{' '}
        / {obj.id}
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Card className="lg:col-span-2" title="Карта расположения">
          <div className="h-72 overflow-hidden rounded">
            <MapContainer center={[obj.coordinates.lat, obj.coordinates.lon]} zoom={9} className="h-full w-full">
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <CircleMarker
                center={[obj.coordinates.lat, obj.coordinates.lon]}
                radius={10}
                pathOptions={{ fillColor: '#1E4D8B', color: 'white', weight: 2, fillOpacity: 0.85 }}
              />
            </MapContainer>
          </div>
        </Card>
        <Card title="Карточка объекта">
          <dl className="space-y-2 text-sm">
            <Row label="Оператор" value={obj.operator} />
            <Row label="Категория опасности">
              <CategoryBadge category={obj.category} />
            </Row>
            <Row label="Тип" value={OBJECT_TYPE_LABEL[obj.type]} />
            <Row label="Регион" value={obj.region} />
            <Row label="Координаты" value={`${obj.coordinates.lat.toFixed(4)}, ${obj.coordinates.lon.toFixed(4)}`} />
            <Row label="Индекс угрозы" value={obj.threatIndex.toFixed(1) + ' / 10'} />
            <Row label="Инцидентов за 12 мес." value={String(obj.incidents12m)} />
          </dl>
        </Card>
      </div>

      <Card className="mt-3" title={`Связанные инциденты (${incidents.length})`} padding="none">
        {incidents.length === 0 ? (
          <p className="p-4 text-xs text-ink-muted">Инцидентов на объекте не зафиксировано</p>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-surface text-ink-muted">
              <tr>
                <th className="px-3 py-2 text-left">ID</th>
                <th className="px-3 py-2 text-left">Дата</th>
                <th className="px-3 py-2 text-left">Тяжесть</th>
                <th className="px-3 py-2 text-left">Ущерб</th>
              </tr>
            </thead>
            <tbody>
              {incidents.map((i) => (
                <tr key={i.id} className="border-t border-surface-border hover:bg-brand-50">
                  <td className="px-3 py-2 font-semibold text-brand-700">
                    <Link to={`/incidents/${i.id}`}>{i.id}</Link>
                  </td>
                  <td className="px-3 py-2">{formatDateTime(i.datetime)}</td>
                  <td className="px-3 py-2">
                    <SeverityBadge severity={i.severity} />
                  </td>
                  <td className="px-3 py-2">{i.damage}/10</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </PageContainer>
  );
}

function Row({ label, value, children }: { label: string; value?: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-2 border-b border-surface-border pb-1.5 last:border-0">
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="text-sm text-ink">{children ?? value}</dd>
    </div>
  );
}
