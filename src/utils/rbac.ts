import type { Role } from '@/types/domain';

// Иерархическое наследование прав
const HIERARCHY: Role[] = ['analyst', 'expert', 'admin'];

export function hasRole(current: Role | null | undefined, required: Role): boolean {
  if (!current) return false;
  return HIERARCHY.indexOf(current) >= HIERARCHY.indexOf(required);
}

export function canSee(current: Role | null | undefined, allowed: Role[]): boolean {
  if (!current) return false;
  return allowed.some((r) => hasRole(current, r));
}
