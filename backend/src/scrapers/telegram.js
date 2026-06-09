// Парсер публичных Telegram-каналов через t.me/s/<username>.
//
// t.me/s/<channel> — это «web-preview» канала: HTML-страница с последними
// 20 сообщениями, БЕЗ авторизации, БЕЗ бота, БЕЗ ключей. Доступна для
// любого публичного канала. Это легальный публичный интерфейс Telegram.
//
// Главная ценность: оперативные сообщения от региональных новостников
// (Mash, Baza, ASTRA, региональные каналы) попадают сюда быстрее, чем
// в крупные RSS — часто за минуты до публикации в СМИ.

import * as cheerio from 'cheerio';
import { parseToIncident } from '../parser.js';

const CHANNELS = [
  { name: 'Mash', user: 'mash' },
  { name: 'Baza', user: 'bazabazon' },
  { name: 'SHOT', user: 'shot_shot' },
  { name: 'ASTRA', user: 'astrapress' },
  { name: 'Readovka', user: 'readovkanews' },
  { name: 'Mash на Мойке', user: 'mash_na_moike' },
  { name: 'Кубанские новости', user: 'kubantoday' },
  { name: 'Белгород', user: 'belgorod_inform' },
  { name: 'Курск №1', user: 'tipich_kursk' },
  { name: 'Воронеж', user: 'voronezhsegodnya' },
  { name: 'Ростов главное', user: 'rostovgazeta' },
  { name: 'Брянск', user: 'bryansk_one' },
  { name: 'РИА Крым', user: 'rian_crimea' },
  { name: 'Татарстан-24', user: 'tatarstan24' },
  { name: 'Минобороны', user: 'mod_russia' },
];

const USER_AGENT =
  'Mozilla/5.0 (compatible; IAS-UAV-TEK-Bot/1.0; academic research; +https://github.com/alwing10/ias-uav-tek)';

async function fetchChannelHtml(username) {
  const url = `https://t.me/s/${username}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'ru-RU,ru;q=0.9' },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return { html: await res.text(), channelUrl: url };
}

function parseMessages(html, channelUrl) {
  const $ = cheerio.load(html);
  const messages = [];

  $('.tgme_widget_message').each((_i, el) => {
    const $el = $(el);
    const text = $el.find('.tgme_widget_message_text').text().trim();
    if (!text || text.length < 20) return;

    const link = $el.find('.tgme_widget_message_date').attr('href');
    const time = $el.find('.tgme_widget_message_date time').attr('datetime');

    messages.push({
      text,
      url: link || channelUrl,
      publishedAt: time || new Date().toISOString(),
    });
  });

  return messages;
}

export async function scrapeTelegram() {
  const incidents = [];
  const errors = [];
  let totalMessages = 0;

  // Параллельно опрашиваем все каналы
  const results = await Promise.allSettled(
    CHANNELS.map(async (ch) => {
      const { html, channelUrl } = await fetchChannelHtml(ch.user);
      const messages = parseMessages(html, channelUrl);
      let added = 0;
      for (const m of messages) {
        // Используем первые 200 символов как заголовок
        const title = m.text.length > 200 ? m.text.slice(0, 197) + '…' : m.text;
        const inc = parseToIncident({
          title,
          description: m.text.slice(0, 600),
          publishedAt: m.publishedAt,
          url: m.url,
          sourceName: `Telegram · ${ch.name}`,
          sourcePrefix: 'TG',
        });
        if (inc) {
          incidents.push(inc);
          added += 1;
        }
      }
      return { channel: ch.name, total: messages.length, added };
    }),
  );

  let ok = 0;
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.status === 'fulfilled') {
      ok += 1;
      totalMessages += r.value.total;
      if (r.value.added > 0) {
        console.log(`[telegram] ${r.value.channel}: ${r.value.total} сообщений, ${r.value.added} релевантных`);
      }
    } else {
      errors.push(`${CHANNELS[i].user}: ${r.reason?.message || r.reason}`);
    }
  }

  console.log(
    `[telegram] собрано ${incidents.length} инцидентов из ${totalMessages} сообщений (${ok}/${CHANNELS.length} каналов), ошибок: ${errors.length}`,
  );
  if (errors.length) console.log(`[telegram] ошибки: ${errors.slice(0, 3).join(' | ')}`);
  return incidents;
}
