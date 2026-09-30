# 서버와 배치가 같은 이미지를 쓴다 (docs/05-백엔드아키텍처.md).
#   서버: 인자 없이 실행 → HTTP 리스너
#   배치: args=["jobs/gmail-watch-renewal"] → 해당 잡 1회 실행 후 종료

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
# prisma generate가 postinstall에서 돌 수 있도록 schema를 먼저 복사한다.
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev && npx prisma generate && npm cache clean --force

COPY --from=build /app/dist ./dist

# Cloud Run은 PORT를 주입한다. 기본값은 컨테이너를 직접 돌릴 때만 쓰인다.
ENV PORT=8080
EXPOSE 8080

# 루트로 돌리지 않는다.
USER node

ENTRYPOINT ["node", "dist/main.js"]
