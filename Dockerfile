# syntax=docker/dockerfile:1
ARG NODE_IMAGE=node:24.11.1-bookworm-slim@sha256:48abc13a19400ca3985071e287bd405a1d99306770eb81d61202fb6b65cf0b57
FROM ${NODE_IMAGE} AS frontend
WORKDIR /build/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --ignore-scripts
COPY frontend/ ./
ARG VITE_REFERENCE_TEMPLATES={}
ENV VITE_REFERENCE_TEMPLATES=${VITE_REFERENCE_TEMPLATES}
RUN npm run typecheck && npm run build

FROM ${NODE_IMAGE} AS dependencies
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
WORKDIR /build/backend
COPY backend/package.json backend/package-lock.json ./
# Native SQLite must be installed for the target Linux platform, not copied from macOS.
RUN npm ci --omit=dev

FROM ${NODE_IMAGE} AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates openssh-client && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production AIRIC_HOST=0.0.0.0 AIRIC_PORT=8010 AIRIC_DATA_DIR=/var/lib/airic-work
WORKDIR /app
COPY --from=dependencies /build/backend/node_modules ./backend/node_modules
COPY backend/package.json ./backend/package.json
COPY backend/src ./backend/src
COPY backend/scripts/grant-admin.ts ./backend/scripts/grant-admin.ts
COPY backend/skills ./backend/skills
COPY --from=frontend /build/frontend/dist ./frontend/dist
RUN mkdir -p /var/lib/airic-work && chown node:node /var/lib/airic-work && chmod 700 /var/lib/airic-work
USER node
EXPOSE 8010
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD ["node", "-e", "fetch('http://127.0.0.1:8010/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]
CMD ["node", "--import", "./backend/node_modules/tsx/dist/loader.mjs", "backend/src/bootstrap/serve.ts"]
