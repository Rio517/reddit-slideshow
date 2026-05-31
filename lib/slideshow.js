import { shouldFetchNextPage } from "./queue.js";

/**
 * @typedef {import("./slides.js").Slide} Slide
 */

const DEFAULT_DWELL_SECONDS = 5;
// Media slides advance on their own `ended` event, but a slightly longer timer
// guarantees forward progress if a video stalls, errors, or never fires `ended`.
const MEDIA_SAFETY_BUFFER_SECONDS = 2;
// Cap how many already-shown slides are retained for back-navigation, so a long
// session does not accumulate every slide object forever (see ADR 0007).
const DEFAULT_MAX_BACK_HISTORY = 50;

/**
 * @typedef {object} QueuePageInput
 * @property {Slide[]} slides
 * @property {string | null | undefined} [after]
 * @property {boolean} [exhausted]
 * @property {number} [postsScanned]
 */

/**
 * Headless slideshow state machine: queue position, pagination triggering, and
 * timer-based auto-advance. DOM-free so it can be unit-tested; the content
 * script supplies `onRender` (paint a slide) and `onRequestNextPage` (fetch).
 */
export class SlideshowController {
  /**
   * @param {{
   *   imageTimerSeconds?: number,
   *   maxBackHistory?: number,
   *   onRender: (slide: Slide, position: { index: number, total: number, exhausted: boolean }) => void,
   *   onRequestNextPage: (after: string) => void,
   *   onEnd?: () => void,
   * }} options
   */
  constructor(options) {
    this.options = options;
    this.maxBackHistory = options.maxBackHistory ?? DEFAULT_MAX_BACK_HISTORY;
    /** @type {Slide[]} */
    this.slides = [];
    this.index = -1;
    // Count of slides dropped from the front so absolute position survives
    // eviction.
    this.evicted = 0;
    /** @type {string | null} */
    this.after = null;
    this.exhausted = false;
    this.postsScannedSinceFetch = 0;
    this.paused = false;
    // True when advance hit the end of a loaded-but-not-exhausted queue and is
    // waiting for the next page so it can resume.
    this.waiting = false;
    /** @type {ReturnType<typeof setTimeout> | null} */
    this.timer = null;
  }

  get imageTimerSeconds() {
    return this.options.imageTimerSeconds ?? DEFAULT_DWELL_SECONDS;
  }

  /** @returns {Slide | null} */
  get current() {
    return this.index >= 0 ? (this.slides[this.index] ?? null) : null;
  }

  get position() {
    // Absolute (eviction-invariant): the retained window is a moving slice.
    return {
      index: this.evicted + this.index,
      total: this.evicted + this.slides.length,
      exhausted: this.exhausted,
    };
  }

  /**
   * Seed the first page and render the first slide.
   * @param {QueuePageInput} page
   */
  start(page) {
    this.append(page);
    return this.current;
  }

  /**
   * Append a fetched page; renders the first slide if nothing is shown yet.
   * @param {QueuePageInput} page
   */
  append(page) {
    this.slides.push(...(page.slides ?? []));
    this.after = page.after ?? null;
    this.exhausted = Boolean(page.exhausted) || !this.after;
    this.postsScannedSinceFetch = page.postsScanned ?? 0;

    const hasUnshown = this.index < this.slides.length - 1;
    if (this.index === -1 && this.slides.length > 0) {
      this.index = 0;
      this.renderCurrent();
      return;
    }
    if (this.waiting && hasUnshown) {
      this.next();
      return;
    }
    // No renderable slide became available (initial empty page, or an
    // all-filtered page arrived while waiting). Keep paging if more exist,
    // otherwise end gracefully instead of hanging.
    if (this.index === -1 || this.waiting) {
      if (!this.exhausted) {
        this.maybeFetchNext();
      } else {
        this.waiting = false;
        this.options.onEnd?.();
      }
    }
  }

  next() {
    if (this.index < this.slides.length - 1) {
      this.index += 1;
      this.renderCurrent();
    } else if (this.exhausted) {
      this.clearTimer();
      this.options.onEnd?.();
      return null;
    } else {
      // At the end of a loaded page but more exist: wait for the next page.
      this.waiting = true;
      this.clearTimer();
      this.maybeFetchNext();
    }
    return this.current;
  }

  prev() {
    if (this.index > 0) {
      this.index -= 1;
      this.renderCurrent();
    }
    return this.current;
  }

  /** A playing video/iframe finished — advance like the timer would. */
  mediaEnded() {
    this.next();
  }

  pause() {
    this.paused = true;
    this.clearTimer();
  }

  resume() {
    if (!this.paused) return;
    this.paused = false;
    this.scheduleAdvance();
  }

  togglePause() {
    if (this.paused) this.resume();
    else this.pause();
  }

  destroy() {
    this.clearTimer();
  }

  renderCurrent() {
    this.trim();
    const slide = this.current;
    if (!slide) return;
    this.waiting = false;
    this.clearTimer();
    this.options.onRender(slide, this.position);
    this.maybeFetchNext();
  }

  /**
   * Drop already-shown slides more than `maxBackHistory` behind the current one.
   * `index` and `evicted` move together, so absolute position is unchanged and
   * pagination (which works on the retained window) is unaffected.
   */
  trim() {
    const excess = this.index - this.maxBackHistory;
    if (excess > 0) {
      this.slides.splice(0, excess);
      this.index -= excess;
      this.evicted += excess;
    }
  }

  /**
   * Begin the current slide's dwell. Called once the media is actually ready,
   * so a slow-loading image does not burn its timer while still loading.
   */
  markReady() {
    this.scheduleAdvance();
  }

  /**
   * Update the per-image dwell live (the user changed it in preferences) and
   * restart the current timer-based slide's countdown so the new value takes
   * effect without a page reload. Media (video) slides keep their own duration,
   * so they are left running.
   * @param {number} seconds
   */
  setImageTimerSeconds(seconds) {
    this.options.imageTimerSeconds = seconds;
    const slide = this.current;
    if (slide && slide.durationMode !== "media") {
      this.scheduleAdvance();
    }
  }

  scheduleAdvance() {
    this.clearTimer();
    const slide = this.current;
    if (!slide || this.paused) return;
    // Videos advance on their own `ended` event; the timer is a safety net so a
    // stalled or broken clip cannot freeze the slideshow.
    const seconds =
      slide.durationMode === "media"
        ? (slide.durationSeconds ?? this.imageTimerSeconds) +
          MEDIA_SAFETY_BUFFER_SECONDS
        : this.imageTimerSeconds;
    this.timer = setTimeout(() => this.next(), seconds * 1000);
  }

  /**
   * Upcoming slides, for preloading.
   * @param {number} [count]
   * @returns {Slide[]}
   */
  peekNext(count = 2) {
    return this.slides.slice(this.index + 1, this.index + 1 + count);
  }

  clearTimer() {
    if (this.timer != null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  maybeFetchNext() {
    if (this.exhausted || !this.after) return;
    const needed = shouldFetchNextPage({
      after: this.after,
      currentIndex: this.index,
      slideCount: this.slides.length,
      postsScannedSinceFetch: this.postsScannedSinceFetch,
    });
    if (!needed) return;
    const after = this.after;
    // Lock until the page arrives so we do not fire duplicate fetches.
    this.after = null;
    this.options.onRequestNextPage(after);
  }
}
