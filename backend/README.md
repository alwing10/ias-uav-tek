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
| GET | `/health` | Health-check |
| GET | `/api/incidents` | Список инцидентов (фильтры: `from, to, region, severity, verified, limit, offset`) |
| GET | `/api/incidents/:id` | Карточка инцидента |
| POST | `/api/incidents` | Создать/обновить (upsert по `id`) |
| POST | `/api/incidents/:id/verify` | `{ status: verified\|rejected\|pending, verifiedBy }` |
| GET | `/api/stats/kpi` | Сводные показатели для дашборда |
| GET | `/api/audit` | Журнал аудита |
| POST | `/api/audit` | Добавить событие в журнал |

## Persistent storage

Файл БД: `data/ias.db`. На Render Free сбрасывается при редеплое (нет диска).
Для постоянного хранения:

- **Render Starter + Disk** ($7/мес) — добавьте `disk: { name: ias-data, mountPath: /app/data, sizeGB: 1 }` в `render.yaml`.
- **PostgreSQL** — замените `better-sqlite3` на `pg` и подключите Render PostgreSQL (есть бесплатный 90-дневный план).
