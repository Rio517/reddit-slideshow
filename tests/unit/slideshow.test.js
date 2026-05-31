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

  it("reschedules the current image slide when the dwell changes live", () => {
    const { controller, rendered } = makeController({ imageTimerSeconds: 10 });
    controller.start({
      slides: [slideWithId("a"), slideWithId("b")],
      exhausted: true,
      postsScanned: 2,
    });
    controller.markReady();
    vi.advanceTimersByTime(5000); // 10s dwell - not yet
    expect(rendered).toEqual(["a"]);
    controller.setImageTimerSeconds(2); // shorten live → restart from now
    vi.advanceTimersByTime(2000);
    expect(rendered).toEqual(["a", "b"]);
  });

  it("leaves a playing video undisturbed when the dwell changes live", () => {
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
    controller.markReady(); // 10s + 2s safety timer
    controller.setImageTimerSeconds(1); // must NOT shorten the video
    vi.advanceTimersByTime(2000);
    expect(rendered).toEqual(["v"]);
    vi.advanceTimersByTime(10000); // 12s total → safety fires
    expect(rendered).toEqual(["v", "b"]);
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

  it("caps retained back-history while preserving absolute position", () => {
    const { controller } = makeController({ maxBackHistory: 5 });
    const slides = Array.from({ length: 20 }, (_, i) => slideWithId(`s${i}`));
    controller.start({
      slides,
      after: null,
      exhausted: true,
      postsScanned: 20,
    });
    for (let i = 0; i < 15; i += 1) controller.next();
    expect(controller.current?.id).toBe("s15");
    expect(controller.position.index).toBe(15);
    expect(controller.position.total).toBe(20);
    // Back-history is capped (local index), and the old slides were dropped.
    expect(controller.index).toBeLessThanOrEqual(5);
    expect(controller.evicted).toBe(10);
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

  it("keeps paging when an all-filtered page arrives while waiting", () => {
    const { controller, rendered, requested } = makeController();
    controller.start({
      slides: [slideWithId("a")],
      after: "t3_p2",
      exhausted: false,
      postsScanned: 50,
    });
    controller.markReady();
    vi.advanceTimersByTime(5000); // hits the end, waits for more
    expect(rendered).toEqual(["a"]);
    controller.append({
      slides: [], // entirely filtered out
      after: "t3_p3",
      exhausted: false,
      postsScanned: 50,
    });
    expect(requested).toEqual(["t3_p2", "t3_p3"]);
    controller.append({
      slides: [slideWithId("b")],
      after: null,
      exhausted: true,
      postsScanned: 50,
    });
    expect(rendered).toEqual(["a", "b"]);
  });

  it("ends gracefully when an exhausted empty page arrives while waiting", () => {
    const { controller, rendered, ended } = makeController();
    controller.start({
      slides: [slideWithId("a")],
      after: "t3_p2",
      exhausted: false,
      postsScanned: 50,
    });
    controller.markReady();
    vi.advanceTimersByTime(5000);
    controller.append({
      slides: [],
      after: null,
      exhausted: true,
      postsScanned: 50,
    });
    expect(ended()).toBe(1);
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
