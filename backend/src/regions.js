// Справочник субъектов РФ — копия минимума с фронта, для серверного парсинга.
// Используется при определении региона по тексту новости.

export const REGIONS = [
  { code: 'BEL', name: 'Белгородская область', slug: 'belgorodskaya-oblast', center: { lat: 50.5961, lon: 36.5876 }, root: 'белгор' },
  { code: 'KRS', name: 'Курская область', slug: 'kurskaya-oblast', center: { lat: 51.7373, lon: 36.1873 }, root: 'курск' },
  { code: 'BRY', name: 'Брянская область', slug: 'bryanskaya-oblast', center: { lat: 53.2435, lon: 34.3641 }, root: 'брянск' },
  { code: 'VOR', name: 'Воронежская область', slug: 'voronezhskaya-oblast', center: { lat: 51.6755, lon: 39.2089 }, root: 'воронеж' },
  { code: 'RST', name: 'Ростовская область', slug: 'rostovskaya-oblast', center: { lat: 47.2225, lon: 39.7187 }, root: 'ростов' },
  { code: 'KDA', name: 'Краснодарский край', slug: 'krasnodarskij-kraj', center: { lat: 45.0355, lon: 38.9753 }, root: 'краснодар' },
  { code: 'CRI', name: 'Республика Крым', slug: 'respublika-krym', center: { lat: 44.9521, lon: 34.1024 }, root: 'крым' },
  { code: 'SEV', name: 'г. Севастополь', slug: 'sevastopol', center: { lat: 44.6166, lon: 33.5254 }, root: 'севастопол' },
  { code: 'STA', name: 'Ставропольский край', slug: 'stavropolskij-kraj', center: { lat: 45.0428, lon: 41.9734 }, root: 'ставропол' },
  { code: 'VGG', name: 'Волгоградская область', slug: 'volgogradskaya-oblast', center: { lat: 48.708, lon: 44.5133 }, root: 'волгоград' },
  { code: 'AST', name: 'Астраханская область', slug: 'astrahanskaya-oblast', center: { lat: 46.3479, lon: 48.0336 }, root: 'астрахан' },
  { code: 'SAR', name: 'Саратовская область', slug: 'saratovskaya-oblast', center: { lat: 51.5333, lon: 46.0341 }, root: 'саратов' },
  { code: 'MOW', name: 'г. Москва', slug: 'moskva', center: { lat: 55.7558, lon: 37.6173 }, root: 'москв' },
  { code: 'MOS', name: 'Московская область', slug: 'moskovskaya-oblast', center: { lat: 55.5043, lon: 38.0 }, root: 'московск' },
  { code: 'TUL', name: 'Тульская область', slug: 'tulskaya-oblast', center: { lat: 54.1933, lon: 37.6173 }, root: 'тульск' },
  { code: 'LIP', name: 'Липецкая область', slug: 'lipeckaya-oblast', center: { lat: 52.6088, lon: 39.5992 }, root: 'липецк' },
  { code: 'TAM', name: 'Тамбовская область', slug: 'tambovskaya-oblast', center: { lat: 52.7212, lon: 41.452 }, root: 'тамбов' },
  { code: 'ORL', name: 'Орловская область', slug: 'orlovskaya-oblast', center: { lat: 52.967, lon: 36.0697 }, root: 'орловск' },
  { code: 'KLG', name: 'Калужская область', slug: 'kaluzhskaya-oblast', center: { lat: 54.5293, lon: 36.2754 }, root: 'калуж' },
  { code: 'SMO', name: 'Смоленская область', slug: 'smolenskaya-oblast', center: { lat: 54.7826, lon: 32.0453 }, root: 'смолен' },
  { code: 'RYA', name: 'Рязанская область', slug: 'ryazanskaya-oblast', center: { lat: 54.6269, lon: 39.6916 }, root: 'рязан' },
  { code: 'SAM', name: 'Самарская область', slug: 'samarskaya-oblast', center: { lat: 53.1959, lon: 50.1002 }, root: 'самарск' },
  { code: 'TAT', name: 'Республика Татарстан', slug: 'respublika-tatarstan', center: { lat: 55.7963, lon: 49.108 }, root: 'татарстан' },
  { code: 'BAS', name: 'Республика Башкортостан', slug: 'respublika-bashkortostan', center: { lat: 54.7388, lon: 55.972 }, root: 'башкор' },
  { code: 'NIZ', name: 'Нижегородская область', slug: 'nizhegorodskaya-oblast', center: { lat: 56.2965, lon: 43.9361 }, root: 'нижегород' },
  { code: 'PEN', name: 'Пензенская область', slug: 'penzenskaya-oblast', center: { lat: 53.2007, lon: 45.0046 }, root: 'пензен' },
  { code: 'ULY', name: 'Ульяновская область', slug: 'ulyanovskaya-oblast', center: { lat: 54.3142, lon: 48.4031 }, root: 'ульяновск' },
  { code: 'ORE', name: 'Оренбургская область', slug: 'orenburgskaya-oblast', center: { lat: 51.7682, lon: 55.0974 }, root: 'оренбург' },
];

export function detectRegion(text) {
  const t = text.toLowerCase();
  for (const r of REGIONS) {
    if (t.includes(r.root)) return r;
  }
  return null;
}
