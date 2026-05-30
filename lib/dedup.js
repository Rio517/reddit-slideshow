/**
 * Duplicate detection for the slideshow queue (see ADR 0006).
 *
 * Layer 1 (identity key) is synchronous and always available. The perceptual
 * difference-hash helpers support the opt-in Layer 2 and are pure so they can be
 * unit-tested without a browser.
 *
 * @typedef {import("./slides.js").Slide} Slide
 */

/**
 * Stable identity key for a slide's media, so the same upload dedups across
 * hosts, preview sizes, crossposts, and galleries.
 *
 * @param {Slide} slide
 * @returns {string}
 */
export function mediaKey(slide) {
  if (slide.provider === "redgifs") {
    const id = redgifsId(slide.embedUrl ?? slide.sourceUrl ?? slide.mediaUrl);
    if (id) return `redgifs:${id}`;
  }
  if (slide.provider === "reddit-video") {
    const id = vredditId(slide.sourceUrl ?? slide.mediaUrl);
    if (id) return `vreddit:${id}`;
  }
  const url = slide.mediaUrl ?? slide.sourceUrl;
  const host = hostnameOf(url);
  const base = basename(url);
  if (host && host.endsWith("redd.it") && base) {
    return `reddit:${base}`;
  }
  return `url:${pathnameOf(url) ?? url ?? ""}`;
}

/**
 * 64-bit difference hash (dHash) from a 9x8 grayscale luminance grid (row-major,
 * width*height values). Compares horizontally adjacent pixels.
 *
 * @param {ArrayLike<number>} luminance
 * @param {number} [width]
 * @param {number} [height]
 * @returns {string} 16-character hex string
 */
export function differenceHash(luminance, width = 9, height = 8) {
  let bits = "";
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width - 1; x += 1) {
      const left = luminance[y * width + x];
      const right = luminance[y * width + x + 1];
      bits += left > right ? "1" : "0";
    }
  }
  let hex = "";
  for (let i = 0; i < bits.length; i += 4) {
    hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
  }
  return hex;
}

/**
 * Hamming distance between two 64-bit hex hashes (16 hex chars). Split into two
 * 32-bit words and popcount each — no BigInt allocation per comparison.
 *
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function hammingDistanceHex(a, b) {
  const aHi = parseInt(a.slice(0, 8), 16);
  const aLo = parseInt(a.slice(8, 16), 16);
  const bHi = parseInt(b.slice(0, 8), 16);
  const bLo = parseInt(b.slice(8, 16), 16);
  return popcount32(aHi ^ bHi) + popcount32(aLo ^ bLo);
}

/**
 * Population count of a 32-bit integer (SWAR).
 * @param {number} value
 * @returns {number}
 */
function popcount32(value) {
  let v = value | 0;
  v = v - ((v >> 1) & 0x55555555);
  v = (v & 0x33333333) + ((v >> 2) & 0x33333333);
  return (Math.imul((v + (v >> 4)) & 0x0f0f0f0f, 0x01010101) >> 24) & 0xff;
}

/**
 * Session-scoped tracker of media already shown. Layer 1 keys are exact;
 * Layer 2 hashes match within a Hamming threshold.
 */
export class DuplicateTracker {
  /**
   * @param {{ hashThreshold?: number }} [options]
   */
  constructor(options = {}) {
    this.hashThreshold = options.hashThreshold ?? 5;
    /** @type {Set<string>} */
    this.keys = new Set();
    /** @type {string[]} */
    this.hashes = [];
  }

  /**
   * Return the slides whose identity key has not been seen yet, recording each
   * new key. Drops exact reposts, crossposts, and repeated galleries.
   *
   * @param {Slide[]} slides
   * @returns {Slide[]}
   */
  filterNewByKey(slides) {
    /** @type {Slide[]} */
    const fresh = [];
    for (const slide of slides) {
      const key = mediaKey(slide);
      if (this.keys.has(key)) continue;
      this.keys.add(key);
      fresh.push(slide);
    }
    return fresh;
  }

  /**
   * @param {string} hex
   * @returns {boolean}
   */
  isDuplicateHash(hex) {
    return this.hashes.some(
      (seen) => hammingDistanceHex(seen, hex) <= this.hashThreshold,
    );
  }

  /** @param {string} hex */
  addHash(hex) {
    this.hashes.push(hex);
  }
}

/**
 * @param {string | undefined} url
 * @returns {string | undefined}
 */
function redgifsId(url) {
  const match = /\/(?:watch|ifr)\/([A-Za-z0-9]+)/.exec(pathnameOf(url) ?? "");
  return match ? match[1] : undefined;
}

/**
 * @param {string | undefined} url
 * @returns {string | undefined}
 */
function vredditId(url) {
  const segment = (pathnameOf(url) ?? "").split("/").filter(Boolean)[0];
  return segment || undefined;
}

/**
 * @param {string | undefined} url
 * @returns {string | undefined}
 */
function basename(url) {
  const last = (pathnameOf(url) ?? "").split("/").filter(Boolean).pop();
  if (!last) return undefined;
  const dot = last.lastIndexOf(".");
  return dot > 0 ? last.slice(0, dot) : last;
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
