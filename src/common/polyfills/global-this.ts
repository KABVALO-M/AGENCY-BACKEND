// Ensure browser-only globals exist when libraries expect them in Node.
const globalAny = globalThis as Record<string, unknown>;

if (typeof globalAny.self === 'undefined') {
  globalAny.self = globalAny;
}
