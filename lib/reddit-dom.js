/**
 * Ordered post elements for the current listing, for either Reddit frontend.
 * Old Reddit: `div.thing[data-fullname]` (excluding promoted/ads). New Reddit:
 * `shreddit-post` web components. Returning elements (not just fullnames) lets
 * the caller read each post's viewport position without a second DOM query, and
 * avoids interpolating a fullname into a selector string.
 *
 * Ads are excluded on both frontends. On new Reddit they render as a distinct
 * `shreddit-ad-post` element (not matched by the `shreddit-post` selector); the
 * `:not([promoted])` guard is belt-and-suspenders in case Reddit ever marks a
 * `shreddit-post` itself as promoted (organic posts carry no `promoted` attr).
 *
 * @param {Document} doc
 * @returns {Element[]}
 */
export function listingPostElements(doc) {
  const old = Array.from(
    doc.querySelectorAll('div.thing[data-fullname^="t3_"]'),
  ).filter((el) => !el.classList.contains("promoted"));
  if (old.length) return old;

  return Array.from(
    doc.querySelectorAll('shreddit-post[id^="t3_"]:not([promoted])'),
  );
}

/**
 * The post fullname (t3_…) for a listing element: old Reddit's `data-fullname`
 * or new Reddit's element `id` (always a string; "" when neither is present).
 *
 * @param {Element} el
 * @returns {string}
 */
export function postFullname(el) {
  return el.getAttribute("data-fullname") ?? el.id;
}
