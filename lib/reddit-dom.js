/**
 * Ordered post fullnames (t3_…) for the current listing, for either Reddit
 * frontend. Old Reddit: `div.thing[data-fullname]` (excluding promoted/ads).
 * New Reddit: `shreddit-post` web components, whose element `id` is the fullname
 * (e.g. `id="t3_abc123"`).
 *
 * @param {Document} doc
 * @returns {string[]}
 */
export function listingPostFullnames(doc) {
  const old = Array.from(
    doc.querySelectorAll('div.thing[data-fullname^="t3_"]'),
  )
    .filter((el) => !el.classList.contains("promoted"))
    .map((el) => el.getAttribute("data-fullname") ?? "")
    .filter(Boolean);
  if (old.length) return old;

  return Array.from(doc.querySelectorAll('shreddit-post[id^="t3_"]'))
    .map((el) => el.id)
    .filter(Boolean);
}
