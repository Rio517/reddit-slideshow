import { fetchQueuePage } from "@/lib/queue.js";
import { createMessageRouter } from "@/lib/background-router.js";

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(() => {
    console.info("Reddit Slideshow installed");
  });

  const router = createMessageRouter({
    runtimeId: browser.runtime.id,
    fetchQueuePage,
    // Privileged fetch for Layer 2 dedup; works for hosts the content script's
    // page-CORS fetch can't reach (degrades to a rejected promise otherwise).
    fetchImageBytes: (url) =>
      fetch(url, { credentials: "omit" }).then((response) =>
        response.ok
          ? response.arrayBuffer()
          : Promise.reject(new Error(`HTTP ${response.status}`)),
      ),
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
        console.info("Reddit Slideshow: open an old.reddit.com listing first");
      }
    },
  );
});
