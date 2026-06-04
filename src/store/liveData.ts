import { create } from 'zustand';
import type { Incident } from '@/types/domain';
import { fetchLiveIncidents } from '@/services/liveApi';

type LiveStatus = 'idle' | 'loading' | 'ok' | 'error';

interface LiveDataState {
  incidents: Incident[];
  status: LiveStatus;
  lastUpdate: string | null;
  errorMessage: string | null;
  autoRefreshMin: number; // интервал в минутах
  diagnostics: {
    rssOk: boolean;
    rssCount: number;
  };
  setAutoRefresh: (min: number) => void;
  refresh: () => Promise<void>;
  startAutoRefresh: () => void;
  stopAutoRefresh: () => void;
}

let intervalHandle: ReturnType<typeof setInterval> | null = null;

export const useLiveData = create<LiveDataState>((set, get) => ({
  incidents: [],
  status: 'idle',
  lastUpdate: null,
  errorMessage: null,
  autoRefreshMin: 10,
  diagnostics: { rssOk: false, rssCount: 0 },

  setAutoRefresh: (min) => {
    set({ autoRefreshMin: min });
    if (intervalHandle) {
      get().startAutoRefresh();
    }
  },

  refresh: async () => {
    set({ status: 'loading', errorMessage: null });
    try {
      const { incidents, diagnostics } = await fetchLiveIncidents();
      set({
        incidents,
        status: 'ok',
        lastUpdate: new Date().toISOString(),
        diagnostics: {
          rssOk: diagnostics.rssOk,
          rssCount: diagnostics.rssCount,
        },
        errorMessage: diagnostics.error ?? null,
      });
    } catch (e) {
      set({
        status: 'error',
        errorMessage: (e as Error).message,
        lastUpdate: new Date().toISOString(),
      });
    }
  },

  startAutoRefresh: () => {
    if (intervalHandle) clearInterval(intervalHandle);
    const min = get().autoRefreshMin;
    // Первый запрос — немедленно
    void get().refresh();
    intervalHandle = setInterval(
      () => {
        void get().refresh();
      },
      Math.max(2, min) * 60_000,
    );
  },

  stopAutoRefresh: () => {
    if (intervalHandle) {
      clearInterval(intervalHandle);
      intervalHandle = null;
    }
  },
}));
