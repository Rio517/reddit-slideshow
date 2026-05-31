import { hostnameOf, pathnameOf } from "./url-utils.js";

const OLD_REDDIT_ORIGIN = "https://old.reddit.com";
const REDGIFS_EMBED_ORIGIN = "https://www.redgifs.com";

/**
 * @typedef {object} Slide
 * @property {string} id
 * @property {string | undefined} postId
 * @property {"reddit-image" | "reddit-gallery" | "reddit-video" | "redgifs"} provider
 * @property {"image" | "video" | "embed"} kind
 * @property {string} mediaUrl
 * @property {string} sourceUrl
 * @property {string | undefined} permalink
 * @property {string} title
 * @property {boolean} over18
 * @property {"timer" | "media"} durationMode
 * @property {boolean} audioAvailable
 * @property {number | undefined} sourceWidth
 * @property {number | undefined} sourceHeight
 * @property {"original" | "preview"} quality
 * @property {string | undefined} mimeType
 * @property {string} filenameHint
 * @property {number} [galleryIndex] 1-based position within a multi-image gallery
 *   post; unset for single images so the jump list can disambiguate galleries.
 * @property {number} [galleryTotal] Number of images in the gallery post.
 * @property {number} [durationSeconds]
 * @property {string} [dashUrl]
 * @property {string} [hlsUrl]
 * @property {string} [embedUrl]
 * @property {boolean} [isGif]
 * @property {boolean} [proxied] Media bytes must be fetched by the background
 *   and played as a blob (e.g. Redgifs, whose CDN blocks a reddit Referer).
 */

/**
 * @param {any} listing Reddit listing JSON in raw_json=1 form.
 * @param {string} [origin] Page origin used to resolve relative permalinks, so
 *   "open original" stays on the user's frontend. Defaults to old Reddit.
 * @returns {Slide[]}
 */
export function slidesFromListing(listing, origin = OLD_REDDIT_ORIGIN) {
  /** @type {any[]} */
  const children = listing?.data?.children ?? [];
  return children.flatMap((child) => slidesFromPost(child.data, origin));
}

/**
 * Resolve a single listing post into zero or more slides.
 *
 * Crossposts carry their media inside `crosspost_parent_list[0]`, so media is
 * resolved from the parent while display context (id, title, permalink, NSFW
 * flag) stays with the post the user actually sees.
 *
 * @param {any} post
 * @param {string} origin
 * @returns {Slide[]}
 */
function slidesFromPost(post, origin) {
  if (!post) return [];
  const media = post.crosspost_parent_list?.[0] ?? post;

  if (isGalleryPost(media)) return gallerySlides(media, post, origin);
  if (isRedditVideoPost(media)) return redditVideoSlides(media, post, origin);
  if (isRedgifsPost(media)) return redgifsSlides(media, post, origin);
  return imageSlides(media, post, origin);
}

/**
 * @param {any} media
 * @param {any} context
 * @param {string} origin
 * @returns {Slide[]}
 */
function imageSlides(media, context, origin) {
  const url = media.url_overridden_by_dest ?? media.url;
  if (!url || !isImagePost(media, url)) return [];

  const previewSource = media.preview?.images?.[0]?.source;
  const isOriginal = hostnameOf(url) === "i.redd.it";

  return [
    {
      id: `${context.name}:0`,
      postId: context.name,
      provider: "reddit-image",
      kind: "image",
      mediaUrl: url,
      sourceUrl: url,
      permalink: absolutePermalink(context.permalink, origin),
      title: context.title ?? "",
      over18: Boolean(context.over_18),
      durationMode: "timer",
      audioAvailable: false,
      sourceWidth: previewSource?.width,
      sourceHeight: previewSource?.height,
      quality: isOriginal ? "original" : "preview",
      mimeType: mimeTypeFromUrl(url),
      filenameHint: filenameHint(context, url),
    },
  ];
}

/**
 * @param {any} media
 * @param {any} context
 * @param {string} origin
 * @returns {Slide[]}
 */
function gallerySlides(media, context, origin) {
  /** @type {any[]} */
  const items = media.gallery_data?.items ?? [];
  /** @type {Slide[]} */
  const slides = [];

  for (const item of items) {
    const meta = media.media_metadata?.[item?.media_id];
    if (item?.is_deleted || meta?.status !== "valid" || !meta?.s?.u) continue;

    const url = meta.s.u;
    const index = slides.length;
    slides.push({
      id: `${context.name}:${index}`,
      postId: context.name,
      provider: "reddit-gallery",
      kind: "image",
      mediaUrl: url,
      sourceUrl: url,
      permalink: absolutePermalink(context.permalink, origin),
      title: context.title ?? "",
      over18: Boolean(context.over_18),
      durationMode: "timer",
      audioAvailable: false,
      sourceWidth: meta.s.x,
      sourceHeight: meta.s.y,
      quality: "original",
      mimeType: mimeTypeFromUrl(url),
      filenameHint: filenameHint(context, url, { index }),
    });
  }

  // Number the images so jump-list entries from one gallery (which share a
  // title) are distinguishable rather than looking like duplicates. Only when
  // there is more than one valid image — a lone image is not a "1/1".
  if (slides.length > 1) {
    const total = slides.length;
    slides.forEach((slide, i) => {
      slide.galleryIndex = i + 1;
      slide.galleryTotal = total;
    });
  }

  return slides;
}

