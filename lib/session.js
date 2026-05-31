import { SlideshowController } from "./slideshow.js";
import { DuplicateTracker } from "./dedup.js";

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
  let muted = true;
  let savedOverflow = "";
  let contentDedup = false;
  /** @type {import("./settings.js").Settings | null} */
  let currentSettings = null;
  /** @type {DuplicateTracker | null} */
  let tracker = null;
  /** @type {Slide[]} */
  let skipped = [];
  /** @type {Map<string, { src: string }>} */
  const preloads = new Map();

  function ensureOverlay() {
    if (overlay) return overlay;
    overlay = deps.createOverlay({
      onPrev: () => controller?.prev(),
      onNext: () => controller?.next(),
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
      onMediaFailed: (/** @type {Slide} */ slide) => {
        // Broken media (404, dead host) — record it and move on instead of
        // dwelling on a placeholder.
        skipped = [...skipped, slide];
        overlay?.setSkipped(skipped);
        controller?.next();
      },
      resolveMedia: deps.resolveMedia,
    });
    deps.doc.documentElement.append(overlay.root);
    return overlay;
  }

  function togglePlay() {
    if (!controller || !overlay) return;
    controller.togglePause();
    overlay.setPlaying(!controller.paused);
  }

  function toggleMute() {
    muted = !muted;
    overlay?.setMuted(muted);
    deps.saveSettings({ startMuted: muted });
  }

  function lockScroll() {
    savedOverflow = deps.doc.documentElement.style.overflow;
    deps.doc.documentElement.style.overflow = "hidden";
  }
  function unlockScroll() {
    deps.doc.documentElement.style.overflow = savedOverflow;
  }

  function close() {
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
      .filter((slide) => slide.kind === "image")
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
   */
  async function maybeHashCurrent(slide) {
    if (!contentDedup || !tracker || !deps.computeImageHash) return;
    if (slide.kind !== "image") return;
    const hash = await deps.computeImageHash(slide.mediaUrl);
    if (!hash || controller?.current?.id !== slide.id) return;
    if (tracker.isDuplicateHash(hash)) {
      controller?.next();
    } else {
      tracker.addHash(hash);
    }
  }

  /**
   * @param {Slide} slide
   * @param {SlideshowController} c
   */
  function effectiveSeconds(slide, c) {
    if (slide.durationMode === "media") {
      return slide.durationSeconds ?? c.imageTimerSeconds;
    }
    return c.imageTimerSeconds;
  }

  async function start() {
    if (starting) return;
    starting = true;
    try {
      const wasOpen = overlay?.isOpen() ?? false;
      const ui = ensureOverlay();
      ui.show();
      if (!wasOpen) lockScroll();
      skipped = [];
      ui.setSkipped(skipped);
      ui.showStatus("Loading slideshow…");

      const settings = await deps.getSettings();
      currentSettings = settings;
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
        let slides = settings.includeNsfw
          ? p.slides
          : p.slides.filter((slide) => !slide.over18);
        if (tracker) slides = tracker.filterNewByKey(slides);
        return { ...p, slides };
      };

      controller = controllerFactory({
        imageTimerSeconds: settings.imageTimerSeconds,
        onRender: (/** @type {Slide} */ slide, /** @type {any} */ position) => {
          if (!controller) return;
          ui.renderCurrent(slide, {
            ...position,
            effectiveSeconds: effectiveSeconds(slide, controller),
            loadWaitMs:
              (currentSettings?.maxLoadWaitSeconds ??
                settings.maxLoadWaitSeconds) * 1000,
            playing: !controller.paused,
          });
          preloadUpcoming();
          void maybeHashCurrent(slide);
        },
        onRequestNextPage: async (/** @type {string} */ after) => {
          ui.setBuffering(true);
          const next = await deps.requestPage(after);
          ui.setBuffering(false);
          if (next?.ok && next.page) {
            controller?.append(prepare(next.page));
          } else {
            // Unblock the controller so it ends instead of hanging on a failed
            // mid-session fetch.
            controller?.append({
              slides: [],
              after: null,
              exhausted: true,
              postsScanned: 0,
            });
          }
        },
        onEnd: () => ui.showStatus("No more media to show."),
      });
      if (!settings.autoplay) controller.pause();
      controller.start(prepare(page));
    } finally {
      starting = false;
    }
  }

  /**
   * Apply changed preferences to the running slideshow without a page reload.
   * The per-image dwell is updated live (and the current timer-based slide's
   * countdown restarts); other settings take effect on the next render/page.
   * @param {import("./settings.js").Settings} next
   */
  function applyLiveSettings(next) {
    currentSettings = next;
    if (!controller || !overlay) return;
    controller.setImageTimerSeconds(next.imageTimerSeconds);
    const slide = controller.current;
    if (slide && slide.durationMode !== "media") {
      overlay.restartTimer(
        effectiveSeconds(slide, controller),
        !controller.paused,
      );
    }
  }

  const HANDLED_KEYS = new Set([
    "ArrowLeft",
    "ArrowRight",
    " ",
    "Escape",
    "m",
    "M",
  ]);

  /**
   * @param {KeyboardEvent} event
   */
  function handleKeydown(event) {
    if (!overlay || overlay.isOpen() !== true) return;
    if (!HANDLED_KEYS.has(event.key)) return;
    // Capture phase + stopImmediatePropagation so RES and old Reddit do not also
    // act on these keys while the slideshow is open.
    event.preventDefault();
    event.stopImmediatePropagation();
    switch (event.key) {
      case "ArrowLeft":
        controller?.prev();
        break;
      case "ArrowRight":
        controller?.next();
        break;
      case " ":
        togglePlay();
        break;
      case "m":
      case "M":
        toggleMute();
        break;
      case "Escape":
        close();
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
 * @param {string} url
 * @returns {boolean}
 */
function isHttpUrl(url) {
  try {
    const { protocol } = new URL(url);
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
}
