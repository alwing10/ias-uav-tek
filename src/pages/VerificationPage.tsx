import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, MessageCircleQuestion, X } from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Modal } from '@/components/common/Modal';
import { SeverityBadge, VerificationBadge } from '@/components/common/StatusBadge';
import { useIncidents } from '@/store/incidents';
import { useLiveData } from '@/store/liveData';
import { useBackend } from '@/store/backendData';
import { verifyIncident } from '@/services/backendApi';
import { useAuth } from '@/store/auth';
import {
  SEVERITY_LABEL,
  UAV_LABEL,
  type Severity,
  type UavType,
} from '@/types/domain';
import { formatDateTime, nf } from '@/utils/format';
import { REGIONS } from '@/mocks/regions';

export function VerificationPage() {
  const { incidents: stored, bulkVerify, updateAttributes } = useIncidents();
  const live = useLiveData((s) => s.incidents);
  const backendIncidents = useBackend((s) => s.incidents);
  const backendEnabled = useBackend((s) => s.enabled);
  const backendRefresh = useBackend((s) => s.refresh);
  const incidents = useMemo(() => {
    const all = [...live, ...backendIncidents, ...stored];
    const seen = new Set<string>();
    return all.filter((i) => (seen.has(i.id) ? false : (seen.add(i.id), true)));
  }, [live, backendIncidents, stored]);
  const user = useAuth((s) => s.user);
  const queue = useMemo(
    () => incidents.filter((i) => i.verified === 'pending' || i.verified === 'new'),
    [incidents],
  );

  // Множество ID, которые точно есть на backend (по последней синхронизации)
  const backendIds = useMemo(() => new Set(backendIncidents.map((i) => i.id)), [backendIncidents]);

  // Отправляем верификацию на backend для каждого инцидента, который там реально есть.
  // Раньше фильтр был по префиксу (DB-/LIVE-), но реальные инциденты имеют
  // префиксы BPL-/RIA-/TASS-/GN1-/GDELT- — они в фильтр не попадали.
  async function backendVerify(ids: string[], status: 'verified' | 'rejected' | 'pending') {
    if (!backendEnabled) return { ok: 0, failed: 0 };
    let ok = 0;
    let failed = 0;
    for (const id of ids) {
      if (!backendIds.has(id)) continue; // нет на backend (например, чисто live-инцидент)
      try {
        await verifyIncident(id, status, user?.name);
        ok += 1;
      } catch {
        failed += 1;
      }
    }
    void backendRefresh();
    return { ok, failed };
  }
  const [selected, setSelected] = useState<string[]>([]);
  const [compareId, setCompareId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }
  function selectAllVisible() {
    setSelected(queue.map((i) => i.id));
  }

  async function applyBulk(action: 'approve' | 'reject' | 'ask') {
    const status: 'verified' | 'rejected' | 'pending' =
      action === 'approve' ? 'verified' : action === 'reject' ? 'rejected' : 'pending';
    const ids = [...selected];
    bulkVerify(ids, status, user?.name);
    const res = await backendVerify(ids, status);
    const label = status === 'verified' ? 'Подтверждено' : status === 'rejected' ? 'Отклонено' : 'Отправлено на уточнение';
    if (backendEnabled) {
      setToast({
        kind: res.failed > 0 ? 'err' : 'ok',
        text: `${label}: ${ids.length} (на backend: ${res.ok}, ошибок: ${res.failed})`,
      });
    } else {
      setToast({ kind: 'ok', text: `${label}: ${ids.length} (только локально, backend выключен)` });
    }
    setSelected([]);
    setTimeout(() => setToast(null), 4000);
  }

  const compareIncident = compareId ? incidents.find((i) => i.id === compareId) : null;

  return (
    <PageContainer
      title="Очередь верификации"
      subtitle={`Эксперт: ${user?.name ?? '—'}. В очереди ${nf(queue.length)} инцидентов`}
      toolbar={
        <div className="flex gap-1">
          <Button size="sm" variant="outline" onClick={selectAllVisible}>
            Выбрать все
          </Button>
          <Button size="sm" disabled={!selected.length} icon={<Check className="h-3.5 w-3.5" />} onClick={() => applyBulk('approve')}>
            Подтвердить ({selected.length})
          </Button>
          <Button size="sm" variant="outline" disabled={!selected.length} icon={<X className="h-3.5 w-3.5" />} onClick={() => applyBulk('reject')}>
            Отклонить
          </Button>
          <Button size="sm" variant="ghost" disabled={!selected.length} icon={<MessageCircleQuestion className="h-3.5 w-3.5" />} onClick={() => applyBulk('ask')}>
            Запросить уточнение
          </Button>
        </div>
      }
    >
      {toast && (
        <div
          className={`mb-3 rounded-card border px-3 py-2 text-xs ${
            toast.kind === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-orange-200 bg-orange-50 text-orange-800'
          }`}
        >
          {toast.text}
        </div>
      )}

      <Card padding="none">
        <table className="w-full text-xs">
          <thead className="bg-surface text-ink-muted">
            <tr>
              <th className="w-8 px-3 py-2"></th>
              <th className="px-3 py-2 text-left font-semibold">ID</th>
              <th className="px-3 py-2 text-left font-semibold">Дата</th>
              <th className="px-3 py-2 text-left font-semibold">Регион</th>
              <th className="px-3 py-2 text-left font-semibold">Объект</th>
              <th className="px-3 py-2 text-left font-semibold">БПЛА</th>
              <th className="px-3 py-2 text-left font-semibold">Тяжесть</th>
              <th className="px-3 py-2 text-left font-semibold">Confidence</th>
              <th className="px-3 py-2 text-left font-semibold">Статус</th>
              <th className="px-3 py-2 text-left font-semibold"></th>
            </tr>
          </thead>
          <tbody>
            {queue.slice(0, 100).map((i, idx) => (
              <tr
                key={i.id}
                className={`border-t border-surface-border ${selected.includes(i.id) ? 'bg-brand-50' : idx % 2 === 1 ? 'bg-surface/40' : ''}`}
              >
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={selected.includes(i.id)}
                    onChange={() => toggle(i.id)}
                  />
                </td>
                <td className="px-3 py-2 font-semibold text-brand-700">
                  <Link to={`/incidents/${i.id}`}>{i.id}</Link>
                </td>
                <td className="px-3 py-2">{formatDateTime(i.datetime)}</td>
                <td className="px-3 py-2">{REGIONS.find((r) => r.code === i.regionCode)?.shortName}</td>
                <td className="px-3 py-2 max-w-[200px] truncate">{i.objectName}</td>
                <td className="px-3 py-2">{UAV_LABEL[i.uavType]}</td>
                <td className="px-3 py-2">
                  <SeverityBadge severity={i.severity} />
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-16 rounded bg-surface">
                      <div
                        className="h-full rounded bg-brand-600"
                        style={{ width: `${i.classificationConfidence * 100}%` }}
                      />
                    </div>
                    <span className="text-ink-muted">{(i.classificationConfidence * 100).toFixed(0)}%</span>
                  </div>
                </td>
                <td className="px-3 py-2">
                  <VerificationBadge status={i.verified} />
                </td>
                <td className="px-3 py-2 text-right">
                  <Button size="sm" variant="outline" onClick={() => setCompareId(i.id)}>
                    Открыть
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Modal
        open={!!compareIncident}
        onClose={() => setCompareId(null)}
        title={compareIncident ? `Верификация ${compareIncident.id}` : ''}
        size="xl"
        footer={
          compareIncident && (
            <>
              <Button
                variant="outline"
                onClick={async () => {
                  bulkVerify([compareIncident.id], 'rejected', user?.name);
                  const res = await backendVerify([compareIncident.id], 'rejected');
                  setToast({
                    kind: res.failed > 0 ? 'err' : 'ok',
                    text: `Инцидент ${compareIncident.id} отклонён${backendEnabled ? ` (backend: ${res.ok > 0 ? 'OK' : 'не сохранён'})` : ' (локально)'}`,
                  });
                  setTimeout(() => setToast(null), 4000);
                  setCompareId(null);
                }}
              >
                Отклонить
              </Button>
              <Button
                onClick={async () => {
                  bulkVerify([compareIncident.id], 'verified', user?.name);
                  const res = await backendVerify([compareIncident.id], 'verified');
                  setToast({
                    kind: res.failed > 0 ? 'err' : 'ok',
                    text: `Инцидент ${compareIncident.id} подтверждён${backendEnabled ? ` (backend: ${res.ok > 0 ? 'OK' : 'не сохранён'})` : ' (локально)'}`,
                  });
                  setTimeout(() => setToast(null), 4000);
                  setCompareId(null);
                }}
              >
                Подтвердить
              </Button>
            </>
          )
        }
      >
        {compareIncident && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <h3 className="text-sm font-semibold text-ink-muted">Как извлечено</h3>
              <dl className="mt-2 space-y-2 text-sm">
                <Row label="Тип БПЛА" value={UAV_LABEL[compareIncident.uavType]} />
                <Row label="Тяжесть" value={SEVERITY_LABEL[compareIncident.severity]} />
                <Row label="Ущерб" value={`${compareIncident.damage}/10`} />
                <Row label="Сценарий" value={compareIncident.scenario} />
                <Row label="Описание" value={compareIncident.description} multi />
              </dl>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-ink-muted">После корректировки</h3>
              <div className="mt-2 space-y-2 text-sm">
                <label className="block">
                  <span className="text-[10px] font-semibold uppercase text-ink-muted">Тип БПЛА</span>
                  <select
                    defaultValue={compareIncident.uavType}
                    onChange={(e) => updateAttributes(compareIncident.id, { uavType: e.target.value as UavType })}
                    className="mt-1 h-8 w-full rounded border border-surface-border px-2 text-sm"
                  >
                    {(Object.keys(UAV_LABEL) as UavType[]).map((v) => (
                      <option key={v} value={v}>
                        {UAV_LABEL[v]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-[10px] font-semibold uppercase text-ink-muted">Тяжесть</span>
                  <select
                    defaultValue={compareIncident.severity}
                    onChange={(e) => updateAttributes(compareIncident.id, { severity: e.target.value as Severity })}
                    className="mt-1 h-8 w-full rounded border border-surface-border px-2 text-sm"
                  >
                    {(['low', 'medium', 'high', 'critical'] as Severity[]).map((v) => (
                      <option key={v} value={v}>
                        {SEVERITY_LABEL[v]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-[10px] font-semibold uppercase text-ink-muted">Ущерб</span>
                  <input
                    type="number"
                    min={0}
                    max={10}
                    defaultValue={compareIncident.damage}
                    onChange={(e) => updateAttributes(compareIncident.id, { damage: +e.target.value })}
                    className="mt-1 h-8 w-full rounded border border-surface-border px-2 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] font-semibold uppercase text-ink-muted">Сценарий</span>
                  <input
                    defaultValue={compareIncident.scenario}
                    onChange={(e) => updateAttributes(compareIncident.id, { scenario: e.target.value })}
                    className="mt-1 h-8 w-full rounded border border-surface-border px-2 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] font-semibold uppercase text-ink-muted">Описание</span>
                  <textarea
                    defaultValue={compareIncident.description}
                    onChange={(e) => updateAttributes(compareIncident.id, { description: e.target.value })}
                    rows={5}
                    className="mt-1 w-full rounded border border-surface-border p-2 text-sm"
                  />
                </label>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </PageContainer>
  );
}

function Row({ label, value, multi }: { label: string; value: string; multi?: boolean }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase text-ink-muted">{label}</dt>
      <dd className={`mt-0.5 text-ink ${multi ? '' : ''}`}>{value}</dd>
    </div>
  );
}
