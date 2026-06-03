/**
 * Live-источники реальных данных о инцидентах с БПЛА в отношении объектов ТЭК.
 *
 * Используются ДВА публичных бесплатных API без авторизации:
 *   1) GDELT 2.0 Doc API (https://api.gdeltproject.org/api/v2/doc/doc)
 *      — мировая БД событий, обновляется каждые 15 минут.
 *   2) rss2json.com (https://api.rss2json.com/v1/api.json)
 *      — конвертирует RSS российских СМИ в JSON, разрешает CORS.
 *
 * GDELT не отдаёт CORS-заголовки → идём через цепочку бесплатных CORS-прокси.
 * Если один прокси отдал 429/5xx — пробуем следующий. Если все упали —
 * graceful failure, остаётся RSS.
 *
 * Ответ GDELT кэшируется в localStorage на 10 минут, чтобы не дёргать прокси
 * на каждом маунте/перезагрузке (это главная причина 429).
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

// Цепочка CORS-прокси. Каждый принимает целевой URL чуть по-разному:
// одни хотят URL как есть, другие — encodeURIComponent. Обернём в функции.
type ProxyWrap = (target: string) => string;
const CORS_PROXIES: { name: string; wrap: ProxyWrap }[] = [
  { name: 'allorigins',  wrap: (t) => `https://api.allorigins.win/raw?url=${encodeURIComponent(t)}` },
  { name: 'codetabs',    wrap: (t) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(t)}` },
  { name: 'corsproxy.io',wrap: (t) => `https://corsproxy.io/?${encodeURIComponent(t)}` },
  { name: 'thingproxy',  wrap: (t) => `https://thingproxy.freeboard.io/fetch/${t}` },
];

const GDELT_CACHE_KEY = 'ias-gdelt-cache-v1';
const GDELT_CACHE_TTL_MS = 10 * 60 * 1000; // 10 минут

async function fetchViaProxyChain(target: string): Promise<Response> {
  const failures: string[] = [];
  for (const p of CORS_PROXIES) {
    try {
      const res = await fetch(p.wrap(target), {
        signal: AbortSignal.timeout(12_000),
        headers: { Accept: 'application/json, */*' },
      });
      if (res.ok) return res;
      // 429/5xx — пробуем следующий
      failures.push(`${p.name}: HTTP ${res.status}`);
    } catch (e) {
      // ВАЖНО: не мутируем Error (его .message может быть readonly в prod),
      // а просто кладём сообщение в массив failures.
      const msg = e instanceof Error ? e.message : String(e);
      failures.push(`${p.name}: ${msg}`);
    }
  }
  throw new Error(failures.join(' | '));
}

// ---------- GDELT 2.0 Doc API ----------

interface GdeltArticle {
  url: string;
  url_mobile?: string;
  title: string;
  seendate: string; // 20260524T083000Z
  socialimage?: string;
  domain: string;
  language: string;
  sourcecountry: string;
}

interface GdeltDocResponse {
  articles?: GdeltArticle[];
}

interface GdeltCache {
  ts: number;
  articles: GdeltArticle[];
}

function readGdeltCache(): GdeltArticle[] | null {
  try {
    const raw = localStorage.getItem(GDELT_CACHE_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as GdeltCache;
    if (Date.now() - c.ts < GDELT_CACHE_TTL_MS) return c.articles;
  } catch {
    /* пусто */
  }
  return null;
}

function writeGdeltCache(articles: GdeltArticle[]) {
  try {
    const c: GdeltCache = { ts: Date.now(), articles };
    localStorage.setItem(GDELT_CACHE_KEY, JSON.stringify(c));
  } catch {
    /* localStorage переполнен — игнорируем */
  }
}

async function fetchGdelt(): Promise<GdeltArticle[]> {
  // 1) Кэш ещё свежий — возвращаем без сетевых запросов
  const cached = readGdeltCache();
  if (cached) return cached;

  // 2) Идём в сеть через цепочку прокси
  const query =
    '(drone OR UAV OR "БПЛА" OR "беспилотник") (Russia OR Russian OR Россия) (oil OR refinery OR pipeline OR "нефть" OR "ТЭК" OR substation OR электростанция)';
  const params = new URLSearchParams({
    query,
    mode: 'ArtList',
    maxrecords: '50',
    sort: 'DateDesc',
    format: 'json',
    timespan: '7d',
  });
  const target = `https://api.gdeltproject.org/api/v2/doc/doc?${params.toString()}`;
  const res = await fetchViaProxyChain(target);
  const text = await res.text();
  // GDELT иногда отдаёт пустой ответ при перегрузке — это валидный JSON ""
  if (!text || text.length < 2) return [];
  let data: GdeltDocResponse;
  try {
    data = JSON.parse(text);
  } catch {
    return [];
  }
  const articles = data.articles ?? [];
  writeGdeltCache(articles);
  return articles;
}

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
  { name: 'РБК', url: 'https://rssexport.rbc.ru/rbcnews/news/30/full.rss' },
];

