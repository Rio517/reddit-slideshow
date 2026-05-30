import "@/assets/overlay.css";
import { createOverlay } from "@/lib/overlay-ui.js";
import { SlideshowController } from "@/lib/slideshow.js";
import { getSettings } from "@/lib/settings.js";

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
      });
      document.documentElement.append(overlay.root);
      return overlay;
    }

    function togglePlay() {
      if (!controller || !overlay) return;
      controller.togglePause();
      overlay.setPlaying(!controller.paused);
    }

    function closeOverlay() {
      controller?.destroy();
      controller = null;
      overlay?.hide();
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
      const ui = ensureOverlay();
      ui.show();
      ui.showStatus("Loading slideshow…");

      const settings = await getSettings();
      const response = await requestPage(undefined);
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

      controller = new SlideshowController({
        imageTimerSeconds: settings.imageTimerSeconds,
        onRender: (slide, position) => {
          if (!controller) return;
          ui.renderCurrent(slide, {
            ...position,
            effectiveSeconds: effectiveSeconds(slide, controller),
            playing: !controller.paused,
          });
        },
        onRequestNextPage: async (after) => {
          const next = await requestPage(after);
          if (next?.ok && next.page) controller?.append(next.page);
        },
        onEnd: () => ui.showStatus("End of slideshow."),
      });
      controller.start(page);
      starting = false;
    }

    document.addEventListener("keydown", (event) => {
      if (!overlay?.isOpen()) return;
      switch (event.key) {
        case "ArrowLeft":
          event.preventDefault();
          controller?.prev();
          break;
        case "ArrowRight":
          event.preventDefault();
          controller?.next();
          break;
        case " ":
          event.preventDefault();
          togglePlay();
          break;
        case "Escape":
          event.preventDefault();
          closeOverlay();
          break;
      }
    });

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
