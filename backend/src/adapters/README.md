# Adapters

The existing adapters provide SQLite control storage, local blobs, Git OM snapshots, HTTPS identity, MCP transport and Pi Durable runtime/history. They implement the application ports and remain available for the Task refactor. The old HTTP and browser delivery were removed.

The current control store uses Execution terminology and a shared database. Task-scoped storage, API authentication, sandboxed Workspace and production scheduling remain to be implemented. Keep provider and persistence types out of the domain and application layers. See [technical design](../../../docs/technical-design.md) and [runtime](driven/runtime/README.md).
