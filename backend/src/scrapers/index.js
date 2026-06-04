// Координатор всех скрейперов.
// Запускается по cron-расписанию (см. index.js).

import { scrapeBplarussia } from './bplarussia.js';
import { scrapeRss } from './rss.js';
import { upsertIncident, getIncident, db } from '../db.js';
import { notifyNewIncident } from '../notify.js';

let lastRun = null;
let lastStats = { bpl: 0, rss: 0, new: 0, errors: 0 };

export function getScrapeStatus() {
  return { lastRun, lastStats };
}

export async function runAllScrapers() {
  const t0 = Date.now();
  console.log('[scrape] === старт цикла сбора ===');

  let bplCount = 0;
  let rssCount = 0;
  let newCount = 0;
  let errors = 0;

  // 1. bplarussia.ru
  try {
    const bplIncidents = await scrapeBplarussia();
    bplCount = bplIncidents.length;
    for (const inc of bplIncidents) {
      const existed = !!getIncident(inc.id);
      upsertIncident(inc);
      if (!existed) {
        newCount += 1;
        await notifyNewIncident(inc).catch((e) => console.error('[notify]', e.message));
      }
    }
  } catch (e) {
    errors += 1;
    console.error('[bplarussia] критическая ошибка:', e.message);
  }

  // 2. RSS
  try {
    const rssIncidents = await scrapeRss();
    rssCount = rssIncidents.length;
    for (const inc of rssIncidents) {
      const existed = !!getIncident(inc.id);
      upsertIncident(inc);
      if (!existed) {
        newCount += 1;
        await notifyNewIncident(inc).catch((e) => console.error('[notify]', e.message));
      }
    }
  } catch (e) {
    errors += 1;
    console.error('[rss] критическая ошибка:', e.message);
  }

  lastRun = new Date().toISOString();
  lastStats = { bpl: bplCount, rss: rssCount, new: newCount, errors };
  const total = db.prepare('SELECT COUNT(*) AS c FROM incidents').get().c;
  console.log(
    `[scrape] === цикл завершён за ${Math.round((Date.now() - t0) / 1000)}с | bpl=${bplCount} rss=${rssCount} новых=${newCount} ошибок=${errors} | всего в БД=${total} ===`,
  );
}
