// GDELT 2.0 Doc API — мировая БД событий, обновляется каждые 15 минут.
// На backend никаких CORS-проблем, ходим напрямую (быстро и надёжно).
//
// Запрос: https://api.gdeltproject.org/api/v2/doc/doc
//   query: булева формула с фильтром по теме
//   mode: ArtList — возвращает структурированный список статей
//   timespan: 7d — за последние 7 дней
//   format: json

import { parseToIncident } from '../parser.js';

const GDELT_URL = 'https://api.gdeltproject.org/api/v2/doc/doc';

const QUERIES = [
  // Несколько запросов с разными формулировками — даёт больше уникальных событий
  '(drone OR UAV OR "БПЛА") (Russia OR Россия) (refinery OR "НПЗ" OR "нефтепереработ")',
  '(drone OR UAV OR Shahed OR Шахед) (Russia OR Россия) (oil OR pipeline OR "нефтепровод")',
  '(дрон OR беспилотник) (атак OR удар OR взрыв) (электро OR подстанц OR ТЭС OR ТЭЦ)',
  '(БПЛА OR "беспилотный") (нефтебаз OR нефтехранил OR резервуар)',
];

async function fetchGdeltQuery(query) {
  const params = new URLSearchParams({
    query,
    mode: 'ArtList',
    maxrecords: '50',
    sort: 'DateDesc',
    format: 'json',
    timespan: '7d',
  });
  const url = `${GDELT_URL}?${params.toString()}`;
  const res = await fetch(url, {
    signal: AbortSignal.timeout(20_000),
    headers: {
      'User-Agent':
        'Mozilla/5.0 (compatible; IAS-UAV-TEK-Bot/1.0; +https://github.com/alwing10/ias-uav-tek)',
      Accept: 'application/json',
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  if (!text || text.length < 4) return [];
  try {
    const data = JSON.parse(text);
    return data.articles ?? [];
  } catch {
    return [];
  }
}

function parseGdeltDate(s) {
  // 20260524T083000Z → 2026-05-24T08:30:00Z
  if (!s || s.length !== 16) return new Date().toISOString();
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(9, 11)}:${s.slice(11, 13)}:${s.slice(13, 15)}Z`;
}

export async function scrapeGdelt() {
  const incidents = [];
  let totalArticles = 0;
  const errors = [];

  const results = await Promise.allSettled(QUERIES.map(fetchGdeltQuery));

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.status === 'fulfilled') {
      const articles = r.value;
      totalArticles += articles.length;
      for (const a of articles) {
        const inc = parseToIncident({
          title: a.title ?? '',
          description: '',
          publishedAt: parseGdeltDate(a.seendate),
          url: a.url,
          sourceName: `GDELT · ${a.domain ?? '?'}`,
          sourcePrefix: 'GDELT',
        });
        if (inc) incidents.push(inc);
      }
    } else {
      errors.push(`query ${i + 1}: ${r.reason?.message || r.reason}`);
    }
  }

  console.log(
    `[gdelt] собрано ${incidents.length} инцидентов из ${totalArticles} статей по ${QUERIES.length} запросам, ошибок: ${errors.length}`,
  );
  if (errors.length) console.log(`[gdelt] ошибки: ${errors.join(' | ')}`);
  return incidents;
}
