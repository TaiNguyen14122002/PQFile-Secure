FROM node:22-alpine
RUN apk add --no-cache python3 make g++
WORKDIR /project
COPY package*.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/crypto-core/package.json packages/crypto-core/package.json
RUN npm install --no-audit --no-fund
COPY apps/api ./apps/api
COPY database ./database
COPY packages/crypto-core ./packages/crypto-core
RUN npm run build -w @pqfile/api
EXPOSE 4000
CMD ["sh", "-c", "npm run db:init -w @pqfile/api && node apps/api/dist/main.js"]
