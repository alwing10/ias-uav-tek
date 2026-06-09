// Точка входа Express-сервера.
// Запуск: npm start  (или node src/index.js)
// Порт:   PORT env (по умолчанию 4000)
// CORS:   CORS_ORIGIN env (по умолчанию '*' — разрешает фронт с любого домена)

import express from 'express';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import cron from 'node-cron';
import {
  listIncidents,
  getIncident,
  upsertIncident,
  setVerification,
  statsKpi,
  listAudit,
  insertAudit,
  listSubscriptions,
  upsertSubscription,
  deleteSubscription,
  getSubscription,
  deleteDemoIncidents,
} from './db.js';
import { seedIfEmpty } from './seed.js';
import { runAllScrapers, getScrapeStatus } from './scrapers/index.js';
import { sendTestEmail } from './notify.js';
import { topHotspots, computeRegionTypeRisk } from './risk.js';

const app = express();
const PORT = Number(process.env.PORT) || 4000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

app.use(cors({ origin: CORS_ORIGIN }));
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(morgan('tiny'));

// Health-check для Render и фронта
app.get('/health', (_req, res) => {
  const scrape = getScrapeStatus();
  res.json({
    status: 'ok',
    service: 'ias-uav-tek-backend',
    time: new Date().toISOString(),
    version: '2.0.0',
    scrape,
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
    if (!body || !body.id) return res.status(400).json({ error: 'id required' });
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

// ===== STATS =====

app.get('/api/stats/kpi', (_req, res) => res.json(statsKpi()));

/**
 * Топ горячих объектов ТЭК — список пар (регион × тип) с максимальным
 * риск-скором за последние 90 дней. Используется на дашборде.
 * Это УНИКАЛЬНАЯ фича модуля (нет в bplarussia, ACLED, GDELT).
 */
app.get('/api/stats/hotspots', (req, res) => {
  const limit = req.query.limit ? Math.min(50, Number(req.query.limit)) : 10;
  res.json({ items: topHotspots(limit) });
});

app.get('/api/stats/risk/:region/:objectType', (req, res) => {
  res.json(computeRegionTypeRisk(req.params.region, req.params.objectType));
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

// ===== УДАЛЕНИЕ ДЕМО-ДАННЫХ =====

app.delete('/api/incidents/demo', (_req, res) => {
  const result = deleteDemoIncidents();
  insertAudit({
    user: 'admin',
    role: 'admin',
    action: 'Удалены демо-инциденты (DB-*)',
    object: `deleted=${result.deleted}`,
  });
  res.json(result);
});

// ===== СБОР (СКРЕЙПИНГ) =====

app.post('/api/scrape/run', async (_req, res) => {
  // Ручной запуск всех скрейперов
  res.json({ status: 'started' });
  runAllScrapers().catch((e) => console.error('[scrape]', e));
});

app.get('/api/scrape/status', (_req, res) => {
  res.json(getScrapeStatus());
});

// ===== ПОДПИСКИ =====

app.get('/api/subscriptions', (_req, res) => {
  res.json({ items: listSubscriptions() });
});

app.get('/api/subscriptions/:email', (req, res) => {
  const sub = getSubscription(req.params.email);
  if (!sub) return res.status(404).json({ error: 'not found' });
  res.json(sub);
});

app.post('/api/subscriptions', (req, res) => {
  const { email, regions = [], severities = ['critical', 'high'] } = req.body ?? {};
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'invalid email' });
  }
  const saved = upsertSubscription({ email, regions, severities });
  insertAudit({
    user: email,
    role: 'analyst',
    action: 'Создана/обновлена подписка на уведомления',
    object: `regions=${regions.join(',') || 'все'} sev=${severities.join(',')}`,
    ip: req.ip,
  });
  res.status(201).json(saved);
});

app.delete('/api/subscriptions/:email', (req, res) => {
  deleteSubscription(req.params.email);
  insertAudit({
    user: req.params.email,
    role: 'analyst',
    action: 'Удалена подписка на уведомления',
    object: req.params.email,
    ip: req.ip,
  });
  res.status(204).end();
});

app.post('/api/subscriptions/:email/test', async (req, res) => {
  try {
    const result = await sendTestEmail(req.params.email);
    res.json({ status: 'sent', ...result });
  } catch (e) {
    res.status(500).json({ status: 'error', error: e.message });
  }
});

// ===== Запуск =====

// Демо-сид ВЫКЛЮЧЕН по умолчанию. Включается переменной SEED_DEMO=1 в env Render.
// Прототип работает только с РЕАЛЬНЫМИ данными из скрейперов.
if (process.env.SEED_DEMO === '1') {
  console.log('[seed] SEED_DEMO=1 → засеваю демо-инцидентами для презентации UI');
  seedIfEmpty(200);
} else {
  console.log('[seed] пропущен (используются только реальные данные из скрейперов)');
}

// Запускаем первый сбор сразу — реальные данные нужны как можно быстрее
setTimeout(() => {
  runAllScrapers().catch((e) => console.error('[scrape initial]', e));
}, 5_000);

// Cron: запускать сбор каждые 5 минут
cron.schedule('*/5 * * * *', () => {
  runAllScrapers().catch((e) => console.error('[scrape cron]', e));
});

app.listen(PORT, () => {
  console.log(`[ias-backend] http://0.0.0.0:${PORT}`);
  console.log(`[ias-backend] health: /health`);
  console.log(`[ias-backend] CORS_ORIGIN = ${CORS_ORIGIN}`);
  console.log(`[ias-backend] Scrape cron: */5 * * * * (каждые 5 минут)`);
});
