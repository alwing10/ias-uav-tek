// Засев БД базовым набором данных при первом запуске.
// Используется, чтобы клиент сразу видел реальный backend, а не пустоту.

import { db, upsertIncident, insertAudit } from './db.js';

const REGIONS = [
  { code: 'BEL', name: 'Белгородская область', center: { lat: 50.5961, lon: 36.5876 } },
  { code: 'KRS', name: 'Курская область', center: { lat: 51.7373, lon: 36.1873 } },
  { code: 'BRY', name: 'Брянская область', center: { lat: 53.2435, lon: 34.3641 } },
  { code: 'VOR', name: 'Воронежская область', center: { lat: 51.6755, lon: 39.2089 } },
  { code: 'RST', name: 'Ростовская область', center: { lat: 47.2225, lon: 39.7187 } },
  { code: 'KDA', name: 'Краснодарский край', center: { lat: 45.0355, lon: 38.9753 } },
  { code: 'CRI', name: 'Республика Крым', center: { lat: 44.9521, lon: 34.1024 } },
  { code: 'VGG', name: 'Волгоградская область', center: { lat: 48.708, lon: 44.5133 } },
  { code: 'SAR', name: 'Саратовская область', center: { lat: 51.5333, lon: 46.0341 } },
  { code: 'TUL', name: 'Тульская область', center: { lat: 54.1933, lon: 37.6173 } },
  { code: 'LIP', name: 'Липецкая область', center: { lat: 52.6088, lon: 39.5992 } },
  { code: 'TAM', name: 'Тамбовская область', center: { lat: 52.7212, lon: 41.452 } },
];

const OBJECT_TYPES = ['refinery', 'oil_depot', 'oil_pipeline', 'gas_pipeline', 'power_grid', 'substation', 'power_plant'];
const UAV_TYPES = ['fpv', 'plane', 'mini', 'multi', 'loitering', 'unknown'];
const SEVERITIES = ['low', 'medium', 'high', 'critical'];

function rand(min, max) {
  return Math.random() * (max - min) + min;
}
function randInt(min, max) {
  return Math.floor(rand(min, max + 1));
}
function pick(arr) {
  return arr[randInt(0, arr.length - 1)];
}

export function seedIfEmpty(count = 200) {
  const existing = db.prepare('SELECT COUNT(*) AS c FROM incidents').get().c;
  if (existing > 0) {
    console.log(`[seed] БД уже содержит ${existing} инцидентов — пропускаю seed`);
    return;
  }
  console.log(`[seed] Засеваю БД ${count} инцидентами…`);

  const startMs = new Date('2026-01-01').getTime();
  const endMs = new Date('2026-05-29').getTime();

  for (let i = 0; i < count; i++) {
    const region = pick(REGIONS);
    const type = pick(OBJECT_TYPES);
    const sev = pick(SEVERITIES);
    const uav = pick(UAV_TYPES);
    const dtMs = startMs + Math.pow(Math.random(), 1.4) * (endMs - startMs);
    const damage =
      sev === 'critical' ? randInt(8, 10) : sev === 'high' ? randInt(5, 8) : sev === 'medium' ? randInt(2, 5) : randInt(0, 2);

    const objNames = {
      refinery: `НПЗ «${region.code}-${i + 1}»`,
      oil_depot: `Нефтебаза «${region.code}-${i + 1}»`,
      oil_pipeline: `Магистральный нефтепровод «${region.code}-${i + 1}»`,
      gas_pipeline: `Магистральный газопровод «${region.code}-${i + 1}»`,
      power_grid: `ЛЭП-${pick([110, 220, 330, 500])} «Линия-${i + 1}»`,
      substation: `ПС-${pick([110, 220, 330, 500])} «Узловая-${i + 1}»`,
      power_plant: `Электростанция «${region.code}-${i + 1}»`,
    };

    const category = type === 'refinery' || type === 'power_plant' ? 'I' : type === 'oil_depot' ? 'II' : 'III';
    const status = damage >= 7 ? 'destroyed' : damage >= 3 ? 'damaged' : 'repelled';

    upsertIncident({
      id: `DB-${String(i + 1).padStart(4, '0')}`,
      datetime: new Date(dtMs).toISOString(),
      region: region.name,
      regionCode: region.code,
      objectId: `TEK-${randInt(1, 300)}`,
      objectName: objNames[type],
      objectType: type,
      objectCategory: category,
      uavType: uav,
      severity: sev,
      status,
      damage,
      casualties: sev === 'critical' && Math.random() > 0.7 ? randInt(1, 3) : 0,
      description: `Зафиксирована попытка применения БПЛА (${uav}) в отношении объекта ${objNames[type]}.`,
      coordinates: {
        lat: region.center.lat + rand(-0.4, 0.4),
        lon: region.center.lon + rand(-0.6, 0.6),
      },
      scenario: 'Прямая атака (поражение цели)',
      verified: Math.random() > 0.4 ? 'verified' : Math.random() > 0.5 ? 'pending' : 'new',
      verifiedBy: Math.random() > 0.5 ? pick(['А. Петрова', 'И. Иванов', 'С. Кузнецов']) : null,
      verifiedAt: Math.random() > 0.5 ? new Date(dtMs + 3600_000).toISOString() : null,
      classificationConfidence: 0.7 + Math.random() * 0.28,
      registeredAt: new Date(dtMs + 60_000).toISOString(),
      fire: sev === 'critical' && Math.random() > 0.3,
      destruction: damage >= 6,
      operationDisrupted: sev !== 'low' && Math.random() > 0.5,
      sources: [
        {
          name: pick(['РИА Новости', 'ТАСС', 'ASTRA', 'Mash', 'Baza']),
          type: 'media',
          confidence: 0.75 + Math.random() * 0.2,
          text: `Зафиксирована попытка атаки БПЛА в ${region.name.toLowerCase()}.`,
        },
      ],
    });
  }

  insertAudit({
    user: 'system',
    role: 'admin',
    action: 'Засев БД',
    object: `${count} incidents`,
  });

  console.log('[seed] Готово');
}
