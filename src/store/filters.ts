import { create } from 'zustand';
import type { Severity, UavType, ObjectType, VerificationStatus } from '@/types/domain';

export interface IncidentsFilter {
  period: { from: string; to: string } | null;
  regions: string[];
  objectTypes: ObjectType[];
  uavTypes: UavType[];
  severities: Severity[];
  verificationStatuses: VerificationStatus[];
  damageRange: [number, number];
  search: string;
}

const DEFAULT_FILTER: IncidentsFilter = {
  period: { from: '2026-01-01', to: '2026-05-29' },
  regions: [],
  objectTypes: [],
  uavTypes: [],
  severities: [],
  verificationStatuses: [],
  damageRange: [0, 10],
  search: '',
};

interface FiltersState {
  filters: IncidentsFilter;
  setFilter: <K extends keyof IncidentsFilter>(key: K, value: IncidentsFilter[K]) => void;
  reset: () => void;
}

export const useFilters = create<FiltersState>((set) => ({
  filters: DEFAULT_FILTER,
  setFilter: (key, value) =>
    set((s) => ({ filters: { ...s.filters, [key]: value } })),
  reset: () => set({ filters: DEFAULT_FILTER }),
}));
