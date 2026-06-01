import { mapLimit, withTimeout } from "./async-pool.js";

/**
 * Shared upgrade flow for native-video providers (Redgifs, Streamable): both
 * arrive from Reddit as an iframe embed and are upgraded to a native `<video>`
 * resolved from the provider's API. Only the API call, response shape, and id
 * extractor differ - that lives in the per-provider modules; the embed→video
 * transform and the page-wide upgrade loop live here.
 *
 * @typedef {import("./slides.js").Slide} Slide
 */

/**
 * Media resolved from a provider API, ready to become a native-video slide.
 * @typedef {object} NativeMedia
 * @property {string} mediaUrl Direct mp4 URL.
 * @property {number} [durationSeconds]
 * @property {boolean} hasAudio
 * @property {number} [sourceWidth]
 * @property {number} [sourceHeight]
 */

/**
 * Turn a provider iframe-embed slide into a native-video slide. `proxied` marks
 * media whose bytes the background must fetch and play as a blob (CDNs that
 * block a reddit Referer); directly-playable CDNs leave it unset.
 *
 * @param {Slide} slide
 * @param {NativeMedia} media
 * @param {{ proxied?: boolean }} [opts]
 * @returns {Slide}
 */
export function toNativeVideoSlide(slide, media, { proxied = false } = {}) {
  /** @type {Slide} */
  const next = {
    ...slide,
    kind: "video",
    mediaUrl: media.mediaUrl,
    durationMode: "media",
    durationSeconds: media.durationSeconds,
    audioAvailable: media.hasAudio,
    sourceWidth: media.sourceWidth ?? slide.sourceWidth,
    sourceHeight: media.sourceHeight ?? slide.sourceHeight,
    mimeType: "video/mp4",
  };
  // Only set the flag when proxied, so direct providers keep the key absent.
  if (proxied) next.proxied = true;
  return next;
}

/**
 * Upgrade every embed slide of one provider to a native-video slide, resolving
 * its id against the provider API. Resolution failures (incl. timeouts) keep
 * the original iframe embed, so the provider still shows. Concurrency-limited
 * to avoid bursting the API; each resolve is bounded by a timeout.
 *
 * @param {Slide[]} slides
 * @param {(id: string) => Promise<NativeMedia>} resolve
 * @param {{
 *   provider: Slide["provider"],
 *   extractId: (url: string | undefined) => string | undefined,
 *   toSlide: (slide: Slide, media: NativeMedia) => Slide,
 *   concurrency: number,
 *   timeoutMs: number,
 *   setTimeoutImpl?: typeof setTimeout,
 *   log?: { warn: (...args: unknown[]) => void },
 * }} config
 * @returns {Promise<Slide[]>}
 */
export function resolveNativeSlides(slides, resolve, config) {
  const { provider, extractId, toSlide, concurrency, timeoutMs, log } = config;
  const setTimeoutImpl = config.setTimeoutImpl ?? setTimeout;

  /** @param {Slide} slide */
  const upgrade = async (slide) => {
    if (slide.provider !== provider || slide.kind !== "embed") return slide;
    const id = extractId(slide.sourceUrl ?? slide.embedUrl);
    if (!id) return slide;
    try {
      const media = await withTimeout(resolve(id), timeoutMs, setTimeoutImpl);
      return toSlide(slide, media);
    } catch (err) {
      log?.warn("native resolve failed, keeping iframe embed", id, err);
      return slide; // keep the iframe embed fallback
    }
  };

  return mapLimit(slides, concurrency, upgrade);
}
