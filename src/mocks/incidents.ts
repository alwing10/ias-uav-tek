// Демо-моки инцидентов УБРАНЫ. Прототип работает только с реальными данными,
// собранными backend-скрейперами (BPL/RIA/TASS/GN/GDELT и т.д.) и
// клиентским резервным каналом (rss2json).
//
// Если для презентации без backend нужно показать UI с заполнением —
// включите DEMO mode: установите переменную окружения VITE_DEMO_MODE=1
// (не реализовано по умолчанию).

import type { Incident } from '@/types/domain';

export const INCIDENTS: Incident[] = [];

export function getIncidentById(id: string): Incident | undefined {
  return INCIDENTS.find((i) => i.id === id);
}
