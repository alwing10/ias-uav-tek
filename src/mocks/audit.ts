import type { AuditEvent } from '@/types/domain';
import { pad, pick, randInt } from './rng';

const USERS = [
  { user: 'analyst@iac.ru', role: 'analyst' as const },
  { user: 'expert@iac.ru', role: 'expert' as const },
  { user: 'admin@iac.ru', role: 'admin' as const },
  { user: 'a.petrova@iac.ru', role: 'expert' as const },
  { user: 'i.ivanov@iac.ru', role: 'analyst' as const },
];

const ACTIONS = [
  { a: 'Вход в систему', obj: '' },
  { a: 'Открыта карточка инцидента', obj: 'INC-' },
  { a: 'Верифицирован инцидент', obj: 'INC-' },
  { a: 'Изменены атрибуты', obj: 'INC-' },
  { a: 'Запущена переклассификация', obj: 'INC-' },
  { a: 'Экспорт отчёта PDF', obj: 'REP-' },
  { a: 'Экспорт XLSX', obj: 'REP-' },
  { a: 'Добавлен источник данных', obj: 'SRC-' },
  { a: 'Изменены справочники', obj: 'DICT-' },
  { a: 'Создан пользователь', obj: 'USR-' },
  { a: 'Изменена роль пользователя', obj: 'USR-' },
  { a: 'Запуск сбора', obj: 'SRC-' },
  { a: 'Просмотр журнала аудита', obj: '' },
];

export function generateAudit(): AuditEvent[] {
  const items: AuditEvent[] = [];
  const N = 240;
  for (let i = 0; i < N; i++) {
    const u = pick(USERS);
    const a = pick(ACTIONS);
    const t = new Date(Date.now() - randInt(0, 60 * 24 * 30) * 60_000);
    items.push({
      id: `LOG-${pad(N - i, 5)}`,
      datetime: t.toISOString(),
      user: u.user,
      role: u.role,
      action: a.a,
      object: a.obj ? a.obj + pad(randInt(1, 1500), 4) : '—',
      ip: `10.0.${randInt(0, 9)}.${randInt(1, 254)}`,
    });
  }
  return items.sort((a, b) => (a.datetime < b.datetime ? 1 : -1));
}

export const AUDIT: AuditEvent[] = generateAudit();
