# Backend ИАС — Express + SQLite

REST API для прототипа ИАС мониторинга инцидентов с применением БПЛА в отношении
объектов ТЭК. Хранит инциденты, верификации и журнал аудита в SQLite.

## Стек

- **Node.js 20 LTS** (жёстко пинится через `.nvmrc`, `.node-version`,
  `NODE_VERSION=20.18.1` в `render.yaml`, `engines.node="20.x"` в `package.json`).
  Это важно: на Node 26+ нативный модуль `better-sqlite3 11.x` не собирается
  из-за изменений V8 API.
- Express 4
- SQLite (better-sqlite3) — встроенная файловая БД, **без отдельного сервера**
- CORS открыт (для GitHub Pages)
- Health-check `/health` для Render / Docker

## Локальный запуск

```bash
cd backend
npm install
npm start
# → http://localhost:4000/health
# → http://localhost:4000/api/incidents
```

При первом запуске БД засевается ~200 инцидентами (`seed.js`).

## Docker

```bash
cd backend
docker build -t ias-backend .
docker run -p 4000:4000 -v ias-data:/app/data ias-backend
```

## Деплой на Render.com (бесплатно)

1. Зарегистрируйтесь на https://render.com (можно через GitHub).
2. **New + → Blueprint** → выберите репозиторий `ias-uav-tek` → ветка `main`.
3. Render найдёт `backend/render.yaml` и создаст Web Service автоматически.
4. Через ~3 минуты получите URL вида `https://ias-uav-tek-backend.onrender.com`.
5. Проверьте: откройте `<URL>/health` → должен ответить JSON `{ "status": "ok", ... }`.

> Бесплатный план Render усыпляет сервис после 15 мин неактивности. Первый запрос
> после простоя ~50 сек на запуск. Для постоянной работы — Render Starter ($7/мес)
> или альтернативно **fly.io**, **Railway** (тоже бесплатные).

После деплоя — добавьте URL во фронт:

- **Локально:** создайте `.env` в корне проекта (рядом с `package.json`):
  ```
  VITE_API_URL=https://ias-uav-tek-backend.onrender.com
  ```
- **GitHub Pages:** в `Settings → Secrets and variables → Actions → Variables`
  добавьте переменную `VITE_API_URL` со значением URL. Workflow её подхватит.

## REST API

| Метод | Путь | Описание |
|---|---|---|
| GET | `/health` | Health-check + статус последнего цикла сбора |
| GET | `/api/incidents` | Список инцидентов (фильтры: `from, to, region, severity, verified, limit, offset`) |
| GET | `/api/incidents/:id` | Карточка инцидента |
| POST | `/api/incidents` | Создать/обновить (upsert по `id`) |
| POST | `/api/incidents/:id/verify` | `{ status: verified\|rejected\|pending, verifiedBy }` |
| GET | `/api/stats/kpi` | Сводные показатели для дашборда |
| GET | `/api/audit` | Журнал аудита |
| POST | `/api/audit` | Добавить событие в журнал |
| POST | `/api/scrape/run` | Запустить сбор всех источников вручную |
| GET | `/api/scrape/status` | Время последнего цикла + статистика |
| GET | `/api/subscriptions` | Список подписок |
| POST | `/api/subscriptions` | Создать/обновить подписку `{ email, regions[], severities[] }` |
| DELETE | `/api/subscriptions/:email` | Удалить подписку |
| POST | `/api/subscriptions/:email/test` | Отправить тестовое письмо |

## Сбор реальных данных (scrapers)

При старте сервера и далее **каждые 5 минут** (`node-cron`) запускается
координатор `src/scrapers/index.js`. Он обходит источники, парсит сырой
текст и через `src/parser.js` превращает каждый match в `Incident`.

**Источники:**

