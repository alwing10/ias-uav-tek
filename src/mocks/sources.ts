import type { DataSource } from '@/types/domain';
import { pad, pick, randFloat, randInt } from './rng';

const TEMPLATE: Array<Omit<DataSource, 'id' | 'lastRun' | 'recordsCount' | 'accuracy' | 'status'>> = [
  { name: 'РИА Новости', address: 'ria.ru', type: 'media', schedule: 'каждые 5 мин' },
  { name: 'ТАСС', address: 'tass.ru', type: 'media', schedule: 'каждые 5 мин' },
  { name: 'Интерфакс', address: 'interfax.ru', type: 'media', schedule: 'каждые 5 мин' },
  { name: 'Коммерсантъ', address: 'kommersant.ru', type: 'media', schedule: 'каждые 10 мин' },
  { name: 'ASTRA', address: 'astrapress.media', type: 'media', schedule: 'каждые 5 мин' },
  { name: 'Lenta.ru', address: 'lenta.ru/rss', type: 'rss', schedule: 'каждые 3 мин' },
  { name: 'Gazeta.ru', address: 'gazeta.ru/export/rss', type: 'rss', schedule: 'каждые 3 мин' },
  { name: 'РБК', address: 'rbc.ru/rss', type: 'rss', schedule: 'каждые 5 мин' },
  { name: 'Mash', address: 't.me/mash', type: 'telegram', schedule: 'непрерывно' },
  { name: 'Baza', address: 't.me/bazabazon', type: 'telegram', schedule: 'непрерывно' },
  { name: 'SHOT', address: 't.me/shot_shot', type: 'telegram', schedule: 'непрерывно' },
  { name: 'Кубань 24', address: 't.me/kuban_news', type: 'telegram', schedule: 'непрерывно' },
  { name: 'Белгород №1', address: 't.me/belgorod_news', type: 'telegram', schedule: 'непрерывно' },
  { name: 'Воронеж сегодня', address: 't.me/voronezh_today', type: 'telegram', schedule: 'непрерывно' },
  { name: 'Ростов на Дону', address: 't.me/rostov_news', type: 'telegram', schedule: 'непрерывно' },
  { name: 'Брянский вестник', address: 't.me/bryansk_v', type: 'telegram', schedule: 'непрерывно' },
  { name: 'Курск №1', address: 't.me/kursk1', type: 'telegram', schedule: 'непрерывно' },
  { name: 'OSINT API', address: 'api.osint-aggregator.ru', type: 'api', schedule: 'каждые 2 мин' },
  { name: 'Реестр Минэнерго', address: 'api.minenergo.gov.ru', type: 'api', schedule: 'раз в сутки' },
  { name: 'СКР', address: 'sledcom.ru/rss', type: 'rss', schedule: 'каждые 10 мин' },
  { name: 'МЧС', address: 'mchs.gov.ru/rss', type: 'rss', schedule: 'каждые 5 мин' },
  { name: 'Минобороны РФ', address: 'mil.ru/rss', type: 'rss', schedule: 'каждые 10 мин' },
  { name: 'Readovka', address: 't.me/readovkanews', type: 'telegram', schedule: 'непрерывно' },
  { name: 'РИА Крым', address: 'crimea.ria.ru', type: 'media', schedule: 'каждые 10 мин' },
  { name: 'Кубанские новости', address: 'kuban24.tv/rss', type: 'rss', schedule: 'каждые 10 мин' },
  { name: 'Donbass24', address: 't.me/donbass24', type: 'telegram', schedule: 'непрерывно' },
  { name: 'Газета.ру: Происшествия', address: 'gazeta.ru/social/rss', type: 'rss', schedule: 'каждые 5 мин' },
  { name: 'OpenSky Network', address: 'opensky-network.org/api', type: 'api', schedule: 'каждые 2 мин' },
  { name: 'Региональные SMI Юг', address: 'api.south-aggregator.ru', type: 'api', schedule: 'каждые 5 мин' },
  { name: 'OSM объекты', address: 'overpass-api.de', type: 'api', schedule: 'раз в час' },
];

function generateSources(): DataSource[] {
  return TEMPLATE.map((t, i) => {
    const lastRunMin = randInt(0, 90);
    const accuracy = +randFloat(0.62, 0.97).toFixed(2);
    const status = lastRunMin > 60 ? 'error' : accuracy < 0.7 ? 'paused' : 'active';
    return {
      id: `SRC-${pad(i + 1, 3)}`,
      lastRun: new Date(Date.now() - lastRunMin * 60_000).toISOString(),
      recordsCount: randInt(50, 4200),
      accuracy,
      status,
      ...t,
    };
  });
}

export const SOURCES: DataSource[] = generateSources();
