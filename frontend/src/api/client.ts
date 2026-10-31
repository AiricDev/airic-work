import { routes } from "./routes";
import type { operations } from "./schema";

export type Result<K extends keyof operations> =
  operations[K]["responses"][200]["content"]["application/json"];
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
let csrfToken: string | undefined;
let identityVersion = 0;
export function resetIdentity() {
  csrfToken = undefined;
  identityVersion++;
}
export async function api<K extends keyof operations>(
  name: K,
  options: {
    params?: Record<string, string>;
    query?: Record<string, string | undefined>;
    body?: unknown;
    key?: string;
    token?: string;
    signal?: AbortSignal;
  } = {},
): Promise<Result<K>> {
  const requestIdentity = identityVersion;
  const route = routes[name];
  const path = route.path.replace(/\{(\w+)\}/g, (_, key: string) => {
    if (!options.params?.[key]) throw new Error("Missing route parameter");
    return encodeURIComponent(options.params[key]);
  });
  const query = new URLSearchParams();
  Object.entries(options.query ?? {}).forEach(([key, value]) => {
    if (value !== undefined) query.set(key, value);
  });
  const headers = new Headers();
  if (csrfToken) headers.set("x-csrf-token", csrfToken);
  if (options.key) headers.set("Idempotency-Key", options.key);
  if (options.token) headers.set("Authorization", `Bearer ${options.token}`);
  const form = options.body instanceof FormData;
  if (options.body !== undefined && !form)
    headers.set("Content-Type", "application/json");
  const response = await fetch(path + (query.size ? "?" + query : ""), {
    method: route.method,
    credentials: "same-origin",
    headers,
    signal: options.signal,
    ...(options.body === undefined
      ? {}
      : {
          body: form
            ? (options.body as FormData)
            : JSON.stringify(options.body),
        }),
  });
  const value = await response.json();
  if (!response.ok) {
    if (
      requestIdentity === identityVersion &&
      (response.status === 401 || value.code === "account-disabled")
    ) {
      resetIdentity();
      window.dispatchEvent(new Event("airic:identity-lost"));
    }
    throw new ApiError(
      response.status,
      value.code ?? "request-failed",
      value.message ?? "请求失败",
    );
  }
  if (name === "login") {
    identityVersion++;
    csrfToken = value.csrfToken;
  }
  if (name === "session" && requestIdentity === identityVersion)
    csrfToken = value.csrfToken;
  if (name === "logout") resetIdentity();
  if (!["GET", "HEAD"].includes(route.method))
    window.dispatchEvent(new Event("airic:invalidate"));
  return value;
}
