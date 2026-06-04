// Отправка email-уведомлений о новых инцидентах подписчикам.
//
// SMTP-конфигурация берётся из env:
//   SMTP_HOST    — например, smtp.gmail.com / smtp.resend.com / smtp.mailgun.org
//   SMTP_PORT    — 465 (SSL) / 587 (TLS)
//   SMTP_USER    — логин (часто email или "resend"/"apikey")
//   SMTP_PASS    — пароль / app password / api key
//   SMTP_FROM    — отправитель, например '"ИАС БПЛА" <alerts@example.com>'
//
// Если SMTP_HOST не задан — используется Ethereal (тестовый SMTP без регистрации).
// Письма не доходят до реального адресата, но Nodemailer возвращает превью URL,
// который выводится в логи backend. Это удобно для отладки.

import nodemailer from 'nodemailer';
import {
  getActiveSubscriptionsFor,
  logNotification,
  wasNotified,
} from './db.js';

let transporter = null;
let etherealAccount = null;

const SEVERITY_LABEL = {
  low: 'Низкая',
  medium: 'Средняя',
  high: 'Высокая',
  critical: 'КРИТИЧЕСКАЯ',
};

const SEVERITY_COLOR = {
  low: '#388E3C',
  medium: '#FBC02D',
  high: '#F57C00',
  critical: '#D32F2F',
};

async function getTransporter() {
  if (transporter) return transporter;

  if (process.env.SMTP_HOST) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    });
    console.log(`[notify] SMTP настроен: ${process.env.SMTP_HOST}`);
    return transporter;
  }

  // Fallback: тестовый аккаунт Ethereal (без регистрации, без лимитов)
  console.log('[notify] SMTP_HOST не задан — использую Ethereal (тестовый SMTP, письма не доходят, но видны через preview URL)');
  etherealAccount = await nodemailer.createTestAccount();
  transporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: { user: etherealAccount.user, pass: etherealAccount.pass },
  });
  console.log(`[notify] Ethereal account: ${etherealAccount.user}`);
  return transporter;
}

