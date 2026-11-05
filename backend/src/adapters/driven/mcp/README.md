# Business MCP authentication and transport

The integration obtains the current user's shared MCP link from the business system and stores an encrypted copy for each Execution. The business system remains responsible for authentication, permission checks, rotation and revocation. This is not OAuth.

Configure a private absolute credential directory, a stable 32-byte AES-256-GCM key and fixed connection IDs with a trusted identity issuer, HTTPS MCP base and HTTPS issue endpoint. Ciphertext is bound to the connection, user, subject and Execution. Changing the key or connection requires reconnecting.

The credential use case checks Execution ownership before connecting. It POSTs `{}` with the current login Bearer to the configured issue endpoint. The response must contain the same `user_id`, a `token_id`, `expires_at: null` and a `path` under the configured MCP endpoint on the same HTTPS origin. The login credential is transient. The link is stored encrypted and never returned to the frontend, Agent, Session or Workspace. CertLab implements the endpoint at `/api/v1/auth/mcp-link`.

Disconnect removes only the local Execution copy. The business user can refresh or delete the shared link in CertLab; old copies then fail authentication and must reconnect. Normal session logout does not delete the shared link. Airic Work still checks the active local account, Execution ownership, generation and connection before every call. It disables redirect and automatic write retries and redacts the URL credential from results.

The HTTPS integration tests cover encrypted persistence, subject validation, owner/generation checks, local disconnect, discovery and calls with a faux Worker model. They do not establish production autonomous execution capability.
