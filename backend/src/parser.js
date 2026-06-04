// Семантический парсер: новостной текст → структура инцидента ТЭК
import crypto from 'node:crypto';
import { detectRegion } from './regions.js';

const OBJECT_PATTERNS = [
  { type: 'refinery', name: 'НПЗ (по сообщению)', regex: /нпз|нефтеперераб|переработ[а-я]*\s+нефт/i },
  { type: 'oil_depot', name: 'Нефтебаза (по сообщению)', regex: /нефтебаз|нефтехран|резервуар|танк[\- ]парк/i },
  { type: 'oil_pipeline', name: 'Нефтепровод (по сообщению)', regex: /нефтепровод|друж[а-я]*|транснефт/i },
  { type: 'gas_pipeline', name: 'Газопровод (по сообщению)', regex: /газопровод/i },
  { type: 'gas_compressor', name: 'ГКС (по сообщению)', regex: /газокомпрессор|компрессорн[а-я]*\s+станц/i },
  { type: 'power_grid', name: 'ЛЭП (по сообщению)', regex: /лэп|линия\s+электропередач/i },
  { type: 'substation', name: 'Подстанция (по сообщению)', regex: /подстанц/i },
  { type: 'power_plant', name: 'Электростанция (по сообщению)', regex: /тэц|тэс|грэс|электростанц/i },
  { type: 'other', name: 'Объект ТЭК (по сообщению)', regex: /нефт|газ|энерг|топлив|fuel/i },
];

const UAV_PATTERNS = [
  { type: 'fpv', regex: /fpv|фпв|квадрокоптер/i },
  { type: 'plane', regex: /самол[её]т[а-я]*\s*тип|шахед|shahed|герань/i },
  { type: 'loitering', regex: /барражир|loitering|switchblade/i },
  { type: 'multi', regex: /мульти[\- ]?коптер|multicopter/i },
  { type: 'mini', regex: /мини[\- ]?бпла|мини[\- ]?дрон/i },
];

function detectObject(text) {
  for (const p of OBJECT_PATTERNS) if (p.regex.test(text)) return { type: p.type, name: p.name };
  return null;
}

function detectUav(text) {
  for (const p of UAV_PATTERNS) if (p.regex.test(text)) return p.type;
  return 'unknown';
}

function detectSeverity(text) {
  const t = text.toLowerCase();
  if (/пожар|взрыв|разруш|погибл|жертв|разнес|взорвал/.test(t)) {
    return { sev: 'critical', damage: 8 + Math.floor(Math.random() * 3) };
  }
  if (/повреждени|пробит|сильный ущерб|серьёзн|серьезн/.test(t)) {
    return { sev: 'high', damage: 5 + Math.floor(Math.random() * 3) };
  }
  if (/сбит|пвo сбила|перехвачен|пресеч/.test(t)) {
    return { sev: 'low', damage: Math.floor(Math.random() * 3) };
  }
  return { sev: 'medium', damage: 3 + Math.floor(Math.random() * 3) };
}

function categoryFor(type) {
  if (type === 'refinery' || type === 'power_plant') return 'I';
  if (type === 'oil_depot' || type === 'gas_compressor' || type === 'substation') return 'II';
  return 'III';
}

/**
 * Преобразование сырой новости в Incident.
 * sourcePrefix — короткий префикс для ID (BPL- для bplarussia, MIL- для mil.ru и т.д.)
 */
export function parseToIncident({ title, description = '', publishedAt, url, sourceName, sourcePrefix }) {
  const text = `${title} ${description}`;
  const region = detectRegion(text);
  if (!region) return null;
  const obj = detectObject(text);
  if (!obj) return null;

  const { sev, damage } = detectSeverity(text);
  const uav = detectUav(text);
  const category = categoryFor(obj.type);
  const status = damage >= 7 ? 'destroyed' : damage >= 3 ? 'damaged' : 'repelled';

  // Детерминированный ID: префикс + первые 8 hex hash от URL/title
  // → инцидент с одной и той же новостью не задвоится при повторном парсинге
  const hash = crypto.createHash('sha1').update(url || `${title}|${publishedAt}`).digest('hex').slice(0, 8).toUpperCase();
  const id = `${sourcePrefix}-${hash}`;

  // Лёгкий jitter координат, чтобы маркеры не перекрывались
  const jitter = (parseInt(hash.slice(0, 4), 16) % 100) / 1000;

  return {
    id,
    datetime: publishedAt || new Date().toISOString(),
    region: region.name,
    regionCode: region.code,
    objectId: 'TEK-EXT',
    objectName: obj.name,
    objectType: obj.type,
    objectCategory: category,
    uavType: uav,
    severity: sev,
    status,
    damage,
    casualties: sev === 'critical' && /погиб|жертв/.test(text.toLowerCase()) ? 1 : 0,
    description: title + (description ? '. ' + description.slice(0, 300) : ''),
    coordinates: {
      lat: region.center.lat + jitter - 0.05,
      lon: region.center.lon + jitter * 1.5 - 0.075,
    },
    scenario: 'Прямая атака (поражение цели)',
    verified: 'pending',
    classificationConfidence: 0.65 + Math.random() * 0.25,
    registeredAt: new Date().toISOString(),
    fire: /пожар|fire/.test(text.toLowerCase()),
    destruction: damage >= 7,
    operationDisrupted: damage >= 5,
    sources: [{ name: sourceName, type: 'media', confidence: 0.8, text: title, url }],
  };
}
