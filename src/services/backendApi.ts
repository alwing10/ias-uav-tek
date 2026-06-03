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

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  if (!API_URL) throw new Error('Backend disabled (VITE_API_URL not set)');
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    signal: AbortSignal.timeout(20_000),
    headers: {
      'content-type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text().catch(() => '')}`);
  return res.json() as Promise<T>;
}

export async function getHealth(): Promise<BackendHealth> {
  return req<BackendHealth>('/health');
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
