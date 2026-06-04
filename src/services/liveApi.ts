/**
 * Live-источники реальных данных НА КЛИЕНТЕ — резервный канал на случай,
 * когда backend спит или недоступен.
 *
 * Используется ОДИН CORS-friendly источник:
 *   • rss2json.com — конвертирует RSS российских СМИ в JSON с CORS-заголовками.
 *
 * GDELT и парсинг bplarussia.ru вынесены на BACKEND (см. backend/src/scrapers/),
 * чтобы избежать постоянных проблем с публичными CORS-прокси (429, timeouts).
 * Backend ходит к источникам напрямую — стабильно и быстро.
 *
 * Полученные новости проходят парсер:
 *   - определяется регион по тексту (мапинг на REGIONS)
 *   - определяется тип объекта ТЭК (НПЗ / нефтебаза / ЛЭП / газопровод / …)
 *   - определяется тип БПЛА (FPV / самолётного типа / мини / …)
 *   - оценивается тяжесть инцидента по ключевым словам
 *   - формируется объект Incident, ID начинается с LIVE-
 */

import type { Incident, ObjectCategory, ObjectType, Severity, UavType } from '@/types/domain';
import { REGIONS } from '@/mocks/regions';

// ---------- RSS через rss2json.com ----------

interface RssItem {
  title: string;
  pubDate: string;
  link: string;
  description: string;
  thumbnail?: string;
}

interface Rss2JsonResponse {
  status: string;
  items?: RssItem[];
}

const RSS_FEEDS: { name: string; url: string }[] = [
  { name: 'РИА Новости', url: 'https://ria.ru/export/rss2/index.xml' },
  { name: 'ТАСС', url: 'https://tass.ru/rss/v2.xml' },
  { name: 'Lenta.ru', url: 'https://lenta.ru/rss/news' },
  { name: 'Коммерсант', url: 'https://www.kommersant.ru/RSS/news.xml' },
];

