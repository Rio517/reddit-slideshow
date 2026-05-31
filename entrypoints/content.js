import "@/assets/overlay.css";
import { createOverlay } from "@/lib/overlay-ui.js";
import { getSettings, saveSettings } from "@/lib/settings.js";
import { afterCursorForViewport } from "@/lib/page-cursor.js";
import { listingPostElements, postFullname } from "@/lib/reddit-dom.js";
import { createSlideshowSession } from "@/lib/session.js";
import { differenceHash, luminanceFromImageData } from "@/lib/dedup.js";

export default defineContentScript({
  matches: ["https://old.reddit.com/*", "https://www.reddit.com/*"],
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
      // begins where the user is, not at the top of the first page. Works on
      // both old Reddit (div.thing) and new Reddit (shreddit-post).
      getStartCursor: () => {
        const posts = listingPostElements(document).map((el) => ({
          fullname: postFullname(el),
          bottom: el.getBoundingClientRect().bottom,
        }));
        return afterCursorForViewport(posts);
      },
      openUrl: (url) => window.open(url, "_blank", "noopener"),
      // The options page can only be opened from a privileged context, so ask
      // the background to open it.
      openPreferences: () => {
        browser.runtime
          .sendMessage({ type: "slideshow.openOptions" })
          .catch(() => {});
      },
      createImage: () => new Image(),
      // Layer 2 dedup: the background fetches the bytes (privileged), then we
      // downscale to 9x8 and difference-hash. Returns null on any failure.
      computeImageHash: async (url) => {
        let res;
        try {
          res = await browser.runtime.sendMessage({
            type: "slideshow.fetchImage",
            payload: { url },
          });
        } catch {
          return null;
        }
        if (!res?.ok || !res.bytes) return null;
        try {
          const bitmap = await createImageBitmap(new Blob([res.bytes]));
          const canvas = new OffscreenCanvas(9, 8);
          const ctx = canvas.getContext("2d");
          if (!ctx) return null;
          ctx.drawImage(bitmap, 0, 0, 9, 8);
          bitmap.close();
          const imageData = ctx.getImageData(0, 0, 9, 8);
          return differenceHash(luminanceFromImageData(imageData, 9, 8), 9, 8);
        } catch {
          return null;
        }
      },
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
