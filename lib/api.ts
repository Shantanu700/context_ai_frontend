import { client } from "@/src/client/client.gen";

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "https://10.21.128.92:8022";

/**
 * Configures the generated client. Kept out of `src/client/**` so that
 * re-running `openapi-ts` never clobbers it — import the SDK from here,
 * not from `@/src/client`, or requests go out without the session cookie.
 */
client.setConfig({
  ...client.getConfig(),
  baseUrl: API_URL,
  // The API authenticates with a Django `sessionid` cookie, and the browser
  // is on a different origin. Without this the cookie is neither stored on
  // login nor sent on any request afterwards.
  credentials: "include",
});

/**
 * Every route but `/login` sits behind the session, so a 401 means the session
 * is gone and there is nothing left to render. A hard navigation rather than
 * `router.replace`: this fires from outside React, and the reload also drops
 * whatever the dead session left in the client cache.
 *
 * 401 only. `../backend/core/permissions.py` answers 401 for unauthenticated
 * (it advertises a challenge so DRF never downgrades to 403), which leaves 403
 * meaning "live session, not allowed" — not something to sign out over.
 */
export function redirectOn401(status: number): void {
  if (
    status === 401 &&
    typeof window !== "undefined" &&
    window.location.pathname !== "/login"
  ) {
    window.location.replace("/login");
  }
}

// Covers every generated-SDK call. The login POST 401s on bad credentials and
// is exempted by the pathname check above, so its inline error still shows.
client.interceptors.response.use((response) => {
  redirectOn401(response.status);
  return response;
});

export * from "@/src/client";

/**
 * The login endpoint takes HTTP Basic, not a JSON body.
 * `btoa` throws on anything outside Latin-1, so encode UTF-8 first —
 * Django reads these bytes back as UTF-8.
 */
export function basicAuth(username: string, password: string): string {
  const bytes = new TextEncoder().encode(`${username}:${password}`);
  return `Basic ${btoa(String.fromCharCode(...bytes))}`;
}

export const UNREACHABLE =
  `Can't reach the API at ${API_URL}. If it's serving a self-signed certificate, ` +
  `open ${API_URL}/health in a tab and accept the warning, then try again.`;

/** DRF reports validation failures as `{field: ["message", …]}`. Show the first one. */
export function readDrfError(body: unknown, status: number): string {
  if (body && typeof body === "object") {
    const fields = Object.values(body as Record<string, unknown>);
    const first = fields.flat().find((v) => typeof v === "string");
    if (first) return first as string;
  }
  return `The server rejected the request (status ${status}).`;
}

/**
 * FileSystemStorage hands back a MEDIA_URL-relative path, R2 an absolute
 * presigned one — `new URL` with a base resolves both. R2's are signed with an
 * hour's expiry, so resolve them per render rather than caching the result.
 */
export function mediaSrc(url: string | null | undefined): string | null {
  return url ? new URL(url, API_URL).href : null;
}
