import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Role, User } from '@/types/domain';

const USERS: Record<string, { password: string; user: User }> = {
  'analyst@iac.ru': {
    password: 'analyst',
    user: { id: 'U1', email: 'analyst@iac.ru', name: 'А. Петрова', role: 'analyst', avatarInitials: 'АП' },
  },
  'expert@iac.ru': {
    password: 'expert',
    user: { id: 'U2', email: 'expert@iac.ru', name: 'И. Иванов', role: 'expert', avatarInitials: 'ИИ' },
  },
  'admin@iac.ru': {
    password: 'admin',
    user: { id: 'U3', email: 'admin@iac.ru', name: 'С. Кузнецов', role: 'admin', avatarInitials: 'СК' },
  },
};

interface AuthState {
  user: User | null;
  login: (email: string, password: string) => boolean;
  logout: () => void;
  switchRole: (role: Role) => void;
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      login: (email, password) => {
        const rec = USERS[email.trim().toLowerCase()];
        if (!rec || rec.password !== password) return false;
        set({ user: rec.user });
        return true;
      },
      logout: () => set({ user: null }),
      switchRole: (role) => {
        const u = get().user;
        if (!u) return;
        set({ user: { ...u, role } });
      },
    }),
    { name: 'ias-auth' },
  ),
);

export const DEMO_ACCOUNTS = [
  { email: 'analyst@iac.ru', password: 'analyst', role: 'Аналитик' as const },
  { email: 'expert@iac.ru', password: 'expert', role: 'Эксперт' as const },
  { email: 'admin@iac.ru', password: 'admin', role: 'Администратор' as const },
];
