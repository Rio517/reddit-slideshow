import { createLogger } from "./log.js";

const log = createLogger("background");

/**
 * Background message router. Pure/injectable so the trust boundary (sender
 * validation) and message handling can be unit-tested without the extension.
 *
 * @param {{
 *   runtimeId: string,
 *   fetchQueuePage: (pageUrl: string, options: { after?: string }) => Promise<any>,
 *   fetchImageBytes: (url: string) => Promise<ArrayBuffer>,
 *   fetchMediaBytes?: (url: string) => Promise<ArrayBuffer>,
 *   openOptionsPage?: () => void,
 *   openPopout?: (url: string) => void,
 * }} deps
 * @returns {(message: any, sender: any) => Promise<any> | undefined}
 */
export function createMessageRouter(deps) {
  return (message, sender) => {
    // Only handle messages from this extension's own content scripts.
    if (sender?.id !== deps.runtimeId) return undefined;
    // Privileged fetches must come from a content script (which has a `tab`),
    // not an extension page (options/popup) where `sender.tab` is undefined.
    const fromContentScript = sender?.tab != null;
    if (message?.type === "slideshow.requestPage") {
      // The session-authenticated listing fetch is privileged too.
      if (!fromContentScript) return Promise.resolve({ ok: false });
      return handleRequestPage(message, deps.fetchQueuePage);
    }
    if (message?.type === "slideshow.fetchImage") {
      if (!fromContentScript) return Promise.resolve({ ok: false });
      return proxyFetch(message, deps.fetchImageBytes, isHashableHost);
    }
    if (message?.type === "slideshow.fetchMedia") {
      if (!fromContentScript) return Promise.resolve({ ok: false });
      return proxyFetch(message, deps.fetchMediaBytes, isProxyMediaHost);
    }
    if (message?.type === "slideshow.openOptions") {
      deps.openOptionsPage?.();
      return Promise.resolve({ ok: true });
    }
    if (message?.type === "slideshow.openPopout") {
      // Opening a window is content-script-only and host-restricted, so a page
      // script can't use the extension to spawn arbitrary windows.
      if (!fromContentScript) return Promise.resolve({ ok: false });
      return handleOpenPopout(message, deps.openPopout);
    }
    return undefined;
  };
}

// A popout may only be opened on the listing frontends.
const POPOUT_HOSTS = new Set(["old.reddit.com", "www.reddit.com"]);

/**
 * @param {any} message
 * @param {((url: string) => void) | undefined} openPopout
 */
function handleOpenPopout(message, openPopout) {
  const url = message.payload?.url;
  if (typeof openPopout !== "function" || typeof url !== "string") {
    return Promise.resolve({ ok: false });
  }
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return Promise.resolve({ ok: false });
  }
  if (parsed.protocol !== "https:" || !POPOUT_HOSTS.has(parsed.hostname)) {
    return Promise.resolve({ ok: false });
  }
  openPopout(url);
  return Promise.resolve({ ok: true });
}

/**
 * @param {any} message
 * @param {(pageUrl: string, options: { after?: string }) => Promise<any>} fetchQueuePage
 */
function handleRequestPage(message, fetchQueuePage) {
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
        postsScanned: page.postsScanned,
        exhausted: page.exhausted,
      },
    }))
    .catch((error) => ({ ok: false, error: errorPayload(error) }));
}

// Hosts whose images are hashable (Layer 2 perceptual dedup). Explicit allowlist
// so the privileged background fetch can't be pointed elsewhere, independent of
// which host permissions happen to be granted. i.imgur.com is included so Imgur
// album images dedup against reddit re-uploads and each other (ADR 0015).
const HASHABLE_HOSTS = new Set([
  "i.redd.it",
  "preview.redd.it",
  "external-preview.redd.it",
  "i.imgur.com",
]);
const isHashableHost = (/** @type {string} */ host) => HASHABLE_HOSTS.has(host);

// Hosts whose media the background proxies to a blob for playback: their CDNs
// 403/placeholder a reddit Referer (Redgifs; Imgur .gifv → .mp4, ADR 0011).
const PROXY_MEDIA_HOSTS = new Set(["media.redgifs.com", "i.imgur.com"]);
// Providers that serve media from varying CDN subdomains (Streamable per-video
// CDN, ADR 0013; Giphy media2./media3./…, ADR 0014) are matched by domain
// suffix. The leading dot is required, so a look-alike like
// "evilstreamable.com" does not match.
const PROXY_MEDIA_HOST_SUFFIXES = [".streamable.com", ".giphy.com"];
const isProxyMediaHost = (/** @type {string} */ host) =>
  PROXY_MEDIA_HOSTS.has(host) ||
  PROXY_MEDIA_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix));

/**
 * Validate a privileged background fetch (HTTPS + allowlisted host) and return
 * the bytes. Fails closed on any problem.
 *
 * @param {any} message
 * @param {((url: string) => Promise<ArrayBuffer>) | undefined} fetchBytes
 * @param {(host: string) => boolean} isAllowed
 */
function proxyFetch(message, fetchBytes, isAllowed) {
  const url = message.payload?.url;
  if (typeof fetchBytes !== "function" || typeof url !== "string") {
    return Promise.resolve({ ok: false });
  }
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    log.warn("proxyFetch: unparseable URL", url);
    return Promise.resolve({ ok: false });
  }
  // Require HTTPS as well as an allowlisted host: a cleartext http://i.redd.it
  // URL would otherwise pass the host check and trigger a cleartext fetch.
  if (parsed.protocol !== "https:" || !isAllowed(parsed.hostname)) {
    log.warn(
      "proxyFetch: host/protocol not allowed",
      parsed.protocol,
      parsed.hostname,
    );
    return Promise.resolve({ ok: false });
  }
  return fetchBytes(url)
    .then((bytes) => ({ ok: true, bytes }))
    .catch((err) => {
      log.warn("proxyFetch failed", url, err);
      return { ok: false };
    });
}

function missingPageUrl() {
  return {
    ok: false,
    error: { code: "missing-page-url", message: "Missing Reddit page URL" },
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
