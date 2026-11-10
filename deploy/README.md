# Run Airic Work with Compose

Copy `task.env.example` to `.env` in this directory. Set a random Bearer token of at least 32 characters and a 32-byte fingerprint key encoded as 64 hex characters. Keep the key with the Task data across restarts. Configure the model credentials and set `AIRIC_OM_REPOSITORY` to an absolute local Git path or a Git HTTPS/SSH URL.

Place `compose.yaml`, `up.sh`, and `.env` in the deployment directory. Run there as a non-root user with Docker access. If the GHCR package is private, sign in with `docker login ghcr.io` first.

```sh
bash ./up.sh pull
bash ./up.sh
```

Compose pulls `ghcr.io/airicdev/airic-work:task`. The main-branch workflow publishes
that tag and a commit-specific tag after tests and the image smoke check pass.
Set `AIRIC_IMAGE` in `.env` to pin a specific release tag or digest.

Open [Swagger UI](http://127.0.0.1:8080/docs/) and authorize with the configured Bearer token. Task data is stored in `deploy/data/` beside `compose.yaml` and mounted at `/var/lib/airic-work`. A local OM is mounted read-only at `/om`. A remote OM is cloned into the data directory. The source ID in Task requests is `local` for either form. The service is published on loopback at port 8080. The OM source in the sample configuration is named `local`.

For delegated calls, set `AIRIC_TASK_DELEGATION` to a JSON object with `bearerToken`, `callerId`, `issuer`, `audience`, `scope`, and `publicKeyPem`. Send the integration bearer and an Ed25519-signed JWT in `X-Airic-Actor-Assertion`. Claims are `iss`, `aud`, `sub`, `scope`, `iat`, and `exp`. The assertion can be valid for up to five minutes. The integration bearer and scope must differ from the direct operator's bearer and scope. A signed optional `grant` contains a single `taskId` and `action` (`read`, `answer`, `notify`, or `credential`). Grant access stays within the configured integration scope. The signer checks business access before issuing it. Answers retain the actual actor and caller, and answer uploads are scoped to the actor and Task.

Workspace commands use Docker Engine API 1.47 or newer. The trusted Worker uses the Docker socket to start command containers. Use `up.sh` for Compose commands, including `bash ./up.sh config --quiet`. The script derives the container UID/GID, the data and OM mount paths, and the group of the local Linux Docker socket. The socket path is fixed at `/var/run/docker.sock`. Those derived values do not need entries in `.env`. Commands run without network access, as a non-root user, with read-only `/om` and `/inputs` mounts and a persistent writable `/work` mount. Only the Worker service receives the Docker socket and the deployment credentials.

The Docker smoke check uses a separate, randomly named project with a disposable volume. It exercises documentation, authorization, uploads, Task persistence across container recreation, and the Workspace command container. A deterministic local model fixture verifies a no-MCP decision and answer, same-Session continuation, and immutable output download. These checks run without external model calls.

```sh
docker build -t airic-work:task .
python3 backend/tests/deploy/smoke.py
```

## Backup

Stop the service with `bash ./up.sh stop` before copying the deployment directory. Keep `.env` with the backup so the fingerprint key can decrypt stored credentials. Place a local OM checkout inside the deployment directory to include it in the same backup. An external checkout requires its own backup.

## Preview cutover

Run `npm run check` and the Docker smoke check, then verify both Swagger paths before switching the intended preview instance. Identify the old container and its data mount with `docker inspect`. Confirm that the mount is the preview instance's dedicated Airic Work volume and record its exact name. Stop and remove that container, then remove the identified preview volume. Start the Task Worker under its chosen Compose project with an empty `deploy/data/` directory and confirm `/healthz`, Swagger, and an authenticated Task request. The new instance uses its own Task token and fingerprint key.

## Acceptance record

- Chrome rendered all 15 Swagger operations. The no-MCP path uploaded an input, created a Task, answered its Decision Request, confirmed continuation in the original Session, and received the file download response.
- The CertLab path used a report-scoped link on an isolated local CertLab instance. The Swagger-created Task saved a draft, and the original receipt and assessment history matched in CertLab.
- A separate fault test discarded the response after CertLab accepted the draft. Airic Work recorded the unknown outcome, sent the write once, and recovered the receipt using the original report link and command ID.
- The Task process recovery test uses SQLite and Pi Durable and kills the Worker after the question is saved, after the answer is saved, and after Pi accepts the input but before delivery is marked. Reopening the Task preserves the original question, answer and input IDs and produces one continuation in the original Session.
- The automated contract tests validate successful requests and actual responses for all 15 OpenAPI operations. They also validate the published examples against the schemas.

These runs used a deterministic model fixture and a synthetic report. They validate runtime behavior. Evaluation quality requires an engineer to review a test report against its business criteria.
