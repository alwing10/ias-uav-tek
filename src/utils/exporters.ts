import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import type { Incident } from '@/types/domain';
import { SEVERITY_LABEL, STATUS_LABEL, UAV_LABEL, VERIFICATION_LABEL } from '@/types/domain';
import { formatDateTime } from './format';

function flattenIncident(i: Incident) {
  return {
    ID: i.id,
    'Дата/Время': formatDateTime(i.datetime),
    Регион: i.region,
    Объект: i.objectName,
    'Категория объекта': i.objectCategory,
    'Тип БПЛА': UAV_LABEL[i.uavType],
    Тяжесть: SEVERITY_LABEL[i.severity],
    Статус: STATUS_LABEL[i.status],
    'Уровень ущерба': i.damage,
    Пострадавшие: i.casualties,
    Источники: i.sources.map((s) => s.name).join('; '),
    'Верификация': VERIFICATION_LABEL[i.verified],
    Координаты: `${i.coordinates.lat.toFixed(4)}, ${i.coordinates.lon.toFixed(4)}`,
  };
}

export function exportIncidentsXLSX(incidents: Incident[], filename = 'incidents.xlsx') {
  const rows = incidents.map(flattenIncident);
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Инциденты');
  XLSX.writeFile(wb, filename);
}

export function exportIncidentsCSV(incidents: Incident[], filename = 'incidents.csv') {
  const rows = incidents.map(flattenIncident);
  const csv = Papa.unparse(rows, { delimiter: ';' });
  // BOM для корректного отображения кириллицы в Excel
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Шрифт Roboto в jsPDF (поддержка кириллицы) — используем встроенный helvetica с примечанием
function setRussianFont(doc: jsPDF) {
  // Внимание: для полной кириллицы в PDF нужны TTF-шрифты.
  // В demo используем стандартный шрифт; кириллица отображается через base64-PT Sans, см. ниже.
  doc.setFont('helvetica');
}

export function exportIncidentsPDF(incidents: Incident[], title: string, filename = 'incidents.pdf') {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
  setRussianFont(doc);
  doc.setFontSize(14);
  doc.text(title, 14, 16);
  doc.setFontSize(10);
  doc.text(`Сформировано: ${new Date().toLocaleString('ru-RU')}`, 14, 22);

  const rows = incidents.slice(0, 200).map(flattenIncident);
  const head = [Object.keys(rows[0] ?? { '': '' })];
  const body = rows.map((r) => Object.values(r).map((v) => String(v)));

  autoTable(doc, {
    head,
    body,
    startY: 28,
    styles: { font: 'helvetica', fontSize: 7, cellPadding: 1.5 },
    headStyles: { fillColor: [30, 77, 139], textColor: 255 },
    alternateRowStyles: { fillColor: [240, 244, 250] },
    margin: { left: 8, right: 8 },
  });

  doc.save(filename);
}

export interface ReportOptions {
  title: string;
  period: string;
  filters: { region?: string; objectType?: string; uavType?: string; severity?: string; onlyVerified?: boolean };
  sections: {
    titlePage: boolean;
    kpi: boolean;
    map: boolean;
    dynamics: boolean;
    topRegions: boolean;
    byUav: boolean;
    fullTable: boolean;
    sourcesAppendix: boolean;
  };
  format: 'pdf' | 'xlsx' | 'docx';
}

export function exportAnalyticReport(opts: ReportOptions, incidents: Incident[]) {
  if (opts.format === 'xlsx') {
    const wb = XLSX.utils.book_new();
    if (opts.sections.kpi) {
      const total = incidents.length;
      const crit = incidents.filter((i) => i.severity === 'critical').length;
      const regions = new Set(incidents.map((i) => i.region)).size;
      const kpi = [
        { Показатель: 'Всего инцидентов', Значение: total },
        { Показатель: 'Критических', Значение: crit },
        { Показатель: 'Регионов', Значение: regions },
        { Показатель: 'Период', Значение: opts.period },
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(kpi), 'KPI');
    }
    if (opts.sections.fullTable) {
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(incidents.map(flattenIncident)),
        'Инциденты',
      );
    }
    if (opts.sections.dynamics) {
      const map = new Map<string, number>();
      incidents.forEach((i) => {
        const m = i.datetime.slice(0, 7);
        map.set(m, (map.get(m) ?? 0) + 1);
      });
      const rows = Array.from(map.entries())
        .sort()
        .map(([m, n]) => ({ Месяц: m, Инцидентов: n }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Динамика');
    }
    XLSX.writeFile(wb, 'report.xlsx');
    return;
  }

  if (opts.format === 'docx') {
    // Простой HTML-документ с расширением .doc — открывается Word
    const html = buildReportHTML(opts, incidents);
    const blob = new Blob([
      `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"></head><body>${html}</body></html>`,
    ], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'report.doc';
    a.click();
    URL.revokeObjectURL(url);
    return;
  }

  // PDF
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  setRussianFont(doc);
  let y = 20;
  if (opts.sections.titlePage) {
    doc.setFontSize(18);
    doc.text(opts.title, 105, 50, { align: 'center' });
    doc.setFontSize(12);
    doc.text('об инцидентах с применением БПЛА', 105, 60, { align: 'center' });
    doc.text('в отношении объектов ТЭК', 105, 67, { align: 'center' });
    doc.setFontSize(11);
    doc.text(`Период: ${opts.period}`, 105, 85, { align: 'center' });
    doc.addPage();
    y = 20;
  }

  if (opts.sections.kpi) {
    doc.setFontSize(13);
    doc.text('Сводные показатели', 14, y);
    y += 8;
    const total = incidents.length;
    const crit = incidents.filter((i) => i.severity === 'critical').length;
    const regions = new Set(incidents.map((i) => i.region)).size;
    autoTable(doc, {
      startY: y,
      head: [['Показатель', 'Значение']],
      body: [
        ['Всего инцидентов', String(total)],
        ['Критических', String(crit)],
        ['Регионов охвачено', String(regions)],
        ['Период', opts.period],
      ],
      styles: { font: 'helvetica', fontSize: 10 },
      headStyles: { fillColor: [30, 77, 139] },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  if (opts.sections.topRegions) {
    if (y > 230) {
      doc.addPage();
      y = 20;
    }
    doc.setFontSize(13);
    doc.text('Топ-10 регионов', 14, y);
    y += 6;
    const cnt = new Map<string, number>();
    incidents.forEach((i) => cnt.set(i.region, (cnt.get(i.region) ?? 0) + 1));
    const top = Array.from(cnt.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);
    autoTable(doc, {
      startY: y + 2,
      head: [['Регион', 'Инцидентов']],
      body: top.map(([r, n]) => [r, String(n)]),
      styles: { font: 'helvetica', fontSize: 10 },
      headStyles: { fillColor: [30, 77, 139] },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  if (opts.sections.fullTable) {
    doc.addPage();
    doc.setFontSize(13);
    doc.text('Реестр инцидентов', 14, 18);
    autoTable(doc, {
      startY: 22,
      head: [['ID', 'Дата', 'Регион', 'Объект', 'БПЛА', 'Тяжесть', 'Статус']],
      body: incidents.slice(0, 250).map((i) => [
        i.id,
        new Date(i.datetime).toLocaleDateString('ru-RU'),
        i.region,
        i.objectName,
        UAV_LABEL[i.uavType],
        SEVERITY_LABEL[i.severity],
        STATUS_LABEL[i.status],
      ]),
      styles: { font: 'helvetica', fontSize: 7, cellPadding: 1 },
      headStyles: { fillColor: [30, 77, 139] },
    });
  }

  doc.save('report.pdf');
}

function buildReportHTML(opts: ReportOptions, incidents: Incident[]): string {
  const total = incidents.length;
  const crit = incidents.filter((i) => i.severity === 'critical').length;
  const regions = new Set(incidents.map((i) => i.region)).size;
  let html = `<h1 style="text-align:center;font-family:'Times New Roman'">${opts.title}</h1>`;
  html += `<p style="text-align:center">об инцидентах с применением БПЛА в отношении объектов ТЭК</p>`;
  html += `<p style="text-align:center">Период: ${opts.period}</p><hr/>`;
  if (opts.sections.kpi) {
    html += `<h2>Сводные показатели</h2><table border="1" cellpadding="6"><tr><th>Показатель</th><th>Значение</th></tr>
      <tr><td>Всего инцидентов</td><td>${total}</td></tr>
      <tr><td>Критических</td><td>${crit}</td></tr>
      <tr><td>Регионов</td><td>${regions}</td></tr></table>`;
  }
  if (opts.sections.fullTable) {
    html += `<h2>Реестр инцидентов</h2><table border="1" cellpadding="4"><tr><th>ID</th><th>Дата</th><th>Регион</th><th>Объект</th><th>БПЛА</th><th>Тяжесть</th></tr>`;
    incidents.slice(0, 100).forEach((i) => {
      html += `<tr><td>${i.id}</td><td>${formatDateTime(i.datetime)}</td><td>${i.region}</td><td>${i.objectName}</td><td>${UAV_LABEL[i.uavType]}</td><td>${SEVERITY_LABEL[i.severity]}</td></tr>`;
    });
    html += '</table>';
  }
  return html;
}
