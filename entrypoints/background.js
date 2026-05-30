import { fetchQueuePage } from "@/lib/queue.js";

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(() => {
    console.info("Reddit Slideshow installed");
  });

  browser.runtime.onMessage.addListener((message, sender) => {
    // Only handle messages from this extension's own content scripts.
    if (sender?.id !== browser.runtime.id) return undefined;
    if (message?.type === "slideshow.requestPage") {
      return handleRequestPage(message);
    }
    if (message?.type === "slideshow.fetchImage") {
      return handleFetchImage(message);
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

/**
 * Fetch image bytes for perceptual dedup (Layer 2). Privileged so it works for
 * hosts where the content script's page-CORS fetch would be blocked; degrades
 * to { ok: false } if the host permission was not granted.
 * @param {any} message
 */
function handleFetchImage(message) {
  const url = message.payload?.url;
  if (typeof url !== "string") {
    return Promise.resolve({ ok: false });
  }
  return fetch(url, { credentials: "omit" })
    .then((response) =>
      response.ok
        ? response.arrayBuffer()
        : Promise.reject(new Error(`HTTP ${response.status}`)),
    )
    .then((bytes) => ({ ok: true, bytes }))
    .catch(() => ({ ok: false }));
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
