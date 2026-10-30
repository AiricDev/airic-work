# Business MCP authentication and transport

`bootstrap/mcp.ts` creates a gateway, a credential application service, and Worker tools. It implements a custom business-issued background credential contract, not a complete OAuth authorization server/client flow.

Configuration is trusted host configuration:

- `directory`: private absolute credential storage directory, separate from Session/Workspace.
- `key`: 32-byte AES-256-GCM key supplied by the host secret store; preserve it across restarts and keep it outside backups of the encrypted files.
- `connections`: fixed IDs, trusted Airic `User.issuer`, HTTPS MCP/issue/revoke URLs. Endpoint changes require reconnecting; ciphertext is bound to the complete connection configuration, owner, subject and Execution.
- Optional host fetch implementation for explicitly configured networking. Production TLS validation must remain enabled.

Composition order:

1. `integration = createMcpIntegration(options, store)`.
2. Create Worker with `tools: async e => integration.tools(application, e)`.
3. Create Backend with `mcp: integration.gateway` and the Worker's runtime/history; assign its Application to the closure above.
4. Create Execution. Call `integration.credentials.connect(userId, executionId, connectionId, loginAccessToken)` from the authenticated host request, before starting work. The raw login token is transient and must not become a Steering Input, task attribute or Session entry. Only token ID/expiry are returned.
5. Run the Execution normally. Agent tools `work_discover_mcp` and `work_call_mcp` use current user/generation, exact service schemas/revisions and stable tool call IDs. Discovery is lazy, so expired/unavailable business credentials do not prevent reopening local Session history.
6. Explicit revocation uses `integration.credentials.revoke(...)` with a current user login credential. Local use is disabled first; remote revoke can be retried by stable token ID if it fails. Reconnect issues a new credential. Wake/continue the original Execution through the usual input path when credentials become available.

Issue contract: POST JSON `{execution_id}` to the configured issue endpoint with login Bearer. Require `{access_token, token_type: 'Bearer', token_id, user_id, execution_id, expires_at}`. Returned subject/Execution must match the current owner. Revoke contract: POST `{token_id}` with login Bearer; require `{status: 'revoked', user_id}` matching that owner. Both operations must use a token intended for those business APIs; an arbitrary OIDC ID token is not accepted by this contract.

CertLab implements these at `/api/v1/auth/mcp-token` and `/api/v1/auth/mcp-token/revoke`. Its dedicated credentials expire after seven days without sliding renewal, require `X-Airic-Execution-Id` on `/mcp`, and cannot authenticate ordinary web APIs. Ordinary session logout leaves the independent grant intact. Expiry/revocation/inactive users block business access; no administrator/shared-account fallback exists. Renew via a new valid login token, not by replaying the expired browser session or keeping the Agent busy.

The gateway uses a fresh MCP client per operation, injects credentials per HTTP request, disables automatic auth recovery/write retries and checks local account/owner/generation/connection before dispatch. It records service schema/classification sources, never infers writes from names. Service errors are failed; a successful response without explicit business-result semantics remains unknown with the original payload available. Host credentials reflected by a service are redacted, including secrets embedded in JSON text content. The normal Application call history still owns durable-before-network and unknown-result recovery.

Tests: `backend/tests/mcp-integration.test.ts` uses a private test CA, real HTTPS MCP initialization/discovery/calls, encrypted disk/reopen, identity/expiry/revocation/config isolation and a real Pi Worker with a faux model. CertLab endpoint tests separately run against real ASGI/Django and isolated databases. No production database migration or live CertLab/Airic deployment is performed automatically.
