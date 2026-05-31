import { describe, expect, it } from "vitest";
import {
  renderSlide,
  MEDIA_CLASS,
  mediaUrlIsSafe,
} from "../../lib/overlay-render.js";

/**
 * @param {Partial<import("../../lib/slides.js").Slide>} [overrides]
 * @returns {import("../../lib/slides.js").Slide}
 */
function slide(overrides) {
  return {
    id: "t3_x:0",
    postId: "t3_x",
    provider: "reddit-image",
    kind: "image",
    mediaUrl: "https://i.redd.it/x.jpg",
    sourceUrl: "https://i.redd.it/x.jpg",
    permalink: "https://old.reddit.com/r/x/comments/x/x/",
    title: "A title",
    over18: false,
    durationMode: "timer",
    audioAvailable: false,
    sourceWidth: 1000,
    sourceHeight: 500,
    quality: "original",
    mimeType: "image/jpeg",
    filenameHint: "t3_x.jpg",
    ...overrides,
  };
}

describe("renderSlide", () => {
  it("renders an image with src, alt, and the media class", () => {
    const el = renderSlide(slide());
    expect(el.tagName).toBe("IMG");
    expect(el.getAttribute("src")).toBe("https://i.redd.it/x.jpg");
    expect(el.getAttribute("alt")).toBe("A title");
    expect(el.classList.contains(MEDIA_CLASS)).toBe(true);
    expect(el.dataset.slideId).toBe("t3_x:0");
  });

  it("renders Reddit video muted and autoplaying, not looping", () => {
    const el = /** @type {HTMLVideoElement} */ (
      renderSlide(
        slide({
          provider: "reddit-video",
          kind: "video",
          mediaUrl: "https://v.redd.it/x/CMAF_720.mp4?source=fallback",
          isGif: false,
        }),
      )
    );
    expect(el.tagName).toBe("VIDEO");
    expect(el.muted).toBe(true);
    expect(el.autoplay).toBe(true);
    expect(el.loop).toBe(false);
    expect(el.controls).toBe(true);
    expect(el.getAttribute("src")).toBe(
      "https://v.redd.it/x/CMAF_720.mp4?source=fallback",
    );
    expect(el.style.aspectRatio).toBe("1000 / 500");
  });

  it("loops GIF-like Reddit video without native controls", () => {
    const el = /** @type {HTMLVideoElement} */ (
      renderSlide(slide({ kind: "video", isGif: true }))
    );
    expect(el.loop).toBe(true);
    expect(el.controls).toBe(false);
  });

  it("refuses a non-HTTPS or data: image URL at the sink", () => {
    expect(
      renderSlide(slide({ mediaUrl: "http://i.redd.it/x.jpg" })).hasAttribute(
        "src",
      ),
    ).toBe(false);
    expect(
      renderSlide(
        slide({ mediaUrl: "data:image/png;base64,AAAA" }),
      ).hasAttribute("src"),
    ).toBe(false);
  });

  it("refuses a non-Reddit (or non-HTTPS) host for direct video", () => {
    const video = (/** @type {string} */ url) =>
      renderSlide(
        slide({ provider: "reddit-video", kind: "video", mediaUrl: url }),
      );
    expect(video("https://evil.example/x.mp4").hasAttribute("src")).toBe(false);
    expect(video("http://v.redd.it/x/CMAF_720.mp4").hasAttribute("src")).toBe(
      false,
    );
    expect(video("https://v.redd.it/x/CMAF_720.mp4").getAttribute("src")).toBe(
      "https://v.redd.it/x/CMAF_720.mp4",
    );
  });

  it("allows a direct Catbox video host", () => {
    const el = renderSlide(
      slide({
        provider: "catbox",
        kind: "video",
        mediaUrl: "https://files.catbox.moe/abcd12.mp4",
        mimeType: "video/mp4",
      }),
    );
    expect(el.getAttribute("src")).toBe("https://files.catbox.moe/abcd12.mp4");
    expect(
      mediaUrlIsSafe(
        slide({
          provider: "catbox",
          kind: "video",
          mediaUrl: "https://files.catbox.moe/abcd12.mp4",
        }),
      ),
    ).toBe(true);
  });

  it("treats an embed as unsafe when its embedUrl is rejected (off-host/empty)", () => {
    const embed = (
      /** @type {Partial<import("../../lib/slides.js").Slide>} */ o,
    ) => slide({ provider: "redgifs", kind: "embed", ...o });
    // A good Redgifs embed passes.
    expect(
      mediaUrlIsSafe(embed({ embedUrl: "https://www.redgifs.com/ifr/abc" })),
    ).toBe(true);
    // An off-host or non-HTTPS embed URL is unsafe, so the overlay can skip it.
    expect(
      mediaUrlIsSafe(embed({ embedUrl: "https://evil.example/ifr/abc" })),
    ).toBe(false);
    expect(mediaUrlIsSafe(embed({ embedUrl: undefined, mediaUrl: "" }))).toBe(
      false,
    );
  });

  it("renders Redgifs as a fullscreen-capable iframe using embedUrl", () => {
    const el = renderSlide(
      slide({
        provider: "redgifs",
        kind: "embed",
        mediaUrl: "https://www.redgifs.com/ifr/abc",
        embedUrl: "https://www.redgifs.com/ifr/abc",
        sourceWidth: 1080,
        sourceHeight: 1920,
      }),
    );
    expect(el.tagName).toBe("IFRAME");
    expect(el.getAttribute("src")).toBe("https://www.redgifs.com/ifr/abc");
    expect(el.hasAttribute("allowfullscreen")).toBe(true);
    expect(el.style.aspectRatio).toBe("1080 / 1920");
  });
});
