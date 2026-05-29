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
 * @property {number} [durationSeconds]
 * @property {string} [dashUrl]
 * @property {string} [hlsUrl]
 * @property {string} [embedUrl]
 * @property {boolean} [isGif]
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
 * Resolve a single listing post into zero or more slides.
 *
 * Crossposts carry their media inside `crosspost_parent_list[0]`, so media is
 * resolved from the parent while display context (id, title, permalink, NSFW
 * flag) stays with the post the user actually sees.
 *
 * @param {any} post
 * @returns {Slide[]}
 */
function slidesFromPost(post) {
  if (!post) return [];
  const media = post.crosspost_parent_list?.[0] ?? post;

  if (isGalleryPost(media)) return gallerySlides(media, post);
  if (isRedditVideoPost(media)) return redditVideoSlides(media, post);
  if (isRedgifsPost(media)) return redgifsSlides(media, post);
  return imageSlides(media, post);
}

/**
 * @param {any} media
 * @param {any} context
 * @returns {Slide[]}
 */
function imageSlides(media, context) {
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
      permalink: absoluteOldRedditUrl(context.permalink),
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
 * @returns {Slide[]}
 */
function gallerySlides(media, context) {
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
      permalink: absoluteOldRedditUrl(context.permalink),
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

  return slides;
}

/**
 * @param {any} media
 * @param {any} context
 * @returns {Slide[]}
 */
function redditVideoSlides(media, context) {
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
      permalink: absoluteOldRedditUrl(context.permalink),
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
 * @returns {Slide[]}
 */
function redgifsSlides(media, context) {
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
      permalink: absoluteOldRedditUrl(context.permalink),
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
function redgifsId(url) {
  if (!url) return undefined;
  const match = /\/(?:watch|ifr)\/([A-Za-z0-9]+)/.exec(pathnameOf(url) ?? "");
  return match ? match[1] : undefined;
}

/**
 * @param {string | undefined} url
 * @returns {string | undefined}
 */
function hostnameOf(url) {
  if (!url) return undefined;
  try {
    return new URL(url).hostname;
  } catch {
    return undefined;
  }
}

/**
 * @param {string | undefined} url
 * @returns {string | undefined}
 */
function pathnameOf(url) {
  if (!url) return undefined;
  try {
    return new URL(url).pathname;
  } catch {
    return undefined;
  }
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
