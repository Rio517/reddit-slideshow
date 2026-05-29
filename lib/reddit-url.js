const SUPPORTED_HOSTS = new Set(["old.reddit.com"]);

/**
 * Convert an old Reddit listing page URL to its JSON listing URL.
 *
 * @param {string} pageUrl
 * @param {{ after?: string }} [options]
 * @returns {string}
 */
export function toListingJsonUrl(pageUrl, options = {}) {
  const url = new URL(pageUrl);
  if (!SUPPORTED_HOSTS.has(url.hostname)) {
    throw new Error("Unsupported Reddit listing URL");
  }
  if (/\/comments\//.test(url.pathname)) {
    throw new Error("Unsupported Reddit listing URL");
  }

  let pathname = url.pathname;
  if (!pathname.endsWith("/") && !pathname.endsWith(".json")) {
    pathname = `${pathname}/`;
  }
  if (!pathname.endsWith(".json")) {
    pathname = `${pathname}.json`;
  }

  const output = new URL(url.href);
  output.pathname = pathname;
  output.searchParams.set("raw_json", "1");
  if (options.after) {
    output.searchParams.set("after", options.after);
  }
  return output.toString();
}
