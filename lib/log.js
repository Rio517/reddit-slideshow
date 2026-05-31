/**
 * Tiny namespaced logger. Silent in production builds and in unit tests; loud
 * under `wxt dev`. Gated on the Vite/WXT build-time DEV flag so `wxt build`
 * dead-code-strips the output entirely.
 */
const ENABLED = (() => {
  try {
    const env = /** @type {any} */ (import.meta).env;
    return Boolean(env?.DEV) && env?.MODE !== "test";
  } catch {
    return false;
  }
})();

/**
 * @param {string} ns Short namespace, e.g. "content" or "redgifs".
 * @returns {{ debug: (...a: unknown[]) => void, info: (...a: unknown[]) => void, warn: (...a: unknown[]) => void, error: (...a: unknown[]) => void }}
 */
export function createLogger(ns) {
  const tag = `[rs:${ns}]`;
  return {
    debug: (...a) => {
      if (ENABLED) console.debug(tag, ...a);
    },
    info: (...a) => {
      if (ENABLED) console.info(tag, ...a);
    },
    warn: (...a) => {
      if (ENABLED) console.warn(tag, ...a);
    },
    error: (...a) => {
      if (ENABLED) console.error(tag, ...a);
    },
  };
}
