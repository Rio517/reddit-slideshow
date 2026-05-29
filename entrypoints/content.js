import "@/assets/overlay.css";
import { renderSlide } from "@/lib/overlay-render.js";

export default defineContentScript({
  matches: ["https://old.reddit.com/*"],
  cssInjectionMode: "manifest",
  main() {
    const ROOT_ID = "reddit-slideshow-root";

    function ensureRoot() {
      let root = document.getElementById(ROOT_ID);
      if (root) return root;
      root = document.createElement("div");
      root.id = ROOT_ID;
      root.hidden = true;

      const closeButton = document.createElement("button");
      closeButton.type = "button";
      closeButton.className = "reddit-slideshow-close";
      closeButton.textContent = "✕";
      closeButton.title = "Close slideshow (Esc)";
      closeButton.addEventListener("click", closeOverlay);
      root.append(closeButton);

      const stage = document.createElement("div");
      stage.className = "reddit-slideshow-stage";
      root.append(stage);

      document.documentElement.append(root);
      return root;
    }

    /**
     * @param {HTMLElement} root
     */
    function stageOf(root) {
      return root.querySelector(".reddit-slideshow-stage");
    }

    function closeOverlay() {
      const root = document.getElementById(ROOT_ID);
      if (root) root.hidden = true;
    }

    /**
     * @param {string} text
     */
    function showStatus(text) {
      const stage = stageOf(ensureRoot());
      if (!stage) return;
      const status = document.createElement("p");
      status.className = "reddit-slideshow-status";
      status.textContent = text;
      stage.replaceChildren(status);
    }

    /**
     * @param {import("@/lib/slides.js").Slide} slide
     */
    function showSlide(slide) {
      const stage = stageOf(ensureRoot());
      if (!stage) return;
      stage.replaceChildren(renderSlide(slide));
    }

    async function startSlideshow() {
      const root = ensureRoot();
      root.hidden = false;
      showStatus("Loading slideshow…");

      let response;
      try {
        response = await browser.runtime.sendMessage({
          type: "slideshow.requestPage",
          payload: { pageUrl: window.location.href },
        });
      } catch {
        showStatus("Could not reach the extension background.");
        return;
      }

      if (!response?.ok) {
        showStatus(response?.error?.message ?? "Could not load this listing.");
        return;
      }

      const slides = response.page?.slides ?? [];
      if (slides.length === 0) {
        showStatus("No supported media on this page.");
        return;
      }

      showSlide(slides[0]);
    }

    document.addEventListener("keydown", (event) => {
      const root = document.getElementById(ROOT_ID);
      if (!root || root.hidden) return;
      if (event.key === "Escape") {
        event.preventDefault();
        closeOverlay();
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
