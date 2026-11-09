# Airic Work

Airic Work is a headless Operating Model (OM) worker. A client creates a Task with an instruction, an OM reference, and any optional materials or MCP connections. The worker pins the OM version and carries out the work in a durable Session.

When the worker needs human input, it creates a Decision Request with the question, evidence, and the work that depends on the answer. Independent work can continue. A person can answer through the API, and the worker resumes the affected work in the same Task. Clients can inspect the original question, answer, delivery, and continuation.

The target HTTP API is described by OpenAPI. Import the YAML into Swagger Editor to browse the operations and examples. To exercise business operations, the developer can add an authorized MCP connection. Business applications can use the same API in their own interfaces and retain authority over their business records and permissions.

- [Product definition](docs/prd.md) · [Target OpenAPI YAML](docs/openapi.yaml)

## Current implementation

The container starts the Task HTTP service and serves Swagger UI at `/docs/`. The Worker uses Pi Durable, a pinned OM, configured model access, and isolated Docker commands for each Task Workspace. See the [acceptance record](deploy/README.md#acceptance-record) for the tested Swagger and recovery paths.

- [Container deployment](deploy/README.md)
- [Architecture index](architecture-map.md) · [Technical design](docs/technical-design.md) · [Worker runtime](docs/worker-runtime-design.md)
