/**
 * Small async helpers shared by the provider resolvers (Redgifs, Streamable, …):
 * a concurrency-limited map and a per-promise timeout. Kept provider-agnostic so
 * each resolver bounds how hard it hits its API and never lets one slow lookup
 * hold up a whole page.
 */

/**
 * Map `fn` over `items` with at most `limit` in flight at once, preserving order.
 * @template T, R
 * @param {T[]} items
 * @param {number} limit
 * @param {(item: T, index: number) => Promise<R>} fn
 * @returns {Promise<R[]>}
 */
export async function mapLimit(items, limit, fn) {
  /** @type {R[]} */
  const results = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index], index);
    }
  };
  const workers = Array.from({ length: Math.min(limit, items.length) }, worker);
  await Promise.all(workers);
  return results;
}

/**
 * Reject with a timeout error if `promise` doesn't settle within `ms`.
 * @template T
 * @param {Promise<T>} promise
 * @param {number} ms
 * @param {typeof setTimeout} [setTimeoutImpl]
 * @returns {Promise<T>}
 */
export function withTimeout(promise, ms, setTimeoutImpl = setTimeout) {
  /** @type {any} */
  let timer;
  const timeout = new Promise((_resolve, reject) => {
    timer = setTimeoutImpl(() => reject(new Error("resolve-timeout")), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
