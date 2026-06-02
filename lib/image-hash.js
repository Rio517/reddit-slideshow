import { differenceHash, luminanceFromImageData } from "./dedup.js";

/**
 * Background-side perceptual hasher (ADR 0006 Layer 2). The privileged context
 * already fetches the image bytes; it also decodes + downscales them to 9x8 and
 * returns just the 16-char dHash hex, so only the hash - not megabytes - crosses
 * the runtime.sendMessage boundary to the content script (a raw ArrayBuffer is
 * dropped by Chrome's JSON message serialization). createImageBitmap and
 * OffscreenCanvas exist in both the Chrome service worker and the FF event page;
 * `decode` is injectable so the glue is unit-testable without them.
 *
 * @param {{
 *   fetchBytes: (url: string) => Promise<ArrayBuffer>,
 *   decode?: (bytes: ArrayBuffer) => Promise<{ data: ArrayLike<number> } | null>,
 * }} deps
 * @returns {(url: string) => Promise<string | null>}
 */
export function createImageHasher({ fetchBytes, decode = decodeTo9x8 }) {
  return async function hashImage(url) {
    const bytes = await fetchBytes(url);
    const imageData = await decode(bytes);
    if (!imageData) return null;
    return differenceHash(luminanceFromImageData(imageData, 9, 8), 9, 8);
  };
}

/**
 * Decode encoded image bytes and downscale to a 9x8 ImageData. Browser-only
 * (createImageBitmap / OffscreenCanvas), so it's the injected default.
 * @param {ArrayBuffer} bytes
 * @returns {Promise<ImageData | null>}
 */
async function decodeTo9x8(bytes) {
  const bitmap = await createImageBitmap(new Blob([bytes]));
  const canvas = new OffscreenCanvas(9, 8);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close(); // free the decoded pixels even on the (unlikely) null ctx
    return null;
  }
  ctx.drawImage(bitmap, 0, 0, 9, 8);
  bitmap.close();
  return ctx.getImageData(0, 0, 9, 8);
}
