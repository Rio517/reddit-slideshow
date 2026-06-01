import { describe, expect, it } from "vitest";
import {
  resolveNativeSlides,
  toNativeVideoSlide,
} from "../../lib/provider-resolve.js";

/** @param {Record<string, unknown>} [o] */
const embed = (o = {}) =>
  /** @type {any} */ ({
    provider: "redgifs",
    kind: "embed",
    sourceUrl: "https://www.redgifs.com/watch/abc",
    embedUrl: "https://www.redgifs.com/ifr/abc",
    title: "t",
    sourceWidth: 10,
    sourceHeight: 20,
    ...o,
  });

describe("toNativeVideoSlide", () => {
  it("maps media onto a native-video slide, preserving display context", () => {
    const out = toNativeVideoSlide(embed(), {
      mediaUrl: "https://media.redgifs.com/x.mp4",
      durationSeconds: 9,
      hasAudio: true,
      sourceWidth: 100,
      sourceHeight: 200,
    });
    expect(out).toMatchObject({
      kind: "video",
      mediaUrl: "https://media.redgifs.com/x.mp4",
      durationMode: "media",
      durationSeconds: 9,
      audioAvailable: true,
      sourceWidth: 100,
      sourceHeight: 200,
      mimeType: "video/mp4",
      title: "t",
    });
  });

  it("omits proxied by default and sets it only when asked", () => {
    const media = { mediaUrl: "https://x/y.mp4", hasAudio: false };
    expect("proxied" in toNativeVideoSlide(embed(), media)).toBe(false);
    expect(toNativeVideoSlide(embed(), media, { proxied: true }).proxied).toBe(
      true,
    );
  });

  it("falls back to the slide's dimensions when media omits them", () => {
    const out = toNativeVideoSlide(embed({ sourceWidth: 7, sourceHeight: 8 }), {
      mediaUrl: "https://x/y.mp4",
      hasAudio: false,
    });
    expect(out.sourceWidth).toBe(7);
    expect(out.sourceHeight).toBe(8);
  });
});

describe("resolveNativeSlides", () => {
  const config = {
    provider: /** @type {any} */ ("redgifs"),
    extractId: (/** @type {string | undefined} */ u) =>
      u?.includes("abc") ? "abc" : undefined,
    toSlide: (/** @type {any} */ s, /** @type {any} */ m) =>
      toNativeVideoSlide(s, m, { proxied: true }),
    concurrency: 4,
    timeoutMs: 1000,
  };
  const resolve = async (/** @type {string} */ id) => ({
    mediaUrl: `https://media.redgifs.com/${id}.mp4`,
    hasAudio: false,
  });

  it("upgrades matching embeds and leaves other slides by reference", async () => {
    const other = /** @type {any} */ ({
      provider: "reddit-image",
      kind: "image",
    });
    const e = embed();
    const out = await resolveNativeSlides([other, e], resolve, config);
    expect(out[0]).toBe(other);
    expect(out[1].kind).toBe("video");
    expect(out[1].proxied).toBe(true);
  });

  it("keeps the original slide when no id can be extracted", async () => {
    const e = embed({
      sourceUrl: "https://www.redgifs.com/watch/",
      embedUrl: undefined,
    });
    const [out] = await resolveNativeSlides([e], resolve, config);
    expect(out).toBe(e);
  });

  it("keeps the original embed when resolution throws", async () => {
    const e = embed();
    const failing = async () => {
      throw new Error("down");
    };
    const [out] = await resolveNativeSlides([e], failing, config);
    expect(out).toBe(e);
  });
});
