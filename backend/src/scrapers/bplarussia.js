// Парсер сайта bplarussia.ru — публичный агрегатор Telegram-публикаций о БПЛА.
// Сайт отдаёт HTML, разделённый по регионам РФ.
// Структура: https://bplarussia.ru/region/<slug>/ → список карточек событий.
//
// Парсим HTML через cheerio. Если структура сайта изменится — нужно
// поправить селекторы. Альтернатива — добавить fallback через RSS если они его сделают.

import * as cheerio from 'cheerio';
import { REGIONS } from '../regions.js';
import { parseToIncident } from '../parser.js';

const BASE = 'https://bplarussia.ru';
const USER_AGENT =
  'Mozilla/5.0 (compatible; IAS-UAV-TEK-Bot/1.0; academic research; +https://github.com/alwing10/ias-uav-tek)';

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`bplarussia ${res.status}`);
  return res.text();
}

/**
 * Парсит страницу одного региона.
 * Возвращает массив сырых событий: { title, publishedAt, url, description }
 */
function parseRegionPage(html, regionUrl) {
  const $ = cheerio.load(html);
  const events = [];

  // У bplarussia.ru карточки событий обычно в <article> или <div class="event/news-item/post">
  // Перебираем несколько потенциальных селекторов
  const selectors = [
    'article',
    '.event',
    '.event-card',
    '.news-item',
    '.post',
    '.item',
    '.card',
    '[itemtype*="NewsArticle"]',
    '.feed-item',
    'main li',
    'main div',
  ];

  for (const sel of selectors) {
    $(sel).each((_i, el) => {
      const $el = $(el);
      // Заголовок: ищем в h1-h4 или ссылке
      const title =
        $el.find('h1, h2, h3, h4').first().text().trim() ||
        $el.find('a').first().attr('title') ||
        $el.find('a').first().text().trim();
      if (!title || title.length < 12 || title.length > 300) return;

      const dateAttr =
        $el.find('time').attr('datetime') ||
        $el.find('[datetime]').attr('datetime') ||
        $el.find('.date, .time, .published').first().text().trim();
      const publishedAt = parseDate(dateAttr);

      const href = $el.find('a').first().attr('href');
      const url = href ? (href.startsWith('http') ? href : new URL(href, regionUrl).toString()) : regionUrl;

      const description =
        $el.find('.description, .summary, .lead, p').first().text().trim().slice(0, 400) || '';

      events.push({ title, publishedAt, url, description });
    });
    if (events.length > 0) break;
  }

  // Универсальный fallback — все ссылки с разумным заголовком
  if (events.length === 0) {
    $('a').each((_i, el) => {
      const title = $(el).text().trim();
      const href = $(el).attr('href');
      if (
        title &&
        title.length > 20 &&
        title.length < 300 &&
        href &&
        // фильтр от навигационных ссылок
        !/^(главная|регионы|контакты|о проекте|войти|подписка)$/i.test(title)
      ) {
        events.push({
          title,
          url: href.startsWith('http') ? href : new URL(href, regionUrl).toString(),
          publishedAt: new Date().toISOString(),
          description: '',
        });
      }
    });
  }

  // Дедупликация по URL внутри одной страницы
  const seen = new Set();
  return events.filter((e) => (seen.has(e.url) ? false : (seen.add(e.url), true)));
}

function parseDate(s) {
  if (!s) return new Date().toISOString();
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString();
  // Русская дата: "29 мая 2026" / "29.05.2026 04:17"
  const m = s.match(/(\d{1,2})[.\s](\d{1,2}|[а-я]+)[.\s](\d{4})/i);
  if (m) {
    const months = { янв: 0, фев: 1, мар: 2, апр: 3, мая: 4, май: 4, июн: 5, июл: 6, авг: 7, сен: 8, окт: 9, ноя: 10, дек: 11 };
    const month = /^\d+$/.test(m[2]) ? parseInt(m[2]) - 1 : months[m[2].toLowerCase().slice(0, 3)] ?? 0;
    return new Date(parseInt(m[3]), month, parseInt(m[1])).toISOString();
  }
  return new Date().toISOString();
}

/**
 * Основная функция: обходит все приграничные регионы РФ и собирает события.
 * Возвращает массив готовых Incident.
 */
export async function scrapeBplarussia() {
  const incidents = [];
  const errors = [];

  // Приоритет — приграничные регионы, по ним больше всего событий.
  // KDA (Краснодар) и CRI (Крым) у них отдают 404 — убрали из списка.
  const targetRegions = REGIONS.filter((r) =>
    ['BEL', 'KRS', 'BRY', 'VOR', 'RST', 'VGG', 'SAR', 'MOW', 'MOS', 'TUL', 'LIP', 'ORE'].includes(r.code),
  );

  for (const region of targetRegions) {
    try {
      const url = `${BASE}/region/${region.slug}/`;
      const html = await fetchHtml(url);

      // Диагностика: если страница пустая или это SPA-каркас без контента,
      // в логах будет видно
      if (html.length < 500) {
        errors.push(`${region.code}: тонкий ответ (${html.length} байт)`);
        continue;
      }

      const rawEvents = parseRegionPage(html, url);
      if (rawEvents.length === 0) {
        // Логируем первые признаки страницы для диагностики
        const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
        console.log(
          `[bplarussia] ${region.code}: 0 событий, title="${titleMatch?.[1] ?? '?'}", html ${html.length}b`,
        );
      }

      for (const ev of rawEvents.slice(0, 15)) {
        // Принудительно задаём регион из URL — он надёжнее текста
        const inc = parseToIncident({
          title: ev.title,
          description: ev.description,
          publishedAt: ev.publishedAt,
          url: ev.url,
          sourceName: 'bplarussia.ru',
          sourcePrefix: 'BPL',
        });
        if (inc) {
          // Override region — мы точно знаем регион по URL
          inc.region = region.name;
          inc.regionCode = region.code;
          incidents.push(inc);
        }
      }
    } catch (e) {
      errors.push(`${region.code}: ${e.message}`);
    }
    // Не DDOS-им — небольшая пауза между регионами
    await new Promise((r) => setTimeout(r, 300));
  }

  console.log(`[bplarussia] собрано ${incidents.length} инцидентов, ошибок: ${errors.length}`);
  if (errors.length) console.log(`[bplarussia] ошибки: ${errors.slice(0, 3).join(' | ')}`);
  return incidents;
}
