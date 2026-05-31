/**
 * Look up a required element and assert its concrete type. Throws if it's
 * missing or the wrong kind, so a renamed id / wrong selector fails loudly at
 * startup instead of as a later `undefined.value`.
 *
 * @template {Element} T
 * @param {string} selector
 * @param {new () => T} ctor e.g. HTMLInputElement
 * @param {ParentNode} [root]
 * @returns {T}
 */
export function requiredElement(selector, ctor, root = document) {
  const el = root.querySelector(selector);
  if (!(el instanceof ctor)) {
    throw new Error(
      `Expected ${ctor.name} for "${selector}", got ${
        el?.constructor.name ?? "null"
      }`,
    );
  }
  return el;
}
