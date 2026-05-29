import { slidesFromListing } from "./slides.js";

const DEFAULT_PREFETCH_REMAINING_SLIDES = 2;
const DEFAULT_MIN_SCANNED_POSTS = 1;

/**
 * @typedef {import("./slides.js").Slide} Slide
 */

/**
 * @typedef {object} QueuePage
 * @property {Slide[]} slides
 * @property {number} postsScanned
 * @property {string | null | undefined} after
 * @property {string | null | undefined} before
 * @property {boolean} exhausted
 */

/**
 * @param {any} listing
 * @returns {QueuePage}
 */
export function buildQueuePage(listing) {
  const children = listing?.data?.children;
  const postsScanned = Array.isArray(children) ? children.length : 0;
  const after = listing?.data?.after;
  return {
    slides: slidesFromListing(listing),
    postsScanned,
    after,
    before: listing?.data?.before,
    exhausted: !after,
  };
}

/**
 * @param {{ currentIndex: number, slideCount: number }} state
 */
export function unreadSlideCount({ currentIndex, slideCount }) {
  return Math.max(slideCount - currentIndex - 1, 0);
}

/**
 * Decide whether pagination should fetch another listing page.
 *
 * The posts-scanned guard lets sparse pages keep paginating even if they
 * produced few slides, while still avoiding a request loop before we have
 * consumed any listing data.
 *
 * @param {{
 *   after?: string | null,
 *   currentIndex: number,
 *   slideCount: number,
 *   postsScannedSinceFetch: number,
 *   prefetchRemainingSlides?: number,
 *   minScannedPosts?: number,
 * }} state
 */
export function shouldFetchNextPage(state) {
  if (!state.after) return false;
  const prefetchRemainingSlides =
    state.prefetchRemainingSlides ?? DEFAULT_PREFETCH_REMAINING_SLIDES;
  const minScannedPosts = state.minScannedPosts ?? DEFAULT_MIN_SCANNED_POSTS;
  return (
    state.postsScannedSinceFetch >= minScannedPosts &&
    unreadSlideCount(state) <= prefetchRemainingSlides
  );
}
