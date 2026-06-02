// Imported as a string (not injected globally) so it can be scoped inside the
// overlay's shadow root, isolating it from old.reddit / RES page styles.
import overlayCss from "@/assets/overlay.css?inline";
import { createOverlay } from "@/lib/overlay-ui.js";
import { getSettings, saveSettings } from "@/lib/settings.js";
import { createSlideshowSession } from "@/lib/session.js";
import { base64ToArrayBuffer } from "@/lib/bytes-base64.js";
import { createLogger } from "@/lib/log.js";

const log = createLogger("content");

// URL fragment a popout window carries so its content script auto-starts.
const POPOUT_MARKER = "rs-slideshow";

export default defineContentScript({
  matches: ["https://old.reddit.com/*", "https://www.reddit.com/*"],
  cssInjectionMode: "manifest",
  main() {
    const session = createSlideshowSession({
      doc: document,
      // Mount the overlay in a shadow root carrying its own stylesheet.
      createOverlay: (handlers) =>
        createOverlay(handlers, document, overlayCss),
      getSettings,
      saveSettings,
      requestPage: async (after) => {
        try {
          return await browser.runtime.sendMessage({
            type: "slideshow.requestPage",
            payload: { pageUrl: window.location.href, after },
          });
        } catch (err) {
          log.warn("requestPage message failed", err);
          return {
            ok: false,
            error: { message: "Could not reach the extension background." },
          };
        }
      },
      // No start cursor: begin from the top of the current listing so the newest
      // posts (above wherever the user has scrolled) are included.
      openUrl: (url) => window.open(url, "_blank", "noopener"),
      // The options page can only be opened from a privileged context, so ask
      // the background to open it.
      openPreferences: () => {
        browser.runtime
          .sendMessage({ type: "slideshow.openOptions" })
          .catch(() => {});
      },
      // Re-open the current feed in a minimal popup window (for AirPlay); the
      // marker tells that window's content script to auto-start.
      openPopout: () => {
        const url = new URL(window.location.href);
        url.hash = POPOUT_MARKER;
        browser.runtime
          .sendMessage({
            type: "slideshow.openPopout",
            payload: { url: url.toString() },
          })
          .catch(() => {});
      },
      // Proxied media (Redgifs): the background fetches the mp4 bytes (no reddit
      // Referer, so the CDN serves them) and returns them base64-encoded (raw
      // bytes don't survive the message boundary in Chrome); we decode and wrap
      // them in a blob: URL the page CSP allows. Null on any failure.
      resolveMedia: async (url) => {
        let res;
        try {
          res = await browser.runtime.sendMessage({
            type: "slideshow.fetchMedia",
            payload: { url },
          });
        } catch (err) {
          log.warn("fetchMedia message failed", url, err);
          return null;
        }
        if (!res?.ok || !res.b64) return null;
        return URL.createObjectURL(
          new Blob([base64ToArrayBuffer(res.b64)], { type: "video/mp4" }),
        );
      },
      createImage: () => new Image(),
      // A detached <video> used only to warm the cache for the next direct clip.
      createVideo: () => document.createElement("video"),
      // Layer 2 dedup: the background fetches, decodes, and 9x8 difference-hashes
      // the image, returning only the hex (raw bytes don't survive the message
      // boundary in Chrome). Returns null on any failure.
      computeImageHash: async (url) => {
        try {
          const res = await browser.runtime.sendMessage({
            type: "slideshow.hashImage",
            payload: { url },
          });
          return res?.ok ? (res.hash ?? null) : null;
        } catch (err) {
          log.warn("hashImage message failed", url, err);
          return null;
        }
      },
    });

    document.addEventListener(
      "keydown",
      (event) => session.handleKeydown(event),
      true,
    );

    // Apply preference changes (e.g. the per-image timer) to a running
    // slideshow immediately, without requiring a page reload.
    browser.storage.onChanged.addListener((_changes, area) => {
      if (area !== "local") return;
      getSettings()
        .then((next) => session.applyLiveSettings(next))
        .catch((err) => log.warn("applyLiveSettings failed", err));
    });

    browser.runtime.onMessage.addListener((/** @type {any} */ message) => {
      if (message?.type !== "slideshow.startRequested") return undefined;
      session.start();
      return Promise.resolve({ ok: true });
    });

    // A popout window opens the feed with the marker fragment; auto-start there.
    if (window.location.hash === `#${POPOUT_MARKER}`) {
      session.start();
    }
  },
});
