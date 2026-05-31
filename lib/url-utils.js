/**
 * Parse the hostname from a URL, or undefined if it isn't a valid absolute URL.
 * @param {string | undefined} url
 * @returns {string | undefined}
 */
export function hostnameOf(url) {
  if (!url) return undefined;
  try {
    return new URL(url).hostname;
  } catch {
    return undefined;
  }
}

/**
 * Parse the pathname from a URL, or undefined if it isn't a valid absolute URL.
 * @param {string | undefined} url
 * @returns {string | undefined}
 */
export function pathnameOf(url) {
  if (!url) return undefined;
  try {
    return new URL(url).pathname;
  } catch {
    return undefined;
  }
}
