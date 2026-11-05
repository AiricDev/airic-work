# Local CertLab and Airic Work development

The local development worker uses real Pi Durable, the configured model and CertLab MCP. It automatically admits new Executions after their MCP credentials are connected, delivers durable Decision Request answers and Steering Input, and reopens the original Session after restart. It is a development host bound to `127.0.0.1`, not the production Workspace implementation. Chat attachments and file/shell tools are unavailable; register assessment materials in CertLab instead.

## Configuration

Airic Work reads its root `.env`. Use an independent `AIRIC_DATA_DIR`, the local `certlab-om` Git source, `AIRIC_MODEL_PROVIDER=deepseek`, `AIRIC_MODEL_ID=deepseek-flash` and your API key. Keep the generated 64-character hex `AIRIC_MCP_ENCRYPTION_KEY` stable.

The local CertLab API is `https://127.0.0.1:8443`. Identity uses `/api/v1/auth/me`, subject `actor_id` and name `display_name`. The `certlab` MCP connection uses `/mcp` and `/api/v1/auth/mcp-link`. Trust the local certificate via `AIRIC_IDENTITY_CA_FILE`; the development worker also adds this CA to Node's default trust for MCP. Certificate verification remains enabled.

Airic Work HTTP origins must include both `http://127.0.0.1:5180` and `http://127.0.0.1:5217`; local HTTP needs `AIRIC_HTTP_SECURE_COOKIES=false`. Set `AIRIC_API_TARGET=http://127.0.0.1:8010` for its Vite proxy.

CertLab root `.env` sets `CERTLAB_API_TARGET=https://127.0.0.1:8443`, `CERTLAB_API_CA_FILE` to the same certificate, `CERTLAB_AIRIC_API_TARGET=http://127.0.0.1:8010`, `VITE_AIRIC_WORK_URL=http://127.0.0.1:5217` and `CERTLAB_ORGANIZATION_ID=certlab-test`.

## Start

Run each command in a separate terminal. The paths below describe the local development setup; the CertLab database is independent of the original `certlab/data/db.sqlite3` and of the server deployment.

```sh
cd /Users/leric/code/certlab
CERTLAB_GITHUB_CLIENT_SECRET= CERTLAB_GITHUB_CLIENT_ID= \
CERTLAB_DATA_DIR=/Users/leric/code/certlab/data/airic-local-dev \
uv run --env-file .env uvicorn certlab.infrastructure.asgi:application \
  --host 127.0.0.1 --port 8443 \
  --ssl-certfile /Users/leric/code/airic-work/.airic-data/local-integration/certlab-cert.pem \
  --ssl-keyfile /Users/leric/code/airic-work/.airic-data/local-integration/certlab-key.pem \
  --no-access-log
```

```sh
cd /Users/leric/code/certlab
npm --prefix frontend run dev -- --host 127.0.0.1 --port 5180 --strictPort
```

```sh
cd /Users/leric/code/airic-work
npm --prefix backend run dev:worker
```

```sh
cd /Users/leric/code/airic-work
npm --prefix frontend run dev -- --host 127.0.0.1 --port 5217 --strictPort
```

Open CertLab at `http://127.0.0.1:5180`. The synthetic engineer account is `certlab_engineer` / `certlab-dev`; the independent synthetic report is named `Synthetic Report A`. From its assessment workbench, create an Agent task. The existing CertLab frontend proxy creates the Execution, connects MCP credentials and opens an Airic Work browser session. Open Airic Work at `http://127.0.0.1:5217` to inspect progress and respond to Decision Requests. Use `127.0.0.1` consistently so the host-scoped development session cookie is shared.

Only the local database is modified. The worker starts real model requests and can write to the connected CertLab under the user's actual business permissions. Each Execution fixes the OM Git SHA and Worker Skill; changing the source tree does not update an existing Execution. New OM experiments need a committed version and a new Execution. After Airic Work code changes, restart the worker; its durable inputs and Pi Session remain in the configured data directory.

An error pauses the affected Execution instead of blindly retrying the same queued work. A new input or a worker restart allows another attempt after the underlying issue is fixed. The console reports Execution IDs and error codes; full model and tool outcomes are available through the Execution trajectory. Local materials and credentials stay out of version control.

## Observed local validation — 2026-11-05

The local CertLab database was created fresh and seeded with synthetic data because the original development database predates a migration that explicitly rejects existing assessments. The original database and its attempted migration copy were retained. Server CertLab data was not used.

Using DeepSeek `deepseek-flash`, Pi Durable 1.4.0, Worker 0.2.1 and OM commit `3d5dee7475ba08418ec4e3d96052fb5ac604fe74`:

- CertLab browser task creation, local API proxy, MCP credential connection and browser-session handoff worked.
- The Agent read the fixed report-evaluation OM and §9.6.3 Decision, discovered tools, and called real `integration.info`, `report.context` and `assessment.context`.
- A persisted supply-relationship Decision Request was answered in the Airic Work webpage with an explicitly synthetic partial answer. The development host consumed the answer automatically and resumed Conversation 77 in the original Session; it did not restart the report.
- The model initially omitted required `report_id`, then invented `capability_id`/`input` fields during attempted repair. CertLab rejected four writes without changing the assessment. The model misread the validation path `field=input` as a required envelope and raised an unnecessary approval/technical-help Decision Request. These are unresolved execution-quality findings, not evidence of an interface change.
- A second webpage answer supplied the published flat argument contract. The same Session resumed Conversation 159, saved one partial English Note/rationale, and read back `record_no=1`, status `draft`. Overall Conformity and Risk ranking remained empty, only one assessment changed, and no submission, confirmation, Finding or Test Task occurred. The synthetic attribution and outstanding unknowns were retained.
- `npm run check`: typecheck and all 331 backend tests passed. These tests do not themselves establish professional judgment quality.

Execution: `01a1ac37-65fd-71bf-b0f3-43a85effbd5a`; Session: `01a1ac37-65fd-71bf-b0f3-44ae59d38298`. Local raw observations and assertions are in the ignored `.qa-artifacts/local-dev-20261105/` directory. This is an assisted integration baseline, not acceptance of autonomous assessment, production scheduling, attachments, crash recovery or all DR ordering cases.
