# Bootstrap

`container.ts` assembles the existing application services from injected ports. `bindings.ts` constructs the SQLite, Git OM, identity, file, MCP and Pi adapters from configuration. The caller owns adapter shutdown and supplies a Workspace implementation.

The legacy HTTP listener, worker entry point and browser authentication handoff have been removed. The target Task API and production worker require new composition and lifecycle wiring. See [technical design](../../../docs/technical-design.md).
