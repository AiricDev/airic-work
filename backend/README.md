# Backend

Airic Work is being refactored into a headless OM Worker. The current backend retains the Execution domain, SQLite control store, Pi Durable runtime, OM snapshot and MCP adapters as the implementation foundation. The old HTTP and frontend delivery have been removed. The Task API, production worker, isolated Workspace and Swagger UI are not implemented yet.

Run `npm run check` at the repository root for type checking and backend tests. Some integration tests start a local HTTPS server and require loopback access. The target contract is [OpenAPI](../docs/openapi.yaml), and the transition is described in the [technical design](../docs/technical-design.md).
