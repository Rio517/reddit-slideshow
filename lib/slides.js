const OLD_REDDIT_ORIGIN = "https://old.reddit.com";

/**
 * @param {any} listing Reddit listing JSON in raw_json=1 form.
 * @returns {Array<object>}
 */
export function slidesFromListing(listing) {
  const children = listing?.data?.children ?? [];
  return children.flatMap((child) => slidesFromPost(child.data));
}

function slidesFromPost(post) {
  const url = post?.url_overridden_by_dest;
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

function isImagePost(post, url) {
  if (post.post_hint === "image") return true;
  return /\.(avif|gif|jpe?g|png|webp)(\?.*)?$/i.test(url);
}

function absoluteOldRedditUrl(permalink) {
  if (!permalink) return undefined;
  return new URL(permalink, OLD_REDDIT_ORIGIN).toString();
}

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

function filenameHint(post, url) {
  const extension = new URL(url).pathname.split(".").pop() || "jpg";
  const slug = (post.title ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug ? `${post.name}-${slug}.${extension}` : `${post.name}.${extension}`;
}
