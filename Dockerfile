# syntax=docker/dockerfile:1
ARG NODE_IMAGE=node:24.11.1-bookworm-slim@sha256:48abc13a19400ca3985071e287bd405a1d99306770eb81d61202fb6b65cf0b57
FROM ${NODE_IMAGE} AS dependencies
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev

FROM ${NODE_IMAGE} AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates openssh-client && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=dependencies /app/backend/node_modules ./backend/node_modules
COPY backend/package.json ./backend/package.json
COPY backend/src ./backend/src
COPY backend/skills ./backend/skills
USER node
CMD ["node", "-e", "console.error('Task API and Worker are not implemented'); process.exit(1)"]
