import { fetchQueuePage } from "@/lib/queue.js";
import { createMessageRouter } from "@/lib/background-router.js";
import { createRedgifsResolver, resolveRedgifsSlides } from "@/lib/redgifs.js";
import {
  fetchCappedBytes,
  MAX_IMAGE_BYTES,
  MAX_MEDIA_BYTES,
} from "@/lib/proxy-fetch.js";

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(() => {
    console.info("Reddit Slideshow installed");
  });

  const redgifs = createRedgifsResolver();

  /**
   * Build a queue page, then upgrade any Redgifs iframe embeds to native
   * (proxied) video slides so they time and unmute correctly.
   * @param {string} pageUrl
   * @param {{ after?: string }} options
   */
  const fetchQueuePageWithRedgifs = async (pageUrl, options) => {
    const page = await fetchQueuePage(pageUrl, options);
    page.slides = await resolveRedgifsSlides(page.slides, redgifs.resolve);
    return page;
  };

  const router = createMessageRouter({
    runtimeId: browser.runtime.id,
    fetchQueuePage: fetchQueuePageWithRedgifs,
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
      } catch {
        console.info("Reddit Slideshow: open a Reddit listing first");
      }
    },
  );
});
