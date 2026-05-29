import { fetchListingJson } from "@/lib/reddit-listing.js";

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(() => {
    console.info("Reddit Slideshow installed");
  });

  browser.runtime.onMessage.addListener((message) => {
    if (message?.type !== "slideshow.probeListing") return undefined;
    const pageUrl = message.payload?.pageUrl;
    if (typeof pageUrl !== "string") {
      return Promise.resolve({
        ok: false,
        error: {
          code: "missing-page-url",
          message: "Missing old Reddit page URL",
        },
      });
    }

    return fetchListingJson(pageUrl)
      .then(({ summary }) => {
        console.info("Reddit Slideshow listing diagnostic", summary);
        return { ok: true, summary };
      })
      .catch((error) => {
        const payload = {
          code: error.name ?? "listing-fetch-failed",
          message: error.message,
          status: error.status,
          jsonUrl: error.jsonUrl,
        };
        console.info("Reddit Slideshow listing diagnostic failed", payload);
        return {
          ok: false,
          error: payload,
        };
      });
  });

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