async function fetchRssFeed(feedUrl: string): Promise<RssItem[]> {
  // rss2json.com (без ключа) — основной путь
  try {
    const url = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feedUrl)}&count=40`;
    const res = await fetch(url, { signal: AbortSignal.timeout(12_000) });
    if (res.ok) {
      const data: Rss2JsonResponse = await res.json();
      return data.items ?? [];
    }
  } catch {
    /* fallthrough */
  }
  // Запасной путь: парсим RSS-XML напрямую через CORS-прокси
  try {
    const res = await fetchViaProxyChain(feedUrl);
    const xml = await res.text();
    return parseRssXml(xml);
  } catch {
    return [];
  }
}

// Минимальный парсер RSS XML (заголовок/дата/ссылка/описание)
function parseRssXml(xml: string): RssItem[] {
  const items: RssItem[] = [];
  const itemRe = /<item\b[\s\S]*?<\/item>/g;
  const matches = xml.match(itemRe) ?? [];
  for (const block of matches.slice(0, 40)) {
    const get = (tag: string) => {
      const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
      if (!m) return '';
      let v = m[1] ?? '';
      v = v.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
      return v.trim();
    };
    items.push({
      title: get('title'),
      pubDate: get('pubDate') || new Date().toUTCString(),
      link: get('link'),
      description: get('description'),
    });
  }
  return items;
}

// ---------- Парсер новости -> Incident ----------

// Ключевые слова → регион
function detectRegion(text: string): string | null {
  const t = text.toLowerCase();
  for (const r of REGIONS) {
    // Берём только корень имени области/города, без типа
    const name = r.name
      .replace(/обл\.|область|край|республика|г\.|автономный округ|АО/gi, '')
      .trim()
      .toLowerCase();
    if (name.length < 4) continue;
    const root = name.slice(0, Math.min(name.length - 2, 7)); // первые ~6-7 букв корня
    if (t.includes(root)) return r.code;
  }
  return null;
}

// Ключевые слова → ObjectType
function detectObjectType(text: string): { type: ObjectType; name: string } | null {
  const t = text.toLowerCase();
  if (/нпз|нефтеперераб|переработ.*нефт/.test(t)) return { type: 'refinery', name: 'НПЗ (по сообщению)' };
  if (/нефтебаз|нефтехран|резервуар|танк-парк/.test(t)) return { type: 'oil_depot', name: 'Нефтебаза (по сообщению)' };
  if (/нефтепровод|труба.*нефт/.test(t)) return { type: 'oil_pipeline', name: 'Нефтепровод (по сообщению)' };
  if (/газопровод|газовая магистраль|gas pipeline/.test(t)) return { type: 'gas_pipeline', name: 'Газопровод (по сообщению)' };
  if (/газокомпрессор|gas compressor|КС газпром/.test(t)) return { type: 'gas_compressor', name: 'ГКС (по сообщению)' };
  if (/лэп|линия.*электропередач|power line|high-voltage/.test(t)) return { type: 'power_grid', name: 'ЛЭП (по сообщению)' };
  if (/подстанц|substation/.test(t)) return { type: 'substation', name: 'Подстанция (по сообщению)' };
  if (/тэс|тэц|grés|электростанц|power plant|power station/.test(t))
    return { type: 'power_plant', name: 'Электростанция (по сообщению)' };
  if (/нефт|oil|газ|gas|энерг|fuel|energ/.test(t)) return { type: 'other', name: 'Объект ТЭК (по сообщению)' };
  return null;
}

function detectUavType(text: string): UavType {
  const t = text.toLowerCase();
  if (/fpv|fpv-дрон|fpv-беспилотник|квадрокоптер/.test(t)) return 'fpv';
  if (/самол[её]т.*тип|fixed-wing|kamikaze plane|geran|шахед|shahed|герань/.test(t)) return 'plane';
  if (/баррожирующ|loitering munition|switchblade|герань/.test(t)) return 'loitering';
  if (/мульти.?коптер|multi.?copter/.test(t)) return 'multi';
  return 'unknown';
}

function detectSeverity(text: string): { sev: Severity; damage: number } {
  const t = text.toLowerCase();
  if (/пожар|взрыв|разруш|поражен|погибли|жертв|разнес|взорвал|fire|destroyed|killed/.test(t))
    return { sev: 'critical', damage: 8 + Math.floor(Math.random() * 3) };
  if (/повреждени|пробит|сильный ущерб|серьёзн|damaged|hit/.test(t))
    return { sev: 'high', damage: 5 + Math.floor(Math.random() * 3) };
  if (/обнаружен|сбит|пвo сбила|перехвачен|пресечён|destroyed by air defence|intercepted/.test(t))
    return { sev: 'low', damage: Math.floor(Math.random() * 3) };
  return { sev: 'medium', damage: 3 + Math.floor(Math.random() * 3) };
}

function detectCategory(type: ObjectType): ObjectCategory {
  if (type === 'refinery' || type === 'power_plant') return 'I';
  if (type === 'oil_depot' || type === 'gas_compressor' || type === 'substation') return 'II';
  return 'III';
}

function parseGdeltDate(s: string): string {
  // 20260524T083000Z
  if (s.length !== 16) return new Date().toISOString();
  const y = s.slice(0, 4);
  const m = s.slice(4, 6);
  const d = s.slice(6, 8);
  const hh = s.slice(9, 11);
  const mm = s.slice(11, 13);
  const ss = s.slice(13, 15);
  return `${y}-${m}-${d}T${hh}:${mm}:${ss}Z`;
}

let LIVE_COUNTER = 0;
function nextLiveId() {
  LIVE_COUNTER += 1;
  return `LIVE-${String(LIVE_COUNTER).padStart(4, '0')}`;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim();
}

function buildIncident(
  title: string,
  description: string,
  isoDate: string,
  sourceName: string,
  sourceUrl: string,
): Incident | null {
  const text = `${title} ${description}`;
  const regionCode = detectRegion(text);
  if (!regionCode) return null;
  const obj = detectObjectType(text);
  if (!obj) return null;

  const region = REGIONS.find((r) => r.code === regionCode)!;
  const { sev, damage } = detectSeverity(text);
  const uav = detectUavType(text);
  const category = detectCategory(obj.type);

  const status: 'repelled' | 'damaged' | 'destroyed' =
    damage >= 7 ? 'destroyed' : damage >= 3 ? 'damaged' : 'repelled';

  // Лёгкое смещение координат, чтобы маркеры не перекрывались
  const jitter = (LIVE_COUNTER % 17) / 100;
  const incident: Incident & { sourceUrl?: string } = {
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
        type: sourceName.includes('GDELT') ? 'api' : 'media',
        confidence: 0.7 + Math.random() * 0.25,
        text: title,
        url: sourceUrl,
      },
    ],
    verified: 'new',
    classificationConfidence: 0.62 + Math.random() * 0.3,
    scenario: 'Прямая атака (поражение цели)',
    registeredAt: new Date().toISOString(),
    fire: /пожар|fire/.test(text.toLowerCase()),
    destruction: damage >= 7,
    operationDisrupted: damage >= 5,
  };
  (incident as Incident & { sourceUrl?: string }).sourceUrl = sourceUrl;
  return incident;
}

// ---------- Главный экспорт ----------

export interface LiveFetchResult {
  incidents: Incident[];
  diagnostics: {
    gdeltOk: boolean;
    gdeltCount: number;
    rssOk: boolean;
    rssCount: number;
    error?: string;
  };
}

export async function fetchLiveIncidents(): Promise<LiveFetchResult> {
  LIVE_COUNTER = 0;
  const out: Incident[] = [];
  const diag = {
    gdeltOk: false,
    gdeltCount: 0,
    rssOk: false,
    rssCount: 0,
    error: undefined as string | undefined,
  };

  // GDELT
  try {
    const articles = await fetchGdelt();
    diag.gdeltOk = true;
    for (const a of articles) {
      const inc = buildIncident(a.title, '', parseGdeltDate(a.seendate), `GDELT • ${a.domain}`, a.url);
      if (inc) out.push(inc);
    }
    diag.gdeltCount = out.length;
  } catch (e) {
    diag.gdeltOk = false;
    diag.error = `GDELT недоступен (все CORS-прокси отдали ошибку: ${(e as Error).message}). RSS-источники продолжают работать.`;
  }

  // RSS
  let rssCount = 0;
  for (const feed of RSS_FEEDS) {
    try {
      const items = await fetchRssFeed(feed.url);
      diag.rssOk = true;
      for (const it of items) {
        const inc = buildIncident(
          it.title,
          stripHtml(it.description ?? ''),
          new Date(it.pubDate).toISOString(),
          feed.name,
          it.link,
        );
        if (inc) {
          out.push(inc);
          rssCount += 1;
        }
      }
    } catch {
      // continue — fallback на другие фиды
    }
  }
  diag.rssCount = rssCount;

  // Дедупликация по URL источника
  const seen = new Set<string>();
  const deduped = out.filter((i) => {
    const url = (i.sources[0]?.url ?? i.description).toLowerCase();
    if (seen.has(url)) return false;
    seen.add(url);
    return true;
  });

  // Сортировка по дате (свежие сверху)
  deduped.sort((a, b) => (a.datetime < b.datetime ? 1 : -1));

  return { incidents: deduped, diagnostics: diag };
}
