/**
 * Экспорт данных в XLSX / CSV / PDF / DOCX.
 *
 * PDF делаем через html2canvas + jsPDF: рендерим HTML с реальными
 * браузерными шрифтами в canvas, затем кладём canvas в PDF как изображение.
 * Это полностью решает проблему кириллицы (jsPDF + helvetica их не умеет).
 */

import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
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
    Верификация: VERIFICATION_LABEL[i.verified],
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
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ===== PDF через html2canvas (поддерживает кириллицу) =====

interface PdfRenderOptions {
  filename: string;
  /** Заголовок страницы */
  title: string;
  /** Опциональный подзаголовок (период, фильтр и т.п.) */
  subtitle?: string;
  /** HTML-разметка содержимого (без <html>/<body>) */
  bodyHtml: string;
}

/**
 * Рендер произвольного HTML в PDF.
 * Создаёт временный скрытый DIV в DOM, html2canvas снимает его в canvas,
 * jsPDF разрезает большой canvas на A4-страницы.
 */
async function renderHtmlToPdf(opts: PdfRenderOptions): Promise<void> {
  // 1. Готовим временный контейнер
  const container = document.createElement('div');
  container.style.cssText = `
    position: absolute;
    left: -10000px;
    top: 0;
    width: 794px;
    background: #ffffff;
    padding: 40px;
    font-family: 'Inter', 'Segoe UI', Arial, sans-serif;
    color: #222b36;
    font-size: 12px;
    line-height: 1.5;
    box-sizing: border-box;
  `;
  container.innerHTML = `
    <div style="border-bottom: 2px solid #1E4D8B; padding-bottom: 12px; margin-bottom: 20px;">
      <div style="font-size: 11px; color: #6B7280; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 6px;">
        ИАС мониторинга инцидентов с применением БПЛА в отношении объектов ТЭК
      </div>
      <h1 style="font-size: 20px; font-weight: 700; color: #1E4D8B; margin: 0;">${escape(opts.title)}</h1>
      ${opts.subtitle ? `<div style="font-size: 12px; color: #6B7280; margin-top: 4px;">${escape(opts.subtitle)}</div>` : ''}
    </div>
    ${opts.bodyHtml}
    <div style="margin-top: 30px; padding-top: 12px; border-top: 1px solid #D9DDE3; font-size: 10px; color: #6B7280; text-align: right;">
      Сформировано ${new Date().toLocaleString('ru-RU')}
    </div>
  `;
  document.body.appendChild(container);

  try {
    // 2. Снимаем canvas в высоком DPI для чёткости
    const canvas = await html2canvas(container, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false,
    });

    // 3. Разрезаем canvas на страницы A4 и кладём в PDF
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pdfWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pdfHeight;

    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;
    }

    pdf.save(opts.filename);
  } finally {
    document.body.removeChild(container);
  }
}

