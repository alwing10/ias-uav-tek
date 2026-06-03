/**
 * Стор для backend-подключения.
 * Делает health-check + загружает инциденты из backend.
 * Если VITE_API_URL не задан или backend упал — статус 'disabled' / 'error',
 * UI продолжает работать без backend.
 */

import { create } from 'zustand';
import type { Incident } from '@/types/domain';
import {
  BACKEND_ENABLED,
  fetchIncidents,
  fetchKpi,
  getHealth,
  type KpiStats,
} from '@/services/backendApi';

type BackendStatus = 'disabled' | 'idle' | 'connecting' | 'ok' | 'error';

interface BackendState {
  enabled: boolean;
  status: BackendStatus;
  apiUrl: string | undefined;
  incidents: Incident[];
  kpi: KpiStats | null;
  lastSync: string | null;
  errorMessage: string | null;
  refresh: () => Promise<void>;
  startAutoSync: () => void;
  stopAutoSync: () => void;
}

let interval: ReturnType<typeof setInterval> | null = null;

export const useBackend = create<BackendState>((set, get) => ({
  enabled: BACKEND_ENABLED,
  status: BACKEND_ENABLED ? 'idle' : 'disabled',
  apiUrl: import.meta.env.VITE_API_URL,
  incidents: [],
  kpi: null,
  lastSync: null,
  errorMessage: null,

  refresh: async () => {
    if (!BACKEND_ENABLED) return;
    set({ status: 'connecting', errorMessage: null });
    try {
      await getHealth();
      const [items, kpi] = await Promise.all([fetchIncidents({ limit: 1000 }), fetchKpi()]);
      set({
        status: 'ok',
        incidents: items,
        kpi,
        lastSync: new Date().toISOString(),
      });
    } catch (e) {
      set({
        status: 'error',
        errorMessage: (e as Error).message,
        lastSync: new Date().toISOString(),
      });
    }
  },

  startAutoSync: () => {
    if (!BACKEND_ENABLED) return;
    if (interval) clearInterval(interval);
    void get().refresh();
    // Backend опрашиваем чаще — раз в минуту
    interval = setInterval(() => void get().refresh(), 60_000);
  },

  stopAutoSync: () => {
    if (interval) {
      clearInterval(interval);
      interval = null;
    }
  },
}));
