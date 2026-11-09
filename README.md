# Airic Work

Airic Work is a headless Operating Model (OM) worker. A client creates a Task with an instruction, an OM reference, and any optional materials or MCP connections. The worker pins the OM version and carries out the work in a durable Session.

When the worker needs human input, it creates a Decision Request with the question, evidence, and the work that depends on the answer. Independent work can continue. A person can answer through the API, and the worker resumes the affected work in the same Task. Clients can inspect the original question, answer, delivery, and continuation.

The target HTTP API is described by OpenAPI. Import the YAML into Swagger Editor to browse the operations and examples. To exercise business operations, the developer can add an authorized MCP connection. Business applications can use the same API in their own interfaces and retain authority over their business records and permissions.

- [Product definition](docs/prd.md) · [Target OpenAPI YAML](docs/openapi.yaml)

## Current implementation

The legacy frontend and HTTP delivery have been removed. The repository retains the Pi Durable runtime and application core as the foundation for the Task refactor. The headless Task API, Worker, isolated Workspace and Swagger UI are not implemented yet. The Dockerfile builds a foundation image that exits with this status rather than starting a service.

- [Architecture index](architecture-map.md) · [Technical design](docs/technical-design.md) · [Worker runtime](docs/worker-runtime-design.md)
