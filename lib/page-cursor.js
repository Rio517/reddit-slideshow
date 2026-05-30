/**
 * Decide which listing `after` cursor to start from based on the posts currently
 * in the page and where the viewport is. This makes the slideshow begin near
 * what the user is looking at (including RES "never-ending" loaded posts),
 * instead of always restarting from the top of the first page.
 *
 * @param {Array<{ fullname: string, bottom: number }>} posts
 *   Posts in document order, each with its `data-fullname` and the `bottom` of
 *   its bounding rect relative to the viewport top.
 * @returns {string | undefined} the fullname to pass as `after`, or undefined to
 *   start from the top of the listing.
 */
export function afterCursorForViewport(posts) {
  if (!posts.length) return undefined;
  let firstVisible = posts.findIndex((post) => post.bottom > 0);
  // Every loaded post is scrolled above the viewport: start after the last one.
  if (firstVisible < 0) firstVisible = posts.length;
  if (firstVisible <= 0) return undefined;
  return posts[firstVisible - 1].fullname;
}
