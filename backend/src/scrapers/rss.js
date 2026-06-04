// Парсер RSS-фидов официальных и крупных СМИ.
// Отличие от фронта (rss2json.com) — здесь у нас нет CORS-проблемы,
// поэтому ходим в RSS напрямую через библиотеку rss-parser.

import Parser from 'rss-parser';
import { parseToIncident } from '../parser.js';

const FEEDS = [
  { name: 'РИА Новости', url: 'https://ria.ru/export/rss2/index.xml', prefix: 'RIA' },
  { name: 'ТАСС', url: 'https://tass.ru/rss/v2.xml', prefix: 'TASS' },
  { name: 'Lenta.ru', url: 'https://lenta.ru/rss/news', prefix: 'LENTA' },
  { name: 'РБК', url: 'https://rssexport.rbc.ru/rbcnews/news/30/full.rss', prefix: 'RBC' },
  { name: 'Минобороны РФ', url: 'https://function.mil.ru/rss_feed/news.htm', prefix: 'MIL' },
  { name: 'МЧС России', url: 'https://www.mchs.gov.ru/rss/news.xml', prefix: 'MCHS' },
];

const parser = new Parser({
  timeout: 15_000,
  headers: { 'User-Agent': 'IAS-UAV-TEK-Bot/1.0 (academic research)' },
});

// Не пропускаем явно нерелевантные новости — экономим CPU на парсинге
const RELEVANT_KEYWORDS = /бпла|беспилотн|дрон|fpv|шахед|герань|loitering|пвo|нпз|нефтебаз|нефтепровод|газопровод|тэц|тэс|подстанц|лэп/i;

export async function scrapeRss() {
  const incidents = [];
  const errors = [];

  for (const feed of FEEDS) {
    try {
      const parsed = await parser.parseURL(feed.url);
      for (const item of (parsed.items ?? []).slice(0, 50)) {
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
        if (inc) incidents.push(inc);
      }
    } catch (e) {
      errors.push(`${feed.name}: ${e.message}`);
    }
  }

  console.log(`[rss] собрано ${incidents.length} инцидентов из ${FEEDS.length} фидов, ошибок: ${errors.length}`);
  if (errors.length) console.log(`[rss] ошибки: ${errors.slice(0, 3).join(' | ')}`);
  return incidents;
}
