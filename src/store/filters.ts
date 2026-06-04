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

function todayISOLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function daysAgoISOLocal(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const DEFAULT_FILTER: IncidentsFilter = {
  period: { from: daysAgoISOLocal(90), to: todayISOLocal() },
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
