// Координатор всех скрейперов.
// Запускается по cron-расписанию (см. index.js).

import { scrapeBplarussia } from './bplarussia.js';
import { scrapeRss } from './rss.js';
import { scrapeGdelt } from './gdelt.js';
import { upsertIncident, getIncident, db } from '../db.js';
import { notifyNewIncident } from '../notify.js';

let lastRun = null;
let lastStats = { bpl: 0, rss: 0, gdelt: 0, new: 0, errors: 0 };

export function getScrapeStatus() {
  return { lastRun, lastStats };
}

export async function runAllScrapers() {
  const t0 = Date.now();
  console.log('[scrape] === старт цикла сбора ===');

  let bplCount = 0;
  let rssCount = 0;
  let gdeltCount = 0;
  let newCount = 0;
  let errors = 0;

  async function processBatch(label, getList) {
    try {
      const list = await getList();
      for (const inc of list) {
        const existed = !!getIncident(inc.id);
        upsertIncident(inc);
        if (!existed) {
          newCount += 1;
          await notifyNewIncident(inc).catch((e) => console.error('[notify]', e.message));
        }
      }
      return list.length;
    } catch (e) {
      errors += 1;
      console.error(`[${label}] критическая ошибка:`, e.message);
      return 0;
    }
  }

  // Параллельно запускаем 3 источника
  const [bpl, rss, gdelt] = await Promise.all([
    processBatch('bplarussia', scrapeBplarussia),
    processBatch('rss', scrapeRss),
    processBatch('gdelt', scrapeGdelt),
  ]);
  bplCount = bpl;
  rssCount = rss;
  gdeltCount = gdelt;

  lastRun = new Date().toISOString();
  lastStats = { bpl: bplCount, rss: rssCount, gdelt: gdeltCount, new: newCount, errors };
  const total = db.prepare('SELECT COUNT(*) AS c FROM incidents').get().c;
  console.log(
    `[scrape] === цикл завершён за ${Math.round((Date.now() - t0) / 1000)}с | bpl=${bplCount} rss=${rssCount} gdelt=${gdeltCount} новых=${newCount} ошибок=${errors} | всего в БД=${total} ===`,
  );
}
