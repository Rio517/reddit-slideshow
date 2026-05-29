/**
 * @typedef {import("./slides.js").Slide} Slide
 */

export const MEDIA_CLASS = "reddit-slideshow-media";

/**
 * Build a DOM element that renders a slide's media.
 *
 * CSP-safe: attributes only, never innerHTML. old.reddit.com sets no CSP, so
 * cross-origin media (i.redd.it, preview.redd.it, v.redd.it, redgifs.com) loads
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
  img.src = slide.mediaUrl;
  img.alt = slide.title;
  img.decoding = "async";
  return img;
}

/**
 * @param {Slide} slide
 * @param {Document} doc
 * @returns {HTMLVideoElement}
 */
function renderVideo(slide, doc) {
  const video = doc.createElement("video");
  video.src = slide.mediaUrl;
  // v1 plays the silent fallback_url; mute keeps autoplay allowed.
  video.muted = true;
  video.autoplay = true;
  video.playsInline = true;
  video.controls = false;
  video.loop = Boolean(slide.isGif);
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
  iframe.src = slide.embedUrl ?? slide.mediaUrl;
  iframe.allow = "autoplay; fullscreen; encrypted-media";
  iframe.setAttribute("allowfullscreen", "true");
  iframe.setAttribute("scrolling", "no");
  iframe.setAttribute("frameborder", "0");
  return iframe;
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
