FROM node:24-alpine AS deps
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package*.json ./
RUN npm ci

FROM node:24-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV DATABASE_PATH=:memory:
RUN npm run build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV DATABASE_PATH=/data/chat.db

RUN mkdir -p /data

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/SPEC.md ./SPEC.md
# Drizzle migration SQL files — required by migrate() at server startup
COPY --from=builder /app/drizzle ./drizzle

# Job schedulati (bank-sync, snapshot, market-refresh — vedi docker/crontab):
# girano via ts-node, quindi servono i sorgenti TS e le devDependencies
# (ts-node, typescript, tsconfig-paths), assenti nello standalone output di
# Next.js. Il node_modules "full" del builder (con devDependencies) sovrascrive
# quello trimmed dello standalone: è un superset compatibile, non rompe il
# server (stessa install, stesso lockfile).
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/src ./src
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/package.json ./package.json

COPY docker/crontab ./docker/crontab
COPY docker/entrypoint.sh ./entrypoint.sh
RUN cp ./docker/crontab /etc/crontabs/root && chmod +x ./entrypoint.sh

VOLUME /data
EXPOSE 3000

CMD ["./entrypoint.sh"]