function escape(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/** Экспорт реестра инцидентов в PDF */
export async function exportIncidentsPDF(
  incidents: Incident[],
  title: string,
  filename = 'incidents.pdf',
) {
  const rows = incidents.slice(0, 200).map(flattenIncident);
  const headers = Object.keys(rows[0] ?? { '': '' });

  const tableHtml = `
    <h2 style="font-size: 14px; font-weight: 600; color: #1E4D8B; margin: 0 0 8px;">
      Реестр инцидентов (${incidents.length}${incidents.length > 200 ? ', показано 200' : ''})
    </h2>
    <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
      <thead>
        <tr style="background: #1E4D8B; color: white;">
          ${headers.map((h) => `<th style="padding: 6px 4px; text-align: left; border: 1px solid #1F3F6E;">${escape(h)}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (r, i) => `
          <tr style="background: ${i % 2 === 0 ? '#ffffff' : '#F5F7FA'};">
            ${Object.values(r)
              .map(
                (v) =>
                  `<td style="padding: 4px; border: 1px solid #D9DDE3; vertical-align: top;">${escape(String(v ?? ''))}</td>`,
              )
              .join('')}
          </tr>
        `,
          )
          .join('')}
      </tbody>
    </table>
  `;

  await renderHtmlToPdf({
    filename,
    title,
    subtitle: `Всего инцидентов: ${incidents.length}`,
    bodyHtml: tableHtml,
  });
}

/** Экспорт карточки одного инцидента в PDF */
export async function exportIncidentCardPDF(incident: Incident, filename = `${incident.id}.pdf`) {
  const sevColor: Record<string, string> = {
    low: '#388E3C',
    medium: '#FBC02D',
    high: '#F57C00',
    critical: '#D32F2F',
  };
  const html = `
    <div style="display: inline-block; padding: 4px 12px; background: ${sevColor[incident.severity]}22; color: ${sevColor[incident.severity]}; border-radius: 999px; font-size: 11px; font-weight: 700; text-transform: uppercase; margin-bottom: 16px;">
      ${SEVERITY_LABEL[incident.severity]}
    </div>
    <h2 style="font-size: 16px; color: #1E4D8B; margin: 0 0 8px;">${escape(incident.objectName)}</h2>
    <p style="color: #6B7280; font-size: 12px; margin: 0 0 16px;">${escape(incident.region)} · ${formatDateTime(incident.datetime)}</p>

    <h3 style="font-size: 13px; font-weight: 600; margin: 20px 0 8px;">Описание</h3>
    <p style="font-size: 12px; line-height: 1.55;">${escape(incident.description)}</p>

    <h3 style="font-size: 13px; font-weight: 600; margin: 20px 0 8px;">Классификация</h3>
    <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
      ${[
        ['Тип объекта ТЭК', incident.objectType],
        ['Категория опасности', incident.objectCategory],
        ['Тип БПЛА', UAV_LABEL[incident.uavType]],
        ['Сценарий', incident.scenario],
        ['Ущерб', `${incident.damage}/10`],
        ['Статус', STATUS_LABEL[incident.status]],
        ['Координаты', `${incident.coordinates.lat.toFixed(4)}, ${incident.coordinates.lon.toFixed(4)}`],
        ['Confidence классификации', `${Math.round(incident.classificationConfidence * 100)}%`],
        ['Верификация', VERIFICATION_LABEL[incident.verified] + (incident.verifiedBy ? ` (${incident.verifiedBy})` : '')],
      ]
        .map(
          ([k, v]) =>
            `<tr><td style="padding: 5px 0; color: #6B7280; width: 200px;">${escape(String(k))}</td><td style="padding: 5px 0;">${escape(String(v))}</td></tr>`,
        )
        .join('')}
    </table>

    <h3 style="font-size: 13px; font-weight: 600; margin: 20px 0 8px;">Источники (${incident.sources.length})</h3>
    ${incident.sources
      .map(
        (s) => `
      <div style="background: #F5F7FA; border-radius: 4px; padding: 10px; margin-bottom: 8px; font-size: 11px;">
        <div style="font-weight: 600; color: #1E4D8B;">${escape(s.name)} <span style="color: #6B7280; font-weight: normal;">· confidence ${s.confidence.toFixed(2)}</span></div>
        <div style="margin-top: 4px;">${escape(s.text)}</div>
        ${s.url ? `<div style="margin-top: 4px; color: #2B5797;">${escape(s.url)}</div>` : ''}
      </div>
    `,
      )
      .join('')}
  `;
  await renderHtmlToPdf({ filename, title: `Карточка инцидента ${incident.id}`, bodyHtml: html });
}

// ===== Аналитический отчёт =====

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

export async function exportAnalyticReport(opts: ReportOptions, incidents: Incident[]) {
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
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(incidents.map(flattenIncident)), 'Инциденты');
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
    const html = buildReportHTML(opts, incidents);
    const blob = new Blob(
      [
        `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"></head><body>${html}</body></html>`,
      ],
      { type: 'application/msword' },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'report.doc';
    a.click();
    URL.revokeObjectURL(url);
    return;
  }

  // PDF — собираем красивый HTML и рендерим через html2canvas
  const html = buildReportHTML(opts, incidents);
  await renderHtmlToPdf({ filename: 'report.pdf', title: opts.title, subtitle: opts.period, bodyHtml: html });
}

