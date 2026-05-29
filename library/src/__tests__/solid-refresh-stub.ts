// Stub for the Solid.js HMR virtual module (/@solid-refresh).
// This module only exists inside a Vite dev server; in Vitest (which has no
// dev server) we replace it with a no-op so imports don't throw.
export default { enabled: false };
export const HotComponent = (c: unknown) => c;

