import { useState, useEffect } from 'react';
import { Bell, Mail, Send, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { MultiSelect } from '@/components/common/MultiSelect';
import { REGIONS } from '@/mocks/regions';
import { SEVERITY_LABEL, type Severity } from '@/types/domain';
import { formatDateTime } from '@/utils/format';
import {
  fetchSubscriptions,
  upsertSubscription,
  deleteSubscription,
  sendTestEmail,
  type Subscription,
} from '@/services/backendApi';
import { useBackend } from '@/store/backendData';

export function SubscriptionsPage() {
  const backendEnabled = useBackend((s) => s.enabled);
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(false);

  // Форма
  const [email, setEmail] = useState('');
  const [regions, setRegions] = useState<string[]>([]);
  const [severities, setSeverities] = useState<Severity[]>(['critical', 'high']);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  async function refresh() {
    if (!backendEnabled) return;
    setLoading(true);
    try {
      setSubs(await fetchSubscriptions());
    } catch (e) {
      setMsg({ kind: 'err', text: `Не удалось загрузить подписки: ${(e as Error).message}` });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, [backendEnabled]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setMsg({ kind: 'err', text: 'Введите корректный e-mail' });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      await upsertSubscription(email.trim().toLowerCase(), regions, severities);
      setMsg({ kind: 'ok', text: 'Подписка сохранена. Уведомления будут приходить на этот e-mail.' });
      setEmail('');
      setRegions([]);
      setSeverities(['critical', 'high']);
      await refresh();
    } catch (e) {
      setMsg({ kind: 'err', text: `Ошибка: ${(e as Error).message}` });
    } finally {
      setBusy(false);
    }
  }

  async function remove(email: string) {
    if (!confirm(`Удалить подписку ${email}?`)) return;
    await deleteSubscription(email);
    await refresh();
  }

  async function test(email: string) {
    setBusy(true);
    try {
      const r = await sendTestEmail(email);
      const previewHint = r.preview ? `\n\nПревью (Ethereal): ${r.preview}` : '';
      setMsg({ kind: 'ok', text: `Тестовое письмо отправлено на ${email}.${previewHint}` });
    } catch (e) {
      setMsg({ kind: 'err', text: `Не удалось отправить: ${(e as Error).message}` });
    } finally {
      setBusy(false);
    }
  }

  if (!backendEnabled) {
    return (
      <PageContainer title="Подписки на уведомления">
        <Card>
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 text-orange-500" />
            <div>
              <h2 className="text-sm font-semibold text-ink">Backend не подключён</h2>
              <p className="mt-1 text-xs text-ink-muted">
                Подписки и email-уведомления требуют backend. Проверьте, что переменная{' '}
                <code>VITE_API_URL</code> задана и backend доступен. См. инструкции
                в README проекта.
              </p>
            </div>
          </div>
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Подписки на уведомления"
      subtitle="Получайте email при появлении новых инцидентов в выбранных регионах"
    >
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_1.2fr]">
        {/* Форма */}
        <Card title="Подписаться">
          <form onSubmit={submit} className="space-y-3">
            <label className="block">
              <span className="block text-[10px] font-semibold uppercase text-ink-muted">E-mail для уведомлений</span>
              <div className="relative mt-1">
                <Mail className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-muted" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="h-10 w-full rounded border border-surface-border bg-white pl-8 pr-3 text-sm focus:border-brand-600 focus:outline-none"
                />
              </div>
            </label>

            <MultiSelect
              label="Регионы (пусто = все)"
              value={regions}
              onChange={setRegions}
              options={REGIONS.map((r) => ({ value: r.code, label: r.shortName }))}
            />

            <MultiSelect
              label="Минимальная тяжесть"
              value={severities}
              onChange={(v) => setSeverities(v as Severity[])}
              options={(['low', 'medium', 'high', 'critical'] as Severity[]).map((v) => ({
                value: v,
                label: SEVERITY_LABEL[v],
              }))}
            />

            <Button type="submit" disabled={busy} icon={<Bell className="h-4 w-4" />} className="w-full">
              {busy ? 'Сохраняем…' : 'Оформить подписку'}
            </Button>

            {msg && (
              <div
                className={`rounded border p-3 text-xs ${
                  msg.kind === 'ok'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    : 'border-red-200 bg-red-50 text-red-800'
                }`}
              >
                {msg.kind === 'ok' ? (
                  <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />
                ) : (
                  <AlertCircle className="mr-1 inline h-3.5 w-3.5" />
                )}
                <span className="whitespace-pre-wrap">{msg.text}</span>
              </div>
            )}
          </form>

          <div className="mt-5 rounded border border-brand-100 bg-brand-50 p-3 text-[11px] text-brand-800">
            <b>Как это работает:</b>
            <ol className="mt-1 list-decimal pl-4">
              <li>Backend каждые 5 минут парсит реальные источники (bplarussia.ru, RSS Минобороны / МЧС / РИА / ТАСС / РБК / Lenta).</li>
              <li>Новые инциденты пропускаются через NER+регекспы → определяется регион, тип объекта ТЭК, тип БПЛА, тяжесть.</li>
              <li>Если инцидент совпадает с вашими фильтрами (регион + тяжесть) — на ваш email приходит письмо.</li>
              <li>Идемпотентность: одно письмо на инцидент на адрес, без дублей.</li>
            </ol>
          </div>
        </Card>

        {/* Список существующих подписок */}
        <Card
          title={`Существующие подписки (${subs.length})`}
          toolbar={
            <Button size="sm" variant="ghost" onClick={refresh} disabled={loading}>
              Обновить
            </Button>
          }
          padding="none"
        >
          {loading && <div className="p-4 text-xs text-ink-muted">Загрузка…</div>}
          {!loading && subs.length === 0 && (
            <div className="p-6 text-center text-xs text-ink-muted">
              Подписок пока нет. Оформите первую слева.
            </div>
          )}
          {!loading && subs.length > 0 && (
            <table className="w-full text-xs">
              <thead className="bg-surface text-ink-muted">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">E-mail</th>
                  <th className="px-3 py-2 text-left font-semibold">Регионы</th>
                  <th className="px-3 py-2 text-left font-semibold">Тяжесть</th>
                  <th className="px-3 py-2 text-left font-semibold">Создана</th>
                  <th className="px-3 py-2 text-left font-semibold">Последнее</th>
                  <th className="px-3 py-2 text-right font-semibold">Действия</th>
                </tr>
              </thead>
              <tbody>
                {subs.map((s, idx) => (
                  <tr key={s.id} className={`border-t border-surface-border ${idx % 2 === 1 ? 'bg-surface/40' : ''}`}>
                    <td className="px-3 py-2 font-semibold text-brand-700">{s.email}</td>
                    <td className="px-3 py-2">
                      {s.regions.length === 0 ? (
                        <span className="text-ink-muted">все</span>
                      ) : (
                        s.regions.map((c) => REGIONS.find((r) => r.code === c)?.shortName ?? c).join(', ')
                      )}
                    </td>
                    <td className="px-3 py-2">{s.severities.map((sev) => SEVERITY_LABEL[sev as Severity] ?? sev).join(', ')}</td>
                    <td className="px-3 py-2 text-ink-muted">{formatDateTime(s.createdAt)}</td>
                    <td className="px-3 py-2 text-ink-muted">{s.lastSentAt ? formatDateTime(s.lastSentAt) : '—'}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => test(s.email)}
                        className="mr-2 inline-flex items-center gap-0.5 text-brand-600 hover:underline"
                        title="Отправить тестовое письмо"
                        disabled={busy}
                      >
                        <Send className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => remove(s.email)}
                        className="inline-flex items-center gap-0.5 text-red-600 hover:underline"
                        title="Удалить подписку"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </PageContainer>
  );
}
