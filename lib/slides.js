const OLD_REDDIT_ORIGIN = "https://old.reddit.com";

/**
 * @typedef {object} Slide
 * @property {string} id
 * @property {string | undefined} postId
 * @property {"reddit-image"} provider
 * @property {"image"} kind
 * @property {string} mediaUrl
 * @property {string} sourceUrl
 * @property {string | undefined} permalink
 * @property {string} title
 * @property {boolean} over18
 * @property {"timer"} durationMode
 * @property {boolean} audioAvailable
 * @property {number | undefined} sourceWidth
 * @property {number | undefined} sourceHeight
 * @property {"original" | "preview"} quality
 * @property {string | undefined} mimeType
 * @property {string} filenameHint
 */

/**
 * @param {any} listing Reddit listing JSON in raw_json=1 form.
 * @returns {Slide[]}
 */
export function slidesFromListing(listing) {
  /** @type {any[]} */
  const children = listing?.data?.children ?? [];
  return children.flatMap((child) => slidesFromPost(child.data));
}

/**
 * @param {any} post
 * @returns {Slide[]}
 */
function slidesFromPost(post) {
  const url = post?.url_overridden_by_dest ?? post?.url;
  if (!url || !isImagePost(post, url)) return [];

  const previewSource = post.preview?.images?.[0]?.source;
  const isOriginal = new URL(url).hostname === "i.redd.it";

  return [
    {
      id: `${post.name}:0`,
      postId: post.name,
      provider: "reddit-image",
      kind: "image",
      mediaUrl: url,
      sourceUrl: url,
      permalink: absoluteOldRedditUrl(post.permalink),
      title: post.title ?? "",
      over18: Boolean(post.over_18),
      durationMode: "timer",
      audioAvailable: false,
      sourceWidth: previewSource?.width,
      sourceHeight: previewSource?.height,
      quality: isOriginal ? "original" : "preview",
      mimeType: mimeTypeFromUrl(url),
      filenameHint: filenameHint(post, url),
    },
  ];
}

/**
 * @param {any} post
 * @param {string} url
 */
function isImagePost(post, url) {
  if (post.post_hint === "image") return true;
  return /\.(avif|gif|jpe?g|png|webp)(\?.*)?$/i.test(url);
}

/**
 * @param {string | undefined} permalink
 */
function absoluteOldRedditUrl(permalink) {
  if (!permalink) return undefined;
  return new URL(permalink, OLD_REDDIT_ORIGIN).toString();
}

/**
 * @param {string} url
 */
function mimeTypeFromUrl(url) {
  const pathname = new URL(url).pathname.toLowerCase();
  if (pathname.endsWith(".avif")) return "image/avif";
  if (pathname.endsWith(".gif")) return "image/gif";
  if (pathname.endsWith(".jpg") || pathname.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  if (pathname.endsWith(".png")) return "image/png";
  if (pathname.endsWith(".webp")) return "image/webp";
  return undefined;
}

/**
 * @param {any} post
 * @param {string} url
 */
function filenameHint(post, url) {
  const extension = new URL(url).pathname.split(".").pop() || "jpg";
  const slug = (post.title ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug
    ? `${post.name}-${slug}.${extension}`
    : `${post.name}.${extension}`;
}
