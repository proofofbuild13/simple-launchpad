try {
  // Optional: extends `expect` with DOM matchers. Some runtimes have ESM
  // resolution issues with jest-dom's lodash subpath imports — keep it
  // optional so pure-logic tests still run.
  await import("@testing-library/jest-dom");
} catch {
  // no-op
}

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});
