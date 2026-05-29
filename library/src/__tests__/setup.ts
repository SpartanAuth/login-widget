/**
 * Global test setup — runs before every test file.
 *
 * Polyfills and stubs that jsdom needs to host Solid.js custom elements:
 *   - A no-op HTMLElement.attachShadow so that solid-element can call it
 *     without throwing in jsdom (jsdom's shadow DOM support is partial).
 *   - A window.location stub so URLSearchParams usage in onMount doesn't fail.
 */

// jsdom ships with customElements support but attachShadow is partial.
// Stub it so solid-element's internals don't throw when the element connects.
if (!Element.prototype.attachShadow) {
  // If attachShadow is missing entirely, return the element itself as the root.
  Element.prototype.attachShadow = function () {
    return this as unknown as ShadowRoot;
  };
}

// Some jsdom versions throw on structuredClone; provide a simple fallback.
if (typeof globalThis.structuredClone === 'undefined') {
  globalThis.structuredClone = <T>(obj: T): T => JSON.parse(JSON.stringify(obj));
}

// The widget tries to decode the JWT it receives from the server. In tests we
// return a fake token string ("tok", "spartan-jwt-abc") that isn't a valid JWT,
// so jwt-decode logs an error. Suppress that specific stderr line so the test
// output stays clean — it's expected noise, not a test failure.
const originalError = console.error.bind(console);
console.error = (...args: unknown[]) => {
  const msg = String(args[0] ?? '');
  if (msg.includes('Error decoding token') || msg.includes('InvalidTokenError')) return;
  originalError(...args);
};


