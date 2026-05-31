/**
 * @typedef {import("./slides.js").Slide} Slide
 */

export const MEDIA_CLASS = "reddit-slideshow-media";

/**
 * Build a DOM element that renders a slide's media.
 *
 * CSP-safe: attributes only, never innerHTML. old.reddit.com sets no CSP, and
 * www.reddit.com's logged-in CSP permits our media hosts (img-src https:,
 * media-src *.redd.it, frame-src redgifs.com), so cross-origin media loads
 * directly from content-script-injected elements.
 *
 * @param {Slide} slide
 * @param {Document} [doc]
 * @returns {HTMLElement}
 */
export function renderSlide(slide, doc = document) {
  let element;
  switch (slide.kind) {
    case "video":
      element = renderVideo(slide, doc);
      break;
    case "embed":
      element = renderEmbed(slide, doc);
      break;
    case "image":
    default:
      element = renderImage(slide, doc);
      break;
  }
  element.classList.add(MEDIA_CLASS);
  element.dataset.provider = slide.provider;
  element.dataset.slideId = slide.id;
  applyAspectRatio(element, slide);
  return element;
}

/**
 * @param {Slide} slide
 * @param {Document} doc
 * @returns {HTMLImageElement}
 */
function renderImage(slide, doc) {
  const img = doc.createElement("img");
  img.alt = slide.title;
  img.decoding = "async";
  // The on-screen image outranks the background preloads for the next slides.
  img.setAttribute("fetchpriority", "high");
  // old.reddit.com sends no CSP, so validate before the sink: HTTPS only (any
  // host - image posts legitimately link to external hosts).
  const src = safeMediaUrl(slide.mediaUrl);
  if (src) img.src = src;
  return img;
}

/**
 * @param {Slide} slide
 * @param {Document} doc
 * @returns {HTMLVideoElement}
 */
function renderVideo(slide, doc) {
  const video = doc.createElement("video");
  // Proxied media (Redgifs) gets a blob: src set asynchronously by the overlay;
  // its real mediaUrl would 403 if loaded directly from a reddit page. The
  // direct (non-proxied) src is gated to Reddit-hosted video.
  if (!slide.proxied) {
    const src = safeMediaUrl(slide.mediaUrl, VIDEO_HOSTS);
    if (src) video.src = src;
  }
  // v1 plays the silent fallback_url; mute keeps autoplay allowed.
  video.muted = true;
  video.autoplay = true;
  video.playsInline = true;
  video.loop = Boolean(slide.isGif);
  // Real videos keep the native control bar (play/pause, scrub, mute) the user
  // sees on Reddit; a silent looping gif plays like an animated image - no bar.
  video.controls = !slide.isGif;
  video.preload = "auto";
  return video;
}

/**
 * @param {Slide} slide
 * @param {Document} doc
 * @returns {HTMLIFrameElement}
 */
function renderEmbed(slide, doc) {
  const iframe = doc.createElement("iframe");
  const src = safeEmbedUrl(slide.embedUrl ?? slide.mediaUrl);
  if (src) iframe.src = src;
  iframe.allow = "autoplay; fullscreen";
  // Let the provider's player run, but deny it top-navigation, popups, and form
  // submission so a third-party embed cannot hijack the Reddit tab. No
  // allow-same-origin: with allow-scripts it would let the embed act as its real
  // origin (the known sandbox foot-gun).
  iframe.setAttribute("sandbox", "allow-scripts allow-presentation");
  iframe.setAttribute("allowfullscreen", "true");
  iframe.setAttribute("scrolling", "no");
  iframe.setAttribute("frameborder", "0");
  return iframe;
}

// Non-proxied (direct) video hosts: Reddit's own, plus Catbox direct files,
// which don't hotlink-protect (ADR 0012). Images can come from external hosts,
// so they're gated on protocol only.
const VIDEO_HOSTS = new Set(["v.redd.it", "files.catbox.moe"]);

/**
 * Validate a media URL before it reaches an <img>/<video> src. HTTPS is
 * required; when `hosts` is given the URL's host must be allow-listed.
 * @param {string | undefined} url
 * @param {Set<string>} [hosts]
 * @returns {string | undefined}
 */
function safeMediaUrl(url, hosts) {
  if (typeof url !== "string") return undefined;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return undefined;
    if (hosts && !hosts.has(parsed.hostname)) return undefined;
    return parsed.toString();
  } catch {
    return undefined;
  }
}

/**
 * Whether a slide's media is loadable directly from its display sink, mirroring
 * the per-kind gating above so the overlay can skip an unsafe slide instead of
 * waiting on a load that never comes.
 * @param {Slide} slide
 * @returns {boolean}
 */
export function mediaUrlIsSafe(slide) {
  if (slide.kind === "image") return Boolean(safeMediaUrl(slide.mediaUrl));
  if (slide.kind === "video" && !slide.proxied) {
    return Boolean(safeMediaUrl(slide.mediaUrl, VIDEO_HOSTS));
  }
  if (slide.kind === "embed") {
    return Boolean(safeEmbedUrl(slide.embedUrl ?? slide.mediaUrl));
  }
  return true; // proxied video (blob) is validated elsewhere
}

// Embeds only ever come from approved hosts; restrict the iframe src accordingly
// so untrusted listing data can't point it at an arbitrary or non-HTTPS origin.
// streamable.com is the Streamable iframe fallback when API resolution fails.
const EMBED_HOSTS = new Set(["www.redgifs.com", "streamable.com"]);

/**
 * @param {string | undefined} src
 * @returns {string | undefined}
 */
function safeEmbedUrl(src) {
  if (typeof src !== "string") return undefined;
  try {
    const url = new URL(src);
    if (url.protocol !== "https:" || !EMBED_HOSTS.has(url.hostname)) {
      return undefined;
    }
    return url.toString();
  } catch {
    return undefined;
  }
}

/**
 * @param {HTMLElement} element
 * @param {Slide} slide
 */
function applyAspectRatio(element, slide) {
  // Images size themselves; video/iframe need a hint to lay out before load.
  if (slide.kind === "image") return;
  if (slide.sourceWidth && slide.sourceHeight) {
    element.style.aspectRatio = `${slide.sourceWidth} / ${slide.sourceHeight}`;
  }
}