| Источник | Файл | Что даёт |
|---|---|---|
| `bplarussia.ru` | `scrapers/bplarussia.js` | HTML-страницы по 14 приграничным регионам РФ. Cheerio парсит карточки событий. ID начинается с `BPL-` |
| RSS Минобороны | `scrapers/rss.js` | `mil.ru/rss_feed/news.htm` — официальные сводки. ID `MIL-` |
| RSS МЧС | `scrapers/rss.js` | `mchs.gov.ru/rss/news.xml` — оперативные сводки. ID `MCHS-` |
| RSS РИА | `scrapers/rss.js` | `ria.ru/export/rss2/index.xml`. ID `RIA-` |
| RSS ТАСС | `scrapers/rss.js` | `tass.ru/rss/v2.xml`. ID `TASS-` |
| RSS Lenta | `scrapers/rss.js` | `lenta.ru/rss/news`. ID `LENTA-` |
| RSS РБК | `scrapers/rss.js` | `rssexport.rbc.ru/rbcnews/news/30/full.rss`. ID `RBC-` |

**Дедупликация:** ID инцидента = `{prefix}-{sha1(url)[:8]}`. Если та же
новость придёт повторно — `INSERT OR REPLACE` без побочных эффектов.

**Фильтрация по релевантности:** RSS прогоняется через регэксп
`/бпла|беспилотн|дрон|fpv|шахед|нпз|нефтебаз|.../i`. Нерелевантное сразу
отбрасывается без CPU на парсинг.

**Распознавание сущностей** (`parser.js`):
- Регион — по корню названия в тексте (на bplarussia overrideится URL)
- Тип объекта ТЭК — 9 категорий через регулярки
- Тип БПЛА — 5 категорий + unknown
- Тяжесть — по ключевым словам (пожар/взрыв → critical, сбит → low)

## Email-уведомления

Каждый новый инцидент после успешного `upsertIncident` проходит через
`notifyNewIncident()`:

1. Берём все активные подписки (таблица `subscriptions`)
2. Фильтруем по совпадению регион + тяжесть
3. Для каждой подходящей подписки отправляем письмо через `Nodemailer`
4. Записываем в `notification_log` с UNIQUE(incident_id, email) — никаких дублей

**Настройка SMTP:**

| Provider | ENV переменные |
|---|---|
| **Resend** (рекомендую — 100/день бесплатно) | `SMTP_HOST=smtp.resend.com SMTP_PORT=465 SMTP_USER=resend SMTP_PASS=re_xxx... SMTP_FROM="ИАС <alerts@yourdomain.com>"` |
| **Gmail** (500/день, нужен App Password) | `SMTP_HOST=smtp.gmail.com SMTP_PORT=465 SMTP_USER=you@gmail.com SMTP_PASS=xxxx_xxxx_xxxx_xxxx` |
| **Mailgun** | `SMTP_HOST=smtp.mailgun.org SMTP_PORT=587 SMTP_USER=... SMTP_PASS=...` |
| **Brevo** (300/день) | `SMTP_HOST=smtp-relay.brevo.com SMTP_PORT=587 SMTP_USER=login@brevo.com SMTP_PASS=...` |

> Если `SMTP_HOST` не задан — backend автоматически создаёт **Ethereal**
> аккаунт (`smtp.ethereal.email`). Письма «уходят» в фейковый ящик, но
> в логах backend появляется **preview URL** — переходите по нему и
> видите как письмо выглядит. Удобно для отладки без настоящего SMTP.

`FRONTEND_URL` — URL вашего GitHub Pages (`https://<user>.github.io/ias-uav-tek`).
Используется в письме для ссылки «Открыть карточку в ИАС →».

Добавьте эти переменные на Render: `Dashboard → ваш сервис → Environment → Add`.

## Persistent storage

Файл БД: `data/ias.db`. На Render Free сбрасывается при редеплое (нет диска).
Для постоянного хранения:

- **Render Starter + Disk** ($7/мес) — добавьте `disk: { name: ias-data, mountPath: /app/data, sizeGB: 1 }` в `render.yaml`.
- **PostgreSQL** — замените `better-sqlite3` на `pg` и подключите Render PostgreSQL (есть бесплатный 90-дневный план).
