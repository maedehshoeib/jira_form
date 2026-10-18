FROM node:20-alpine AS deps

WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

FROM node:20-alpine AS builder

WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY frontend/package.json frontend/package-lock.json frontend/tsconfig.json frontend/next.config.ts frontend/next-env.d.ts frontend/postcss.config.js frontend/tailwind.config.js ./
COPY frontend/src ./src
COPY frontend/public ./public

ARG BACKEND_URL=http://backend:8000
ENV BACKEND_URL=${BACKEND_URL}
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN npm run build \
    && find .next-prod -name '*.map' -delete \
    && rm -rf .next-prod/cache src

FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next-prod/standalone ./
COPY --from=builder /app/.next-prod/static ./.next-prod/static

RUN if [ -d /app/.next-prod ]; then find /app/.next-prod -name '*.map' -delete; fi \
    && rm -rf /app/src /app/.next-prod/cache

EXPOSE 3000

CMD ["node", "server.js"]
