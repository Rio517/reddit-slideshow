import { describe, expect, it } from "vitest";
import { slidesFromListing } from "../../lib/slides.js";
import fixture from "../fixtures/reddit-json/subreddit-direct-images.json";
import galleryFixture from "../fixtures/reddit-json/gallery.json";
import videoFixture from "../fixtures/reddit-json/reddit-video.json";
import redgifsFixture from "../fixtures/reddit-json/redgifs.json";
import crosspostFixture from "../fixtures/reddit-json/crosspost.json";

describe("slidesFromListing", () => {
  it("normalizes direct i.redd.it images as original quality slides", () => {
    const slides = slidesFromListing(fixture);
    expect(slides[0]).toMatchObject({
      id: "t3_alpha:0",
      postId: "t3_alpha",
      provider: "reddit-image",
      kind: "image",
      mediaUrl: "https://i.redd.it/alpha.jpg",
      sourceUrl: "https://i.redd.it/alpha.jpg",
      permalink:
        "https://old.reddit.com/r/example/comments/alpha/ultra_high_resolution_landscape/",
      title: "Ultra high resolution landscape",
      over18: false,
      durationMode: "timer",
      sourceWidth: 7680,
      sourceHeight: 4320,
      quality: "original",
    });
  });

  it("keeps preview-only images but marks them preview quality and emits the preview URL", () => {
    const slides = slidesFromListing(fixture);
    expect(slides[1]).toMatchObject({
      id: "t3_gamma:0",
      provider: "reddit-image",
      kind: "image",
      quality: "preview",
      mediaUrl:
        "https://preview.redd.it/gamma.jpg?width=1080&crop=smart&auto=webp&s=fake",
      sourceWidth: 1600,
      sourceHeight: 900,
    });
  });

  it("resolves permalinks against the given page origin", () => {
    const slides = slidesFromListing(fixture, "https://www.reddit.com");
    expect(slides[0].permalink).toBe(
      "https://www.reddit.com/r/example/comments/alpha/ultra_high_resolution_landscape/",
    );
  });

  it("does not throw on a post with no title", () => {
    const listing = {
      data: {
        children: [
          {
            kind: "t3",
            data: {
              name: "t3_notitle",
              url_overridden_by_dest: "https://i.redd.it/notitle.png",
              post_hint: "image",
            },
          },
        ],
      },
    };
    const slides = slidesFromListing(listing);
    expect(slides[0].filenameHint).toBe("t3_notitle.png");
  });

  it("uses url when url_overridden_by_dest is missing", () => {
    const slides = slidesFromListing({
      data: {
        children: [
          {
            kind: "t3",
            data: {
              name: "t3_urlonly",
              title: "URL only image",
              permalink: "/r/example/comments/urlonly/url_only_image/",
              url: "https://i.redd.it/urlonly.webp",
              domain: "i.redd.it",
              post_hint: "image",
            },
          },
        ],
      },
    });

    expect(slides[0]).toMatchObject({
      id: "t3_urlonly:0",
      mediaUrl: "https://i.redd.it/urlonly.webp",
      sourceUrl: "https://i.redd.it/urlonly.webp",
      quality: "original",
      mimeType: "image/webp",
    });
  });
});

describe("gallery posts", () => {
  it("expands a gallery into one slide per item in gallery_data order", () => {
    const slides = slidesFromListing(galleryFixture);
    expect(slides.map((s) => s.id)).toEqual([
      "t3_gal1:0",
      "t3_gal1:1",
      "t3_gal1:2",
    ]);
    expect(slides.map((s) => s.mediaUrl)).toEqual([
      "https://preview.redd.it/aaa111.jpg?width=4000&format=pjpg&auto=webp&s=fakesig1",
      "https://preview.redd.it/bbb222.png?width=1920&format=png&auto=webp&s=fakesig2",
      "https://preview.redd.it/ccc333.jpg?width=2000&format=pjpg&auto=webp&s=fakesig3",
    ]);
  });

  it("carries gallery item dimensions, provider, and a unique filename per item", () => {
    const slides = slidesFromListing(galleryFixture);
    expect(slides[0]).toMatchObject({
      provider: "reddit-gallery",
      kind: "image",
      quality: "original",
      sourceWidth: 4000,
      sourceHeight: 3000,
      mimeType: "image/jpeg",
      filenameHint: "t3_gal1-three-photo-set-0.jpg",
    });
    expect(slides[1].mimeType).toBe("image/png");
    expect(slides[2].filenameHint).toBe("t3_gal1-three-photo-set-2.jpg");
  });

  it("skips deleted or invalid gallery items without leaving index gaps", () => {
    const slides = slidesFromListing(galleryFixture);
    expect(slides).toHaveLength(3);
  });
});

describe("Reddit-hosted video posts", () => {
  it("normalizes v.redd.it video with the fallback URL and audio metadata", () => {
    const slides = slidesFromListing(videoFixture);
    expect(slides[0]).toMatchObject({
      id: "t3_vid1:0",
      provider: "reddit-video",
      kind: "video",
      mediaUrl: "https://v.redd.it/vidfake1/CMAF_720.mp4?source=fallback",
      sourceUrl: "https://v.redd.it/vidfake1",
      durationMode: "media",
      audioAvailable: true,
      durationSeconds: 14,
      sourceWidth: 720,
      sourceHeight: 1280,
      isGif: false,
      mimeType: "video/mp4",
      dashUrl: "https://v.redd.it/vidfake1/DASHPlaylist.mpd?a=000&v=1&f=sd",
      hlsUrl: "https://v.redd.it/vidfake1/HLSPlaylist.m3u8?a=000&v=1&f=sd",
      filenameHint: "t3_vid1-short-clip-with-sound.mp4",
    });
  });

  it("reports no audio for GIF-like Reddit video", () => {
    const slides = slidesFromListing(videoFixture);
    expect(slides[1]).toMatchObject({
      id: "t3_vid2:0",
      isGif: true,
      audioAvailable: false,
      durationSeconds: 6,
    });
  });
});

describe("Redgifs posts", () => {
  it("embeds the first-party iframe and takes aspect ratio from oembed", () => {
    const slides = slidesFromListing(redgifsFixture);
    expect(slides[0]).toMatchObject({
      id: "t3_rg1:0",
      provider: "redgifs",
      kind: "embed",
      mediaUrl: "https://www.redgifs.com/ifr/fakeslugword",
      embedUrl: "https://www.redgifs.com/ifr/fakeslugword",
      sourceUrl: "https://www.redgifs.com/watch/fakeslugword",
      durationMode: "timer",
      over18: true,
      sourceWidth: 1080,
      sourceHeight: 1920,
    });
  });
});

describe("crossposts", () => {
  it("resolves media from crosspost_parent_list with the outer post's context", () => {
    const slides = slidesFromListing(crosspostFixture);
    expect(slides[0]).toMatchObject({
      id: "t3_xp1:0",
      postId: "t3_xp1",
      provider: "reddit-video",
      kind: "video",
      mediaUrl: "https://v.redd.it/parentfake1/CMAF_720.mp4?source=fallback",
      permalink:
        "https://old.reddit.com/r/example/comments/xp1/crossposted_clip/",
      title: "Crossposted clip seen by the user",
      durationSeconds: 20,
    });
  });
});
