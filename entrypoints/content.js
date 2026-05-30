import "@/assets/overlay.css";
import { createOverlay } from "@/lib/overlay-ui.js";
import { SlideshowController } from "@/lib/slideshow.js";
import { getSettings, saveSettings } from "@/lib/settings.js";
import { afterCursorForViewport } from "@/lib/page-cursor.js";
import { DuplicateTracker } from "@/lib/dedup.js";

export default defineContentScript({
  matches: ["https://old.reddit.com/*"],
  cssInjectionMode: "manifest",
  main() {
    /** @type {ReturnType<typeof createOverlay> | null} */
    let overlay = null;
    /** @type {SlideshowController | null} */
    let controller = null;
    let starting = false;
    let muted = true;

    function ensureOverlay() {
      if (overlay) return overlay;
      overlay = createOverlay({
        onPrev: () => controller?.prev(),
        onNext: () => controller?.next(),
        onTogglePlay: togglePlay,
        onClose: closeOverlay,
        onOpenOriginal: (slide) => {
          const url = slide.permalink ?? slide.sourceUrl;
          if (url && isHttpUrl(url)) window.open(url, "_blank", "noopener");
        },
        onMediaEnded: () => controller?.mediaEnded(),
        onMediaReady: () => controller?.markReady(),
        onToggleMute: toggleMute,
      });
      document.documentElement.append(overlay.root);
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
      saveSettings({ startMuted: muted });
    }

    let savedOverflow = "";
    function lockScroll() {
      savedOverflow = document.documentElement.style.overflow;
      document.documentElement.style.overflow = "hidden";
    }
    function unlockScroll() {
      document.documentElement.style.overflow = savedOverflow;
    }

    function closeOverlay() {
      controller?.destroy();
      controller = null;
      overlay?.hide();
      unlockScroll();
      cancelPreloads();
    }

    /** @type {Map<string, HTMLImageElement>} */
    const preloads = new Map();
    function cancelPreloads() {
      for (const img of preloads.values()) img.src = "";
      preloads.clear();
    }

    // Warm the browser cache for the next images. Bounded to the look-ahead
    // window; preloads that fall out of it have their fetch cancelled.
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
        const img = new Image();
        img.decoding = "async";
        img.src = url;
        preloads.set(url, img);
      }
    }

    /**
     * @param {import("@/lib/slides.js").Slide} slide
     * @param {SlideshowController} c
     */
    function effectiveSeconds(slide, c) {
      if (slide.durationMode === "media") {
        return slide.durationSeconds ?? c.imageTimerSeconds;
      }
      return c.imageTimerSeconds;
    }

    /**
     * Guard against non-http(s) schemes (e.g. javascript:) from listing fields.
     * @param {string} url
     */
    function isHttpUrl(url) {
      try {
        const { protocol } = new URL(url);
        return protocol === "https:" || protocol === "http:";
      } catch {
        return false;
      }
    }

    // Start the queue from the post nearest the top of the viewport so the
    // slideshow begins where the user is, not at the top of the first page.
    function startingAfter() {
      const posts = Array.from(
        document.querySelectorAll('div.thing[data-fullname^="t3_"]'),
      )
        .filter((el) => !el.classList.contains("promoted"))
        .map((el) => ({
          fullname: el.getAttribute("data-fullname") ?? "",
          bottom: el.getBoundingClientRect().bottom,
        }));
      return afterCursorForViewport(posts);
    }

    /**
     * @param {string} [after]
     */
    async function requestPage(after) {
      try {
        return await browser.runtime.sendMessage({
          type: "slideshow.requestPage",
          payload: { pageUrl: window.location.href, after },
        });
      } catch {
        return {
          ok: false,
          error: { message: "Could not reach the extension background." },
        };
      }
    }

    async function startSlideshow() {
      if (starting) return;
      starting = true;
      try {
        const wasOpen = overlay?.isOpen() ?? false;
        const ui = ensureOverlay();
        ui.show();
        if (!wasOpen) lockScroll();
        ui.showStatus("Loading slideshow…");

        const settings = await getSettings();
        muted = settings.startMuted;
        ui.setMuted(muted);
        const response = await requestPage(startingAfter());
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

        const tracker = settings.dedupe ? new DuplicateTracker() : null;
        /** @param {{ slides: import("@/lib/slides.js").Slide[] }} p */
        const prepare = (p) => {
          let slides = settings.includeNsfw
            ? p.slides
            : p.slides.filter((slide) => !slide.over18);
          if (tracker) slides = tracker.filterNewByKey(slides);
          return { ...p, slides };
        };

        controller = new SlideshowController({
          imageTimerSeconds: settings.imageTimerSeconds,
          onRender: (slide, position) => {
            if (!controller) return;
            ui.renderCurrent(slide, {
              ...position,
              effectiveSeconds: effectiveSeconds(slide, controller),
              loadWaitMs: settings.maxLoadWaitSeconds * 1000,
              playing: !controller.paused,
            });
            preloadUpcoming();
          },
          onRequestNextPage: async (after) => {
            ui.setBuffering(true);
            const next = await requestPage(after);
            ui.setBuffering(false);
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
          },
          onEnd: () => ui.showStatus("No more media to show."),
        });
        if (!settings.autoplay) controller.pause();
        controller.start(prepare(page));
      } finally {
        starting = false;
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
    document.addEventListener(
      "keydown",
      (event) => {
        if (!overlay?.isOpen() || !HANDLED_KEYS.has(event.key)) return;
        // Capture phase + stopImmediatePropagation so RES and old Reddit do not
        // also act on these keys while the slideshow is open.
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
            closeOverlay();
            break;
        }
      },
      true,
    );

    browser.runtime.onMessage.addListener((/** @type {any} */ message) => {
      if (message?.type !== "slideshow.startRequested") return undefined;
      startSlideshow();
      return Promise.resolve({ ok: true });
    });
  },
});