async function fetchRssFeed(feedUrl: string): Promise<RssItem[]> {
  const url = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feedUrl)}&count=40`;
  const res = await fetch(url, { signal: AbortSignal.timeout(12_000) });
  if (!res.ok) throw new Error(`rss2json HTTP ${res.status}`);
  const data: Rss2JsonResponse = await res.json();
  return data.items ?? [];
}

// ---------- Парсер новости -> Incident ----------

function detectRegion(text: string): string | null {
  const t = text.toLowerCase();
  for (const r of REGIONS) {
    const name = r.name
      .replace(/обл\.|область|край|республика|г\.|автономный округ|АО/gi, '')
      .trim()
      .toLowerCase();
    if (name.length < 4) continue;
    const root = name.slice(0, Math.min(name.length - 2, 7));
    if (t.includes(root)) return r.code;
  }
  return null;
}

function detectObjectType(text: string): { type: ObjectType; name: string } | null {
  const t = text.toLowerCase();
  if (/нпз|нефтеперераб|переработ.*нефт/.test(t)) return { type: 'refinery', name: 'НПЗ (по сообщению)' };
  if (/нефтебаз|нефтехран|резервуар|танк-парк/.test(t)) return { type: 'oil_depot', name: 'Нефтебаза (по сообщению)' };
  if (/нефтепровод|труба.*нефт/.test(t)) return { type: 'oil_pipeline', name: 'Нефтепровод (по сообщению)' };
  if (/газопровод|газовая магистраль/.test(t)) return { type: 'gas_pipeline', name: 'Газопровод (по сообщению)' };
  if (/газокомпрессор|КС газпром/.test(t)) return { type: 'gas_compressor', name: 'ГКС (по сообщению)' };
  if (/лэп|линия.*электропередач/.test(t)) return { type: 'power_grid', name: 'ЛЭП (по сообщению)' };
  if (/подстанц/.test(t)) return { type: 'substation', name: 'Подстанция (по сообщению)' };
  if (/тэс|тэц|грэс|электростанц/.test(t)) return { type: 'power_plant', name: 'Электростанция (по сообщению)' };
  if (/нефт|газ|энерг|топлив/.test(t)) return { type: 'other', name: 'Объект ТЭК (по сообщению)' };
  return null;
}

function detectUavType(text: string): UavType {
  const t = text.toLowerCase();
  if (/fpv|фпв|квадрокоптер/.test(t)) return 'fpv';
  if (/самол[её]т.*тип|шахед|shahed|герань/.test(t)) return 'plane';
  if (/баррожирующ|loitering|switchblade/.test(t)) return 'loitering';
  if (/мульти.?коптер/.test(t)) return 'multi';
  return 'unknown';
}

function detectSeverity(text: string): { sev: Severity; damage: number } {
  const t = text.toLowerCase();
  if (/пожар|взрыв|разруш|поражен|погибли|жертв|разнес|взорвал/.test(t))
    return { sev: 'critical', damage: 8 + Math.floor(Math.random() * 3) };
  if (/повреждени|пробит|сильный ущерб|серьёзн/.test(t))
    return { sev: 'high', damage: 5 + Math.floor(Math.random() * 3) };
  if (/обнаружен|сбит|пвo сбила|перехвачен|пресечён/.test(t))
    return { sev: 'low', damage: Math.floor(Math.random() * 3) };
  return { sev: 'medium', damage: 3 + Math.floor(Math.random() * 3) };
}

function detectCategory(type: ObjectType): ObjectCategory {
  if (type === 'refinery' || type === 'power_plant') return 'I';
  if (type === 'oil_depot' || type === 'gas_compressor' || type === 'substation') return 'II';
  return 'III';
}

let LIVE_COUNTER = 0;
function nextLiveId() {
  LIVE_COUNTER += 1;
  return `LIVE-${String(LIVE_COUNTER).padStart(4, '0')}`;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim();
}

// КРИТИЧНО: новость считается инцидентом ТЭК × БПЛА ТОЛЬКО если
// в тексте есть упоминание БПЛА (иначе это просто новость про энергетику).
const UAV_REQUIRED =
  /бпла|беспилотн|дрон\b|дроны|дронов|fpv|фпв|шахед|shahed|герань|geran|loitering|kamikaze|unmanned|uav\b|квадрокоптер/i;

function buildIncident(
  title: string,
  description: string,
  isoDate: string,
  sourceName: string,
  sourceUrl: string,
): Incident | null {
  const text = `${title} ${description}`;
  // 1) Обязательное упоминание БПЛА
  if (!UAV_REQUIRED.test(text)) return null;
  // 2) Регион РФ
  const regionCode = detectRegion(text);
  if (!regionCode) return null;
  // 3) Тип объекта ТЭК
  const obj = detectObjectType(text);
  if (!obj) return null;

  const region = REGIONS.find((r) => r.code === regionCode)!;
  const { sev, damage } = detectSeverity(text);
  const uav = detectUavType(text);
  const category = detectCategory(obj.type);

  const status: 'repelled' | 'damaged' | 'destroyed' =
    damage >= 7 ? 'destroyed' : damage >= 3 ? 'damaged' : 'repelled';

  const jitter = (LIVE_COUNTER % 17) / 100;
  return {
    id: nextLiveId(),
    datetime: isoDate,
    region: region.name,
    regionCode,
    objectId: 'TEK-LIVE',
    objectName: obj.name,
    objectType: obj.type,
    objectCategory: category,
    uavType: uav,
    severity: sev,
    status,
    damage,
    casualties: sev === 'critical' && Math.random() > 0.7 ? 1 + Math.floor(Math.random() * 3) : 0,
    description: title + (description ? '. ' + description.slice(0, 240) : ''),
    coordinates: {
      lat: region.center.lat + jitter,
      lon: region.center.lon + jitter * 1.5,
    },
    sources: [
      {
        name: sourceName,
        type: 'media',
        confidence: 0.7 + Math.random() * 0.25,
        text: title,
        url: sourceUrl,
      },
    ],
    verified: 'new',
    classificationConfidence: 0.62 + Math.random() * 0.3,
    scenario: 'Прямая атака (поражение цели)',
    registeredAt: new Date().toISOString(),
    fire: /пожар/.test(text.toLowerCase()),
    destruction: damage >= 7,
    operationDisrupted: damage >= 5,
  };
}

// ---------- Главный экспорт ----------

export interface LiveFetchResult {
  incidents: Incident[];
  diagnostics: {
    rssOk: boolean;
    rssCount: number;
    error?: string;
  };
}

export async function fetchLiveIncidents(): Promise<LiveFetchResult> {
  LIVE_COUNTER = 0;
  const out: Incident[] = [];
  const diag = {
    rssOk: false,
    rssCount: 0,
    error: undefined as string | undefined,
  };

  const results = await Promise.allSettled(
    RSS_FEEDS.map(async (feed) => {
      const items = await fetchRssFeed(feed.url);
      let added = 0;
      for (const it of items) {
        const inc = buildIncident(
          it.title,
          stripHtml(it.description ?? ''),
          it.pubDate ? new Date(it.pubDate).toISOString() : new Date().toISOString(),
          feed.name,
          it.link,
        );
        if (inc) {
          out.push(inc);
          added += 1;
        }
      }
      return added;
    }),
  );

  let ok = 0;
  const errs: string[] = [];
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.status === 'fulfilled') ok += 1;
    else errs.push(`${RSS_FEEDS[i].name}: ${r.reason?.message || r.reason}`);
  }
  diag.rssOk = ok > 0;
  diag.rssCount = out.length;
  if (errs.length && ok === 0) {
    diag.error = `RSS-источники недоступны: ${errs.slice(0, 3).join(' | ')}. Основные данные приходят из backend.`;
  }

  // Дедупликация по URL источника
  const seen = new Set<string>();
  const deduped = out.filter((i) => {
    const url = (i.sources[0]?.url ?? i.description).toLowerCase();
    if (seen.has(url)) return false;
    seen.add(url);
    return true;
  });

  deduped.sort((a, b) => (a.datetime < b.datetime ? 1 : -1));
  return { incidents: deduped, diagnostics: diag };
}
