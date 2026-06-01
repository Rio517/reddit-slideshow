/**
 * Single source of truth for the host allowlists that gate media loading.
 *
 * The playback sink (overlay-render) and the privileged background proxy fetch
 * (background-router) are trust boundaries, and the provider resolvers validate
 * third-party API responses against the same facts. Declaring each host once
 * here keeps those lists from drifting apart (a silent drift fails closed: the
 * media just won't load).
 */

// Direct-playable video hosts: Reddit's own and Catbox direct files, which
// don't hotlink-protect (ADR 0012). Exact match.
export const DIRECT_VIDEO_HOSTS = ["v.redd.it", "files.catbox.moe"];
// Streamable's per-video CDN (cdn-*.streamable.com) serves the mp4 directly to
// a reddit page; the subdomain varies, so match by dot-prefixed suffix (the
// leading dot blocks look-alikes like "evilstreamable.com"). ADR 0013.
export const STREAMABLE_HOST_SUFFIX = ".streamable.com";
export const DIRECT_VIDEO_HOST_SUFFIXES = [STREAMABLE_HOST_SUFFIX];
// First-party iframe-embed fallbacks, used when native resolution fails.
export const EMBED_HOSTS = ["www.redgifs.com", "streamable.com"];

// Redgifs API mp4 host; the third-party API response is validated against it.
export const REDGIFS_MEDIA_HOST = "media.redgifs.com";
// Media the background proxies to a blob because the CDN 403s a reddit Referer
// (Redgifs; Imgur .gifv -> .mp4, ADR 0011). Exact match.
export const PROXY_MEDIA_HOSTS = [REDGIFS_MEDIA_HOST, "i.imgur.com"];
// Proxied providers served from varying CDN subdomains (Streamable ADR 0013,
// Giphy ADR 0014): suffix match.
export const PROXY_MEDIA_HOST_SUFFIXES = [STREAMABLE_HOST_SUFFIX, ".giphy.com"];
// Image hosts whose bytes the background may fetch for Layer-2 perceptual
// dedup (ADR 0006/0015). Exact match.
export const HASHABLE_HOSTS = [
  "i.redd.it",
  "preview.redd.it",
  "external-preview.redd.it",
  "i.imgur.com",
];

/**
 * Host allowlist matcher: exact host in `hosts`, or ending with one of
 * `suffixes`. The matching used by every media trust gate, declared once.
 * @param {string} host
 * @param {{ hosts?: readonly string[], suffixes?: readonly string[] }} allow
 * @returns {boolean}
 */
export function hostMatches(host, { hosts = [], suffixes = [] }) {
  return (
    hosts.includes(host) || suffixes.some((suffix) => host.endsWith(suffix))
  );
}

/**
 * Whether a host is Streamable (the watch domain or any CDN subdomain). Used by
 * the resolver's response validation and listing-provider detection.
 * @param {string | undefined} host
 * @returns {boolean}
 */
export function isStreamableHost(host) {
  return (
    !!host &&
    (host === "streamable.com" || host.endsWith(STREAMABLE_HOST_SUFFIX))
  );
}
