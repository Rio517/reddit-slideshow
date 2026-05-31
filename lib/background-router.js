/**
 * Background message router. Pure/injectable so the trust boundary (sender
 * validation) and message handling can be unit-tested without the extension.
 *
 * @param {{
 *   runtimeId: string,
 *   fetchQueuePage: (pageUrl: string, options: { after?: string }) => Promise<any>,
 *   fetchImageBytes: (url: string) => Promise<ArrayBuffer>,
 *   openOptionsPage?: () => void,
 * }} deps
 * @returns {(message: any, sender: any) => Promise<any> | undefined}
 */
export function createMessageRouter(deps) {
  return (message, sender) => {
    // Only handle messages from this extension's own content scripts.
    if (sender?.id !== deps.runtimeId) return undefined;
    if (message?.type === "slideshow.requestPage") {
      return handleRequestPage(message, deps.fetchQueuePage);
    }
    if (message?.type === "slideshow.fetchImage") {
      return handleFetchImage(message, deps.fetchImageBytes);
    }
    if (message?.type === "slideshow.openOptions") {
      deps.openOptionsPage?.();
      return Promise.resolve({ ok: true });
    }
    return undefined;
  };
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
        before: page.before,
        postsScanned: page.postsScanned,
        exhausted: page.exhausted,
      },
    }))
    .catch((error) => ({ ok: false, error: errorPayload(error) }));
}

// Only Reddit image hosts are hashable (Layer 2). Explicit allowlist so the
// privileged background fetch can't be pointed elsewhere, independent of which
// host permissions happen to be granted.
const HASHABLE_HOSTS = new Set([
  "i.redd.it",
  "preview.redd.it",
  "external-preview.redd.it",
]);

/**
 * @param {any} message
 * @param {(url: string) => Promise<ArrayBuffer>} fetchImageBytes
 */
function handleFetchImage(message, fetchImageBytes) {
  const url = message.payload?.url;
  if (typeof url !== "string") {
    return Promise.resolve({ ok: false });
  }
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return Promise.resolve({ ok: false });
  }
  // Require HTTPS as well as an allowlisted host: a cleartext http://i.redd.it
  // URL would otherwise pass the host check and trigger a cleartext fetch.
  if (parsed.protocol !== "https:" || !HASHABLE_HOSTS.has(parsed.hostname)) {
    return Promise.resolve({ ok: false });
  }
  return fetchImageBytes(url)
    .then((bytes) => ({ ok: true, bytes }))
    .catch(() => ({ ok: false }));
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
