import { useEffect, useState } from 'react';
import { TrendingDown, TrendingUp, Minus, Flame } from 'lucide-react';
import { Card } from './Card';
import { fetchHotspots, type Hotspot } from '@/services/backendApi';
import { useBackend } from '@/store/backendData';
import { OBJECT_TYPE_LABEL, type ObjectType } from '@/types/domain';
import { REGIONS } from '@/mocks/regions';
import { formatDate } from '@/utils/format';

const TREND_ICON = {
  up: <TrendingUp className="h-3.5 w-3.5 text-red-600" />,
  down: <TrendingDown className="h-3.5 w-3.5 text-emerald-600" />,
  flat: <Minus className="h-3.5 w-3.5 text-zinc-500" />,
};

function riskColor(score: number): string {
  if (score >= 8) return '#D32F2F';
  if (score >= 6) return '#F57C00';
  if (score >= 4) return '#FBC02D';
  return '#388E3C';
}

function riskLabel(score: number): string {
  if (score >= 8) return 'Критический';
  if (score >= 6) return 'Высокий';
  if (score >= 4) return 'Повышенный';
  return 'Низкий';
}

export function HotspotsCard() {
  const enabled = useBackend((s) => s.enabled);
  const [items, setItems] = useState<Hotspot[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const load = () => {
      setLoading(true);
      fetchHotspots(10)
        .then(setItems)
        .catch(() => setItems([]))
        .finally(() => setLoading(false));
    };
    load();
    const t = setInterval(load, 120_000); // обновление раз в 2 минуты
    return () => clearInterval(t);
  }, [enabled]);

  if (!enabled) return null;

  return (
    <Card
      title={
        <span className="inline-flex items-center gap-2">
          <Flame className="h-4 w-4 text-red-600" /> Горячие точки ТЭК
        </span>
      }
      subtitle="Топ-10 (регион × тип объекта) с максимальным индексом риска за 90 дней. Алгоритм учитывает плотность инцидентов, тяжесть, % успешных атак и свежесть."
      padding="none"
    >
      {loading && items.length === 0 && (
        <div className="p-4 text-xs text-ink-muted">Расчёт…</div>
      )}
      {!loading && items.length === 0 && (
        <div className="p-6 text-center text-xs text-ink-muted">
          Пока недостаточно данных для расчёта риска. Backend ещё собирает инциденты.
        </div>
      )}
      {items.length > 0 && (
        <table className="w-full text-xs">
          <thead className="bg-surface text-ink-muted">
            <tr>
              <th className="w-8 px-3 py-2 text-left font-semibold">#</th>
              <th className="px-3 py-2 text-left font-semibold">Регион</th>
              <th className="px-3 py-2 text-left font-semibold">Тип объекта</th>
              <th className="px-3 py-2 text-left font-semibold">Риск</th>
              <th className="px-3 py-2 text-center font-semibold">30 дн</th>
              <th className="px-3 py-2 text-center font-semibold">90 дн</th>
              <th className="px-3 py-2 text-center font-semibold">Тренд</th>
              <th className="px-3 py-2 text-left font-semibold">Последний</th>
            </tr>
          </thead>
          <tbody>
            {items.map((h, idx) => {
              const region = REGIONS.find((r) => r.code === h.regionCode);
              return (
                <tr
                  key={h.regionCode + h.objectType}
                  className={`border-t border-surface-border hover:bg-brand-50 ${
                    idx % 2 === 1 ? 'bg-surface/40' : ''
                  }`}
                >
                  <td className="px-3 py-2 font-semibold text-ink-muted">{idx + 1}</td>
                  <td className="px-3 py-2 font-semibold text-ink">{region?.shortName ?? h.region}</td>
                  <td className="px-3 py-2">{OBJECT_TYPE_LABEL[h.objectType as ObjectType] ?? h.objectType}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-20 rounded bg-surface">
                        <div
                          className="h-full rounded"
                          style={{ width: `${(h.score / 10) * 100}%`, background: riskColor(h.score) }}
                        />
                      </div>
                      <span className="font-semibold" style={{ color: riskColor(h.score) }}>
                        {h.score.toFixed(1)}
                      </span>
                      <span className="text-[10px] text-ink-muted">{riskLabel(h.score)}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-center">{h.incidents30}</td>
                  <td className="px-3 py-2 text-center text-ink-muted">{h.incidents90}</td>
                  <td className="px-3 py-2 text-center">{TREND_ICON[h.trend]}</td>
                  <td className="px-3 py-2 text-ink-muted">
                    {h.lastIncidentAt ? formatDate(h.lastIncidentAt) : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </Card>
  );
}