function buildReportHTML(opts: ReportOptions, incidents: Incident[]): string {
  const total = incidents.length;
  const crit = incidents.filter((i) => i.severity === 'critical').length;
  const regions = new Set(incidents.map((i) => i.region)).size;
  const high = incidents.filter((i) => i.severity === 'high').length;

  let html = '';

  if (opts.sections.kpi) {
    html += `
      <h2 style="font-size: 14px; color: #1E4D8B; margin: 16px 0 8px;">Сводные показатели</h2>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <tr>
          <td style="background: #EAF2FA; padding: 12px; border-radius: 6px; text-align: center; width: 25%;">
            <div style="font-size: 10px; color: #6B7280; font-weight: 600; text-transform: uppercase;">ВСЕГО</div>
            <div style="font-size: 22px; color: #1E4D8B; font-weight: 700; margin-top: 4px;">${total}</div>
          </td>
          <td style="width: 8px;"></td>
          <td style="background: #FDECEC; padding: 12px; border-radius: 6px; text-align: center; width: 25%;">
            <div style="font-size: 10px; color: #6B7280; font-weight: 600; text-transform: uppercase;">КРИТИЧЕСКИХ</div>
            <div style="font-size: 22px; color: #D32F2F; font-weight: 700; margin-top: 4px;">${crit}</div>
          </td>
          <td style="width: 8px;"></td>
          <td style="background: #FFF3E0; padding: 12px; border-radius: 6px; text-align: center; width: 25%;">
            <div style="font-size: 10px; color: #6B7280; font-weight: 600; text-transform: uppercase;">ВЫСОКИХ</div>
            <div style="font-size: 22px; color: #F57C00; font-weight: 700; margin-top: 4px;">${high}</div>
          </td>
          <td style="width: 8px;"></td>
          <td style="background: #EAF2FA; padding: 12px; border-radius: 6px; text-align: center; width: 25%;">
            <div style="font-size: 10px; color: #6B7280; font-weight: 600; text-transform: uppercase;">РЕГИОНОВ</div>
            <div style="font-size: 22px; color: #1E4D8B; font-weight: 700; margin-top: 4px;">${regions}</div>
          </td>
        </tr>
      </table>
    `;
  }

  if (opts.sections.dynamics) {
    const byMonth = new Map<string, number>();
    incidents.forEach((i) => {
      const m = i.datetime.slice(0, 7);
      byMonth.set(m, (byMonth.get(m) ?? 0) + 1);
    });
    const arr = Array.from(byMonth.entries()).sort();
    const max = Math.max(1, ...arr.map(([, v]) => v));
    html += `
      <h2 style="font-size: 14px; color: #1E4D8B; margin: 24px 0 8px;">Динамика инцидентов по месяцам</h2>
      <div style="display: flex; align-items: flex-end; gap: 12px; height: 140px; padding: 12px; background: #F5F7FA; border-radius: 6px;">
        ${arr
          .map(
            ([m, v]) => `
          <div style="flex: 1; text-align: center;">
            <div style="background: #2B5797; width: 100%; height: ${(v / max) * 110}px; border-radius: 3px 3px 0 0;"></div>
            <div style="font-size: 10px; margin-top: 4px; color: #6B7280;">${m}</div>
            <div style="font-size: 10px; font-weight: 600;">${v}</div>
          </div>
        `,
          )
          .join('')}
      </div>
    `;
  }

  if (opts.sections.topRegions) {
    const cnt = new Map<string, number>();
    incidents.forEach((i) => cnt.set(i.region, (cnt.get(i.region) ?? 0) + 1));
    const top = Array.from(cnt.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    const max = Math.max(1, ...top.map(([, v]) => v));
    html += `
      <h2 style="font-size: 14px; color: #1E4D8B; margin: 24px 0 8px;">Топ-10 регионов</h2>
      <div style="display: flex; flex-direction: column; gap: 4px;">
        ${top
          .map(
            ([r, v]) => `
          <div style="display: flex; align-items: center; gap: 8px; font-size: 11px;">
            <div style="width: 180px; color: #222b36;">${escape(r)}</div>
            <div style="flex: 1; background: #F5F7FA; height: 14px; border-radius: 3px;">
              <div style="width: ${(v / max) * 100}%; background: #2B5797; height: 100%; border-radius: 3px;"></div>
            </div>
            <div style="width: 40px; text-align: right; color: #6B7280;">${v}</div>
          </div>
        `,
          )
          .join('')}
      </div>
    `;
  }

  if (opts.sections.fullTable) {
    html += `
      <h2 style="font-size: 14px; color: #1E4D8B; margin: 24px 0 8px;">Реестр инцидентов</h2>
      <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
        <thead>
          <tr style="background: #1E4D8B; color: white;">
            <th style="padding: 5px; text-align: left; border: 1px solid #1F3F6E;">ID</th>
            <th style="padding: 5px; text-align: left; border: 1px solid #1F3F6E;">Дата</th>
            <th style="padding: 5px; text-align: left; border: 1px solid #1F3F6E;">Регион</th>
            <th style="padding: 5px; text-align: left; border: 1px solid #1F3F6E;">Объект</th>
            <th style="padding: 5px; text-align: left; border: 1px solid #1F3F6E;">БПЛА</th>
            <th style="padding: 5px; text-align: left; border: 1px solid #1F3F6E;">Тяжесть</th>
          </tr>
        </thead>
        <tbody>
          ${incidents
            .slice(0, 150)
            .map(
              (i, idx) => `
            <tr style="background: ${idx % 2 === 0 ? '#ffffff' : '#F5F7FA'};">
              <td style="padding: 4px; border: 1px solid #D9DDE3;">${escape(i.id)}</td>
              <td style="padding: 4px; border: 1px solid #D9DDE3;">${formatDateTime(i.datetime)}</td>
              <td style="padding: 4px; border: 1px solid #D9DDE3;">${escape(i.region)}</td>
              <td style="padding: 4px; border: 1px solid #D9DDE3;">${escape(i.objectName)}</td>
              <td style="padding: 4px; border: 1px solid #D9DDE3;">${UAV_LABEL[i.uavType]}</td>
              <td style="padding: 4px; border: 1px solid #D9DDE3;">${SEVERITY_LABEL[i.severity]}</td>
            </tr>
          `,
            )
            .join('')}
        </tbody>
      </table>
    `;
  }

  return html;
}
