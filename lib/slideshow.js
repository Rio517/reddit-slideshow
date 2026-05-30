import { shouldFetchNextPage } from "./queue.js";

/**
 * @typedef {import("./slides.js").Slide} Slide
 */

const DEFAULT_DWELL_SECONDS = 5;

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
   *   onRender: (slide: Slide, position: { index: number, total: number, exhausted: boolean }) => void,
   *   onRequestNextPage: (after: string) => void,
   *   onEnd?: () => void,
   * }} options
   */
  constructor(options) {
    this.options = options;
    /** @type {Slide[]} */
    this.slides = [];
    this.index = -1;
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
    return {
      index: this.index,
      total: this.slides.length,
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
    if (this.index === -1 && this.slides.length > 0) {
      this.index = 0;
      this.renderCurrent();
    } else if (this.waiting && this.index < this.slides.length - 1) {
      this.next();
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
    const slide = this.current;
    if (!slide) return;
    this.waiting = false;
    this.options.onRender(slide, this.position);
    this.scheduleAdvance();
    this.maybeFetchNext();
  }

  scheduleAdvance() {
    this.clearTimer();
    const slide = this.current;
    if (!slide || this.paused) return;
    // Videos advance on their own `ended` event (durationMode "media").
    if (slide.durationMode !== "timer") return;
    this.timer = setTimeout(() => this.next(), this.imageTimerSeconds * 1000);
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
