// Точка входа Express-сервера.
// Запуск: npm start  (или node src/index.js)
// Порт:   PORT env (по умолчанию 4000)
// CORS:   CORS_ORIGIN env (по умолчанию '*' — разрешает фронт с любого домена)

import express from 'express';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import {
  listIncidents,
  getIncident,
  upsertIncident,
  setVerification,
  statsKpi,
  listAudit,
  insertAudit,
} from './db.js';
import { seedIfEmpty } from './seed.js';

const app = express();
const PORT = Number(process.env.PORT) || 4000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

app.use(cors({ origin: CORS_ORIGIN }));
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(morgan('tiny'));

// Health-check для Render и фронта
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'ias-uav-tek-backend',
    time: new Date().toISOString(),
    version: '1.0.0',
  });
});

// ===== INCIDENTS =====

app.get('/api/incidents', (req, res) => {
  const { from, to, region, severity, verified, limit, offset } = req.query;
  const list = listIncidents({
    from,
    to,
    region,
    severity,
    verified,
    limit: limit ? Math.min(2000, Number(limit)) : 500,
    offset: offset ? Number(offset) : 0,
  });
  res.json({ count: list.length, items: list });
});

app.get('/api/incidents/:id', (req, res) => {
  const inc = getIncident(req.params.id);
  if (!inc) return res.status(404).json({ error: 'not found' });
  res.json(inc);
});

app.post('/api/incidents', (req, res) => {
  try {
    const body = req.body;
    if (!body || !body.id) {
      return res.status(400).json({ error: 'id required' });
    }
    const saved = upsertIncident(body);
    insertAudit({
      user: req.headers['x-user'] ?? 'system',
      role: req.headers['x-role'] ?? 'analyst',
      action: 'Создан/обновлён инцидент',
      object: body.id,
      ip: req.ip,
    });
    res.status(201).json(saved);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/incidents/:id/verify', (req, res) => {
  const { status, verifiedBy } = req.body;
  if (!['verified', 'rejected', 'pending', 'new'].includes(status)) {
    return res.status(400).json({ error: 'invalid status' });
  }
  const saved = setVerification(req.params.id, status, verifiedBy);
  if (!saved) return res.status(404).json({ error: 'not found' });
  insertAudit({
    user: req.headers['x-user'] ?? verifiedBy ?? 'unknown',
    role: req.headers['x-role'] ?? 'expert',
    action: `Верификация → ${status}`,
    object: req.params.id,
    ip: req.ip,
  });
  res.json(saved);
});

// ===== STATS / KPI =====

app.get('/api/stats/kpi', (_req, res) => {
  res.json(statsKpi());
});

// ===== AUDIT =====

app.get('/api/audit', (req, res) => {
  const { from, to, user, action, limit } = req.query;
  res.json({
    items: listAudit({
      from,
      to,
      user,
      action,
      limit: limit ? Math.min(1000, Number(limit)) : 200,
    }),
  });
});

app.post('/api/audit', (req, res) => {
  const id = insertAudit({
    user: req.body?.user ?? req.headers['x-user'] ?? 'system',
    role: req.body?.role ?? req.headers['x-role'] ?? 'analyst',
    action: req.body?.action ?? 'unknown',
    object: req.body?.object,
    ip: req.ip,
  });
  res.status(201).json({ id });
});

// ===== Запуск =====

seedIfEmpty(200);

app.listen(PORT, () => {
  console.log(`[ias-backend] http://0.0.0.0:${PORT}`);
  console.log(`[ias-backend] health: /health`);
  console.log(`[ias-backend] CORS_ORIGIN = ${CORS_ORIGIN}`);
});
