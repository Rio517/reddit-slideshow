import { afterEach, describe, expect, it } from "vitest";
import { createOverlay } from "../../lib/overlay-ui.js";
import { createSlideshowSession } from "../../lib/session.js";

const ROOT = "#reddit-slideshow-root";
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

/** @type {Array<{ close: () => void }>} */
let sessions = [];

afterEach(() => {
  for (const session of sessions) session.close();
  sessions = [];
  document.querySelectorAll(ROOT).forEach((el) => el.remove());
  document.documentElement.style.overflow = "";
});

/**
 * @param {string} id
 * @param {Partial<import("../../lib/slides.js").Slide>} [overrides]
 * @returns {import("../../lib/slides.js").Slide}
 */
function imageSlide(id, overrides) {
  return /** @type {any} */ ({
    id,
    postId: id,
    provider: "reddit-image",
    kind: "image",
    mediaUrl: `https://i.redd.it/${id}.jpg`,
    sourceUrl: `https://i.redd.it/${id}.jpg`,
    permalink: "https://old.reddit.com/r/x/comments/x/x/",
    title: id,
    over18: false,
    durationMode: "timer",
    audioAvailable: false,
    quality: "original",
    filenameHint: `${id}.jpg`,
    ...overrides,
  });
}

/** @param {Record<string, unknown>} [overrides] */
function settings(overrides) {
  return {
    imageTimerSeconds: 5,
    startMuted: true,
    autoplay: false, // deterministic: no auto-advance timer in tests
    includeNsfw: true,
    dedupe: true,
    contentDedup: false,
    alwaysShowMeta: true,
    maxLoadWaitSeconds: 5,
    panZoom: false,
    panZoomScale: 2,
    panZoomShowSeconds: 2,
    panZoomZoomInSeconds: 2,
    panZoomPanSeconds: 6,
    panZoomZoomOutSeconds: 2,
    panZoomShowEndSeconds: 2,
    panZoomMinOversize: 1.5,
    ...overrides,
  };
}

/** @param {Array<any>} pages */
function fakeRequest(pages) {
  let i = 0;
  /** @type {Array<string | undefined>} */
  const calls = [];
  const fn = async (/** @type {string=} */ after) => {
    calls.push(after);
    const page = pages[i++];
    if (page === "fail") return { ok: false, error: { message: "boom" } };
    if (!page) {
      return {
        ok: true,
        page: { slides: [], after: null, exhausted: true, postsScanned: 0 },
      };
    }
    return { ok: true, page };
  };
  return Object.assign(fn, { calls });
}

/**
 * @param {{ pages?: any[], settingsOverrides?: Record<string, unknown>, openUrl?: (url: string) => void, saveSettings?: (patch: object) => Promise<unknown>, computeImageHash?: (url: string) => Promise<string | null>, createImage?: () => { src: string, decoding?: string } }} [opts]
 */
function makeSession({
  pages,
  settingsOverrides,
  openUrl,
  saveSettings,
  computeImageHash,
  createImage,
} = {}) {
  const request = fakeRequest(
    pages ?? [
      {
        slides: [imageSlide("a"), imageSlide("b")],
        after: null,
        exhausted: true,
        postsScanned: 2,
      },
    ],
  );
  const session = createSlideshowSession({
    doc: document,
    createOverlay,
    getSettings: async () => settings(settingsOverrides),
    saveSettings: saveSettings ?? (async () => {}),
    requestPage: request,
    getStartCursor: () => undefined,
    openUrl: openUrl ?? (() => {}),
    createImage: createImage ?? (() => ({ src: "", decoding: "" })),
    computeImageHash,
  });
  sessions.push(session);
  return { session, request };
}

/** @param {string} sel */
const text = (sel) => document.querySelector(sel)?.textContent;
const mediaSrc = () =>
  document
    .querySelector(`${ROOT} img.reddit-slideshow-media`)
    ?.getAttribute("src");
