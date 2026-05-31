import { fetchQueuePage } from "@/lib/queue.js";
import { createMessageRouter } from "@/lib/background-router.js";
import { createRedgifsResolver, resolveRedgifsSlides } from "@/lib/redgifs.js";

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

  // Privileged background fetch; credentials omitted, and no Referer so the
  // Redgifs CDN (which 403s a reddit referer) serves the bytes.
  /** @param {string} url */
  const fetchBytes = (url) =>
    fetch(url, { credentials: "omit", referrerPolicy: "no-referrer" }).then(
      (response) =>
        response.ok
          ? response.arrayBuffer()
          : Promise.reject(new Error(`HTTP ${response.status}`)),
    );

  const router = createMessageRouter({
    runtimeId: browser.runtime.id,
    fetchQueuePage: fetchQueuePageWithRedgifs,
    // Layer 2 dedup image bytes (hosts the content script's page-CORS fetch
    // can't reach).
    fetchImageBytes: fetchBytes,
    // Redgifs mp4 bytes, played back as a blob to dodge CDN hotlink protection.
    fetchMediaBytes: fetchBytes,
    openOptionsPage: () => browser.runtime.openOptionsPage(),
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
