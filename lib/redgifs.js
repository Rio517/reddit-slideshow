import { redgifsId } from "./slides.js";

/**
 * Redgifs native-video support.
 *
 * Redgifs links arrive from Reddit as an iframe embed (`/ifr/<id>`), which we
 * can't time (no duration, no `ended`) or unmute (cross-origin). Instead we
 * resolve the direct mp4 (plus duration and audio flag) from the Redgifs API
 * and play it as a native `<video>`, which fixes both. The Redgifs CDN
 * hotlink-protects by `Referer` (a reddit referer gets 403), so the actual mp4
 * bytes are fetched by the background and played as a blob — see the `proxied`
 * slide flag and `slideshow.fetchMedia`.
 */

const AUTH_URL = "https://api.redgifs.com/v2/auth/temporary";
const GIF_URL = "https://api.redgifs.com/v2/gifs/";

/**
 * @typedef {object} RedgifsMedia
 * @property {string} mediaUrl Direct mp4 (hd) URL.
 * @property {number} [durationSeconds]
 * @property {boolean} hasAudio
 * @property {number} [sourceWidth]
 * @property {number} [sourceHeight]
 */

/**
 * Resolve Redgifs ids to direct mp4 URLs, caching the anonymous temporary token
 * and refreshing it once on a 401.
 *
 * @param {{ fetchImpl?: typeof fetch }} [deps]
 */
export function createRedgifsResolver({ fetchImpl = fetch } = {}) {
  /** @type {string | null} */
  let token = null;

  /**
   * @param {boolean} [force]
   * @returns {Promise<string>}
   */
  async function getToken(force) {
    if (token && !force) return token;
    const res = await fetchImpl(AUTH_URL);
    if (!res.ok) throw new Error(`Redgifs auth HTTP ${res.status}`);
    const next = (await res.json())?.token;
    if (!next) throw new Error("Redgifs auth: no token");
    token = next;
    return next;
  }

  /**
   * @param {string} id
   * @returns {Promise<RedgifsMedia>}
   */
  async function resolve(id) {
    /** @param {string} t */
    const get = (t) =>
      fetchImpl(GIF_URL + id, { headers: { Authorization: `Bearer ${t}` } });

    let res = await get(await getToken());
    if (res.status === 401) res = await get(await getToken(true));
    if (!res.ok) throw new Error(`Redgifs gif HTTP ${res.status}`);

    const gif = (await res.json())?.gif;
    const mediaUrl = gif?.urls?.hd ?? gif?.urls?.sd;
    if (!mediaUrl) throw new Error("Redgifs gif: no mp4 url");
    return {
      mediaUrl,
      durationSeconds:
        typeof gif.duration === "number" ? gif.duration : undefined,
      hasAudio: Boolean(gif.hasAudio),
      sourceWidth: gif.width,
      sourceHeight: gif.height,
    };
  }

  return { resolve };
}

/**
 * Turn a Redgifs iframe-embed slide into a proxied native-video slide.
 *
 * @param {import("./slides.js").Slide} slide
 * @param {RedgifsMedia} media
 * @returns {import("./slides.js").Slide}
 */
export function redgifsVideoSlide(slide, media) {
  return {
    ...slide,
    kind: "video",
    mediaUrl: media.mediaUrl,
    durationMode: "media",
    durationSeconds: media.durationSeconds,
    audioAvailable: media.hasAudio,
    sourceWidth: media.sourceWidth ?? slide.sourceWidth,
    sourceHeight: media.sourceHeight ?? slide.sourceHeight,
    mimeType: "video/mp4",
    proxied: true,
  };
}

/**
 * Upgrade every Redgifs embed slide in a page to a proxied native-video slide.
 * Resolution failures keep the original iframe embed, so Redgifs still shows.
 *
 * @param {import("./slides.js").Slide[]} slides
 * @param {(id: string) => Promise<RedgifsMedia>} resolve
 * @returns {Promise<import("./slides.js").Slide[]>}
 */
export function resolveRedgifsSlides(slides, resolve) {
  return Promise.all(
    slides.map(async (slide) => {
      if (slide.provider !== "redgifs" || slide.kind !== "embed") return slide;
      const id = redgifsId(slide.sourceUrl ?? slide.embedUrl);
      if (!id) return slide;
      try {
        return redgifsVideoSlide(slide, await resolve(id));
      } catch {
        return slide; // keep the iframe embed fallback
      }
    }),
  );
}
