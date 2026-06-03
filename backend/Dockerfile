FROM node:20-alpine
WORKDIR /app

# Зависимости для better-sqlite3 (нативный модуль)
RUN apk add --no-cache python3 make g++

COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY src ./src

ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000

# Папка под БД (на Render Disk монтируется сюда)
VOLUME ["/app/data"]

CMD ["node", "src/index.js"]
