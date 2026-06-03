import type { TekObject, ObjectType, ObjectCategory } from '@/types/domain';
import { REGIONS } from './regions';
import { pad, pick, pickWeighted, randFloat, randInt } from './rng';

const OPERATORS = [
  'ПАО «Газпром»',
  'ПАО «Роснефть»',
  'ПАО «Лукойл»',
  'ПАО «Транснефть»',
  'ПАО «Россети»',
  'ПАО «ФСК ЕЭС»',
  'АО «РусГидро»',
  'ПАО «Сургутнефтегаз»',
  'ПАО «Татнефть»',
  'ПАО «Башнефть»',
  'АО «Концерн Росэнергоатом»',
  'ПАО «Газпром нефть»',
];

const NAME_TEMPLATES: Record<ObjectType, (i: number, r: string) => string> = {
  refinery: (i, r) => `НПЗ «${r}-${i}»`,
  oil_depot: (i, r) => `Нефтебаза «${r}-${i}»`,
  oil_pipeline: (i, r) => `Магистральный нефтепровод «${r}-${i}»`,
  gas_pipeline: (i, r) => `Магистральный газопровод «${r}-${i}»`,
  gas_compressor: (i, r) => `Газокомпрессорная станция №${i} (${r})`,
  power_grid: (i) => `ЛЭП-${[110, 220, 330, 500, 750][i % 5]} «Линия-${i}»`,
  substation: (i) => `ПС-${[110, 220, 330, 500][i % 4]} «Узловая-${i}»`,
  power_plant: (i, r) => `Электростанция «${r}-${i}»`,
  other: (i, r) => `Объект ТЭК «${r}-${i}»`,
};

const TYPE_DISTRIBUTION: { value: ObjectType; weight: number }[] = [
  { value: 'refinery', weight: 10 },
  { value: 'oil_depot', weight: 18 },
  { value: 'oil_pipeline', weight: 12 },
  { value: 'gas_pipeline', weight: 12 },
  { value: 'gas_compressor', weight: 8 },
  { value: 'power_grid', weight: 14 },
  { value: 'substation', weight: 14 },
  { value: 'power_plant', weight: 8 },
  { value: 'other', weight: 4 },
];

function categoryFor(type: ObjectType): ObjectCategory {
  if (type === 'refinery' || type === 'power_plant') {
    return pickWeighted<ObjectCategory>([
      { value: 'I', weight: 6 },
      { value: 'II', weight: 3 },
      { value: 'III', weight: 1 },
    ]);
  }
  if (type === 'oil_depot' || type === 'gas_compressor' || type === 'substation') {
    return pickWeighted<ObjectCategory>([
      { value: 'I', weight: 2 },
      { value: 'II', weight: 6 },
      { value: 'III', weight: 2 },
    ]);
  }
  return pickWeighted<ObjectCategory>([
    { value: 'I', weight: 1 },
    { value: 'II', weight: 4 },
    { value: 'III', weight: 5 },
  ]);
}

function generateObjects(): TekObject[] {
  const list: TekObject[] = [];
  const targetTotal = 300;
  // Веса регионов: приграничные — выше плотность объектов
  const regionPool = REGIONS.flatMap((r) => Array(r.isBorderRegion ? 4 : 1).fill(r));

  for (let i = 1; i <= targetTotal; i++) {
    const region = regionPool[randInt(0, regionPool.length - 1)]!;
    const type = pickWeighted(TYPE_DISTRIBUTION);
    const category = categoryFor(type);
    const id = `TEK-${pad(i, 4)}`;
    const name = NAME_TEMPLATES[type](i, region.shortName);

    const lat = region.center.lat + randFloat(-0.6, 0.6);
    const lon = region.center.lon + randFloat(-0.9, 0.9);

    const threatIndex = +(
      (region.isBorderRegion ? randFloat(4, 9.5) : randFloat(0.5, 5.5)) +
      (category === 'I' ? 0.6 : category === 'II' ? 0.2 : 0)
    ).toFixed(1);

    const incidents12m = region.isBorderRegion
      ? randInt(0, 14) + (category === 'I' ? randInt(2, 6) : 0)
      : randInt(0, 3);

    list.push({
      id,
      name,
      type,
      region: region.name,
      regionCode: region.code,
      category,
      operator: pick(OPERATORS),
      coordinates: { lat, lon },
      threatIndex: Math.min(10, threatIndex),
      incidentsCount: incidents12m + randInt(0, 4),
      incidents12m,
    });
  }
  return list;
}

export const OBJECTS: TekObject[] = generateObjects();

export function getObjectById(id: string): TekObject | undefined {
  return OBJECTS.find((o) => o.id === id);
}
