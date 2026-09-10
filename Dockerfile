FROM node:22-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production runtime stage
FROM node:22-slim

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080
ENV HOST=0.0.0.0
ENV BOT_CROSSING_HOST=0.0.0.0
ENV GCP_PROJECT_ID=submind-matrix
ENV ALLOWED_HOSTS=colony.dalesackrider.com,localhost,127.0.0.1

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY server ./server
COPY tools ./tools

EXPOSE 8080

CMD ["node", "server/serve.mjs"]
