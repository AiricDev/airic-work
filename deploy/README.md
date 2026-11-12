# Run Airic Work with Compose

Copy `task.env.example` to `.env` in this directory. Set `AIRIC_SECRET_KEY` to a random Bearer token of at least 32 characters. Configure the model credentials and set `AIRIC_OM_REPOSITORY` to the absolute path of an existing local Git repository on the host.

Place `compose.yaml` and `.env` in the deployment directory. Run there as a
non-root user with Docker access. Prepare the directories before starting:

```sh
cp task.env.example .env
mkdir -p -m 700 data
id -u
id -g
# Linux Docker socket group. On Docker Desktop use 0.
stat -c %g /var/run/docker.sock
pwd -P
```

Fill in `AIRIC_DEPLOY_UID`, `AIRIC_DEPLOY_GID`, and
`AIRIC_DOCKER_SOCKET_GID` from those results. Set `AIRIC_DEPLOY_DATA` to the
absolute path of `data/` in this deployment directory. It must identify the
same host directory for the Worker and its command containers. The user
identified by UID/GID must own `data/`.

Compose mounts the repository from `AIRIC_OM_REPOSITORY` read-only at
`/om`. Prepare and update the checkout outside Airic Work. Restart the service
after updating its local HEAD to use that commit for new Tasks. Each existing
Task keeps the OM revision pinned at creation.

If the GHCR package is private, sign in with `docker login ghcr.io` first.

```sh
docker compose config --quiet
docker compose pull
docker compose up -d --wait
```

Compose defaults to `ghcr.io/airicdev/airic-work:task`. When upgrading a
preview deployment, remove any `AIRIC_IMAGE` override pointing to `:preview`,
or replace it with the Task image. Set `AIRIC_IMAGE` in `.env` to pin a
specific Task release tag or digest. The main-branch workflow publishes
images after tests and the image smoke check pass.

Open [Swagger UI](http://127.0.0.1:8080/docs/) and authorize with the configured Bearer token. Task data is stored in `deploy/data/` beside `compose.yaml` and mounted at `/var/lib/airic-work`. The service is published on loopback at port 8080. The OM source is named `local`.

Use `AIRIC_SECRET_KEY` as the API Bearer token over HTTPS. It grants access to every Task in the instance. CertLab authorizes its users and supplies `X-Airic-Actor-Id` for attribution. For Task-bound reads, answers, credential updates and notifications it also supplies `X-Airic-Task-Id` and `X-Airic-Task-Action` to identify the target operation.

Workspace commands use Docker Engine API 1.47 or newer. The trusted Worker uses the Docker socket to start command containers. Configure the host paths and permissions in `.env` as described above. The Docker socket path is fixed at `/var/run/docker.sock`. Commands run without network access, as a non-root user, with read-only `/om` and `/inputs` mounts and a persistent writable `/work` mount. Only the Worker service receives the Docker socket and the deployment credentials.

The Docker smoke check uses a separate, randomly named project with temporary local directories. It exercises documentation, authorization, uploads, Task persistence across container recreation, and the Workspace command container. A deterministic local model fixture verifies a no-MCP decision and answer, same-Session continuation, and immutable output download. These checks run without external model calls.

```sh
docker build -t airic-work:task .
python3 backend/tests/deploy/smoke.py
```

To verify the CertLab integration, install the backend Node dependencies with
`npm ci --prefix backend` and install CertLab's development dependencies with
`uv sync --extra dev` in its checkout. From the Airic Work repository, run:

```sh
python3 backend/tests/deploy/smoke.py --certlab ../certlab
```

This mode starts both services locally with disposable data, a temporary TLS
certificate and one generated `AIRIC_SECRET_KEY`. It uses a deterministic model
and verifies Task creation, a reviewer's answer resuming the same Session,
MCP fieldwork creation and delivery of CertLab's completion notification.
It requires Node 24, Git and OpenSSL. The existing Docker smoke remains the
default when no CertLab checkout is supplied.

## Backup

Stop the service with `docker compose stop` before copying the deployment directory. Restrict access to the deployment directory and its backups. They contain the API secret and stored MCP credentials. Place a local OM checkout inside the deployment directory to include it in the same backup. An external checkout requires its own backup.

## Preview cutover

Run `npm run check` and the Docker smoke check, then verify both Swagger paths before switching the intended preview instance. Identify the old container and its data mount with `docker inspect`. Confirm that the mount is the preview instance's dedicated Airic Work volume and record its exact name. Stop and remove that container, then remove the identified preview volume. Start the Task Worker under its chosen Compose project with an empty `deploy/data/` directory and confirm `/healthz`, Swagger, and an authenticated Task request. The new instance uses its own API secret.

## Acceptance record

- Chrome rendered all 15 Swagger operations. The no-MCP path uploaded an input, created a Task, answered its Decision Request, confirmed continuation in the original Session, and received the file download response.
- The CertLab path used a report-scoped link on an isolated local CertLab instance. The Swagger-created Task saved a draft, and the original receipt and assessment history matched in CertLab.
- A separate fault test discarded the response after CertLab accepted the draft. Airic Work recorded the unknown outcome, sent the write once, and recovered the receipt using the original report link and command ID.
- The Task process recovery test uses SQLite and Pi Durable and kills the Worker after the question is saved, after the answer is saved, and after Pi accepts the input but before delivery is marked. Reopening the Task preserves the original question, answer and input IDs and produces one continuation in the original Session.
- The automated contract tests validate successful requests and actual responses for all 15 OpenAPI operations. They also validate the published examples against the schemas.

These runs used a deterministic model fixture and a synthetic report. They validate runtime behavior. Evaluation quality requires an engineer to review a test report against its business criteria.
