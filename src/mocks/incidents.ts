import type {
  Incident,
  Severity,
  UavType,
  SourceRef,
  IncidentStatus,
  VerificationStatus,
} from '@/types/domain';
import { SCENARIOS } from '@/types/domain';
import { OBJECTS } from './objects';
import { REGIONS, getRegionByCode } from './regions';
import { pad, pick, pickWeighted, randFloat, randInt, rand } from './rng';

const TOTAL = 1500;

const UAV_DIST: { value: UavType; weight: number }[] = [
  { value: 'fpv', weight: 48 },
  { value: 'plane', weight: 25 },
  { value: 'mini', weight: 7 },
  { value: 'multi', weight: 6 },
  { value: 'loitering', weight: 5 },
  { value: 'unknown', weight: 9 },
];

const SEVERITY_DIST: { value: Severity; weight: number }[] = [
  { value: 'low', weight: 38 },
  { value: 'medium', weight: 42 },
  { value: 'high', weight: 16 },
  { value: 'critical', weight: 4 },
];

const SOURCES_POOL = [
  { name: 'РИА Новости', type: 'media' as const, base: 0.92 },
  { name: 'ТАСС', type: 'media' as const, base: 0.94 },
  { name: 'Интерфакс', type: 'media' as const, base: 0.91 },
  { name: 'Коммерсантъ', type: 'media' as const, base: 0.88 },
  { name: 'ASTRA', type: 'media' as const, base: 0.86 },
  { name: 'Mash', type: 'telegram' as const, base: 0.78 },
  { name: 'Baza', type: 'telegram' as const, base: 0.74 },
  { name: 'SHOT', type: 'telegram' as const, base: 0.72 },
  { name: '@kuban_news', type: 'telegram' as const, base: 0.6 },
  { name: '@operativno', type: 'telegram' as const, base: 0.55 },
  { name: 'Lenta.ru RSS', type: 'rss' as const, base: 0.82 },
  { name: 'Gazeta.ru RSS', type: 'rss' as const, base: 0.8 },
  { name: 'OSINT API', type: 'api' as const, base: 0.84 },
];

function generateDescription(uav: UavType, objType: string, region: string): string {
  const t =
    uav === 'fpv'
      ? 'FPV-беспилотник'
      : uav === 'plane'
        ? 'БПЛА самолётного типа'
        : uav === 'mini'
          ? 'мини-БПЛА'
          : uav === 'loitering'
            ? 'барражирующий боеприпас'
            : uav === 'multi'
              ? 'мультикоптер'
              : 'беспилотный летательный аппарат';
  return `${region}. Зафиксирована попытка применения ${t} в отношении объекта (${objType}). Сработала система обнаружения, развёрнуты средства противодействия.`;
}

function generateSourceText(name: string, region: string, uav: UavType): string {
  return `[${name}] В ${region.toLowerCase()} в ночное время суток зафиксирована попытка атаки с применением ${
    uav === 'fpv' ? 'FPV-дронов' : uav === 'plane' ? 'БПЛА самолётного типа' : 'беспилотника'
  } на объект топливно-энергетического комплекса. Подробности уточняются.`;
}

function generateSources(severity: Severity): SourceRef[] {
  const count =
    severity === 'critical'
      ? randInt(3, 5)
      : severity === 'high'
        ? randInt(2, 4)
        : severity === 'medium'
          ? randInt(1, 3)
          : randInt(1, 2);
  const shuffled = [...SOURCES_POOL].sort(() => rand() - 0.5).slice(0, count);
  return shuffled.map((s) => ({
    name: s.name,
    type: s.type,
    confidence: Math.min(0.99, +(s.base + randFloat(-0.08, 0.06)).toFixed(2)),
    text: generateSourceText(s.name, '', 'fpv'),
    hasPhoto: rand() > 0.65,
    hasVideo: rand() > 0.85,
  }));
}

