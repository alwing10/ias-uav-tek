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
        title="Подключение к открытым источникам (live)"
        subtitle="GDELT 2.0 Doc API + RSS российских СМИ (РИА, ТАСС, РБК). Обновление каждые 10 минут."
        toolbar={
          <Button size="sm" variant="outline" onClick={() => void refreshLive()}>
            Обновить
          </Button>
        }
      >
        <div className="grid grid-cols-2 gap-4 text-xs md:grid-cols-4">
          <div>
            <div className="text-[10px] font-semibold uppercase text-ink-muted">GDELT 2.0</div>
            <div className="mt-1 flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${liveDiag.gdeltOk ? 'bg-emerald-500' : 'bg-red-500'}`} />
              <span className="text-ink">{liveDiag.gdeltOk ? `OK · ${liveDiag.gdeltCount} событий` : 'Недоступен'}</span>
            </div>
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase text-ink-muted">RSS rss2json</div>
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
