import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

class MockResponse {
  ok = true;
  status = 200;
  private readonly body: string;

  constructor(body: string) {
    this.body = body;
  }

  clone() {
    return new MockResponse(this.body);
  }

  async text() {
    return this.body;
  }
}

test("service worker precaches the built application shell for offline startup", async () => {
  const source = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");
  const listeners = new Map<string, (event: { waitUntil(promise: Promise<unknown>): void }) => void>();
  const cached = new Set<string>();
  const index = `<link rel="stylesheet" href="/assets/app.css"><script src="/assets/app.js"></script>`;
  let install: Promise<unknown> | undefined;

  vm.runInNewContext(source, {
    URL,
    console,
    Request: class {
      readonly url: string;

      constructor(url: string) {
        this.url = url;
      }
    },
    fetch: async (request: { url: string }) => new MockResponse(request.url === "/" ? index : ""),
    caches: {
      open: async () => ({
        put: async (url: string) => { cached.add(url); },
        match: async () => undefined,
      }),
      keys: async () => [],
      delete: async () => true,
    },
    self: {
      location: { hostname: "example.com", origin: "https://example.com" },
      addEventListener: (name: string, listener: (event: { waitUntil(promise: Promise<unknown>): void }) => void) =>
        listeners.set(name, listener),
      skipWaiting: () => undefined,
      clients: { claim: async () => undefined, matchAll: async () => [] },
      registration: { unregister: async () => true },
    },
  });

  listeners.get("install")?.({ waitUntil: promise => { install = promise; } });
  await install;

  assert.ok(cached.has("/"));
  assert.ok(cached.has("/index.html"));
  assert.ok(cached.has("/assets/app.css"));
  assert.ok(cached.has("/assets/app.js"));
});
