import { fetchQueuePage } from "@/lib/queue.js";
import { createMessageRouter } from "@/lib/background-router.js";
import { createRedgifsResolver, resolveRedgifsSlides } from "@/lib/redgifs.js";
import {
  createStreamableResolver,
  resolveStreamableSlides,
} from "@/lib/streamable.js";
import {
  fetchCappedBytes,
  MAX_IMAGE_BYTES,
  MAX_MEDIA_BYTES,
} from "@/lib/proxy-fetch.js";
import { createLogger } from "@/lib/log.js";

const log = createLogger("background");

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(() => {
    log.info("installed");
  });

  const redgifs = createRedgifsResolver();
  const streamable = createStreamableResolver();

  /**
   * Build a queue page, then upgrade provider iframe embeds (Redgifs, Streamable)
   * to native (proxied) video slides so they time and unmute correctly. Each
   * resolver leaves the iframe fallback in place when its lookup fails.
   * @param {string} pageUrl
   * @param {{ after?: string }} options
   */
  const fetchQueuePageWithProviders = async (pageUrl, options) => {
    const page = await fetchQueuePage(pageUrl, options);
    page.slides = await resolveRedgifsSlides(page.slides, redgifs.resolve);
    page.slides = await resolveStreamableSlides(
      page.slides,
      streamable.resolve,
    );
    return page;
  };

  const router = createMessageRouter({
    runtimeId: browser.runtime.id,
    fetchQueuePage: fetchQueuePageWithProviders,
    // Layer 2 dedup image bytes (hosts the content script's page-CORS fetch
    // can't reach), capped + timed out.
    fetchImageBytes: (url) => fetchCappedBytes(url, MAX_IMAGE_BYTES),
    // Redgifs mp4 bytes, played back as a blob to dodge CDN hotlink protection.
    fetchMediaBytes: (url) => fetchCappedBytes(url, MAX_MEDIA_BYTES),
    openOptionsPage: () => browser.runtime.openOptionsPage(),
    // Minimal popup window (no tab strip / toolbar / URL bar) for AirPlay.
    openPopout: (url) =>
      browser.windows.create({ url, type: "popup", width: 1280, height: 800 }),
  });
  browser.runtime.onMessage.addListener(router);

  browser.action.onClicked.addListener(
    async (/** @type {Browser.tabs.Tab} */ tab) => {
      if (!tab.id) return;
      try {
        await browser.tabs.sendMessage(tab.id, {
          type: "slideshow.startRequested",
          payload: { source: "action" },
        });
      } catch (err) {
        log.info("toolbar clicked off a Reddit listing", err);
      }
    },
  );
});
