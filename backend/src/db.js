// Слой работы с SQLite. Файл БД создаётся в data/ias.db и переживает рестарты,
// но на Render.com Free БД сбрасывается при редеплое (нет persistent disk).
// Для прод-сценария добавьте Render Disk или подключите PostgreSQL.

import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.resolve(__dirname, '..', 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_PATH = path.join(DATA_DIR, 'ias.db');

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// --- Миграции ---
db.exec(`
CREATE TABLE IF NOT EXISTS incidents (
  id              TEXT PRIMARY KEY,
  datetime        TEXT NOT NULL,
  region          TEXT NOT NULL,
  region_code     TEXT NOT NULL,
  object_id       TEXT NOT NULL,
  object_name     TEXT NOT NULL,
  object_type     TEXT NOT NULL,
  object_category TEXT NOT NULL,
  uav_type        TEXT NOT NULL,
  severity        TEXT NOT NULL,
  status          TEXT NOT NULL,
  damage          INTEGER NOT NULL,
  casualties      INTEGER NOT NULL DEFAULT 0,
  description     TEXT,
  lat             REAL NOT NULL,
  lon             REAL NOT NULL,
  scenario        TEXT,
  verified        TEXT NOT NULL DEFAULT 'new',
  verified_by     TEXT,
  verified_at     TEXT,
  classification_confidence REAL,
  registered_at   TEXT NOT NULL,
  fire            INTEGER NOT NULL DEFAULT 0,
  destruction     INTEGER NOT NULL DEFAULT 0,
  operation_disrupted INTEGER NOT NULL DEFAULT 0,
  sources_json    TEXT
);

CREATE INDEX IF NOT EXISTS ix_incidents_datetime ON incidents(datetime);
CREATE INDEX IF NOT EXISTS ix_incidents_region ON incidents(region_code);
CREATE INDEX IF NOT EXISTS ix_incidents_severity ON incidents(severity);

CREATE TABLE IF NOT EXISTS audit_events (
  id        TEXT PRIMARY KEY,
  datetime  TEXT NOT NULL,
  user      TEXT NOT NULL,
  role      TEXT NOT NULL,
  action    TEXT NOT NULL,
  object    TEXT,
  ip        TEXT
);

CREATE INDEX IF NOT EXISTS ix_audit_datetime ON audit_events(datetime);

CREATE TABLE IF NOT EXISTS verification_updates (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  incident_id TEXT NOT NULL,
  status      TEXT NOT NULL,
  verified_by TEXT,
  verified_at TEXT NOT NULL,
  FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  email           TEXT NOT NULL,
  regions_json    TEXT NOT NULL DEFAULT '[]',
  severities_json TEXT NOT NULL DEFAULT '["critical","high"]',
  active          INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL,
  last_sent_at    TEXT,
  UNIQUE(email)
);

CREATE INDEX IF NOT EXISTS ix_subs_email ON subscriptions(email);

CREATE TABLE IF NOT EXISTS notification_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  incident_id TEXT NOT NULL,
  email       TEXT NOT NULL,
  sent_at     TEXT NOT NULL,
  status      TEXT NOT NULL,
  message_id  TEXT,
  error       TEXT,
  UNIQUE(incident_id, email)
);
`);

// --- ORM-обёртки ---

export function rowToIncident(row) {
  return {
    id: row.id,
    datetime: row.datetime,
    region: row.region,
    regionCode: row.region_code,
    objectId: row.object_id,
    objectName: row.object_name,
    objectType: row.object_type,
    objectCategory: row.object_category,
    uavType: row.uav_type,
    severity: row.severity,
    status: row.status,
    damage: row.damage,
    casualties: row.casualties,
    description: row.description ?? '',
    coordinates: { lat: row.lat, lon: row.lon },
    scenario: row.scenario ?? '',
    verified: row.verified,
    verifiedBy: row.verified_by ?? undefined,
    verifiedAt: row.verified_at ?? undefined,
    classificationConfidence: row.classification_confidence ?? 1,
    registeredAt: row.registered_at,
    fire: !!row.fire,
    destruction: !!row.destruction,
    operationDisrupted: !!row.operation_disrupted,
    sources: row.sources_json ? JSON.parse(row.sources_json) : [],
  };
}

export function listIncidents({ from, to, region, severity, verified, limit = 500, offset = 0 } = {}) {
  const where = [];
  const params = {};
  if (from) {
    where.push('datetime >= @from');
    params.from = from;
  }
  if (to) {
    where.push('datetime <= @to');
    params.to = to;
  }
  if (region) {
    where.push('region_code = @region');
    params.region = region;
  }
  if (severity) {
    where.push('severity = @severity');
    params.severity = severity;
  }
  if (verified) {
    where.push('verified = @verified');
    params.verified = verified;
  }
  const sql = `
    SELECT * FROM incidents
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY datetime DESC
    LIMIT @limit OFFSET @offset
  `;
  const rows = db.prepare(sql).all({ ...params, limit, offset });
  return rows.map(rowToIncident);
}

export function getIncident(id) {
  const row = db.prepare('SELECT * FROM incidents WHERE id = ?').get(id);
  return row ? rowToIncident(row) : null;
}

const INSERT_INCIDENT = db.prepare(`
  INSERT INTO incidents (
    id, datetime, region, region_code, object_id, object_name, object_type,
    object_category, uav_type, severity, status, damage, casualties, description,
    lat, lon, scenario, verified, verified_by, verified_at,
    classification_confidence, registered_at, fire, destruction, operation_disrupted, sources_json
  ) VALUES (
    @id, @datetime, @region, @regionCode, @objectId, @objectName, @objectType,
    @objectCategory, @uavType, @severity, @status, @damage, @casualties, @description,
    @lat, @lon, @scenario, @verified, @verifiedBy, @verifiedAt,
    @classificationConfidence, @registeredAt, @fire, @destruction, @operationDisrupted, @sourcesJson
  )
  ON CONFLICT(id) DO UPDATE SET
    description = excluded.description,
    severity = excluded.severity,
    verified = excluded.verified,
    verified_by = excluded.verified_by,
    verified_at = excluded.verified_at,
    sources_json = excluded.sources_json
`);

export function upsertIncident(i) {
  INSERT_INCIDENT.run({
    id: i.id,
    datetime: i.datetime,
    region: i.region,
    regionCode: i.regionCode,
    objectId: i.objectId,
    objectName: i.objectName,
    objectType: i.objectType,
    objectCategory: i.objectCategory,
    uavType: i.uavType,
    severity: i.severity,
    status: i.status,
    damage: i.damage,
    casualties: i.casualties ?? 0,
    description: i.description ?? '',
    lat: i.coordinates.lat,
    lon: i.coordinates.lon,
    scenario: i.scenario ?? '',
    verified: i.verified ?? 'new',
    verifiedBy: i.verifiedBy ?? null,
    verifiedAt: i.verifiedAt ?? null,
    classificationConfidence: i.classificationConfidence ?? 1,
    registeredAt: i.registeredAt ?? new Date().toISOString(),
    fire: i.fire ? 1 : 0,
    destruction: i.destruction ? 1 : 0,
    operationDisrupted: i.operationDisrupted ? 1 : 0,
    sourcesJson: JSON.stringify(i.sources ?? []),
  });
  return getIncident(i.id);
}

export function setVerification(id, status, verifiedBy) {
  const verifiedAt = status === 'verified' ? new Date().toISOString() : null;
  db.prepare(
    'UPDATE incidents SET verified = ?, verified_by = ?, verified_at = ? WHERE id = ?',
  ).run(status, verifiedBy ?? null, verifiedAt, id);
  db.prepare(
    'INSERT INTO verification_updates (incident_id, status, verified_by, verified_at) VALUES (?, ?, ?, ?)',
  ).run(id, status, verifiedBy ?? null, verifiedAt ?? new Date().toISOString());
  return getIncident(id);
}

export function statsKpi() {
  const total = db.prepare('SELECT COUNT(*) AS c FROM incidents').get().c;
  const crit = db.prepare("SELECT COUNT(*) AS c FROM incidents WHERE severity='critical'").get().c;
  const unverified = db
    .prepare("SELECT COUNT(*) AS c FROM incidents WHERE verified IN ('new', 'pending')")
    .get().c;
  const regions = db.prepare('SELECT COUNT(DISTINCT region_code) AS c FROM incidents').get().c;
  return { total, critical: crit, unverified, regions };
}

export function listAudit({ from, to, user, action, limit = 200 } = {}) {
  const where = [];
  const params = {};
  if (from) {
    where.push('datetime >= @from');
    params.from = from;
  }
  if (to) {
    where.push('datetime <= @to');
    params.to = to;
  }
  if (user) {
    where.push('user = @user');
    params.user = user;
  }
  if (action) {
    where.push('action = @action');
    params.action = action;
  }
  const sql = `
    SELECT * FROM audit_events
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY datetime DESC
    LIMIT @limit
  `;
  return db.prepare(sql).all({ ...params, limit });
}

// ---------- ПОДПИСКИ ----------

export function listSubscriptions() {
  return db.prepare('SELECT * FROM subscriptions ORDER BY created_at DESC').all().map(rowToSubscription);
}

export function getSubscription(email) {
  const row = db.prepare('SELECT * FROM subscriptions WHERE email = ?').get(email);
  return row ? rowToSubscription(row) : null;
}

export function upsertSubscription({ email, regions = [], severities = ['critical', 'high'] }) {
  db.prepare(
    `INSERT INTO subscriptions (email, regions_json, severities_json, active, created_at)
     VALUES (?, ?, ?, 1, ?)
     ON CONFLICT(email) DO UPDATE SET
       regions_json = excluded.regions_json,
       severities_json = excluded.severities_json,
       active = 1`,
  ).run(email.toLowerCase(), JSON.stringify(regions), JSON.stringify(severities), new Date().toISOString());
  return getSubscription(email.toLowerCase());
}

export function deleteSubscription(email) {
  db.prepare('DELETE FROM subscriptions WHERE email = ?').run(email.toLowerCase());
}

export function getActiveSubscriptionsFor(incident) {
  // Подписки, у которых регион инцидента ИЛИ regions пустой (= все регионы),
  // И тяжесть инцидента входит в severities ИЛИ severities пустой
  const rows = db.prepare('SELECT * FROM subscriptions WHERE active = 1').all();
  return rows.map(rowToSubscription).filter((s) => {
    const regionOk = s.regions.length === 0 || s.regions.includes(incident.regionCode);
    const sevOk = s.severities.length === 0 || s.severities.includes(incident.severity);
    return regionOk && sevOk;
  });
}

function rowToSubscription(row) {
  return {
    id: row.id,
    email: row.email,
    regions: JSON.parse(row.regions_json || '[]'),
    severities: JSON.parse(row.severities_json || '[]'),
    active: !!row.active,
    createdAt: row.created_at,
    lastSentAt: row.last_sent_at,
  };
}

export function logNotification(incidentId, email, status, messageId, error) {
  try {
    db.prepare(
      'INSERT INTO notification_log (incident_id, email, sent_at, status, message_id, error) VALUES (?, ?, ?, ?, ?, ?)',
    ).run(incidentId, email, new Date().toISOString(), status, messageId ?? null, error ?? null);
    if (status === 'sent') {
      db.prepare('UPDATE subscriptions SET last_sent_at = ? WHERE email = ?').run(
        new Date().toISOString(),
        email,
      );
    }
  } catch {
    /* дубль уведомления — это OK, не ошибка */
  }
}

export function wasNotified(incidentId, email) {
  const row = db
    .prepare("SELECT id FROM notification_log WHERE incident_id = ? AND email = ? AND status = 'sent'")
    .get(incidentId, email);
  return !!row;
}

export function insertAudit(ev) {
  const id = ev.id ?? `LOG-${Date.now()}-${Math.floor(Math.random() * 9999)}`;
  db.prepare(
    'INSERT INTO audit_events (id, datetime, user, role, action, object, ip) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ).run(
    id,
    ev.datetime ?? new Date().toISOString(),
    ev.user ?? 'system',
    ev.role ?? 'analyst',
    ev.action,
    ev.object ?? null,
    ev.ip ?? null,
  );
  return id;
}
