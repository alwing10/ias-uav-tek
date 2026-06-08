// Координатор всех скрейперов.
// Запускается по cron-расписанию (см. index.js).

import { scrapeBplarussia } from './bplarussia.js';
import { scrapeRss } from './rss.js';
import { scrapeGdelt } from './gdelt.js';
import {
  upsertIncident,
  db,
  getKnownIncidentIds,
  findSemanticDuplicate,
  mergeSourcesIntoIncident,
} from '../db.js';
import { notifyNewIncident } from '../notify.js';

let lastRun = null;
let lastStats = { bpl: 0, rss: 0, gdelt: 0, new: 0, merged: 0, skipped: 0, errors: 0 };

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
  let mergedCount = 0;
  let skippedCount = 0;
  let errors = 0;

  // Кэш известных ID — для мгновенного skip уже собранных URL
  const known = getKnownIncidentIds();

  async function processBatch(label, getList) {
    try {
      const list = await getList();
      for (const inc of list) {
        // 1) Точный дубль по ID (sha1 от URL) — пропускаем, не парсим
        if (known.has(inc.id)) {
          skippedCount += 1;
          continue;
        }

        // 2) Семантический дубль (другое СМИ про то же событие) — мерж источников
        const dup = findSemanticDuplicate(inc);
        if (dup) {
          const newSource = inc.sources?.[0];
          if (newSource) mergeSourcesIntoIncident(dup.id, newSource);
          mergedCount += 1;
          continue;
        }

        // 3) Новый инцидент — сохраняем и уведомляем подписчиков
        upsertIncident(inc);
        newCount += 1;
        await notifyNewIncident(inc).catch((e) => console.error('[notify]', e.message));
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
  lastStats = {
    bpl: bplCount,
    rss: rssCount,
    gdelt: gdeltCount,
    new: newCount,
    merged: mergedCount,
    skipped: skippedCount,
    errors,
  };
  const total = db.prepare('SELECT COUNT(*) AS c FROM incidents').get().c;
  console.log(
    `[scrape] === цикл за ${Math.round((Date.now() - t0) / 1000)}с | bpl=${bplCount} rss=${rssCount} gdelt=${gdeltCount} | НОВЫХ=${newCount} мерж=${mergedCount} skip=${skippedCount} ошибок=${errors} | в БД=${total} ===`,
  );
}
