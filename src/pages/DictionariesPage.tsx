import { useState } from 'react';
import { Edit, Plus, Trash2 } from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Tabs } from '@/components/common/Tabs';
import { Modal } from '@/components/common/Modal';
import { OBJECT_CATEGORY_DICT, OPERATORS_DICT, TACTICS_DICT, UAV_DICT } from '@/mocks/dictionaries';
import { REGIONS } from '@/mocks/regions';
import type { DictionaryEntry } from '@/types/domain';

type DictKey = 'regions' | 'categories' | 'uav' | 'tactics' | 'operators';

const DICTS: Record<DictKey, { label: string; entries: DictionaryEntry[] }> = {
  regions: {
    label: 'Регионы',
    entries: REGIONS.map((r) => ({ id: r.code, name: r.name, description: `Координаты: ${r.center.lat.toFixed(2)}, ${r.center.lon.toFixed(2)}` })),
  },
  categories: { label: 'Категории объектов ТЭК', entries: OBJECT_CATEGORY_DICT },
  uav: { label: 'Типы БПЛА', entries: UAV_DICT },
  tactics: { label: 'Тактики применения', entries: TACTICS_DICT },
  operators: { label: 'Операторы', entries: OPERATORS_DICT },
};

export function DictionariesPage() {
  const [tab, setTab] = useState<DictKey>('regions');
  const [dicts, setDicts] = useState(DICTS);
  const [editing, setEditing] = useState<DictionaryEntry | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<DictionaryEntry>({ id: '', name: '', description: '' });

  const current = dicts[tab];

  function openAdd() {
    setForm({ id: '', name: '', description: '' });
    setAdding(true);
  }
  function openEdit(e: DictionaryEntry) {
    setForm({ ...e });
    setEditing(e);
  }
  function save() {
    setDicts((d) => {
      const entries = adding
        ? [...d[tab].entries, { ...form, id: form.id || `${tab}-${Date.now()}` }]
        : d[tab].entries.map((x) => (x.id === editing?.id ? { ...form } : x));
      return { ...d, [tab]: { ...d[tab], entries } };
    });
    setAdding(false);
    setEditing(null);
  }
  function remove(id: string) {
    setDicts((d) => ({ ...d, [tab]: { ...d[tab], entries: d[tab].entries.filter((x) => x.id !== id) } }));
  }

  return (
    <PageContainer
      title="Справочники"
      subtitle="CRUD-управление словарями системы"
      toolbar={
        <Button size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={openAdd}>
          Добавить запись
        </Button>
      }
    >
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={(Object.keys(DICTS) as DictKey[]).map((k) => ({ value: k, label: DICTS[k].label, count: dicts[k].entries.length }))}
      />

      <Card className="mt-3" padding="none">
        <table className="w-full text-xs">
          <thead className="bg-surface text-ink-muted">
            <tr>
              <th className="w-32 px-3 py-2 text-left font-semibold">Код</th>
              <th className="px-3 py-2 text-left font-semibold">Наименование</th>
              <th className="px-3 py-2 text-left font-semibold">Описание</th>
              <th className="w-20 px-3 py-2 text-right font-semibold">Действия</th>
            </tr>
          </thead>
          <tbody>
            {current.entries.map((e, idx) => (
              <tr key={e.id} className={`border-t border-surface-border ${idx % 2 === 1 ? 'bg-surface/40' : ''}`}>
                <td className="px-3 py-2 font-mono text-ink-muted">{e.id}</td>
                <td className="px-3 py-2 font-semibold text-ink">{e.name}</td>
                <td className="px-3 py-2 text-ink-muted">{e.description ?? '—'}</td>
                <td className="px-3 py-2 text-right">
                  <button onClick={() => openEdit(e)} className="mr-2 text-brand-600 hover:underline">
                    <Edit className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => remove(e.id)} className="text-red-600">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Modal
        open={adding || !!editing}
        onClose={() => {
          setAdding(false);
          setEditing(null);
        }}
        title={adding ? 'Новая запись' : 'Редактирование записи'}
        size="md"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setAdding(false);
                setEditing(null);
              }}
            >
              Отмена
            </Button>
            <Button onClick={save}>Сохранить</Button>
          </>
        }
      >
        <div className="space-y-3 text-sm">
          <label className="block">
            <span className="text-xs font-semibold text-ink-muted">Код</span>
            <input
              value={form.id}
              onChange={(e) => setForm({ ...form, id: e.target.value })}
              className="mt-1 h-9 w-full rounded border border-surface-border px-2 text-sm"
              disabled={!adding}
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-ink-muted">Наименование</span>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="mt-1 h-9 w-full rounded border border-surface-border px-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-ink-muted">Описание</span>
            <textarea
              value={form.description ?? ''}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="mt-1 w-full rounded border border-surface-border p-2 text-sm"
            />
          </label>
        </div>
      </Modal>
    </PageContainer>
  );
}
