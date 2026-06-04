import { useMemo, useState, useEffect } from 'react';
import { Pause, Play, Plus, Settings, Trash2 } from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { KpiCard } from '@/components/common/KpiCard';
import { Tabs } from '@/components/common/Tabs';
import { SOURCES } from '@/mocks/sources';
import type { DataSource } from '@/types/domain';
import { relativeMin, nf } from '@/utils/format';
import { useLiveData } from '@/store/liveData';
import { useBackend } from '@/store/backendData';
import { fetchScrapeStatus, triggerScrape, type ScrapeStatus } from '@/services/backendApi';

type SourceTab = 'all' | 'media' | 'telegram' | 'rss' | 'api';

interface LogEntry {
  id: number;
  time: string;
  source: string;
  level: 'info' | 'warn' | 'error';
  message: string;
}

export function SourcesPage() {
  const [tab, setTab] = useState<SourceTab>('all');
  const [sources, setSources] = useState<DataSource[]>(SOURCES);
  const [logs, setLogs] = useState<LogEntry[]>(() => generateLogs());
  const liveStatus = useLiveData((s) => s.status);
  const liveLast = useLiveData((s) => s.lastUpdate);
  const liveCount = useLiveData((s) => s.incidents.length);
  const liveDiag = useLiveData((s) => s.diagnostics);
  const liveErr = useLiveData((s) => s.errorMessage);
  const refreshLive = useLiveData((s) => s.refresh);
  const backendStatus = useBackend((s) => s.status);
  const backendEnabled = useBackend((s) => s.enabled);
  const backendUrl = useBackend((s) => s.apiUrl);
  const backendCount = useBackend((s) => s.incidents.length);
  const backendLast = useBackend((s) => s.lastSync);
  const backendErr = useBackend((s) => s.errorMessage);
  const refreshBackend = useBackend((s) => s.refresh);
  const [scrapeStatus, setScrapeStatus] = useState<ScrapeStatus | null>(null);
  const [scrapeBusy, setScrapeBusy] = useState(false);

  // Подтягиваем статус скрейперов с backend
  useEffect(() => {
    if (!backendEnabled) return;
    const load = () =>
      fetchScrapeStatus()
        .then(setScrapeStatus)
        .catch(() => {});
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [backendEnabled]);

  async function manualScrape() {
    setScrapeBusy(true);
    try {
      await triggerScrape();
      setTimeout(() => {
        fetchScrapeStatus().then(setScrapeStatus).catch(() => {});
        setScrapeBusy(false);
      }, 3000);
    } catch {
      setScrapeBusy(false);
    }
  }

  // Эмуляция «реального времени»: новая запись каждые 3 секунды
  useEffect(() => {
    const i = setInterval(() => {
      setLogs((prev) => [makeLog(prev.length + 1, sources), ...prev].slice(0, 60));
    }, 3000);
    return () => clearInterval(i);
  }, [sources]);

  const filtered = tab === 'all' ? sources : sources.filter((s) => s.type === tab);

  const stats = useMemo(
    () => ({
      active: sources.filter((s) => s.status === 'active').length,
      events24: nf(sources.reduce((sum, s) => sum + s.recordsCount, 0)),
      incidents: 134,
      errors: sources.filter((s) => s.status === 'error').length,
    }),
    [sources],
  );

  function toggle(id: string) {
    setSources((arr) =>
      arr.map((s) => (s.id === id ? { ...s, status: s.status === 'active' ? 'paused' : 'active' } : s)),
    );
  }
  function remove(id: string) {
    setSources((arr) => arr.filter((s) => s.id !== id));
  }
  function startAll() {
    setSources((arr) => arr.map((s) => ({ ...s, status: 'active' })));
  }
  function stopAll() {
    setSources((arr) => arr.map((s) => ({ ...s, status: 'paused' })));
  }

  return (
    <PageContainer
      title="Источники данных"
      subtitle="Управление перечнем источников, журнал сбора и параметры классификатора"
      toolbar={
        <div className="flex gap-1">
          <Button size="sm" icon={<Plus className="h-3.5 w-3.5" />}>
            Источник
          </Button>
          <Button size="sm" variant="outline" icon={<Play className="h-3.5 w-3.5" />} onClick={startAll}>
            Запустить все
          </Button>
          <Button size="sm" variant="outline" icon={<Pause className="h-3.5 w-3.5" />} onClick={stopAll}>
            Стоп
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Активных источников" value={nf(stats.active)} />
        <KpiCard label="События за 24 ч" value={stats.events24} />
        <KpiCard label="Инциденты выявлены" value={nf(stats.incidents)} />
        <KpiCard label="Ошибок парсеров" value={nf(stats.errors)} accent={stats.errors > 0 ? 'critical' : 'default'} />
      </div>

      <Card
        className="mt-4"
        title="Резервный канал (live в браузере)"
        subtitle="Дополнительные RSS-источники (РИА, ТАСС, Lenta, Коммерсант) через rss2json.com — на случай если backend временно недоступен. Обновление каждые 10 минут."
        toolbar={
          <Button size="sm" variant="outline" onClick={() => void refreshLive()}>
            Обновить
          </Button>
        }
      >
        <div className="grid grid-cols-2 gap-4 text-xs md:grid-cols-3">
          <div>
            <div className="text-[10px] font-semibold uppercase text-ink-muted">RSS rss2json (CORS-friendly)</div>
            <div className="mt-1 flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${liveDiag.rssOk ? 'bg-emerald-500' : 'bg-red-500'}`} />
              <span className="text-ink">{liveDiag.rssOk ? `OK · ${liveDiag.rssCount} событий` : 'Недоступен'}</span>
            </div>
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase text-ink-muted">Всего live-событий</div>
            <div className="mt-1 text-base font-bold text-brand-700">{liveCount}</div>
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase text-ink-muted">Последнее обновление</div>
            <div className="mt-1 text-ink">
              {liveLast ? relativeMin(liveLast) : 'не выполнялось'}{' '}
              <span
                className={`ml-1 inline-flex rounded-full px-2 py-0.5 text-[9px] font-semibold ${
                  liveStatus === 'ok'
                    ? 'bg-emerald-100 text-emerald-700'
                    : liveStatus === 'loading'
                      ? 'bg-orange-100 text-orange-700'
                      : liveStatus === 'error'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-zinc-200 text-zinc-700'
                }`}
              >
                {liveStatus}
              </span>
            </div>
          </div>
        </div>
        {liveErr && (
          <div className="mt-3 rounded border border-orange-200 bg-orange-50 px-3 py-2 text-[11px] text-orange-800">
            <b>Диагностика:</b> {liveErr}
          </div>
        )}
      </Card>

      <Card
        className="mt-4"
        title="Подключение к backend (БД)"
        subtitle={
          backendEnabled
            ? `Express + SQLite REST API: ${backendUrl}`
            : 'VITE_API_URL не задан — клиент работает без backend (моки + live-источники)'
        }
        toolbar={
          backendEnabled && (
            <Button size="sm" variant="outline" onClick={() => void refreshBackend()}>
              Синхронизировать
            </Button>
          )
        }
      >
        <div className="grid grid-cols-2 gap-4 text-xs md:grid-cols-4">
          <div>
            <div className="text-[10px] font-semibold uppercase text-ink-muted">Статус</div>
            <div className="mt-1 flex items-center gap-1.5">
              <span
                className={`h-2 w-2 rounded-full ${
                  backendStatus === 'ok'
                    ? 'bg-emerald-500'
                    : backendStatus === 'connecting' || backendStatus === 'waking'
                      ? 'bg-orange-500 animate-pulse'
                      : backendStatus === 'error'
                        ? 'bg-red-500'
                        : 'bg-zinc-400'
                }`}
              />
              <span className="text-ink">
                {backendStatus === 'ok' && 'Подключён'}
                {backendStatus === 'waking' && 'Пробуждение Render (до 60 сек)…'}
                {backendStatus === 'connecting' && 'Синхронизация…'}
                {backendStatus === 'error' && 'Недоступен'}
                {backendStatus === 'disabled' && 'Не настроен'}
                {backendStatus === 'idle' && 'Готов'}
              </span>
            </div>
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase text-ink-muted">Инцидентов в БД</div>
            <div className="mt-1 text-base font-bold text-brand-700">{backendCount}</div>
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase text-ink-muted">Последняя синхр.</div>
            <div className="mt-1 text-ink">{backendLast ? relativeMin(backendLast) : 'не выполнялась'}</div>
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase text-ink-muted">Авто-синхр.</div>
            <div className="mt-1 text-ink">каждые 60 сек</div>
          </div>
        </div>
        {backendErr && (
          <div className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-800">
            <b>Ошибка:</b> {backendErr}
          </div>
        )}
        {!backendEnabled && (
          <div className="mt-3 rounded border border-brand-200 bg-brand-50 p-3 text-[11px] text-brand-800">
            Чтобы подключить backend:
            <ol className="mt-1 list-decimal pl-4">
              <li>
                Разверните <code>backend/</code> на Render.com (см. <code>backend/README.md</code>) или
                запустите локально: <code>cd backend && npm install && npm start</code>.
              </li>
              <li>
                Создайте файл <code>.env</code> в корне проекта со строкой{' '}
                <code>VITE_API_URL=https://&lt;адрес&gt;</code>.
              </li>
              <li>
                Для GitHub Pages — добавьте Variable <code>VITE_API_URL</code> в Settings → Secrets &
                Variables → Actions.
              </li>
            </ol>
          </div>
        )}
      </Card>

      {/* Скрейперы backend — реальный сбор из открытых источников */}
      {backendEnabled && (
        <Card
          className="mt-4"
          title="Скрейперы backend (реальный сбор данных)"
          subtitle="Запускаются каждые 5 минут на сервере. Обходят CORS-ограничения через прямые запросы."
          toolbar={
            <Button size="sm" onClick={manualScrape} disabled={scrapeBusy}>
              {scrapeBusy ? 'Запущено…' : 'Запустить сбор сейчас'}
            </Button>
          }
        >
          <div className="grid grid-cols-2 gap-4 text-xs md:grid-cols-4">
            <div className="rounded bg-surface p-3">
              <div className="text-[10px] font-semibold uppercase text-ink-muted">bplarussia.ru</div>
              <div className="mt-1 text-base font-bold text-brand-700">{scrapeStatus?.lastStats.bpl ?? 0}</div>
              <div className="text-[10px] text-ink-muted">за последний цикл</div>
            </div>
            <div className="rounded bg-surface p-3">
              <div className="text-[10px] font-semibold uppercase text-ink-muted">RSS СМИ + Google News</div>
              <div className="mt-1 text-base font-bold text-brand-700">{scrapeStatus?.lastStats.rss ?? 0}</div>
              <div className="text-[10px] text-ink-muted">за последний цикл</div>
            </div>
            <div className="rounded bg-surface p-3">
              <div className="text-[10px] font-semibold uppercase text-ink-muted">GDELT 2.0 Doc API</div>
              <div className="mt-1 text-base font-bold text-brand-700">
                {scrapeStatus?.lastStats.gdelt ?? 0}
              </div>
              <div className="text-[10px] text-ink-muted">за последний цикл</div>
            </div>
            <div className="rounded bg-surface p-3">
              <div className="text-[10px] font-semibold uppercase text-ink-muted">Всего новых</div>
              <div className="mt-1 text-base font-bold text-emerald-600">
                +{scrapeStatus?.lastStats.new ?? 0}
              </div>
              <div className="text-[10px] text-ink-muted">
                {scrapeStatus?.lastRun ? `Цикл: ${relativeMin(scrapeStatus.lastRun)}` : 'Ещё не выполнялся'}
              </div>
            </div>
          </div>
          <div className="mt-3 rounded border border-emerald-200 bg-emerald-50 p-3 text-[11px] text-emerald-800">
            <b>Почему скрейпинг на backend?</b> Серверу не нужны CORS-прокси, нет rate-limit от
            публичных прокси-сервисов, данные кэшируются в SQLite и переживают рестарт клиента.
            Pipeline: <code>fetch (RSS/HTML/JSON) → cheerio/rss-parser → parser.js (NER+regex) →
            upsertIncident → notifyNewIncident (email)</code>.
          </div>
        </Card>
      )}

      <Tabs
        className="mt-4"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'all', label: 'Все', count: sources.length },
          { value: 'media', label: 'СМИ', count: sources.filter((s) => s.type === 'media').length },
          { value: 'telegram', label: 'Telegram', count: sources.filter((s) => s.type === 'telegram').length },
          { value: 'rss', label: 'RSS', count: sources.filter((s) => s.type === 'rss').length },
          { value: 'api', label: 'API', count: sources.filter((s) => s.type === 'api').length },
        ]}
      />

      <Card className="mt-3" padding="none">
        <div className="scrollbar-thin overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-surface text-ink-muted">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Наименование</th>
                <th className="px-3 py-2 text-left font-semibold">Тип</th>
                <th className="px-3 py-2 text-left font-semibold">Расписание</th>
                <th className="px-3 py-2 text-left font-semibold">Посл. сбор</th>
                <th className="px-3 py-2 text-left font-semibold">Записей</th>
                <th className="px-3 py-2 text-left font-semibold">Точность</th>
                <th className="px-3 py-2 text-left font-semibold">Статус</th>
                <th className="px-3 py-2 text-right font-semibold">Действия</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, idx) => (
                <tr key={s.id} className={`border-t border-surface-border ${idx % 2 === 1 ? 'bg-surface/40' : ''}`}>
                  <td className="px-3 py-2">
                    <div className="font-semibold text-ink">{s.name}</div>
                    <div className="text-[10px] text-ink-muted">{s.address}</div>
                  </td>
                  <td className="px-3 py-2 uppercase text-ink-muted">{s.type}</td>
                  <td className="px-3 py-2">{s.schedule}</td>
                  <td className="px-3 py-2">{relativeMin(s.lastRun)}</td>
                  <td className="px-3 py-2">{nf(s.recordsCount)}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-20 rounded bg-surface">
                        <div
                          className="h-full rounded"
                          style={{ width: `${s.accuracy * 100}%`, background: s.accuracy > 0.85 ? '#2E7D32' : s.accuracy > 0.7 ? '#F57C00' : '#D32F2F' }}
                        />
                      </div>
                      <span className="text-ink-muted">{(s.accuracy * 100).toFixed(0)}%</span>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        s.status === 'active'
                          ? 'bg-emerald-100 text-emerald-700'
                          : s.status === 'paused'
                            ? 'bg-zinc-200 text-zinc-700'
                            : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {s.status === 'active' ? 'Активен' : s.status === 'paused' ? 'Пауза' : 'Ошибка'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => toggle(s.id)} className="mr-2 text-brand-600 hover:underline">
                      <Settings className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => remove(s.id)} className="text-red-600">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Card title="Лог сбора (real-time)" padding="none">
          <ul className="scrollbar-thin max-h-72 overflow-y-auto divide-y divide-surface-border text-[11px]">
            {logs.map((l) => (
              <li key={l.id} className="flex items-start gap-2 px-3 py-1.5">
                <span
                  className={`mt-1 h-1.5 w-1.5 rounded-full ${
                    l.level === 'info' ? 'bg-emerald-500' : l.level === 'warn' ? 'bg-orange-500' : 'bg-red-600'
                  }`}
                />
                <span className="w-14 text-ink-muted">{l.time}</span>
                <span className="w-32 font-semibold text-ink">{l.source}</span>
                <span className="flex-1 text-ink">{l.message}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Классификатор инцидентов">
          <div className="space-y-2 text-sm">
            <Field label="Версия модели" value="incident-classifier v1.4.2" />
            <Field label="Архитектура" value="BERT-RU + LightGBM (cascade)" />
            <Field label="F1-метрика (macro)" value="0.87" />
            <Field label="Precision / Recall" value="0.89 / 0.85" />
            <Field label="Дата переобучения" value="14.04.2026" />
            <Field label="Размер обучающей выборки" value="32 800 размеченных сообщений" />
          </div>
          <Button className="mt-4 w-full">Переобучить</Button>
        </Card>
      </div>
    </PageContainer>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-surface-border pb-1.5 last:border-0">
      <span className="text-xs text-ink-muted">{label}</span>
      <span className="text-ink">{value}</span>
    </div>
  );
}

function generateLogs(): LogEntry[] {
  const arr: LogEntry[] = [];
  for (let i = 0; i < 20; i++) arr.push(makeLog(i, SOURCES));
  return arr;
}

function makeLog(i: number, sources: DataSource[]): LogEntry {
  const s = sources[Math.floor(Math.random() * sources.length)]!;
  const lvl: LogEntry['level'] = Math.random() < 0.05 ? 'error' : Math.random() < 0.15 ? 'warn' : 'info';
  const messages = {
    info: ['Получено 12 сообщений', 'Цикл завершён за 4.2 сек', 'Дедупликация: 3 совпадения', 'Извлечено 1 инцидент'],
    warn: ['Высокая задержка ответа', 'Дубль найден за 24ч', 'Низкая уверенность классификатора'],
    error: ['Ошибка парсера: timeout', 'HTTP 503 от источника', 'Превышен лимит запросов'],
  };
  const m = messages[lvl][Math.floor(Math.random() * messages[lvl].length)]!;
  const t = new Date();
  return {
    id: i,
    time: t.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    source: s.name,
    level: lvl,
    message: m,
  };
}
