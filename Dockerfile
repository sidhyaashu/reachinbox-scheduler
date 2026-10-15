# ==========================================
# Base Layer
# ==========================================
FROM node:22-alpine AS base
WORKDIR /app
RUN apk add --no-cache curl python3 make g++

# ==========================================
# Builder Stage
# ==========================================
FROM base AS builder
WORKDIR /app

# Copy package manifests across monorepo
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/database/package.json ./packages/database/
COPY packages/queue/package.json ./packages/queue/
COPY apps/api/package.json ./apps/api/
COPY apps/scheduler/package.json ./apps/scheduler/
COPY apps/worker/package.json ./apps/worker/
COPY apps/search/package.json ./apps/search/
COPY apps/gateway/package.json ./apps/gateway/
COPY apps/web/package.json ./apps/web/

# Install dependencies
RUN npm ci

# Copy TypeScript configs and source code
COPY tsconfig.base.json tsconfig.json ./
COPY packages/shared ./packages/shared
COPY packages/database ./packages/database
COPY packages/queue ./packages/queue
COPY apps/api ./apps/api
COPY apps/scheduler ./apps/scheduler
COPY apps/worker ./apps/worker
COPY apps/search ./apps/search
COPY apps/gateway ./apps/gateway
COPY apps/web ./apps/web

# Compile all packages and applications
RUN npm run build

# ==========================================
# Target: Migrator Runner
# ==========================================
FROM base AS migrator
WORKDIR /app
COPY --from=builder /app /app
CMD ["node", "packages/database/dist/bin/migrate.js"]

# ==========================================
# Target: Email API Service
# ==========================================
FROM base AS api
WORKDIR /app
COPY --from=builder /app /app
EXPOSE 4001
CMD ["node", "apps/api/dist/server.js"]

# ==========================================
# Target: Scheduler Service
# ==========================================
FROM base AS scheduler
WORKDIR /app
COPY --from=builder /app /app
EXPOSE 4002
CMD ["node", "apps/scheduler/dist/server.js"]

# ==========================================
# Target: Email Worker Service
# ==========================================
FROM base AS worker
WORKDIR /app
COPY --from=builder /app /app
EXPOSE 4003
CMD ["node", "apps/worker/dist/server.js"]

# ==========================================
# Target: Search Service
# ==========================================
FROM base AS search
WORKDIR /app
COPY --from=builder /app /app
EXPOSE 4004
CMD ["node", "apps/search/dist/server.js"]

# ==========================================
# Target: API Gateway
# ==========================================
FROM base AS gateway
WORKDIR /app
COPY --from=builder /app /app
EXPOSE 4000
CMD ["node", "apps/gateway/dist/server.js"]

# ==========================================
# Target: Next.js Web Frontend
# ==========================================
FROM base AS web
WORKDIR /app
COPY --from=builder /app /app
EXPOSE 3000
ENV NODE_ENV=production
CMD ["npm", "--workspace=@reachinbox/web", "run", "start"]

