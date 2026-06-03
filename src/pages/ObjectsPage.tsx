import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, Plus, Upload, Search } from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { CategoryBadge } from '@/components/common/CategoryBadge';
import { KpiCard } from '@/components/common/KpiCard';
import { Modal } from '@/components/common/Modal';
import { OBJECTS } from '@/mocks/objects';
import { REGIONS } from '@/mocks/regions';
import { OBJECT_TYPE_LABEL, type ObjectCategory, type ObjectType } from '@/types/domain';
import { nf } from '@/utils/format';
import { MultiSelect } from '@/components/common/MultiSelect';
import * as XLSX from 'xlsx';

export function ObjectsPage() {
  const [search, setSearch] = useState('');
  const [categories, setCategories] = useState<ObjectCategory[]>([]);
  const [types, setTypes] = useState<ObjectType[]>([]);
  const [regions, setRegions] = useState<string[]>([]);
  const [threatRange, setThreatRange] = useState<[number, number]>([0, 10]);
  const [addOpen, setAddOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return OBJECTS.filter((o) => {
      if (q && !o.name.toLowerCase().includes(q) && !o.id.toLowerCase().includes(q) && !o.operator.toLowerCase().includes(q)) return false;
      if (categories.length && !categories.includes(o.category)) return false;
      if (types.length && !types.includes(o.type)) return false;
      if (regions.length && !regions.includes(o.regionCode)) return false;
      if (o.threatIndex < threatRange[0] || o.threatIndex > threatRange[1]) return false;
      return true;
    });
  }, [search, categories, types, regions, threatRange]);

  const stats = useMemo(() => {
    return {
      total: OBJECTS.length,
      cat1: OBJECTS.filter((o) => o.category === 'I').length,
      cat2: OBJECTS.filter((o) => o.category === 'II').length,
      cat3: OBJECTS.filter((o) => o.category === 'III').length,
      attacked12m: OBJECTS.filter((o) => o.incidents12m > 0).length,
      atRisk: OBJECTS.filter((o) => o.threatIndex >= 7).length,
    };
  }, []);

  function exportXlsx() {
    const rows = filtered.map((o) => ({
      ID: o.id,
      Наименование: o.name,
      Тип: OBJECT_TYPE_LABEL[o.type],
      Регион: o.region,
      Категория: o.category,
      Оператор: o.operator,
      'Инцидентов (12 мес.)': o.incidents12m,
      'Индекс угрозы': o.threatIndex,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Объекты');
    XLSX.writeFile(wb, 'objects.xlsx');
  }

  return (
    <PageContainer
      title="Объекты ТЭК"
      subtitle="Справочник критически важных объектов топливно-энергетического комплекса"
      toolbar={
        <div className="flex gap-1">
          <Button size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setAddOpen(true)}>
            Добавить
          </Button>
          <Button size="sm" variant="outline" icon={<Upload className="h-3.5 w-3.5" />}>
            Импорт XLSX
          </Button>
          <Button size="sm" variant="outline" icon={<Download className="h-3.5 w-3.5" />} onClick={exportXlsx}>
            Экспорт
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        <KpiCard label="Всего объектов" value={nf(stats.total)} />
        <KpiCard label="I категория" value={nf(stats.cat1)} accent="critical" />
        <KpiCard label="II категория" value={nf(stats.cat2)} accent="warning" />
        <KpiCard label="III категория" value={nf(stats.cat3)} />
        <KpiCard label="Атаковано (12 мес.)" value={nf(stats.attacked12m)} accent="warning" />
        <KpiCard label="В зоне риска" value={nf(stats.atRisk)} accent="critical" />
      </div>

      <Card className="mt-4" padding="sm">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
          <MultiSelect
            label="Категория"
            value={categories}
            onChange={setCategories}
            options={[
              { value: 'I' as const, label: 'I' },
              { value: 'II' as const, label: 'II' },
              { value: 'III' as const, label: 'III' },
            ]}
          />
          <MultiSelect
            label="Тип объекта"
            value={types}
            onChange={setTypes}
            options={(Object.keys(OBJECT_TYPE_LABEL) as ObjectType[]).map((v) => ({ value: v, label: OBJECT_TYPE_LABEL[v] }))}
          />
          <MultiSelect
            label="Регион"
            value={regions}
            onChange={setRegions}
            options={REGIONS.map((r) => ({ value: r.code, label: r.shortName }))}
          />
          <div>
            <span className="block text-[10px] font-semibold uppercase text-ink-muted">
              Индекс угрозы: {threatRange[0]}—{threatRange[1]}
            </span>
            <div className="mt-1 grid grid-cols-2 gap-1.5">
              <input type="range" min={0} max={10} value={threatRange[0]} onChange={(e) => setThreatRange([+e.target.value, threatRange[1]])} />
              <input type="range" min={0} max={10} value={threatRange[1]} onChange={(e) => setThreatRange([threatRange[0], +e.target.value])} />
            </div>
          </div>
          <div>
            <span className="block text-[10px] font-semibold uppercase text-ink-muted">Поиск</span>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-ink-muted" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ID, наименование, оператор"
                className="h-8 w-full rounded border border-surface-border bg-white pl-6 pr-2 text-xs"
              />
            </div>
          </div>
        </div>
      </Card>

      <Card className="mt-4" padding="none" title={`Найдено объектов: ${nf(filtered.length)}`}>
        <div className="scrollbar-thin overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-surface text-ink-muted">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">ID</th>
                <th className="px-3 py-2 text-left font-semibold">Наименование</th>
                <th className="px-3 py-2 text-left font-semibold">Тип</th>
                <th className="px-3 py-2 text-left font-semibold">Регион</th>
                <th className="px-3 py-2 text-left font-semibold">Категория</th>
                <th className="px-3 py-2 text-left font-semibold">Оператор</th>
                <th className="px-3 py-2 text-left font-semibold">Инцидентов</th>
                <th className="px-3 py-2 text-left font-semibold">Индекс угрозы</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 200).map((o, idx) => (
                <tr key={o.id} className={`border-t border-surface-border hover:bg-brand-50 ${idx % 2 === 1 ? 'bg-surface/40' : ''}`}>
                  <td className="px-3 py-2 font-semibold text-brand-700">{o.id}</td>
                  <td className="px-3 py-2">
                    <Link to={`/objects/${o.id}`} className="hover:underline">
                      {o.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{OBJECT_TYPE_LABEL[o.type]}</td>
                  <td className="px-3 py-2">{REGIONS.find((r) => r.code === o.regionCode)?.shortName}</td>
                  <td className="px-3 py-2">
                    <CategoryBadge category={o.category} />
                  </td>
                  <td className="px-3 py-2 text-ink-muted">{o.operator}</td>
                  <td className="px-3 py-2">{o.incidentsCount}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-24 rounded bg-surface">
                        <div
                          className="h-full rounded"
                          style={{
                            width: `${(o.threatIndex / 10) * 100}%`,
                            background:
                              o.threatIndex >= 7 ? '#D32F2F' : o.threatIndex >= 4 ? '#F57C00' : '#388E3C',
                          }}
                        />
                      </div>
                      <span className="text-ink-muted">{o.threatIndex.toFixed(1)}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Новый объект ТЭК"
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Отмена</Button>
            <Button onClick={() => setAddOpen(false)}>Создать</Button>
          </>
        }
      >
        <p className="text-sm text-ink-muted">Заполните основные атрибуты объекта (заглушка формы для демо).</p>
      </Modal>
    </PageContainer>
  );
}
