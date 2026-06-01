import { SlideshowController } from "./slideshow.js";
import { DuplicateTracker } from "./dedup.js";
import { panZoomTotalSeconds, panZoomConfig } from "./pan-zoom.js";
import { mediaUrlIsSafe } from "./overlay-render.js";
import { createLogger } from "./log.js";

const log = createLogger("session");

// Cap retained skipped slides so a long session can't grow the list unbounded
// (it pins otherwise-evicted slides alive); the badge still shows the true total.
const MAX_SKIPPED_RETAINED = 200;

/**
 * @typedef {import("./slides.js").Slide} Slide
 * @typedef {ReturnType<typeof import("./overlay-ui.js").createOverlay>} Overlay
 */

/**
 * Orchestrates the slideshow: wires the controller to the overlay, applies the
 * NSFW/dedup filters, drives pagination, and handles navigation keys. All
 * browser/DOM specifics are injected so this is testable without an extension.
 *
 * @param {{
 *   doc: Document,
 *   createOverlay: (handlers: any) => Overlay,
 *   getSettings: () => Promise<import("./settings.js").Settings>,
 *   saveSettings: (patch: object) => Promise<unknown>,
 *   requestPage: (after?: string) => Promise<any>,
 *   getStartCursor: () => string | undefined,
 *   openUrl: (url: string) => void,
 *   openPreferences?: () => void,
 *   openPopout?: () => void,
 *   resolveMedia?: (url: string) => Promise<string | null>,
 *   createImage: () => { src: string, decoding?: string },
 *   computeImageHash?: (url: string) => Promise<string | null>,
 *   controllerFactory?: (opts: any) => SlideshowController,
 * }} deps
 */
