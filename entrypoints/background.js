import { fetchListingJson } from "@/lib/reddit-listing.js";
import { fetchQueuePage } from "@/lib/queue.js";

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(() => {
    console.info("Reddit Slideshow installed");
  });

  browser.runtime.onMessage.addListener((message) => {
    if (message?.type === "slideshow.probeListing") {
      return handleProbe(message);
    }
    if (message?.type === "slideshow.requestPage") {
      return handleRequestPage(message);
    }
    return undefined;
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

/**
 * @param {any} message
 */
function handleProbe(message) {
  const pageUrl = message.payload?.pageUrl;
  if (typeof pageUrl !== "string") {
    return Promise.resolve(missingPageUrl());
  }

  return fetchListingJson(pageUrl)
    .then(({ summary }) => {
      console.info("Reddit Slideshow listing diagnostic", summary);
      return { ok: true, summary };
    })
    .catch((error) => {
      const payload = errorPayload(error);
      console.info("Reddit Slideshow listing diagnostic failed", payload);
      return { ok: false, error: payload };
    });
}

/**
 * @param {any} message
 */
function handleRequestPage(message) {
  const pageUrl = message.payload?.pageUrl;
  if (typeof pageUrl !== "string") {
    return Promise.resolve(missingPageUrl());
  }
  const after = message.payload?.after;
  const options = typeof after === "string" ? { after } : {};

  return fetchQueuePage(pageUrl, options)
    .then((page) => ({
      ok: true,
      page: {
        slides: page.slides,
        after: page.after,
        before: page.before,
        postsScanned: page.postsScanned,
        exhausted: page.exhausted,
      },
    }))
    .catch((error) => ({ ok: false, error: errorPayload(error) }));
}

function missingPageUrl() {
  return {
    ok: false,
    error: { code: "missing-page-url", message: "Missing old Reddit page URL" },
  };
}

/**
 * @param {any} error
 */
function errorPayload(error) {
  return {
    code: error?.name ?? "listing-fetch-failed",
    message: error?.message,
    status: error?.status,
    jsonUrl: error?.jsonUrl,
  };
}
