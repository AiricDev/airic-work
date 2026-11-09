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
COPY docs/openapi.yaml ./docs/openapi.yaml
RUN install -d -m 0700 -o node -g node /var/lib/airic-work
ENV AIRIC_TASK_HOST=0.0.0.0 AIRIC_TASK_PORT=8080 AIRIC_TASK_DATA=/var/lib/airic-work AIRIC_DATA_DIR=/var/lib/airic-work
USER node
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s CMD ["node", "-e", "fetch('http://127.0.0.1:' + process.env.AIRIC_TASK_PORT + '/healthz').then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))"]
CMD ["npm", "--prefix", "backend", "run", "task:http"]
