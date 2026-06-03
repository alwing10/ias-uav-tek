// Доменные типы ИАС мониторинга инцидентов с применением БПЛА в отношении объектов ТЭК

export type Role = 'analyst' | 'expert' | 'admin';

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  avatarInitials: string;
}

export type Severity = 'low' | 'medium' | 'high' | 'critical';
export type IncidentStatus = 'repelled' | 'damaged' | 'destroyed';
export type VerificationStatus = 'new' | 'pending' | 'verified' | 'rejected';

export type UavType =
  | 'fpv'
  | 'plane'
  | 'mini'
  | 'multi'
  | 'loitering'
  | 'unknown';

export type ObjectType =
  | 'refinery'
  | 'oil_depot'
  | 'oil_pipeline'
  | 'gas_pipeline'
  | 'gas_compressor'
  | 'power_grid'
  | 'substation'
  | 'power_plant'
  | 'other';

export type ObjectCategory = 'I' | 'II' | 'III';

export interface SourceRef {
  name: string;
  type: 'media' | 'telegram' | 'rss' | 'api';
  confidence: number; // 0..1
  text: string;
  url?: string;
  hasPhoto?: boolean;
  hasVideo?: boolean;
}

export interface Incident {
  id: string; // INC-NNNN
  datetime: string; // ISO
  region: string; // субъект РФ
  regionCode: string;
  objectId: string;
  objectName: string;
  objectType: ObjectType;
  objectCategory: ObjectCategory;
  uavType: UavType;
  severity: Severity;
  status: IncidentStatus;
  damage: number; // 0..10
  casualties: number;
  description: string;
  coordinates: { lat: number; lon: number };
  sources: SourceRef[];
  verified: VerificationStatus;
  verifiedBy?: string;
  verifiedAt?: string;
  classificationConfidence: number; // 0..1
  scenario: string;
  reactionTimeSec?: number;
  hitDistanceM?: number;
  neutralization?: string;
  registeredAt: string;
  fire: boolean;
  destruction: boolean;
  operationDisrupted: boolean;
}

export interface TekObject {
  id: string; // TEK-NNNN
  name: string;
  type: ObjectType;
  region: string;
  regionCode: string;
  category: ObjectCategory;
  operator: string;
  coordinates: { lat: number; lon: number };
  threatIndex: number; // 0..10
  incidentsCount: number;
  incidents12m: number;
}

export interface DataSource {
  id: string;
  name: string;
  address: string;
  type: 'media' | 'telegram' | 'rss' | 'api';
  schedule: string;
  lastRun: string;
  recordsCount: number;
  accuracy: number; // 0..1
  status: 'active' | 'paused' | 'error';
}

export interface RegionInfo {
  code: string;
  name: string;
  shortName: string;
  center: { lat: number; lon: number };
  isBorderRegion: boolean;
}

export interface AuditEvent {
  id: string;
  datetime: string;
  user: string;
  role: Role;
  action: string;
  object: string;
  ip: string;
}

export interface DictionaryEntry {
  id: string;
  name: string;
  description?: string;
  meta?: Record<string, string>;
}

// Сценарии применения
export const SCENARIOS = [
  'Прямая атака (поражение цели)',
  'Разведка и наблюдение',
  'Сброс боеприпаса',
  'Барражирование над объектом',
  'Несанкционированный пролёт',
];

// Лейблы
export const SEVERITY_LABEL: Record<Severity, string> = {
  low: 'Низкая',
  medium: 'Средняя',
  high: 'Высокая',
  critical: 'Критическая',
};

export const SEVERITY_COLOR: Record<Severity, string> = {
  low: '#388E3C',
  medium: '#FBC02D',
  high: '#F57C00',
  critical: '#D32F2F',
};

export const STATUS_LABEL: Record<IncidentStatus, string> = {
  repelled: 'Отражён',
  damaged: 'Повреждён',
  destroyed: 'Поражён',
};

export const UAV_LABEL: Record<UavType, string> = {
  fpv: 'FPV (квадрокоптер)',
  plane: 'Самолётного типа',
  mini: 'Мини-класс',
  multi: 'Мульти',
  loitering: 'Барражирующий',
  unknown: 'Не установлено',
};

export const OBJECT_TYPE_LABEL: Record<ObjectType, string> = {
  refinery: 'НПЗ',
  oil_depot: 'Нефтебаза',
  oil_pipeline: 'Нефтепровод',
  gas_pipeline: 'Газопровод',
  gas_compressor: 'Газокомпрессорная',
  power_grid: 'ЛЭП',
  substation: 'Подстанция',
  power_plant: 'Электростанция',
  other: 'Прочее',
};

export const OBJECT_TYPE_GROUP: Record<ObjectType, string> = {
  refinery: 'Нефтепереработка',
  oil_depot: 'Нефтепереработка',
  oil_pipeline: 'Нефтепроводы',
  gas_pipeline: 'Газовая инфр.',
  gas_compressor: 'Газовая инфр.',
  power_grid: 'Электросети',
  substation: 'Электросети',
  power_plant: 'Электросети',
  other: 'Прочее',
};

export const VERIFICATION_LABEL: Record<VerificationStatus, string> = {
  new: 'Новый',
  pending: 'На верификации',
  verified: 'Верифицирован',
  rejected: 'Отклонён',
};

export const ROLE_LABEL: Record<Role, string> = {
  analyst: 'Аналитик',
  expert: 'Эксперт',
  admin: 'Администратор',
};