function statusForSeverity(s: Severity): IncidentStatus {
  if (s === 'critical') return pickWeighted<IncidentStatus>([
    { value: 'destroyed', weight: 7 },
    { value: 'damaged', weight: 2 },
    { value: 'repelled', weight: 1 },
  ]);
  if (s === 'high') return pickWeighted<IncidentStatus>([
    { value: 'destroyed', weight: 3 },
    { value: 'damaged', weight: 5 },
    { value: 'repelled', weight: 2 },
  ]);
  if (s === 'medium') return pickWeighted<IncidentStatus>([
    { value: 'damaged', weight: 4 },
    { value: 'repelled', weight: 6 },
  ]);
  return pickWeighted<IncidentStatus>([
    { value: 'repelled', weight: 9 },
    { value: 'damaged', weight: 1 },
  ]);
}

function damageForSeverity(s: Severity): number {
  if (s === 'critical') return randInt(8, 10);
  if (s === 'high') return randInt(5, 8);
  if (s === 'medium') return randInt(2, 5);
  return randInt(0, 2);
}

function genDateInRange(): Date {
  // С 01.01.2026 по 29.05.2026
  const start = new Date('2026-01-01T00:00:00Z').getTime();
  const end = new Date('2026-05-29T23:59:59Z').getTime();
  // Распределение с пиком в апреле
  const r = rand();
  const bias = Math.pow(r, 1.4);
  const t = start + bias * (end - start);
  return new Date(t);
}

function generateIncidents(): Incident[] {
  const items: Incident[] = [];
  const objectsBorder = OBJECTS.filter((o) => getRegionByCode(o.regionCode)?.isBorderRegion);
  const objectsAll = OBJECTS;

  for (let i = 1; i <= TOTAL; i++) {
    // 88% инцидентов — на объектах в приграничных регионах
    const pool = rand() < 0.88 ? objectsBorder : objectsAll;
    const obj = pool[randInt(0, pool.length - 1)]!;
    const region = REGIONS.find((r) => r.code === obj.regionCode)!;
    const id = `INC-${pad(1000 + i, 4)}`;
    const uav = pickWeighted(UAV_DIST);
    const severity = pickWeighted(SEVERITY_DIST);
    const status = statusForSeverity(severity);
    const dt = genDateInRange();
    const damage = damageForSeverity(severity);
    const sources = generateSources(severity);
    const verifProb = sources[0]!.confidence;
    const verified: VerificationStatus =
      verifProb > 0.85 ? 'verified' : verifProb > 0.7 ? (rand() > 0.4 ? 'verified' : 'pending') : rand() > 0.5 ? 'pending' : 'new';

    items.push({
      id,
      datetime: dt.toISOString(),
      region: region.name,
      regionCode: region.code,
      objectId: obj.id,
      objectName: obj.name,
      objectType: obj.type,
      objectCategory: obj.category,
      uavType: uav,
      severity,
      status,
      damage,
      casualties: severity === 'critical' && rand() > 0.6 ? randInt(1, 4) : 0,
      description: generateDescription(uav, obj.type, region.name),
      coordinates: {
        lat: obj.coordinates.lat + randFloat(-0.05, 0.05),
        lon: obj.coordinates.lon + randFloat(-0.07, 0.07),
      },
      sources,
      verified,
      verifiedBy: verified === 'verified' ? pick(['А. Петрова', 'И. Иванов', 'С. Кузнецов', 'М. Сидорова']) : undefined,
      verifiedAt:
        verified === 'verified'
          ? new Date(dt.getTime() + randInt(20, 240) * 60_000).toISOString()
          : undefined,
      classificationConfidence: +(verifProb - randFloat(0, 0.12)).toFixed(2),
      scenario: pick(SCENARIOS),
      reactionTimeSec: status === 'repelled' ? randInt(15, 180) : undefined,
      hitDistanceM: status !== 'destroyed' ? randInt(50, 1200) : undefined,
      neutralization: status === 'repelled' ? pick(['РЭБ', 'ПВО', 'Стрелковое оружие']) : undefined,
      registeredAt: new Date(dt.getTime() + randInt(5, 90) * 60_000).toISOString(),
      fire: severity === 'critical' && rand() > 0.3,
      destruction: damage >= 6,
      operationDisrupted: severity !== 'low' && rand() > 0.6,
    });
  }
  // По убыванию даты
  items.sort((a, b) => (a.datetime < b.datetime ? 1 : -1));
  return items;
}

export const INCIDENTS: Incident[] = generateIncidents();

export function getIncidentById(id: string): Incident | undefined {
  return INCIDENTS.find((i) => i.id === id);
}
