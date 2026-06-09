/**
 * Клиент к Express+SQLite backend.
 *
 * URL берётся из переменной окружения VITE_API_URL.
 * Если переменная пустая или undefined — клиент возвращает пустые ответы
 * и status='disabled' (UI продолжает работать с моками + GDELT/RSS).
 *
 * При деплое на GitHub Pages:
 *   - Локально: создайте `.env` с VITE_API_URL=http://localhost:4000
 *   - В CI: добавьте Variable `VITE_API_URL` в Settings → Secrets → Actions
 */

import type { Incident, AuditEvent } from '@/types/domain';

const API_URL: string | undefined = import.meta.env.VITE_API_URL?.replace(/\/+$/, '');

export const BACKEND_ENABLED = !!API_URL;

export interface BackendHealth {
  status: string;
  service: string;
  time: string;
  version: string;
}

// Render Free усыпляет сервис через 15 мин неактивности. Холодный старт
// иногда занимает 50–60 секунд. Поэтому таймаут на отдельный запрос — 75 сек.
const DEFAULT_TIMEOUT_MS = 75_000;

async function req<T>(path: string, init?: RequestInit & { timeoutMs?: number }): Promise<T> {
  if (!API_URL) throw new Error('Backend disabled (VITE_API_URL not set)');
  const { timeoutMs, ...rest } = init ?? {};
  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    signal: AbortSignal.timeout(timeoutMs ?? DEFAULT_TIMEOUT_MS),
    headers: {
      'content-type': 'application/json',
      ...(rest.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text().catch(() => '')}`);
  return res.json() as Promise<T>;
}

/**
 * Пробуждение Render Free. Сначала шлём /health с длинным таймаутом —
 * это «будит» спящий сервис. Дальше остальные запросы быстрые.
 *
 * Делаем ДВА retry: если первый health-check упал по таймауту в 75с —
 * Render всё ещё просыпается, ждём ещё.
 */
export async function getHealth(): Promise<BackendHealth> {
  let lastErr: Error | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await req<BackendHealth>('/health', { timeoutMs: 75_000 });
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
    }
  }
  throw lastErr ?? new Error('Backend health-check failed');
}

export interface ListIncidentsQuery {
  from?: string;
  to?: string;
  region?: string;
  severity?: string;
  verified?: string;
  limit?: number;
  offset?: number;
}

export async function fetchIncidents(q: ListIncidentsQuery = {}): Promise<Incident[]> {
  const params = new URLSearchParams();
  Object.entries(q).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
  });
  const data = await req<{ count: number; items: Incident[] }>(
    `/api/incidents${params.toString() ? '?' + params.toString() : ''}`,
  );
  return data.items;
}

export async function fetchIncidentById(id: string): Promise<Incident | null> {
  try {
    return await req<Incident>(`/api/incidents/${encodeURIComponent(id)}`);
  } catch {
    return null;
  }
}

export async function upsertIncident(incident: Incident): Promise<Incident> {
  return req<Incident>('/api/incidents', {
    method: 'POST',
    body: JSON.stringify(incident),
  });
}

export async function verifyIncident(
  id: string,
  status: 'verified' | 'rejected' | 'pending' | 'new',
  verifiedBy?: string,
): Promise<Incident> {
  return req<Incident>(`/api/incidents/${encodeURIComponent(id)}/verify`, {
    method: 'POST',
    body: JSON.stringify({ status, verifiedBy }),
  });
}

export interface KpiStats {
  total: number;
  critical: number;
  unverified: number;
  regions: number;
}

export async function fetchKpi(): Promise<KpiStats> {
  return req<KpiStats>('/api/stats/kpi');
}

export async function fetchAudit(): Promise<AuditEvent[]> {
  const data = await req<{ items: AuditEvent[] }>('/api/audit');
  return data.items;
}

export async function postAudit(ev: Partial<AuditEvent> & { action: string }): Promise<{ id: string }> {
  return req<{ id: string }>('/api/audit', { method: 'POST', body: JSON.stringify(ev) });
}

// ===== ПОДПИСКИ =====

export interface Subscription {
  id: number;
  email: string;
  regions: string[];
  severities: string[];
  active: boolean;
  createdAt: string;
  lastSentAt: string | null;
}

export async function fetchSubscriptions(): Promise<Subscription[]> {
  const data = await req<{ items: Subscription[] }>('/api/subscriptions');
  return data.items;
}

export async function getSubscription(email: string): Promise<Subscription | null> {
  try {
    return await req<Subscription>(`/api/subscriptions/${encodeURIComponent(email)}`);
  } catch {
    return null;
  }
}

export async function upsertSubscription(
  email: string,
  regions: string[],
  severities: string[],
): Promise<Subscription> {
  return req<Subscription>('/api/subscriptions', {
    method: 'POST',
    body: JSON.stringify({ email, regions, severities }),
  });
}

export async function deleteSubscription(email: string): Promise<void> {
  await req<void>(`/api/subscriptions/${encodeURIComponent(email)}`, { method: 'DELETE' });
}

export async function sendTestEmail(email: string): Promise<{ status: string; preview?: string | null; messageId?: string }> {
  return req<{ status: string; preview?: string | null; messageId?: string }>(
    `/api/subscriptions/${encodeURIComponent(email)}/test`,
    { method: 'POST' },
  );
}

// ===== СКРЕЙПЕРЫ =====

export interface ScrapeStatus {
  lastRun: string | null;
  lastStats: {
    bpl: number;
    rss: number;
    gdelt: number;
    tg: number;
    new: number;
    merged: number;
    skipped: number;
    errors: number;
  };
}

export async function fetchScrapeStatus(): Promise<ScrapeStatus> {
  return req<ScrapeStatus>('/api/scrape/status');
}

export async function triggerScrape(): Promise<{ status: string }> {
  return req<{ status: string }>('/api/scrape/run', { method: 'POST' });
}

/** Удалить старые демо-инциденты (ID начинающиеся с DB-) из БД */
export async function deleteDemoIncidents(): Promise<{ deleted: number }> {
  return req<{ deleted: number }>('/api/incidents/demo', { method: 'DELETE' });
}

// ===== HOTSPOTS (горячие объекты ТЭК) — уникальная фича =====

export interface Hotspot {
  regionCode: string;
  region: string;
  objectType: string;
  score: number;
  trend: 'up' | 'down' | 'flat';
  incidents30: number;
  incidents90: number;
  incidentsPrev30: number;
  lastIncidentAt: string | null;
  severityMix: string;
  successRate: string;
}

export async function fetchHotspots(limit = 10): Promise<Hotspot[]> {
  const data = await req<{ items: Hotspot[] }>(`/api/stats/hotspots?limit=${limit}`);
  return data.items;
}
