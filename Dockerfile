# ── Stage 1: Build client ─────────────────────────────────────────────
FROM node:20-alpine AS client-build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# ── Stage 2: Build server ─────────────────────────────────────────────
FROM node:20-alpine AS server-build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig*.json nest-cli.json ./
COPY src/ ./src/
RUN npm run build

# ── Stage 3: Production ──────────────────────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app

# Install production deps only
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy built server
COPY --from=server-build /app/dist ./dist

# Copy built client
COPY --from=client-build /app/client/dist ./client/dist

# Create uploads directory
RUN mkdir -p uploads

# Don't run as root
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup && \
    chown -R appuser:appgroup /app
USER appuser

EXPOSE 3000

CMD ["node", "dist/main"]
