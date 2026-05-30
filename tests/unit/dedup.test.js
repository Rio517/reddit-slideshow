import { describe, expect, it } from "vitest";
import {
  DuplicateTracker,
  differenceHash,
  hammingDistanceHex,
  mediaKey,
} from "../../lib/dedup.js";

/**
 * @param {Partial<import("../../lib/slides.js").Slide>} overrides
 * @returns {import("../../lib/slides.js").Slide}
 */
function slide(overrides) {
  return /** @type {any} */ ({
    provider: "reddit-image",
    mediaUrl: "https://i.redd.it/abc.jpg",
    sourceUrl: "https://i.redd.it/abc.jpg",
    ...overrides,
  });
}

describe("mediaKey", () => {
  it("keys reddit images by media id across host and size", () => {
    const original = slide({ mediaUrl: "https://i.redd.it/abc.jpg" });
    const preview = slide({
      provider: "reddit-gallery",
      mediaUrl: "https://preview.redd.it/abc.jpg?width=1080&s=sig",
    });
    expect(mediaKey(original)).toBe("reddit:abc");
    expect(mediaKey(preview)).toBe("reddit:abc");
  });

  it("keys v.redd.it video by id regardless of fallback path", () => {
    expect(
      mediaKey(
        slide({
          provider: "reddit-video",
          sourceUrl: "https://v.redd.it/vid1",
          mediaUrl: "https://v.redd.it/vid1/CMAF_720.mp4?source=fallback",
        }),
      ),
    ).toBe("vreddit:vid1");
  });

  it("keys Redgifs by id from the embed URL", () => {
    expect(
      mediaKey(
        slide({
          provider: "redgifs",
          embedUrl: "https://www.redgifs.com/ifr/somelongslug",
          sourceUrl: "https://www.redgifs.com/watch/somelongslug",
        }),
      ),
    ).toBe("redgifs:somelongslug");
  });
});

describe("DuplicateTracker.filterNewByKey", () => {
  it("drops repeats of the same media id within a session", () => {
    const tracker = new DuplicateTracker();
    const a = slide({ mediaUrl: "https://i.redd.it/aaa.jpg" });
    const aPreview = slide({
      provider: "reddit-gallery",
      mediaUrl: "https://preview.redd.it/aaa.jpg?width=640&s=x",
    });
    const b = slide({ mediaUrl: "https://i.redd.it/bbb.jpg" });

    expect(tracker.filterNewByKey([a, b]).length).toBe(2);
    // a (again, as a preview) is a duplicate; b is too.
    expect(tracker.filterNewByKey([aPreview, b]).length).toBe(0);
  });
});

describe("differenceHash + hammingDistanceHex", () => {
  it("produces a 16-char hex hash", () => {
    const lum = Array.from({ length: 72 }, (_, i) => i % 9);
    const hash = differenceHash(lum);
    expect(hash).toHaveLength(16);
  });

  it("is identical for identical input and 0 distance", () => {
    const lum = Array.from({ length: 72 }, (_, i) => (i * 7) % 9);
    const a = differenceHash(lum);
    const b = differenceHash(lum);
    expect(a).toBe(b);
    expect(hammingDistanceHex(a, b)).toBe(0);
  });

  it("counts differing bits between near-identical images", () => {
    const base = Array.from({ length: 72 }, (_, i) => (i % 9) * 10);
    const tweaked = base.slice();
    tweaked[0] = 255; // flip one comparison
    const distance = hammingDistanceHex(
      differenceHash(base),
      differenceHash(tweaked),
    );
    expect(distance).toBeGreaterThan(0);
    expect(distance).toBeLessThanOrEqual(2);
  });
});

describe("DuplicateTracker hash matching", () => {
  it("matches hashes within the threshold", () => {
    const tracker = new DuplicateTracker({ hashThreshold: 4 });
    tracker.addHash("ffffffffffffffff");
    expect(tracker.isDuplicateHash("ffffffffffffffff")).toBe(true);
    expect(tracker.isDuplicateHash("fffffffffffffff0")).toBe(true); // 4 bits
    expect(tracker.isDuplicateHash("0000000000000000")).toBe(false);
  });
});
