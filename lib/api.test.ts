import assert from "node:assert/strict";
import test from "node:test";

import { redirectOn401 } from "./api";

/** Stands in for the browser: records where `redirectOn401` tried to go. */
function withWindow(pathname: string, run: () => void): string | null {
  let went: string | null = null;
  const original = (globalThis as { window?: unknown }).window;
  (globalThis as { window?: unknown }).window = {
    location: {
      pathname,
      replace: (url: string) => {
        went = url;
      },
    },
  };
  try {
    run();
  } finally {
    (globalThis as { window?: unknown }).window = original;
  }
  return went;
}

test("401 bounces to the login page", () => {
  assert.equal(
    withWindow("/projects", () => redirectOn401(401)),
    "/login",
  );
});

test("401 on the login page does not loop", () => {
  assert.equal(
    withWindow("/login", () => redirectOn401(401)),
    null,
  );
});

test("other statuses are left alone", () => {
  for (const status of [200, 400, 403, 404, 500]) {
    assert.equal(
      withWindow("/projects", () => redirectOn401(status)),
      null,
      `status ${status} should not redirect`,
    );
  }
});

test("no window (server render) is a no-op, not a crash", () => {
  const original = (globalThis as { window?: unknown }).window;
  (globalThis as { window?: unknown }).window = undefined;
  try {
    redirectOn401(401);
  } finally {
    (globalThis as { window?: unknown }).window = original;
  }
});
