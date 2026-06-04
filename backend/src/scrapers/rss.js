// Парсер RSS-фидов официальных и крупных СМИ.
// Отличие от фронта (rss2json.com) — здесь у нас нет CORS-проблемы,
// поэтому ходим в RSS напрямую через библиотеку rss-parser.
//
// ВАЖНЫЙ источник — **Google News RSS** с поисковыми запросами.
// Возвращает агрегированные новости от десятков СМИ по конкретной теме.

import Parser from 'rss-parser';
import { parseToIncident } from '../parser.js';

// Google News RSS поиск — формат:
//   https://news.google.com/rss/search?q=<query>&hl=ru&gl=RU&ceid=RU:ru
// Возвращает топ-100 новостей за последние ~24 ч по запросу. Без авторизации.
function gnews(query, prefix) {
  return {
    name: `Google News · ${query}`,
    url: `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=ru&gl=RU&ceid=RU:ru`,
    prefix,
  };
}

const FEEDS = [
  // ===== Google News — главный поставщик реал-тайм новостей =====
  gnews('БПЛА НПЗ Россия', 'GN1'),
  gnews('беспилотник нефтебаза', 'GN2'),
  gnews('дрон подстанция атака', 'GN3'),
  gnews('FPV нефтепровод', 'GN4'),
  gnews('Шахед нефтеперерабатывающий завод', 'GN5'),
  gnews('атака БПЛА Белгород', 'GN6'),
  gnews('атака БПЛА Краснодар', 'GN7'),
  gnews('атака БПЛА Ростов', 'GN8'),

  // ===== Прямые RSS крупных СМИ =====
  { name: 'РИА Новости', url: 'https://ria.ru/export/rss2/index.xml', prefix: 'RIA' },
  { name: 'ТАСС', url: 'https://tass.ru/rss/v2.xml', prefix: 'TASS' },
  { name: 'Lenta.ru', url: 'https://lenta.ru/rss/news', prefix: 'LENTA' },
  { name: 'Коммерсант', url: 'https://www.kommersant.ru/RSS/news.xml', prefix: 'KOMM' },
  { name: 'Интерфакс', url: 'https://www.interfax.ru/rss.asp', prefix: 'IF' },
  // Газета.ру меняла URL фидов — используем актуальный raw URL
  { name: 'Газета.ру', url: 'https://www.gazeta.ru/export/rss/first.xml', prefix: 'GAZ' },

  // ===== Официальные источники =====
  // Минобороны и МЧС часто медленно отдают или редиректят — даём им свои таймауты
  // через попытку и пропуск при ошибке (Promise.allSettled внизу).
  // Используем функциональные поддомены, не главные mil.ru/mchs.gov.ru.
];

// Альтернатива RSS Минобороны/МЧС — Google News даёт их новости через поиск:
FEEDS.push(gnews('site:mil.ru БПЛА', 'MIL'));
FEEDS.push(gnews('site:mchs.gov.ru пожар нефть OR газ', 'MCHS'));

const parser = new Parser({
  timeout: 25_000, // 25 секунд — некоторые российские RSS медленные
  headers: {
    'User-Agent':
      'Mozilla/5.0 (compatible; IAS-UAV-TEK-Bot/1.0; academic research; +https://github.com/alwing10/ias-uav-tek)',
    Accept: 'application/rss+xml, application/xml, text/xml, */*',
    'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8',
  },
});

// Не пропускаем явно нерелевантные новости — экономим CPU на парсинге.
// Google News-фиды уже сами фильтруют по запросу, но добавим страховку.
const RELEVANT_KEYWORDS =
  /бпла|беспилотн|дрон|fpv|шахед|герань|loitering|пвo|пво|нпз|нефтебаз|нефтепровод|нефтехранил|газопровод|газокомпрессор|тэц|тэс|грэс|подстанц|лэп|электростанц|нефтеперераб/i;

export async function scrapeRss() {
  const incidents = [];
  const errors = [];

  // Параллельные запросы — быстрее в 5-10 раз, чем последовательные
  // (всё равно у нас разные домены, не DDOS)
  const results = await Promise.allSettled(
    FEEDS.map(async (feed) => {
      const parsed = await parser.parseURL(feed.url);
      let added = 0;
      for (const item of (parsed.items ?? []).slice(0, 60)) {
        const fullText = `${item.title ?? ''} ${item.contentSnippet ?? item.content ?? ''}`;
        if (!RELEVANT_KEYWORDS.test(fullText)) continue;

        const inc = parseToIncident({
          title: item.title ?? '',
          description: item.contentSnippet ?? '',
          publishedAt: item.isoDate ?? item.pubDate ?? new Date().toISOString(),
          url: item.link,
          sourceName: feed.name,
          sourcePrefix: feed.prefix,
        });
        if (inc) {
          incidents.push(inc);
          added += 1;
        }
      }
      return { feed: feed.name, total: parsed.items?.length ?? 0, added };
    }),
  );

  let ok = 0;
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.status === 'fulfilled') {
      ok += 1;
      if (r.value.added > 0) {
        console.log(`[rss] ${r.value.feed}: ${r.value.total} новостей, ${r.value.added} релевантных`);
      }
    } else {
      errors.push(`${FEEDS[i].name}: ${r.reason?.message || r.reason}`);
    }
  }

  console.log(
    `[rss] собрано ${incidents.length} инцидентов из ${ok}/${FEEDS.length} фидов, ошибок: ${errors.length}`,
  );
  if (errors.length) console.log(`[rss] ошибки: ${errors.slice(0, 5).join(' | ')}`);
  return incidents;
}