/** @param {string} k @returns {any} */
const key = (k) => ({
  key: k,
  preventDefault() {},
  stopImmediatePropagation() {},
});

describe("createSlideshowSession", () => {
  it("renders the first slide and position counter", async () => {
    const { session } = makeSession();
    await session.start();
    expect(mediaSrc()).toBe("https://i.redd.it/a.jpg");
    expect(text(".rs-meta__counter")).toBe("1 / 2");
    expect(session.isOpen()).toBe(true);
  });

  it("shows a status when the page has no supported media", async () => {
    const { session } = makeSession({
      pages: [{ slides: [], after: null, exhausted: true, postsScanned: 0 }],
    });
    await session.start();
    expect(text(".rs-status")).toBe("No supported media on this page.");
  });

  it("surfaces a fetch error as a status", async () => {
    const { session } = makeSession({ pages: ["fail"] });
    await session.start();
    expect(text(".rs-status")).toBe("boom");
  });

  it("advances and goes back with arrow keys", async () => {
    const { session } = makeSession();
    await session.start();
    session.handleKeydown(key("ArrowRight"));
    expect(mediaSrc()).toBe("https://i.redd.it/b.jpg");
    expect(text(".rs-meta__counter")).toBe("2 / 2");
    session.handleKeydown(key("ArrowLeft"));
    expect(mediaSrc()).toBe("https://i.redd.it/a.jpg");
  });

  it("ignores keys when the overlay is closed", async () => {
    const { session } = makeSession();
    await session.start();
    session.close();
    expect(session.isOpen()).toBe(false);
    // No throw, no effect.
    session.handleKeydown(key("ArrowRight"));
  });

  it("fetches the next page when nearing the end, then can advance into it", async () => {
    const { session, request } = makeSession({
      pages: [
        {
          slides: [imageSlide("a")],
          after: "t3_next",
          exhausted: false,
          postsScanned: 50,
        },
        {
          slides: [imageSlide("b")],
          after: null,
          exhausted: true,
          postsScanned: 50,
        },
      ],
    });
    await session.start();
    await flush(); // let the async pagination fetch resolve
    expect(request.calls).toContain("t3_next");
    session.handleKeydown(key("ArrowRight"));
    expect(mediaSrc()).toBe("https://i.redd.it/b.jpg");
  });

  it("applies the NSFW filter", async () => {
    const { session } = makeSession({
      settingsOverrides: { includeNsfw: false },
      pages: [
        {
          slides: [imageSlide("a", { over18: true }), imageSlide("b")],
          after: null,
          exhausted: true,
          postsScanned: 2,
        },
      ],
    });
    await session.start();
    expect(mediaSrc()).toBe("https://i.redd.it/b.jpg");
    expect(text(".rs-meta__counter")).toBe("1 / 1");
  });

  it("drops duplicates by media id", async () => {
    const dupe = imageSlide("a", {
      provider: "reddit-gallery",
      mediaUrl: "https://preview.redd.it/a.jpg?width=640&s=x",
    });
    const { session } = makeSession({
      pages: [
        {
          slides: [imageSlide("a"), dupe, imageSlide("b")],
          after: null,
          exhausted: true,
          postsScanned: 3,
        },
      ],
    });
    await session.start();
    expect(text(".rs-meta__counter")).toBe("1 / 2"); // dupe removed
  });

  it("skips a perceptual duplicate image when content dedup is on", async () => {
    /** @type {Record<string, string>} */
    const hashes = {
      "https://i.redd.it/a.jpg": "ffffffffffffffff",
      "https://i.redd.it/b.jpg": "ffffffffffffffff", // same as a → duplicate
      "https://i.redd.it/c.jpg": "0000000000000000",
    };
    const { session } = makeSession({
      settingsOverrides: { contentDedup: true },
      computeImageHash: async (url) => hashes[url] ?? null,
      pages: [
        {
          slides: [imageSlide("a"), imageSlide("b"), imageSlide("c")],
          after: null,
          exhausted: true,
          postsScanned: 3,
        },
      ],
    });
    await session.start();
    await flush(); // "a" hashed and recorded
    expect(mediaSrc()).toBe("https://i.redd.it/a.jpg");
    session.handleKeydown(key("ArrowRight")); // -> "b", a perceptual dup of "a"
    await flush(); // "b" hashed → skipped → "c"
    expect(mediaSrc()).toBe("https://i.redd.it/c.jpg");
  });

  it("locks page scroll while open and restores it on close", async () => {
    document.documentElement.style.overflow = "scroll";
    const { session } = makeSession();
    await session.start();
    expect(document.documentElement.style.overflow).toBe("hidden");
    session.close();
    expect(document.documentElement.style.overflow).toBe("scroll");
  });

  it("bounds and cancels image preloads", async () => {
    /** @type {Array<{ src: string }>} */
    const created = [];
    const { session } = makeSession({
      pages: [
        {
          slides: ["a", "b", "c", "d", "e"].map((id) => imageSlide(id)),
          after: null,
          exhausted: true,
          postsScanned: 5,
        },
      ],
      createImage: () => {
        const img = { src: "", decoding: "" };
        created.push(img);
        return img;
      },
    });
    await session.start();
    session.handleKeydown(key("ArrowRight"));
    session.handleKeydown(key("ArrowRight"));
    // Only the look-ahead window stays in flight; the rest were cancelled.
    expect(created.filter((img) => img.src !== "").length).toBeLessThanOrEqual(
      2,
    );
    session.close();
    expect(created.every((img) => img.src === "")).toBe(true);
  });

  it("suppresses handled keys but not others", async () => {
    const { session } = makeSession();
    await session.start();
    let prevented = 0;
    let stopped = 0;
    const ev = (/** @type {string} */ k) => ({
      key: k,
      preventDefault: () => {
        prevented += 1;
      },
      stopImmediatePropagation: () => {
        stopped += 1;
      },
    });
    session.handleKeydown(/** @type {any} */ (ev("ArrowRight")));
    expect(prevented).toBe(1);
    expect(stopped).toBe(1);
    session.handleKeydown(/** @type {any} */ (ev("x"))); // unhandled
    expect(prevented).toBe(1);
    expect(stopped).toBe(1);
  });

  it("applies a changed image timer to the running slideshow without reload", async () => {
    const { session } = makeSession();
    await session.start();
    session.applyLiveSettings(
      /** @type {any} */ (settings({ imageTimerSeconds: 20 })),
    );
    const fill = /** @type {HTMLElement | null} */ (
      document.querySelector(".rs-timer__fill")
    );
    expect(fill?.style.animation).toContain("20s");
  });

  it("skips broken media and records it in the skipped list", async () => {
    const { session } = makeSession({
      pages: [
        {
          slides: [imageSlide("a"), imageSlide("b")],
          after: null,
          exhausted: true,
          postsScanned: 2,
        },
      ],
    });
    await session.start();
    expect(mediaSrc()).toBe("https://i.redd.it/a.jpg");

    document
      .querySelector(`${ROOT} .reddit-slideshow-media`)
      ?.dispatchEvent(new Event("error"));

    expect(mediaSrc()).toBe("https://i.redd.it/b.jpg"); // advanced past the broken one
    expect(text(".rs-skipped")).toBe("1 skipped");
  });

  it("changes a setting from the in-overlay panel (persist + live)", async () => {
    /** @type {object[]} */
    const saved = [];
    const { session } = makeSession({
      saveSettings: async (patch) => saved.push(patch),
    });
    await session.start();
    // Open the inline settings panel and bump the per-image timer.
    /** @type {HTMLElement} */ (
      document.querySelector(`${ROOT} [aria-label^="Settings"]`)
    ).click();
    const range = /** @type {HTMLInputElement} */ (
      document.querySelector(`${ROOT} .rs-set__range`)
    );
    range.value = "20";
    range.dispatchEvent(new Event("change", { bubbles: true }));

    expect(saved.at(-1)).toEqual({ imageTimerSeconds: 20 });
    const fill = /** @type {HTMLElement | null} */ (
      document.querySelector(`${ROOT} .rs-timer__fill`)
    );
    expect(fill?.style.animation).toContain("20s");
  });

  it("pan-zooms only oversized (UHD) images", async () => {
    /** @type {Array<{ slide: any, info: any }>} */
    const renders = [];
    const fakeOverlay = () => ({
      root: document.createElement("div"),
      show() {},
      hide() {},
      isOpen: () => true,
      showStatus() {},
      setSkipped() {},
      setSettings() {},
      setMuted() {},
      setBuffering() {},
      setPlaying() {},
      restartTimer() {},
      setJumpList() {},
      renderCurrent: (/** @type {any} */ slide, /** @type {any} */ info) =>
        renders.push({ slide, info }),
    });
    const big = imageSlide("big", { sourceWidth: 12000, sourceHeight: 8000 });
    const small = imageSlide("small", { sourceWidth: 800, sourceHeight: 600 });
    const session = createSlideshowSession({
      doc: document,
      createOverlay: /** @type {any} */ (fakeOverlay),
      // total = 3 + 3 + 4 + 0 + 0 = 10s
      getSettings: async () =>
        /** @type {any} */ (
          settings({
            panZoom: true,
            panZoomShowSeconds: 3,
            panZoomZoomInSeconds: 3,
            panZoomPanSeconds: 4,
            panZoomZoomOutSeconds: 0,
            panZoomShowEndSeconds: 0,
          })
        ),
      saveSettings: async () => {},
      requestPage: async () => ({
        ok: true,
        page: {
          slides: [big, small],
          after: null,
          exhausted: true,
          postsScanned: 2,
        },
      }),
      getStartCursor: () => undefined,
      openUrl: () => {},
      createImage: () => ({ src: "", decoding: "" }),
    });
    sessions.push(session);
    await session.start();
    session.handleKeydown(key("ArrowRight")); // advance to the small image

    expect(renders[0].slide.id).toBe("big");
    expect(renders[0].info.panZoom).not.toBeNull(); // oversized → pan-zoom
    expect(renders[0].info.effectiveSeconds).toBe(10); // runs the full sequence

    expect(renders[1].slide.id).toBe("small");
    expect(renders[1].info.panZoom).toBeNull(); // too small → no pan-zoom
    expect(renders[1].info.effectiveSeconds).toBe(5); // normal image timer
  });

  it("jumps to a loaded post from the counter list", async () => {
    const { session } = makeSession({
      pages: [
        {
          slides: [imageSlide("a"), imageSlide("b"), imageSlide("c")],
          after: null,
          exhausted: true,
          postsScanned: 3,
        },
      ],
    });
    await session.start();
    session.handleKeydown(key("ArrowRight")); // -> b
    session.handleKeydown(key("ArrowRight")); // -> c
    expect(mediaSrc()).toBe("https://i.redd.it/c.jpg");

    // Open the jump list from the counter, then click the first post.
    /** @type {HTMLElement} */ (
      document.querySelector(`${ROOT} .rs-meta__counter`)
    ).click();
    const items = document.querySelectorAll(`${ROOT} .rs-jump-panel__item`);
    expect(items.length).toBe(3);
    /** @type {HTMLElement} */ (items[0]).click();
    expect(mediaSrc()).toBe("https://i.redd.it/a.jpg");
    expect(text(".rs-meta__counter")).toBe("1 / 3");
  });

  it("persists the mute preference when toggled", async () => {
    /** @type {object[]} */
    const saved = [];
    const { session } = makeSession({
      saveSettings: async (patch) => saved.push(patch),
    });
    await session.start();
    session.handleKeydown(key("m"));
    expect(saved.at(-1)).toEqual({ startMuted: false });
  });
});