function buildEmailHtml(incident, frontendUrl) {
  const sevColor = SEVERITY_COLOR[incident.severity] || '#666';
  const sevLabel = SEVERITY_LABEL[incident.severity] || incident.severity;
  const date = new Date(incident.datetime).toLocaleString('ru-RU');
  const cardUrl = frontendUrl ? `${frontendUrl}#/incidents/${incident.id}` : null;
  const source = incident.sources?.[0];

  return `
<!doctype html>
<html lang="ru">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#f5f7fa;font-family:'Inter','Segoe UI',Arial,sans-serif;color:#222b36;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f5f7fa;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="background:#fff;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,.08);overflow:hidden;">
        <tr><td style="background:#1E4D8B;padding:16px 24px;color:#fff;">
          <div style="font-size:11px;letter-spacing:.1em;text-transform:uppercase;opacity:.8;">ИАС мониторинга БПЛА · ТЭК</div>
          <div style="font-size:18px;font-weight:700;margin-top:4px;">Новый инцидент: ${escape(incident.id)}</div>
        </td></tr>
        <tr><td style="padding:24px;">
          <div style="display:inline-block;background:${sevColor}22;color:${sevColor};padding:4px 12px;border-radius:999px;font-size:11px;font-weight:700;text-transform:uppercase;">${sevLabel} тяжесть</div>
          <h2 style="font-size:16px;margin:16px 0 8px;color:#1E4D8B;">${escape(incident.objectName)}</h2>
          <div style="color:#6B7280;font-size:13px;margin-bottom:16px;">${escape(incident.region)} · ${date}</div>
          <p style="font-size:14px;line-height:1.55;margin:0 0 16px;">${escape(incident.description)}</p>
          <table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;font-size:12px;width:100%;margin-bottom:16px;">
            <tr><td style="padding:6px 0;color:#6B7280;width:140px;">Тип объекта</td><td style="padding:6px 0;">${escape(incident.objectType)}</td></tr>
            <tr><td style="padding:6px 0;color:#6B7280;">Категория</td><td style="padding:6px 0;">${incident.objectCategory}</td></tr>
            <tr><td style="padding:6px 0;color:#6B7280;">Тип БПЛА</td><td style="padding:6px 0;">${escape(incident.uavType)}</td></tr>
            <tr><td style="padding:6px 0;color:#6B7280;">Ущерб</td><td style="padding:6px 0;">${incident.damage}/10</td></tr>
            <tr><td style="padding:6px 0;color:#6B7280;">Статус</td><td style="padding:6px 0;">${escape(incident.status)}</td></tr>
            ${source ? `<tr><td style="padding:6px 0;color:#6B7280;">Источник</td><td style="padding:6px 0;"><a href="${escape(source.url || '#')}" style="color:#1E4D8B;">${escape(source.name)}</a></td></tr>` : ''}
          </table>
          ${cardUrl ? `<a href="${escape(cardUrl)}" style="display:inline-block;background:#1E4D8B;color:#fff;text-decoration:none;padding:10px 20px;border-radius:6px;font-size:13px;font-weight:600;">Открыть карточку в ИАС →</a>` : ''}
        </td></tr>
        <tr><td style="background:#f5f7fa;padding:16px 24px;font-size:11px;color:#6B7280;">
          Вы получили это письмо, потому что подписались на инциденты в регионе
          «${escape(incident.region)}» с тяжестью «${sevLabel}».
          <br>Отписаться: ответьте на письмо или удалите подписку на странице «Подписки» в ИАС.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function escape(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

/**
 * Главная функция: при появлении нового инцидента находим подходящих
 * подписчиков и отправляем email каждому.
 */
export async function notifyNewIncident(incident) {
  const subs = getActiveSubscriptionsFor(incident);
  if (subs.length === 0) return { sent: 0, total: 0 };

  const t = await getTransporter();
  const from = process.env.SMTP_FROM || '"ИАС мониторинга БПЛА" <alerts@ias.local>';
  const frontendUrl = process.env.FRONTEND_URL || '';

  let sent = 0;
  for (const sub of subs) {
    // Идемпотентность — не шлём дубли
    if (wasNotified(incident.id, sub.email)) continue;

    try {
      const info = await t.sendMail({
        from,
        to: sub.email,
        subject: `🚨 ${SEVERITY_LABEL[incident.severity]} инцидент в регионе ${incident.region}: ${incident.objectName}`,
        html: buildEmailHtml(incident, frontendUrl),
        text: `Новый инцидент ИАС: ${incident.id}\n${incident.objectName}\n${incident.region}\n${incident.description}\nОткрыть: ${frontendUrl}#/incidents/${incident.id}`,
      });
      logNotification(incident.id, sub.email, 'sent', info.messageId);
      sent += 1;

      // Если используется Ethereal — печатаем preview URL в логи
      const preview = nodemailer.getTestMessageUrl(info);
      if (preview) console.log(`[notify] preview ${sub.email}: ${preview}`);
    } catch (e) {
      console.error(`[notify] не отправлено ${sub.email}:`, e.message);
      logNotification(incident.id, sub.email, 'error', null, e.message);
    }
  }
  console.log(`[notify] инцидент ${incident.id}: отправлено ${sent}/${subs.length}`);
  return { sent, total: subs.length };
}

/** Для эндпоинта /api/subscriptions/test — отправить тестовое письмо */
export async function sendTestEmail(toEmail) {
  const t = await getTransporter();
  const from = process.env.SMTP_FROM || '"ИАС мониторинга БПЛА" <alerts@ias.local>';
  const info = await t.sendMail({
    from,
    to: toEmail,
    subject: '✅ Тестовое уведомление ИАС',
    text: 'Это тестовое письмо подтверждает, что подписка работает. Спасибо!',
    html: `<p>Это тестовое письмо от ИАС мониторинга БПЛА (ТЭК). Подписка работает.</p>
           <p style="color:#6B7280;font-size:12px;">SMTP: ${process.env.SMTP_HOST ?? 'Ethereal (тестовый)'}</p>`,
  });
  const preview = nodemailer.getTestMessageUrl(info);
  return { messageId: info.messageId, preview: preview || null };
}
