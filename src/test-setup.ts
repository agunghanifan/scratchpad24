import '@testing-library/jest-dom/vitest';

/**
 * Node >= 22 exposes an experimental global `localStorage` that is `undefined`
 * unless `--localstorage-file` is passed. Vitest's jsdom environment sees
 * `'localStorage' in global === true` and skips overriding it with the real
 * jsdom implementation, so component tests crash at render time.
 *
 * Restore the real jsdom Storage instance (reachable via `globalThis.jsdom`,
 * set by vitest's jsdom environment) so `Storage.prototype` mocks apply.
 * Guarded to a no-op outside the jsdom environment.
 */
const jsdomInstance = (globalThis as { jsdom?: { window: Window } }).jsdom;
if (jsdomInstance) {
  const jsdomLocalStorage = jsdomInstance.window.localStorage;
  if (typeof jsdomLocalStorage !== 'undefined') {
    Object.defineProperty(globalThis, 'localStorage', {
      value: jsdomLocalStorage,
      configurable: true,
      writable: true,
    });
  }
}