import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SlideshowController } from "../../lib/slideshow.js";

/**
 * @param {Partial<import("../../lib/slides.js").Slide>} [overrides]
 * @returns {import("../../lib/slides.js").Slide}
 */
function imageSlide(overrides) {
  return {
    id: "img:0",
    postId: "img",
    provider: "reddit-image",
    kind: "image",
    mediaUrl: "https://i.redd.it/x.jpg",
    sourceUrl: "https://i.redd.it/x.jpg",
    permalink: undefined,
    title: "",
    over18: false,
    durationMode: "timer",
    audioAvailable: false,
    sourceWidth: undefined,
    sourceHeight: undefined,
    quality: "original",
    mimeType: "image/jpeg",
    filenameHint: "x.jpg",
    ...overrides,
  };
}

/** @param {string} id @param {Partial<import("../../lib/slides.js").Slide>} [o] */
function slideWithId(id, o) {
  return imageSlide({ id, ...o });
}

function makeController(overrides = {}) {
  /** @type {string[]} */
  const rendered = [];
  /** @type {string[]} */
  const requested = [];
  let ended = 0;
  const controller = new SlideshowController({
    imageTimerSeconds: 5,
    onRender: (slide) => rendered.push(slide.id),
    onRequestNextPage: (after) => requested.push(after),
    onEnd: () => (ended += 1),
    ...overrides,
  });
  return { controller, rendered, requested, ended: () => ended };
}

describe("SlideshowController", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("renders the first slide when started", () => {
    const { controller, rendered } = makeController();
    controller.start({
      slides: [slideWithId("a"), slideWithId("b")],
      after: null,
      exhausted: true,
      postsScanned: 2,
    });
    expect(rendered).toEqual(["a"]);
    expect(controller.current?.id).toBe("a");
  });

  it("auto-advances image slides on the timer once ready", () => {
    const { controller, rendered } = makeController();
    controller.start({
      slides: [slideWithId("a"), slideWithId("b")],
      exhausted: true,
      postsScanned: 2,
    });
    // The dwell only starts once the media signals it is ready.
    vi.advanceTimersByTime(5000);
    expect(rendered).toEqual(["a"]);
    controller.markReady();
    vi.advanceTimersByTime(5000);
    expect(rendered).toEqual(["a", "b"]);
  });

  it("keeps the timer running after manual navigation", () => {
    const { controller, rendered } = makeController();
    controller.start({
      slides: [slideWithId("a"), slideWithId("b"), slideWithId("c")],
      exhausted: true,
      postsScanned: 3,
    });
    controller.markReady();
    controller.next(); // -> b
    controller.markReady();
    expect(rendered).toEqual(["a", "b"]);
    vi.advanceTimersByTime(5000);
    expect(rendered).toEqual(["a", "b", "c"]);
  });

  it("clamps prev at the first slide", () => {
    const { controller } = makeController();
    controller.start({
      slides: [slideWithId("a"), slideWithId("b")],
      exhausted: true,
      postsScanned: 2,
    });
    controller.prev();
    expect(controller.current?.id).toBe("a");
  });

  it("advances video on mediaEnded, before the safety timer", () => {
    const { controller, rendered } = makeController();
    controller.start({
      slides: [
        slideWithId("v", {
          kind: "video",
          durationMode: "media",
          durationSeconds: 10,
        }),
        slideWithId("b"),
      ],
      exhausted: true,
      postsScanned: 2,
    });
    controller.markReady();
    vi.advanceTimersByTime(5000); // image timer would have fired here
    expect(rendered).toEqual(["v"]);
    controller.mediaEnded();
    expect(rendered).toEqual(["v", "b"]);
  });

  it("uses a safety timer when a video never ends", () => {
    const { controller, rendered } = makeController();
    controller.start({
      slides: [
        slideWithId("v", {
          kind: "video",
          durationMode: "media",
          durationSeconds: 10,
        }),
        slideWithId("b"),
      ],
      exhausted: true,
      postsScanned: 2,
    });
    controller.markReady();
    vi.advanceTimersByTime(12 * 1000); // durationSeconds + safety buffer
    expect(rendered).toEqual(["v", "b"]);
  });

  it("peeks upcoming slides for preloading", () => {
    const { controller } = makeController();
    controller.start({
      slides: [slideWithId("a"), slideWithId("b"), slideWithId("c")],
      exhausted: true,
      postsScanned: 3,
    });
    expect(controller.peekNext(2).map((s) => s.id)).toEqual(["b", "c"]);
  });

  it("pauses and resumes the timer", () => {
    const { controller, rendered } = makeController();
    controller.start({
      slides: [slideWithId("a"), slideWithId("b")],
      exhausted: true,
      postsScanned: 2,
    });
    controller.markReady();
    controller.pause();
    vi.advanceTimersByTime(10000);
    expect(rendered).toEqual(["a"]);
    controller.resume();
    vi.advanceTimersByTime(5000);
    expect(rendered).toEqual(["a", "b"]);
  });

  it("requests the next page when nearing the end, then appends it", () => {
    const { controller, requested } = makeController();
    controller.start({
      slides: [slideWithId("a")],
      after: "t3_next",
      exhausted: false,
      postsScanned: 50,
    });
    // One unread slide remaining (<= prefetch threshold) -> fetch requested.
    expect(requested).toEqual(["t3_next"]);
    controller.append({
      slides: [slideWithId("b"), slideWithId("c")],
      after: null,
      exhausted: true,
      postsScanned: 50,
    });
    expect(controller.position.total).toBe(3);
  });

  it("does not double-request while a fetch is in flight", () => {
    const { controller, requested } = makeController();
    controller.start({
      slides: [slideWithId("a")],
      after: "t3_next",
      exhausted: false,
      postsScanned: 50,
    });
    controller.next();
    controller.prev();
    expect(requested).toEqual(["t3_next"]);
  });

  it("resumes autoplay after the next page is appended", () => {
    const { controller, rendered } = makeController();
    controller.start({
      slides: [slideWithId("a")],
      after: "t3_next",
      exhausted: false,
      postsScanned: 50,
    });
    controller.markReady();
    vi.advanceTimersByTime(5000); // timer hits the end, waits for more
    expect(rendered).toEqual(["a"]);
    controller.append({
      slides: [slideWithId("b")],
      after: null,
      exhausted: true,
      postsScanned: 50,
    });
    expect(rendered).toEqual(["a", "b"]);
  });

  it("skips an empty page and fetches the next one", () => {
    const { controller, rendered, requested } = makeController();
    controller.start({
      slides: [],
      after: "t3_p2",
      exhausted: false,
      postsScanned: 50,
    });
    expect(rendered).toEqual([]);
    expect(requested).toEqual(["t3_p2"]);
    controller.append({
      slides: [slideWithId("a")],
      after: null,
      exhausted: true,
      postsScanned: 50,
    });
    expect(rendered).toEqual(["a"]);
  });

  it("calls onEnd when advancing past the last slide of an exhausted queue", () => {
    const { controller, ended } = makeController();
    controller.start({
      slides: [slideWithId("a")],
      exhausted: true,
      postsScanned: 1,
    });
    controller.next();
    expect(ended()).toBe(1);
  });
});
