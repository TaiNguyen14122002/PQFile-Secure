FROM node:22-alpine AS builder
WORKDIR /project
COPY package*.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/crypto-core/package.json packages/crypto-core/package.json
RUN npm install --no-audit --no-fund
COPY apps/web ./apps/web
COPY packages/crypto-core ./packages/crypto-core
RUN npm run build -w @pqfile/web
FROM node:22-alpine
WORKDIR /app
COPY --from=builder /project/apps/web/.output ./.output
ENV HOST=0.0.0.0 PORT=3000
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