/**
 * @param {any} media
 * @param {any} context
 * @param {string} origin
 * @returns {Slide[]}
 */
function redditVideoSlides(media, context, origin) {
  const video = redditVideoOf(media);
  const url = video?.fallback_url;
  if (!url) return [];

  const isGif = Boolean(video.is_gif);
  return [
    {
      id: `${context.name}:0`,
      postId: context.name,
      provider: "reddit-video",
      kind: "video",
      mediaUrl: url,
      sourceUrl: media.url ?? url,
      permalink: absolutePermalink(context.permalink, origin),
      title: context.title ?? "",
      over18: Boolean(context.over_18),
      durationMode: "media",
      audioAvailable: Boolean(video.has_audio) && !isGif,
      durationSeconds:
        typeof video.duration === "number" ? video.duration : undefined,
      sourceWidth: video.width,
      sourceHeight: video.height,
      quality: "original",
      mimeType: "video/mp4",
      dashUrl: video.dash_url,
      hlsUrl: video.hls_url,
      isGif,
      filenameHint: filenameHint(context, url, { extension: "mp4" }),
    },
  ];
}

/**
 * @param {any} media
 * @param {any} context
 * @param {string} origin
 * @returns {Slide[]}
 */
function redgifsSlides(media, context, origin) {
  const watchUrl = media.url_overridden_by_dest ?? media.url;
  const id = redgifsId(watchUrl);
  if (!id) return [];

  const embedUrl = `${REDGIFS_EMBED_ORIGIN}/ifr/${id}`;
  const oembed = media.secure_media?.oembed;
  return [
    {
      id: `${context.name}:0`,
      postId: context.name,
      provider: "redgifs",
      kind: "embed",
      mediaUrl: embedUrl,
      sourceUrl: watchUrl,
      permalink: absolutePermalink(context.permalink, origin),
      title: context.title ?? "",
      over18: Boolean(context.over_18),
      durationMode: "timer",
      audioAvailable: false,
      sourceWidth: oembed?.width,
      sourceHeight: oembed?.height,
      quality: "original",
      mimeType: undefined,
      embedUrl,
      filenameHint: filenameHint(context, watchUrl, { extension: "mp4" }),
    },
  ];
}

/**
 * @param {any} media
 */
function isGalleryPost(media) {
  return Boolean(
    media?.is_gallery && media?.gallery_data?.items && media?.media_metadata,
  );
}

/**
 * @param {any} media
 */
function redditVideoOf(media) {
  return media?.secure_media?.reddit_video ?? media?.media?.reddit_video;
}

/**
 * @param {any} media
 */
function isRedditVideoPost(media) {
  return Boolean(redditVideoOf(media));
}

/**
 * @param {any} media
 */
function isRedgifsPost(media) {
  if (media?.secure_media?.type === "redgifs.com") return true;
  const host = hostnameOf(media?.url_overridden_by_dest ?? media?.url);
  return Boolean(
    host && (host === "redgifs.com" || host.endsWith(".redgifs.com")),
  );
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
 * @param {string | undefined} url
 * @returns {string | undefined}
 */
export function redgifsId(url) {
  if (!url) return undefined;
  const match = /\/(?:watch|ifr)\/([A-Za-z0-9]+)/.exec(pathnameOf(url) ?? "");
  return match ? match[1] : undefined;
}

/**
 * Resolve a relative listing permalink against the page's origin.
 * @param {string | undefined} permalink
 * @param {string} origin
 */
function absolutePermalink(permalink, origin) {
  if (!permalink) return undefined;
  return new URL(permalink, origin).toString();
}

/**
 * @param {string} url
 * @returns {string | undefined}
 */
function mimeTypeFromUrl(url) {
  const pathname = (pathnameOf(url) ?? "").toLowerCase();
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
 * @param {any} context
 * @param {string} url
 * @param {{ index?: number, extension?: string }} [options]
 */
function filenameHint(context, url, options = {}) {
  const extension =
    options.extension ?? ((pathnameOf(url) ?? "").split(".").pop() || "jpg");
  const slug = (context.title ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  const base = slug ? `${context.name}-${slug}` : `${context.name}`;
  const indexSuffix =
    typeof options.index === "number" ? `-${options.index}` : "";
  return `${base}${indexSuffix}.${extension}`;
}
