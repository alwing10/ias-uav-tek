import { create } from 'zustand';
import { INCIDENTS } from '@/mocks/incidents';
import type { Incident, VerificationStatus, Severity, UavType, ObjectType } from '@/types/domain';

interface IncidentsState {
  incidents: Incident[];
  setVerification: (id: string, status: VerificationStatus, by?: string) => void;
  bulkVerify: (ids: string[], status: VerificationStatus, by?: string) => void;
  updateAttributes: (id: string, patch: Partial<Pick<Incident, 'severity' | 'uavType' | 'objectType' | 'scenario' | 'damage' | 'description'>>) => void;
  addIncident: (incident: Incident) => void;
}

export const useIncidents = create<IncidentsState>((set) => ({
  incidents: INCIDENTS,
  setVerification: (id, status, by) =>
    set((s) => ({
      incidents: s.incidents.map((i) =>
        i.id === id
          ? {
              ...i,
              verified: status,
              verifiedBy: status === 'verified' ? by ?? i.verifiedBy : i.verifiedBy,
              verifiedAt: status === 'verified' ? new Date().toISOString() : i.verifiedAt,
            }
          : i,
      ),
    })),
  bulkVerify: (ids, status, by) =>
    set((s) => ({
      incidents: s.incidents.map((i) =>
        ids.includes(i.id)
          ? {
              ...i,
              verified: status,
              verifiedBy: status === 'verified' ? by ?? i.verifiedBy : i.verifiedBy,
              verifiedAt: status === 'verified' ? new Date().toISOString() : i.verifiedAt,
            }
          : i,
      ),
    })),
  updateAttributes: (id, patch) =>
    set((s) => ({
      incidents: s.incidents.map((i) => (i.id === id ? { ...i, ...patch } : i)),
    })),
  addIncident: (incident) => set((s) => ({ incidents: [incident, ...s.incidents] })),
}));

export { type Incident, type Severity, type UavType, type ObjectType, type VerificationStatus };