export function createSlideshowSession(deps) {
  const controllerFactory =
    deps.controllerFactory ?? ((opts) => new SlideshowController(opts));

  /** @type {Overlay | null} */
  let overlay = null;
  /** @type {SlideshowController | null} */
  let controller = null;
  let starting = false;
  // True once the queue is exhausted and the end card is showing, so the next
  // forward press replays from the top instead of no-oping.
  let ended = false;
  let muted = true;
  let savedOverflow = "";
  let contentDedup = false;
  /** @type {import("./settings.js").Settings | null} */
  let currentSettings = null;
  /** @type {DuplicateTracker | null} */
  let tracker = null;
  // Slide ids already run through the content-dedup hash, so revisiting a slide
  // (Back / jump) doesn't re-hash it and match it against its own stored hash.
  const hashedIds = new Set();
  /** @type {Slide[]} */
  let skipped = [];
  // True skip count; `skipped` keeps only the most recent MAX_SKIPPED_RETAINED.
  let skippedCount = 0;
  // Bumped on every start(); late async callbacks from a prior run compare
  // against it so a restart-while-open can't let two runs drive one overlay.
  let runId = 0;
  /** @type {Map<string, { src: string }>} */
  const preloads = new Map();

  function ensureOverlay() {
    if (overlay) return overlay;
    overlay = deps.createOverlay({
      onPrev: () => back(),
      onNext: () => advance(),
      onTogglePlay: togglePlay,
      onClose: close,
      onOpenOriginal: (/** @type {Slide} */ slide) => {
        const url = slide.permalink ?? slide.sourceUrl;
        if (url && isHttpUrl(url)) deps.openUrl(url);
      },
      onMediaEnded: () => controller?.mediaEnded(),
      onMediaReady: () => controller?.markReady(),
      onToggleMute: toggleMute,
      onOpenPreferences: () => deps.openPreferences?.(),
      onChangeSetting: (/** @type {Record<string, unknown>} */ patch) => {
        // Persist (fire-and-forget), and apply live to the running slideshow.
        void Promise.resolve(deps.saveSettings(patch)).catch(() => {});
        applyLiveSettings(
          /** @type {any} */ ({ ...(currentSettings ?? {}), ...patch }),
        );
      },
      onMediaFailed: (/** @type {Slide} */ slide) => {
        // Broken media (404, dead host) - record it and move on instead of
        // dwelling on a placeholder.
        recordSkip(slide, "Unavailable");
        controller?.next();
      },
      onJumpTo: (/** @type {number} */ i) => controller?.goTo(i),
      // Hand off to the popout window, then close this tab's slideshow.
      onPopout: () => {
        deps.openPopout?.();
        close();
      },
      resolveMedia: deps.resolveMedia,
    });
    // Mount the shadow host (the overlay lives in its shadow root) as a sibling
    // of <body>, so making <body> inert on show() can't also inert the overlay.
    deps.doc.documentElement.append(overlay.host);
    return overlay;
  }

  // Record an auto-skipped slide with the reason it was skipped. The reason
  // rides on the slide object (the same reference lives in the controller's
  // window), so both the jump list and the skipped list can show it.
  /**
   * @param {Slide} slide
   * @param {string} reason
   */
  function recordSkip(slide, reason) {
    // Idempotent: a slide reached again (e.g. clicked in the jump list) must not
    // be counted or listed twice.
    if (slide.skipReason) return;
    slide.skipReason = reason;
    skippedCount += 1;
    skipped = [...skipped, slide].slice(-MAX_SKIPPED_RETAINED);
    overlay?.setSkipped(skipped, skippedCount);
  }

  // Forward (Next / Right): replay from the top once the end card is up,
  // otherwise advance one slide.
  function advance() {
    if (ended) {
      void start();
      return;
    }
    overlay?.notifyManualNav();
    controller?.next();
  }

  // Back (Prev / Left): from the end card, drop back into the last slide;
  // otherwise step back one.
  function back() {
    if (ended) {
      ended = false;
      controller?.renderCurrent();
      return;
    }
    overlay?.notifyManualNav();
    controller?.prev();
  }

  // Page Down / Page Up: coarse ±10 seek (clamped to the loaded window). A no-op
  // on the end card so it can't trigger the replay the way Right does.
  function skipForward() {
    if (ended) return;
    overlay?.notifyManualNav();
    controller?.skip(10);
  }
  function skipBack() {
    if (ended) return;
    overlay?.notifyManualNav();
    controller?.skip(-10);
  }

  // Shift+Right: bail out of the current post/gallery to the next post.
  function skipGallery() {
    if (ended) return;
    overlay?.notifyManualNav();
    controller?.skipPostGroup();
  }

  function togglePlay() {
    if (!controller || !overlay) return;
    controller.togglePause();
    overlay.setPlaying(!controller.paused);
  }

  function toggleMute() {
    muted = !muted;
    overlay?.setMuted(muted);
    void Promise.resolve(deps.saveSettings({ startMuted: muted })).catch(
      () => {},
    );
  }

  function lockScroll() {
    savedOverflow = deps.doc.documentElement.style.overflow;
    deps.doc.documentElement.style.overflow = "hidden";
  }
  function unlockScroll() {
    deps.doc.documentElement.style.overflow = savedOverflow;
  }

  function close() {
    ended = false;
    controller?.destroy();
    controller = null;
    overlay?.hide();
    unlockScroll();
    cancelPreloads();
  }

  function cancelPreloads() {
    for (const img of preloads.values()) img.src = "";
    preloads.clear();
  }

  // Warm the cache for the next images; cancel preloads that leave the window.
  function preloadUpcoming() {
    if (!controller) return;
    const wanted = controller
      .peekNext(2)
      .filter((slide) => slide.kind === "image" && mediaUrlIsSafe(slide))
      .map((slide) => slide.mediaUrl);
    for (const [url, img] of preloads) {
      if (!wanted.includes(url)) {
        img.src = "";
        preloads.delete(url);
      }
    }
    for (const url of wanted) {
      if (preloads.has(url)) continue;
      const img = deps.createImage();
      img.decoding = "async";
      img.src = url;
      preloads.set(url, img);
    }
  }

  /**
   * Layer 2 dedup: hash the current image and skip it if it perceptually
   * matches one already shown (ADR 0006). Async + best-effort; only acts if the
   * slide is still current when the hash returns.
   * @param {Slide} slide
   * @param {number} myRun
   */
  async function maybeHashCurrent(slide, myRun) {
    if (!contentDedup || !tracker || !deps.computeImageHash) return;
    if (slide.kind !== "image" || hashedIds.has(slide.id)) return;
    const hash = await deps.computeImageHash(slide.mediaUrl);
    if (myRun !== runId) return;
    if (!hash || controller?.current?.id !== slide.id) return;
    hashedIds.add(slide.id);
    if (tracker.isDuplicateHash(hash)) {
      recordSkip(slide, "Duplicate image");
      controller?.next();
    } else {
      tracker.addHash(hash);
    }
  }

  /**
   * Whether the pan & zoom motion should run for this slide: the feature is on,
   * it's an image, and either the threshold is "all images" (panZoomMinOversize
   * ≤ 1) or the image is that many times bigger than the display window (longest
   * side ≥ panZoomMinOversize × the window's longest side in device px).
   * @param {Slide} slide
   * @param {import("./settings.js").Settings} s
   */
  function panZoomApplies(slide, s) {
    if (!s.panZoom || slide.kind !== "image") return false;
    // "All images": move every image, regardless of size (or unknown size).
    if (s.panZoomMinOversize <= 1) return true;
    const longest = Math.max(slide.sourceWidth ?? 0, slide.sourceHeight ?? 0);
    if (!longest) return false;
    const win = deps.doc.defaultView;
    const dpr = win?.devicePixelRatio || 1;
    const winLongest =
      Math.max(win?.innerWidth ?? 0, win?.innerHeight ?? 0) * dpr;
    return winLongest > 0 && longest >= s.panZoomMinOversize * winLongest;
  }

  /**
   * The dwell shown by the countdown bar. Pan-zoomed images run for the full
   * sequence (and advance on the animation's finish); everything else uses its
   * media duration or the plain image timer.
   * @param {Slide} slide
   * @param {SlideshowController} c
   * @param {import("./settings.js").Settings} s
   */
  function effectiveSeconds(slide, c, s) {
    if (slide.durationMode === "media") {
      return slide.durationSeconds ?? c.imageTimerSeconds;
    }
    if (panZoomApplies(slide, s)) {
      return panZoomTotalSeconds(panZoomConfig(s));
    }
    return c.imageTimerSeconds;
  }

  async function start() {
    if (starting) return;
    starting = true;
    // Tear down any previous run so its timers / in-flight fetches / hash work
    // can't keep driving the overlay (restart-while-open race).
    const myRun = ++runId;
    ended = false;
    hashedIds.clear();
    controller?.destroy();
    controller = null;
    cancelPreloads();
    try {
      const wasOpen = overlay?.isOpen() ?? false;
      const ui = ensureOverlay();
      ui.show();
      if (!wasOpen) lockScroll();
      skipped = [];
      skippedCount = 0;
      ui.setSkipped(skipped, skippedCount);
      ui.showLoading();

      const settings = await deps.getSettings();
      currentSettings = settings;
      ui.setSettings(settings);
      muted = settings.startMuted;
      ui.setMuted(muted);
      const response = await deps.requestPage(deps.getStartCursor());
      if (!response?.ok) {
        ui.showStatus(
          response?.error?.message ?? "Could not load this listing.",
        );
        return;
      }
      const page = response.page;
      if (!page?.slides?.length) {
        ui.showStatus("No supported media on this page.");
        return;
      }

      tracker = settings.dedupe ? new DuplicateTracker() : null;
      contentDedup =
        settings.dedupe &&
        settings.contentDedup &&
        typeof deps.computeImageHash === "function";
      /** @param {{ slides: Slide[] }} p */
      const prepare = (p) => {
        // Read the live NSFW toggle so a mid-session change affects new pages.
        let slides = (currentSettings ?? settings).includeNsfw
          ? p.slides
          : p.slides.filter((slide) => !slide.over18);
        if (tracker) slides = tracker.filterNewByKey(slides);
        return { ...p, slides };
      };

      controller = controllerFactory({
        imageTimerSeconds: settings.imageTimerSeconds,
        onRender: (/** @type {Slide} */ slide, /** @type {any} */ position) => {
          if (!controller || myRun !== runId) return;
          const live = currentSettings ?? settings;
          const applies = panZoomApplies(slide, live);
          ui.renderCurrent(slide, {
            ...position,
            effectiveSeconds: effectiveSeconds(slide, controller, live),
            loadWaitMs: live.maxLoadWaitSeconds * 1000,
            playing: !controller.paused,
            transition: live.transition,
            panZoom: applies ? panZoomConfig(live) : null,
          });
          // The jump list shows the loaded (retained) window; baseNumber is the
          // absolute 1-based position of its first slide.
          ui.setJumpList(
            controller.slides,
            controller.index,
            position.index - controller.index + 1,
          );
          preloadUpcoming();
          void maybeHashCurrent(slide, myRun);
        },
        onRequestNextPage: async (/** @type {string} */ after) => {
          ui.setBuffering(true);
          try {
            const next = await deps.requestPage(after);
            if (myRun !== runId) return;
            if (next?.ok && next.page) {
              controller?.append(prepare(next.page));
            } else {
              // Unblock the controller so it ends instead of hanging on a
              // failed mid-session fetch.
              controller?.append({
                slides: [],
                after: null,
                exhausted: true,
                postsScanned: 0,
              });
            }
          } catch (err) {
            log.warn("next-page fetch failed", err);
            // A stale rejection after a restart must not append onto the new run.
            if (myRun !== runId) return;
            controller?.append({
              slides: [],
              after: null,
              exhausted: true,
              postsScanned: 0,
            });
          } finally {
            if (myRun === runId) ui.setBuffering(false);
          }
        },
        onEnd: () => {
          ended = true;
          ui.showEnd();
        },
      });
      if (!settings.autoplay) controller.pause();
      controller.start(prepare(page));
    } finally {
      starting = false;
    }
  }

  /**
   * Apply changed preferences to the running slideshow without a page reload.
   * The per-image dwell, autoplay, and mute apply immediately; NSFW and load-wait
   * apply to subsequently loaded pages/slides; dedup toggles take effect on the
   * next run.
   * @param {import("./settings.js").Settings} next
   */
  function applyLiveSettings(next) {
    const prev = currentSettings;
    currentSettings = next;
    overlay?.setSettings(next);
    if (!controller || !overlay) return;

    // Per-image dwell: update and restart the current timer-based slide. A
    // pan-zoomed image advances on its animation, not this timer, so leave its
    // running countdown alone (the change applies to the next image).
    controller.setImageTimerSeconds(next.imageTimerSeconds);
    const slide = controller.current;
    if (
      slide &&
      slide.durationMode !== "media" &&
      !panZoomApplies(slide, next)
    ) {
      overlay.restartTimer(
        effectiveSeconds(slide, controller, next),
        !controller.paused,
      );
    }

    // Autoplay and mute only change when the setting itself flips, so a manual
    // pause/unmute isn't clobbered by an unrelated settings change.
    if (prev && prev.autoplay !== next.autoplay) {
      if (next.autoplay && controller.paused) controller.resume();
      else if (!next.autoplay && !controller.paused) controller.pause();
      overlay.setPlaying(!controller.paused);
    }
    if (prev && prev.startMuted !== next.startMuted) {
      muted = next.startMuted;
      overlay.setMuted(muted);
    }
  }

  const HANDLED_KEYS = new Set([
    "ArrowLeft",
    "ArrowRight",
    "PageUp",
    "PageDown",
    " ",
    "Escape",
    "m",
    "M",
    "f",
    "F",
  ]);

  /**
   * @param {KeyboardEvent} event
   */
  function handleKeydown(event) {
    if (!overlay || overlay.isOpen() !== true) return;
    if (!HANDLED_KEYS.has(event.key)) return;
    // Let the browser handle Space/Enter natively on a focused control or inside
    // an open panel/popover (toggling a checkbox, activating a button) rather
    // than hijacking it for play/pause.
    const target = /** @type {Element | null} */ (event.target);
    const inControl = target?.closest?.(
      "button, input, select, a, [role=dialog], .rs-confirm, .rs-jump-panel, .rs-skipped-panel, .rs-settings-panel, .rs-help-panel",
    );
    if (inControl && (event.key === " " || event.key === "Enter")) return;
    // Capture phase + stopImmediatePropagation so RES and old Reddit do not also
    // act on these keys while the slideshow is open.
    event.preventDefault();
    event.stopImmediatePropagation();
    switch (event.key) {
      case "ArrowLeft":
        back();
        break;
      case "ArrowRight":
        if (event.shiftKey) skipGallery();
        else advance();
        break;
      case "PageDown":
        skipForward();
        break;
      case "PageUp":
        skipBack();
        break;
      case " ":
        togglePlay();
        break;
      case "m":
      case "M":
        toggleMute();
        break;
      case "f":
      case "F":
        overlay?.toggleFullscreen();
        break;
      case "Escape":
        // Close an open panel/popover first; only close the show when nothing
        // is open on top.
        if (!overlay?.dismissTopLayer()) close();
        break;
    }
  }

  return {
    start,
    handleKeydown,
    close,
    applyLiveSettings,
    isOpen: () => overlay?.isOpen() === true,
  };
}

/**
 * HTTPS only - "open original" should never navigate to a cleartext (or
 * `javascript:`/`data:`) URL from a post's permalink/source field.
 * @param {string} url
 * @returns {boolean}
 */
function isHttpUrl(url) {
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}
