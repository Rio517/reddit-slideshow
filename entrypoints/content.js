import "@/assets/overlay.css";
import { createOverlay } from "@/lib/overlay-ui.js";
import { SlideshowController } from "@/lib/slideshow.js";
import { getSettings } from "@/lib/settings.js";
import { afterCursorForViewport } from "@/lib/page-cursor.js";

export default defineContentScript({
  matches: ["https://old.reddit.com/*"],
  cssInjectionMode: "manifest",
  main() {
    /** @type {ReturnType<typeof createOverlay> | null} */
    let overlay = null;
    /** @type {SlideshowController | null} */
    let controller = null;
    let starting = false;

    function ensureOverlay() {
      if (overlay) return overlay;
      overlay = createOverlay({
        onPrev: () => controller?.prev(),
        onNext: () => controller?.next(),
        onTogglePlay: togglePlay,
        onClose: closeOverlay,
        onOpenOriginal: (slide) => {
          const url = slide.permalink ?? slide.sourceUrl;
          if (url) window.open(url, "_blank", "noopener");
        },
        onMediaEnded: () => controller?.mediaEnded(),
        onMediaReady: () => controller?.markReady(),
      });
      document.documentElement.append(overlay.root);
      return overlay;
    }

    function togglePlay() {
      if (!controller || !overlay) return;
      controller.togglePause();
      overlay.setPlaying(!controller.paused);
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
    }

    // Warm the browser cache for the next slides so transitions do not stutter.
    function preloadUpcoming() {
      if (!controller) return;
      for (const slide of controller.peekNext(2)) {
        if (slide.kind === "image") {
          const img = new Image();
          img.decoding = "async";
          img.src = slide.mediaUrl;
        }
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
      const wasOpen = overlay?.isOpen() ?? false;
      const ui = ensureOverlay();
      ui.show();
      if (!wasOpen) lockScroll();
      ui.showStatus("Loading slideshow…");

      const settings = await getSettings();
      const response = await requestPage(startingAfter());
      if (!response?.ok) {
        ui.showStatus(
          response?.error?.message ?? "Could not load this listing.",
        );
        starting = false;
        return;
      }
      const page = response.page;
      if (!page?.slides?.length) {
        ui.showStatus("No supported media on this page.");
        starting = false;
        return;
      }

      /** @param {{ slides: import("@/lib/slides.js").Slide[] }} p */
      const applyNsfw = (p) =>
        settings.includeNsfw
          ? p
          : { ...p, slides: p.slides.filter((slide) => !slide.over18) };

      controller = new SlideshowController({
        imageTimerSeconds: settings.imageTimerSeconds,
        onRender: (slide, position) => {
          if (!controller) return;
          ui.renderCurrent(slide, {
            ...position,
            effectiveSeconds: effectiveSeconds(slide, controller),
            playing: !controller.paused,
          });
          preloadUpcoming();
        },
        onRequestNextPage: async (after) => {
          ui.setBuffering(true);
          const next = await requestPage(after);
          ui.setBuffering(false);
          if (next?.ok && next.page) controller?.append(applyNsfw(next.page));
        },
        onEnd: () => ui.showStatus("No more media to show."),
      });
      if (!settings.autoplay) controller.pause();
      controller.start(applyNsfw(page));
      starting = false;
    }

    const HANDLED_KEYS = new Set(["ArrowLeft", "ArrowRight", " ", "Escape"]);
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

    // Temporary aid: a plain navigation can launch the slideshow for validation
    // without the toolbar. Remove before v1 ship.
    if (
      new URL(window.location.href).searchParams.has("reddit_slideshow_probe")
    ) {
      startSlideshow();
    }
  },
});
