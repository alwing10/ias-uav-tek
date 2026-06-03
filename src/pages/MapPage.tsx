import { useMemo, useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.markercluster';
import 'leaflet.heat';
import { Link } from 'react-router-dom';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { MultiSelect } from '@/components/common/MultiSelect';
import { useIncidents } from '@/store/incidents';
import { REGIONS } from '@/mocks/regions';
import {
  OBJECT_TYPE_LABEL,
  SEVERITY_COLOR,
  SEVERITY_LABEL,
  UAV_LABEL,
  type ObjectType,
  type Severity,
  type UavType,
  type VerificationStatus,
} from '@/types/domain';
import { formatDate } from '@/utils/format';

type MapMode = 'markers' | 'clusters' | 'heatmap';

export function MapPage() {
  const incidents = useIncidents((s) => s.incidents);
  const [mode, setMode] = useState<MapMode>('markers');
  const [period, setPeriod] = useState<{ from: string; to: string }>({ from: '2026-01-01', to: '2026-05-29' });
  const [regions, setRegions] = useState<string[]>([]);
  const [objectTypes, setObjectTypes] = useState<ObjectType[]>([]);
  const [uavTypes, setUavTypes] = useState<UavType[]>([]);
  const [severities, setSeverities] = useState<Severity[]>([]);
  const [verifications, setVerifications] = useState<VerificationStatus[]>([]);
  const [damageRange, setDamageRange] = useState<[number, number]>([0, 10]);
  const [appliedFilters, setAppliedFilters] = useState({
    period,
    regions,
    objectTypes,
    uavTypes,
    severities,
    verifications,
    damageRange,
  });

  const filtered = useMemo(() => {
    return incidents.filter((i) => {
      const dt = new Date(i.datetime);
      if (dt < new Date(appliedFilters.period.from) || dt > new Date(appliedFilters.period.to)) return false;
      if (appliedFilters.regions.length && !appliedFilters.regions.includes(i.regionCode)) return false;
      if (appliedFilters.objectTypes.length && !appliedFilters.objectTypes.includes(i.objectType)) return false;
      if (appliedFilters.uavTypes.length && !appliedFilters.uavTypes.includes(i.uavType)) return false;
      if (appliedFilters.severities.length && !appliedFilters.severities.includes(i.severity)) return false;
      if (appliedFilters.verifications.length && !appliedFilters.verifications.includes(i.verified)) return false;
      if (i.damage < appliedFilters.damageRange[0] || i.damage > appliedFilters.damageRange[1]) return false;
      return true;
    });
  }, [incidents, appliedFilters]);

  function apply() {
    setAppliedFilters({ period, regions, objectTypes, uavTypes, severities, verifications, damageRange });
  }
  function reset() {
    setPeriod({ from: '2026-01-01', to: '2026-05-29' });
    setRegions([]);
    setObjectTypes([]);
    setUavTypes([]);
    setSeverities([]);
    setVerifications([]);
    setDamageRange([0, 10]);
    setAppliedFilters({
      period: { from: '2026-01-01', to: '2026-05-29' },
      regions: [],
      objectTypes: [],
      uavTypes: [],
      severities: [],
      verifications: [],
      damageRange: [0, 10],
    });
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* Левая панель фильтров */}
      <aside className="w-[280px] shrink-0 overflow-y-auto border-r border-surface-border bg-white p-4">
        <h2 className="text-sm font-semibold text-ink">Фильтры</h2>
        <p className="mt-0.5 text-[10px] text-ink-muted">Найдено: {filtered.length}</p>

        <div className="mt-4 space-y-3">
          <div>
            <span className="block text-[10px] font-semibold uppercase text-ink-muted">Период</span>
            <div className="mt-1 grid grid-cols-2 gap-1.5">
              <input
                type="date"
                value={period.from}
                onChange={(e) => setPeriod((p) => ({ ...p, from: e.target.value }))}
                className="h-8 rounded border border-surface-border px-1.5 text-[11px]"
              />
              <input
                type="date"
                value={period.to}
                onChange={(e) => setPeriod((p) => ({ ...p, to: e.target.value }))}
                className="h-8 rounded border border-surface-border px-1.5 text-[11px]"
              />
            </div>
          </div>

          <MultiSelect
            label="Регион"
            value={regions}
            onChange={setRegions}
            options={REGIONS.map((r) => ({ value: r.code, label: r.shortName }))}
          />

          <MultiSelect
            label="Тип объекта ТЭК"
            value={objectTypes}
            onChange={setObjectTypes}
            options={(Object.keys(OBJECT_TYPE_LABEL) as ObjectType[]).map((v) => ({
              value: v,
              label: OBJECT_TYPE_LABEL[v],
            }))}
          />

          <MultiSelect
            label="Тип БПЛА"
            value={uavTypes}
            onChange={setUavTypes}
            options={(Object.keys(UAV_LABEL) as UavType[]).map((v) => ({ value: v, label: UAV_LABEL[v] }))}
          />

          <MultiSelect
            label="Тяжесть"
            value={severities}
            onChange={setSeverities}
            options={(['low', 'medium', 'high', 'critical'] as Severity[]).map((v) => ({
              value: v,
              label: SEVERITY_LABEL[v],
            }))}
          />

          <MultiSelect
            label="Статус верификации"
            value={verifications}
            onChange={setVerifications}
            options={[
              { value: 'new' as const, label: 'Новый' },
              { value: 'pending' as const, label: 'На верификации' },
              { value: 'verified' as const, label: 'Верифицирован' },
              { value: 'rejected' as const, label: 'Отклонён' },
            ]}
          />

          <div>
            <span className="block text-[10px] font-semibold uppercase text-ink-muted">
              Уровень ущерба: {damageRange[0]}—{damageRange[1]}
            </span>
            <div className="mt-1 grid grid-cols-2 gap-1.5">
              <input
                type="range"
                min={0}
                max={10}
                value={damageRange[0]}
                onChange={(e) => setDamageRange([+e.target.value, damageRange[1]])}
              />
              <input
                type="range"
                min={0}
                max={10}
                value={damageRange[1]}
                onChange={(e) => setDamageRange([damageRange[0], +e.target.value])}
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button onClick={apply} size="sm" className="flex-1">
              Применить
            </Button>
            <Button onClick={reset} size="sm" variant="outline" className="flex-1">
              Сбросить
            </Button>
          </div>
        </div>
      </aside>

      {/* Карта */}
      <div className="relative flex-1">
        <MapContainer
          center={[54, 40]}
          zoom={5}
          minZoom={3}
          className="h-full w-full"
          preferCanvas
        >
          <TileLayer
            attribution="© OpenStreetMap"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ModeLayer mode={mode} incidents={filtered} />
        </MapContainer>

        {/* Переключатель режимов */}
        <div className="absolute left-3 top-3 z-[400] flex gap-1 rounded border border-surface-border bg-white p-0.5 text-[11px] shadow">
          {(['markers', 'clusters', 'heatmap'] as MapMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded px-2 py-1 ${mode === m ? 'bg-brand-600 text-white' : 'text-ink hover:bg-brand-50'}`}
            >
              {m === 'markers' ? 'Маркеры' : m === 'clusters' ? 'Кластеры' : 'Heatmap'}
            </button>
          ))}
        </div>

        {/* Легенда */}
        <div className="absolute bottom-3 left-3 z-[400] rounded border border-surface-border bg-white p-3 text-[11px] shadow">
          <div className="mb-1 font-semibold text-ink">Тяжесть инцидента</div>
          {(['critical', 'high', 'medium', 'low'] as Severity[]).map((s) => (
            <div key={s} className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: SEVERITY_COLOR[s] }} />
              <span>{SEVERITY_LABEL[s]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Правая панель */}
      <aside className="w-[280px] shrink-0 overflow-y-auto border-l border-surface-border bg-white">
        <div className="border-b border-surface-border p-3">
          <h2 className="text-sm font-semibold text-ink">Видимые инциденты</h2>
          <p className="mt-0.5 text-[11px] text-ink-muted">Найдено: {filtered.length} • сорт: дата ↓</p>
        </div>
        <div className="scrollbar-thin h-[calc(100vh-3.5rem-66px)] overflow-y-auto p-2">
          {filtered.slice(0, 60).map((i) => (
            <Link
              key={i.id}
              to={`/incidents/${i.id}`}
              className="mb-2 block rounded bg-surface p-2 hover:bg-brand-50"
            >
              <div className="flex items-start gap-2">
                <span
                  className="mt-0.5 h-full w-0.5 self-stretch rounded"
                  style={{ background: SEVERITY_COLOR[i.severity] }}
                />
                <div className="flex-1">
                  <div className="text-[11px] font-semibold text-brand-700">{i.id}</div>
                  <div className="truncate text-[11px] text-ink">
                    {REGIONS.find((r) => r.code === i.regionCode)?.shortName}, {i.objectName}
                  </div>
                  <div className="mt-0.5 text-[10px] text-ink-muted">
                    {formatDate(i.datetime)} • {SEVERITY_LABEL[i.severity]}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </aside>
    </div>
  );
}

// Подложка-слой: маркеры / кластеры / heatmap
function ModeLayer({ mode, incidents }: { mode: MapMode; incidents: ReturnType<typeof useIncidents>['incidents'] }) {
  const map = useMap();
  const layerRef = useRef<L.Layer | null>(null);

  useEffect(() => {
    if (layerRef.current) {
      map.removeLayer(layerRef.current);
      layerRef.current = null;
    }

    if (mode === 'heatmap') {
      const heat = (L as unknown as { heatLayer: (latlngs: [number, number, number][], opts: object) => L.Layer }).heatLayer(
        incidents.map((i) => [i.coordinates.lat, i.coordinates.lon, 0.4 + i.damage * 0.06] as [number, number, number]),
        { radius: 25, blur: 18, max: 1.4 },
      );
      heat.addTo(map);
      layerRef.current = heat;
      return;
    }

    if (mode === 'clusters') {
      const group = (L as unknown as { markerClusterGroup: (opts: object) => L.FeatureGroup & { addLayer: (l: L.Layer) => void } }).markerClusterGroup({
        chunkedLoading: true,
        maxClusterRadius: 50,
      });
      incidents.forEach((i) => {
        const m = L.circleMarker([i.coordinates.lat, i.coordinates.lon], {
          radius: 6,
          color: '#fff',
          weight: 1,
          fillColor: SEVERITY_COLOR[i.severity],
          fillOpacity: 0.85,
        });
        m.bindPopup(popupHtml(i));
        group.addLayer(m);
      });
      map.addLayer(group);
      layerRef.current = group;
      return;
    }

    // Маркеры
    const fg = L.featureGroup();
    incidents.forEach((i) => {
      const m = L.circleMarker([i.coordinates.lat, i.coordinates.lon], {
        radius: i.severity === 'critical' ? 9 : i.severity === 'high' ? 7 : 5,
        color: '#fff',
        weight: 1,
        fillColor: SEVERITY_COLOR[i.severity],
        fillOpacity: 0.85,
      });
      m.bindPopup(popupHtml(i));
      fg.addLayer(m);
    });
    fg.addTo(map);
    layerRef.current = fg;
  }, [mode, incidents, map]);

  return null;
}

function popupHtml(i: any) {
  return `
    <div style="font-family:Inter, sans-serif; min-width: 200px">
      <div style="font-weight:700; color:#1E4D8B">${i.id}</div>
      <div style="font-size: 11px; margin-top: 4px"><b>Объект:</b> ${i.objectName}</div>
      <div style="font-size: 11px"><b>Регион:</b> ${i.region}</div>
      <div style="font-size: 11px"><b>БПЛА:</b> ${UAV_LABEL[i.uavType as UavType]}</div>
      <div style="font-size: 11px"><b>Тяжесть:</b> ${SEVERITY_LABEL[i.severity as Severity]}</div>
      <a href="/incidents/${i.id}" style="display:inline-block; margin-top:6px; color:#1E4D8B; font-weight:600; font-size: 11px">Открыть карточку →</a>
    </div>
  `;
}
