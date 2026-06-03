import type { DictionaryEntry } from '@/types/domain';

export const UAV_DICT: DictionaryEntry[] = [
  { id: 'fpv', name: 'FPV (квадрокоптер)', description: 'Малогабаритный дрон с управлением «от первого лица»' },
  { id: 'plane', name: 'Самолётного типа', description: 'БПЛА фиксированного крыла среднего и большого радиуса' },
  { id: 'mini', name: 'Мини-класс', description: 'Малый коммерческий БПЛА' },
  { id: 'multi', name: 'Мультикоптер', description: 'Многороторный БПЛА' },
  { id: 'loitering', name: 'Барражирующий', description: 'Боеприпас с длительным временем барражирования' },
  { id: 'unknown', name: 'Не установлен', description: 'Тип не идентифицирован' },
];

export const TACTICS_DICT: DictionaryEntry[] = [
  { id: 't1', name: 'Прямая атака', description: 'Поражение цели' },
  { id: 't2', name: 'Разведка', description: 'Визуальная разведка объекта' },
  { id: 't3', name: 'Сброс боеприпаса', description: 'Сброс на цель' },
  { id: 't4', name: 'Барражирование', description: 'Длительное нахождение в воздухе у объекта' },
  { id: 't5', name: 'Несанкционированный пролёт', description: 'Без явного боевого назначения' },
];

export const OBJECT_CATEGORY_DICT: DictionaryEntry[] = [
  { id: 'I', name: 'I категория', description: 'Объекты критической важности (высшая категория опасности)' },
  { id: 'II', name: 'II категория', description: 'Объекты повышенной важности' },
  { id: 'III', name: 'III категория', description: 'Стандартная категория' },
];

export const OPERATORS_DICT: DictionaryEntry[] = [
  { id: 'op1', name: 'ПАО «Газпром»' },
  { id: 'op2', name: 'ПАО «Роснефть»' },
  { id: 'op3', name: 'ПАО «Лукойл»' },
  { id: 'op4', name: 'ПАО «Транснефть»' },
  { id: 'op5', name: 'ПАО «Россети»' },
  { id: 'op6', name: 'ПАО «ФСК ЕЭС»' },
  { id: 'op7', name: 'АО «РусГидро»' },
  { id: 'op8', name: 'ПАО «Сургутнефтегаз»' },
  { id: 'op9', name: 'ПАО «Татнефть»' },
  { id: 'op10', name: 'ПАО «Башнефть»' },
];
