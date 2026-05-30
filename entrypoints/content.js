import "@/assets/overlay.css";
import { createOverlay } from "@/lib/overlay-ui.js";
import { getSettings, saveSettings } from "@/lib/settings.js";
import { afterCursorForViewport } from "@/lib/page-cursor.js";
import { createSlideshowSession } from "@/lib/session.js";

export default defineContentScript({
  matches: ["https://old.reddit.com/*"],
  cssInjectionMode: "manifest",
  main() {
    const session = createSlideshowSession({
      doc: document,
      createOverlay,
      getSettings,
      saveSettings,
      requestPage: async (after) => {
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
      },
      // Start from the post nearest the top of the viewport so the slideshow
      // begins where the user is, not at the top of the first page.
      getStartCursor: () => {
        const posts = Array.from(
          document.querySelectorAll('div.thing[data-fullname^="t3_"]'),
        )
          .filter((el) => !el.classList.contains("promoted"))
          .map((el) => ({
            fullname: el.getAttribute("data-fullname") ?? "",
            bottom: el.getBoundingClientRect().bottom,
          }));
        return afterCursorForViewport(posts);
      },
      openUrl: (url) => window.open(url, "_blank", "noopener"),
      createImage: () => new Image(),
    });

    document.addEventListener(
      "keydown",
      (event) => session.handleKeydown(event),
      true,
    );

    browser.runtime.onMessage.addListener((/** @type {any} */ message) => {
      if (message?.type !== "slideshow.startRequested") return undefined;
      session.start();
      return Promise.resolve({ ok: true });
    });
  },
});
