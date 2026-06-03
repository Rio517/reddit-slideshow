/**
 * Reddit (`v.redd.it`) serves video and audio as separate DASH streams; the
 * `fallback_url` mp4 we play is silent. To recover sound we resolve the audio
 * track URL from the DASH manifest (`DASHPlaylist.mpd`) and play it from a
 * companion `<audio>` synced to the silent `<video>` (ADR 0018).
 */

/**
 * Extract the audio track URL from a reddit DASH manifest (MPD XML), resolved
 * against the manifest URL. Reddit serves audio as a sibling file whose name
 * contains "audio" (e.g. `DASH_AUDIO_128.mp4`), listed in a `<BaseURL>`; pick
 * that one. Returns null when the manifest has no audio track (a silent clip)
 * or can't be read.
 *
 * Regex-based, not DOMParser: the background runs in a service worker (Chrome)
 * where DOMParser is unavailable.
 *
 * @param {string} mpdXml
 * @param {string} manifestUrl
 * @returns {string | null}
 */
export function audioUrlFromDash(mpdXml, manifestUrl) {
  if (typeof mpdXml !== "string") return null;
  const baseUrls = [
    ...mpdXml.matchAll(/<BaseURL>\s*([^<\s][^<]*?)\s*<\/BaseURL>/gi),
  ].map((m) => m[1]);
  const audio = baseUrls.find((u) => /audio/i.test(u));
  if (!audio) return null;
  let resolved;
  let manifestHost;
  try {
    resolved = new URL(audio, manifestUrl);
    manifestHost = new URL(manifestUrl).hostname;
  } catch {
    return null;
  }
  // The manifest is third-party content. Trust the audio only on the manifest's
  // own host (v.redd.it), over HTTPS - never an off-host absolute BaseURL.
  if (resolved.protocol !== "https:" || resolved.hostname !== manifestHost) {
    return null;
  }
  return resolved.toString();
}
