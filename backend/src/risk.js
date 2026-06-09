/**
 * Алгоритм расчёта индекса риска для объекта/региона.
 *
 * Это УНИКАЛЬНАЯ фича модуля — ни bplarussia.ru, ни ACLED, ни GDELT
 * не считают индивидуальный риск-скор для конкретного критически
 * важного объекта.
 *
 * Формула учитывает:
 *   1. Плотность инцидентов в регионе за период (30 / 90 / 180 дней)
 *   2. Среднюю тяжесть этих инцидентов
 *   3. Тип объекта ТЭК (НПЗ и электростанции — выше базовый риск)
 *   4. Дату последнего инцидента (свежие весят больше)
 *   5. % успешных атак vs отражённых
 *
 * Результат: число 0–10 с понятной для человека градацией.
 */

import { db } from './db.js';

// Базовый вес типа объекта (с учётом критичности для ТЭК)
const TYPE_BASE_WEIGHT = {
  refinery: 9.0,
  power_plant: 8.5,
  oil_depot: 7.0,
  gas_compressor: 6.5,
  substation: 5.5,
  oil_pipeline: 5.0,
  gas_pipeline: 5.0,
  power_grid: 4.0,
  other: 3.0,
};

// Множители тяжести
const SEVERITY_WEIGHT = {
  low: 0.3,
  medium: 0.6,
  high: 1.0,
  critical: 1.5,
};

/**
 * Считает риск-скор по региону + типу объекта.
 *
 * Возвращает:
 *   { score (0..10), trend ('up'|'down'|'flat'), incidents30, incidents90, lastIncidentAt }
 */
export function computeRegionTypeRisk(regionCode, objectType) {
  const now = Date.now();
  const day = 24 * 3600_000;
  const isoAgo = (days) => new Date(now - days * day).toISOString();

  // Запрашиваем инциденты по региону+типу за разные окна
  const stmt = db.prepare(
    `SELECT id, datetime, severity, status, damage
     FROM incidents
     WHERE region_code = ? AND object_type = ? AND datetime >= ?
     ORDER BY datetime DESC`,
  );

  const rows30 = stmt.all(regionCode, objectType, isoAgo(30));
  const rows90 = stmt.all(regionCode, objectType, isoAgo(90));
  const rowsPrev30 = db
    .prepare(
      `SELECT COUNT(*) AS c FROM incidents
       WHERE region_code = ? AND object_type = ?
         AND datetime >= ? AND datetime < ?`,
    )
    .get(regionCode, objectType, isoAgo(60), isoAgo(30)).c;

  const base = TYPE_BASE_WEIGHT[objectType] ?? 3;

  // Множитель плотности (логарифмически от числа инцидентов за 30 дней)
  const density = Math.log2(1 + rows30.length) / 4; // 0 → 0; 1 → 0.25; 7 → 0.75; 15 → 1

  // Средняя тяжесть свежих инцидентов
  const avgSev =
    rows30.length === 0
      ? 0
      : rows30.reduce((s, r) => s + (SEVERITY_WEIGHT[r.severity] ?? 0.5), 0) / rows30.length;

  // % успешных атак (damage >= 5)
  const succRate =
    rows30.length === 0 ? 0 : rows30.filter((r) => r.damage >= 5).length / rows30.length;

  // Финальный скор
  let score = base * (0.4 + density * 0.3 + avgSev * 0.2 + succRate * 0.1);

  // Бонус за свежесть последнего инцидента
  if (rows30.length > 0) {
    const lastAt = new Date(rows30[0].datetime).getTime();
    const daysAgo = (now - lastAt) / day;
    if (daysAgo < 3) score += 0.5;
  }

  score = Math.min(10, Math.max(0, +score.toFixed(1)));

  const trend =
    rows30.length > rowsPrev30 * 1.2
      ? 'up'
      : rows30.length < rowsPrev30 * 0.8
        ? 'down'
        : 'flat';

  return {
    score,
    trend,
    incidents30: rows30.length,
    incidents90: rows90.length,
    incidentsPrev30: rowsPrev30,
    lastIncidentAt: rows30[0]?.datetime ?? null,
    severityMix: avgSev.toFixed(2),
    successRate: succRate.toFixed(2),
  };
}

/**
 * Топ-N «горячих точек» — комбинаций регион+тип с максимальным риском.
 * Используется на дашборде в блоке «Горячие объекты ТЭК».
 */
export function topHotspots(limit = 10) {
  // Все уникальные пары (регион, тип) из БД за последние 90 дней
  const day = 24 * 3600_000;
  const since = new Date(Date.now() - 90 * day).toISOString();
  const pairs = db
    .prepare(
      `SELECT region_code, region, object_type, COUNT(*) AS c
       FROM incidents
       WHERE datetime >= ?
       GROUP BY region_code, object_type
       HAVING c >= 1
       ORDER BY c DESC
       LIMIT 100`,
    )
    .all(since);

  const hotspots = pairs.map((p) => {
    const risk = computeRegionTypeRisk(p.region_code, p.object_type);
    return {
      regionCode: p.region_code,
      region: p.region,
      objectType: p.object_type,
      ...risk,
    };
  });

  return hotspots.sort((a, b) => b.score - a.score).slice(0, limit);
}
