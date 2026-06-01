import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createOverlay } from "../../lib/overlay-ui.js";
import { imageTimerStopSeconds } from "../../lib/settings.js";

/** @typedef {ReturnType<typeof createOverlay>} Overlay */

/**
 * @param {Partial<import("../../lib/slides.js").Slide>} [overrides]
 * @returns {import("../../lib/slides.js").Slide}
 */
function imageSlide(overrides) {
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
    sourceHeight: 800,
    quality: "original",
    mimeType: "image/jpeg",
    filenameHint: "t3_x.jpg",
    ...overrides,
  };
}

const PANEL_SETTINGS = {
  imageTimerSeconds: 5,
  startMuted: true,
  autoplay: true,
  includeNsfw: true,
  dedupe: true,
  contentDedup: false,
  alwaysShowMeta: true,
  maxLoadWaitSeconds: 5,
  timerBar: "all",
  panZoom: false,
};

/** @param {Overlay} overlay */
function renderProxiedVideo(overlay) {
  overlay.renderCurrent(
    imageSlide({
      kind: "video",
      durationMode: "media",
      proxied: true,
      mediaUrl: "https://media.redgifs.com/X.mp4",
    }),
    { index: 0, total: 1, exhausted: true, effectiveSeconds: 5, playing: true },
  );
}

function noopHandlers() {
  return {
    onPrev() {},
    onNext() {},
    onTogglePlay() {},
    onClose() {},
    onOpenOriginal() {},
    onMediaEnded() {},
    onMediaReady() {},
    onToggleMute() {},
    onOpenPreferences() {},
  };
}

/**
 * @param {Element} root
 * @param {string} prefix
 */
function clickByLabel(root, prefix) {
  const el = /** @type {HTMLElement | null} */ (
    root.querySelector(`[aria-label^="${prefix}"]`)
  );
  el?.click();
}

describe("createOverlay", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    // show() makes the page inert; tests that don't hide() must not leak it.
    document.body.inert = false;
  });

  it("builds the chrome with ten controls, hidden by default", () => {
    const overlay = createOverlay(noopHandlers());
    expect(overlay.root.querySelector(".rs-stage")).toBeTruthy();
    expect(overlay.root.querySelector(".rs-timer")).toBeTruthy();
    expect(overlay.root.querySelectorAll(".rs-btn").length).toBe(10);
    expect(overlay.isOpen()).toBe(false);
  });

  it("mounts the UI inside an open shadow root on the host, with the CSS", () => {
    const overlay = createOverlay(
      noopHandlers(),
      document,
      "#reddit-slideshow-root .rs-stage{color:red}",
    );
    // The mounted element is the host; the UI container lives in its shadow,
    // isolating the overlay from host/RES page styles.
    expect(overlay.host).toBeTruthy();
    const shadow = overlay.host.shadowRoot;
    expect(shadow).toBeTruthy();
    expect(shadow?.querySelector("#reddit-slideshow-root")).toBe(overlay.root);
    expect(shadow?.querySelector("style")?.textContent).toContain(".rs-stage");
    // Nothing leaks into the light DOM.
    expect(overlay.host.querySelector(".rs-stage")).toBeNull();
  });

  it("makes the page inert while shown and restores it on hide", () => {
    const overlay = createOverlay(noopHandlers());
    document.documentElement.append(overlay.host);
    overlay.show();
    expect(document.body.inert).toBe(true);
    overlay.hide();
    expect(document.body.inert).toBe(false);
    overlay.host.remove();
  });

  it("flags the play button as paused (turquoise pulse) only while paused", () => {
    const overlay = createOverlay(noopHandlers());
    const play = overlay.root.querySelector(".rs-btn--primary");
    overlay.setPlaying(false);
    expect(play?.classList.contains("rs-btn--paused")).toBe(true);
    overlay.setPlaying(true);
    expect(play?.classList.contains("rs-btn--paused")).toBe(false);
  });

  it("wires the popout control to onPopout", () => {
    const onPopout = vi.fn();
    const overlay = createOverlay({ ...noopHandlers(), onPopout });
    clickByLabel(overlay.root, "Open in a window");
    expect(onPopout).toHaveBeenCalledTimes(1);
  });

  it("a backdrop click with the settings panel open closes the panel, not the show", () => {
    const onClose = vi.fn();
    const overlay = createOverlay({ ...noopHandlers(), onClose });
    // Open the settings panel via the gear.
    clickByLabel(overlay.root, "Settings");
    const panel = /** @type {HTMLElement | null} */ (
      overlay.root.querySelector(".rs-settings-panel")
    );
    expect(panel?.hidden).toBe(false);
    // Click the backdrop (the root itself).
    overlay.root.dispatchEvent(new Event("click", { bubbles: true }));
    expect(panel?.hidden).toBe(true); // panel dismissed
    expect(onClose).not.toHaveBeenCalled(); // slideshow stays open
  });

  it("toggles the inline settings panel from the gear", () => {
    const overlay = createOverlay(noopHandlers());
    const panel = /** @type {HTMLElement | null} */ (
      overlay.root.querySelector(".rs-settings-panel")
    );
    expect(panel?.hidden).toBe(true);
    clickByLabel(overlay.root, "Settings");
    expect(panel?.hidden).toBe(false);
    clickByLabel(overlay.root, "Settings");
    expect(panel?.hidden).toBe(true);
  });

  it("opens full preferences from the settings panel", () => {
    const onOpenPreferences = vi.fn();
    const overlay = createOverlay({ ...noopHandlers(), onOpenPreferences });
    clickByLabel(overlay.root, "Settings");
    overlay.root
      .querySelector(".rs-settings-panel__more")
      ?.dispatchEvent(new Event("click", { bubbles: true }));
    expect(onOpenPreferences).toHaveBeenCalledTimes(1);
  });

  it("applies a settings panel change via onChangeSetting", () => {
    const onChangeSetting = vi.fn();
    const overlay = createOverlay({ ...noopHandlers(), onChangeSetting });
    overlay.setSettings(/** @type {any} */ ({ ...PANEL_SETTINGS }));
    const range = /** @type {HTMLInputElement | null} */ (
      overlay.root.querySelector(".rs-set__range")
    );
    if (range) {
      range.value = "12";
      range.dispatchEvent(new Event("change", { bubbles: true }));
    }
    // The range is a stops index; the panel emits that stop's seconds.
    expect(onChangeSetting).toHaveBeenCalledWith({
      imageTimerSeconds: imageTimerStopSeconds(12),
    });
  });

  it("renders a slide with the position counter, title, and NSFW tag", () => {
    const overlay = createOverlay(noopHandlers());
    overlay.show();
    overlay.renderCurrent(imageSlide({ title: "Hello", over18: true }), {
      index: 0,
      total: 50,
      exhausted: false,
      effectiveSeconds: 5,
      playing: true,
    });
    expect(overlay.root.querySelector(".rs-meta__counter")?.textContent).toBe(
      "1 / 50+",
    );
    expect(overlay.root.querySelector(".rs-meta__title")?.textContent).toBe(
      "Hello",
    );
    const nsfw = /** @type {HTMLElement | null} */ (
      overlay.root.querySelector(".rs-meta__nsfw")
    );
    expect(nsfw?.hidden).toBe(false);
    expect(
      overlay.root.querySelector("img.reddit-slideshow-media"),
    ).toBeTruthy();
  });

  it("drops the + from the counter when the queue is exhausted", () => {
    const overlay = createOverlay(noopHandlers());
    overlay.renderCurrent(imageSlide(), {
      index: 2,
      total: 3,
      exhausted: true,
      effectiveSeconds: 5,
      playing: true,
    });
    expect(overlay.root.querySelector(".rs-meta__counter")?.textContent).toBe(
      "3 / 3",
    );
  });

  it("wires control buttons to handlers", () => {
    /** @type {string[]} */
    const calls = [];
    const overlay = createOverlay({
      onPrev: () => calls.push("prev"),
      onNext: () => calls.push("next"),
      onTogglePlay: () => calls.push("play"),
      onClose: () => calls.push("close"),
      onOpenOriginal: () => calls.push("open"),
      onMediaEnded: () => {},
      onMediaReady: () => {},
      onToggleMute: () => calls.push("mute"),
      onOpenPreferences: () => calls.push("prefs"),
    });
    overlay.renderCurrent(imageSlide(), {
      index: 0,
      total: 1,
      exhausted: true,
      effectiveSeconds: 5,
      playing: true,
    });
    clickByLabel(overlay.root, "Next");
    clickByLabel(overlay.root, "Previous");
    clickByLabel(overlay.root, "Open");
    clickByLabel(overlay.root, "Mute");
    clickByLabel(overlay.root, "Close");
    expect(calls).toEqual(["next", "prev", "open", "mute", "close"]);
  });

  it("loads a proxied video through resolveMedia as a blob src", async () => {
    vi.useRealTimers();
    const resolveMedia = vi.fn(async () => "blob:fake-123");
    const overlay = createOverlay({ ...noopHandlers(), resolveMedia });
    overlay.renderCurrent(
      imageSlide({
        kind: "video",
        durationMode: "media",
        proxied: true,
        mediaUrl: "https://media.redgifs.com/X.mp4",
      }),
      {
        index: 0,
        total: 1,
        exhausted: true,
        effectiveSeconds: 5,
        playing: true,
      },
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    const video = overlay.root.querySelector("video.reddit-slideshow-media");
    expect(resolveMedia).toHaveBeenCalledWith(
      "https://media.redgifs.com/X.mp4",
    );
    expect(video?.getAttribute("src")).toBe("blob:fake-123");
  });

  it("a backdrop click asks before closing once well into the show; media/control clicks do not", () => {
    const onClose = vi.fn();
    const overlay = createOverlay({ ...noopHandlers(), onClose });
    // Past slide 20, so a backdrop click guards instead of closing outright.
    overlay.renderCurrent(imageSlide(), {
      index: 24,
      total: 50,
      exhausted: false,
      effectiveSeconds: 5,
      playing: true,
    });
    const click = (/** @type {Element | null | undefined} */ el) =>
      el?.dispatchEvent(new Event("click", { bubbles: true }));

    click(overlay.root.querySelector(".rs-slide")); // the media - no close
    click(overlay.root.querySelector(".rs-btn")); // a control - no close
    expect(onClose).not.toHaveBeenCalled();

    // A backdrop click guards against an accidental click - it confirms first.
    click(overlay.root.querySelector(".rs-stage"));
    expect(onClose).not.toHaveBeenCalled();
    const confirm = /** @type {HTMLElement | null} */ (
      overlay.root.querySelector(".rs-confirm")
    );
    expect(confirm?.hidden).toBe(false);
    click(overlay.root.querySelector(".rs-confirm__btn--danger")); // "Close"
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("a backdrop click closes immediately in the first 20 slides (no confirm)", () => {
    const onClose = vi.fn();
    const overlay = createOverlay({ ...noopHandlers(), onClose });
    overlay.renderCurrent(imageSlide(), {
      index: 5,
      total: 50,
      exhausted: false,
      effectiveSeconds: 5,
      playing: true,
    });
    overlay.root
      .querySelector(".rs-stage")
      ?.dispatchEvent(new Event("click", { bubbles: true }));
    // No confirm popover; the show just closes.
    expect(
      /** @type {HTMLElement | null} */ (
        overlay.root.querySelector(".rs-confirm")
      )?.hidden,
    ).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("the X button and Keep-watching skip / dismiss the confirm", () => {
    const onClose = vi.fn();
    const overlay = createOverlay({ ...noopHandlers(), onClose });
    // Past slide 20 so a backdrop click confirms rather than closing outright.
    overlay.renderCurrent(imageSlide(), {
      index: 24,
      total: 50,
      exhausted: false,
      effectiveSeconds: 5,
      playing: true,
    });
    const click = (/** @type {Element | null | undefined} */ el) =>
      el?.dispatchEvent(new Event("click", { bubbles: true }));
    const confirm = /** @type {HTMLElement | null} */ (
      overlay.root.querySelector(".rs-confirm")
    );

    // The X (top-right) closes immediately, no confirm.
    clickByLabel(overlay.root, "Close");
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(confirm?.hidden).toBe(true);

    // A backdrop click then "Keep watching" dismisses without closing.
    click(overlay.root.querySelector(".rs-stage"));
    expect(confirm?.hidden).toBe(false);
    const keep = [...overlay.root.querySelectorAll(".rs-confirm__btn")].find(
      (b) => !b.classList.contains("rs-confirm__btn--danger"),
    );
    click(keep);
    expect(confirm?.hidden).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(1); // still just the X
  });

  it("counts down in the Keep-watching button and auto-dismisses", () => {
    const onClose = vi.fn();
    const overlay = createOverlay({ ...noopHandlers(), onClose });
    overlay.renderCurrent(imageSlide(), {
      index: 24,
      total: 50,
      exhausted: false,
      effectiveSeconds: 5,
      playing: true,
    });
    const click = (/** @type {Element | null | undefined} */ el) =>
      el?.dispatchEvent(new Event("click", { bubbles: true }));
    click(overlay.root.querySelector(".rs-stage"));
    const confirm = /** @type {HTMLElement | null} */ (
      overlay.root.querySelector(".rs-confirm")
    );
    const keep = [...overlay.root.querySelectorAll(".rs-confirm__btn")].find(
      (b) => !b.classList.contains("rs-confirm__btn--danger"),
    );
    expect(keep?.textContent).toBe("Keep watching (5s)");
    vi.advanceTimersByTime(1000);
    expect(keep?.textContent).toBe("Keep watching (4s)");
    vi.advanceTimersByTime(4000); // reaches 0 → self-dismiss
    expect(confirm?.hidden).toBe(true);
    expect(keep?.textContent).toBe("Keep watching"); // reset
    expect(onClose).not.toHaveBeenCalled();
  });

  it("puts the close button in the top-right corner, off the control rail", () => {
    const overlay = createOverlay(noopHandlers());
    const close = /** @type {HTMLElement | null} */ (
      overlay.root.querySelector('[aria-label^="Close"]')
    );
    expect(close?.classList.contains("rs-close-top")).toBe(true);
    expect(overlay.root.querySelector(".rs-controls .rs-close-top")).toBeNull();
  });

  it("keeps the controls up while the pointer rests on them", () => {
    const overlay = createOverlay(noopHandlers());
    overlay.show();
    overlay.root.dispatchEvent(new Event("mouseleave")); // force idle
    expect(overlay.root.classList.contains("rs-idle")).toBe(true);
    overlay.root
      .querySelector(".rs-controls")
      ?.dispatchEvent(new Event("mouseenter"));
    expect(overlay.root.classList.contains("rs-idle")).toBe(false);
  });

  it("dismisses an open settings panel when the overlay goes idle", () => {
    const overlay = createOverlay(noopHandlers());
    overlay.show();
    clickByLabel(overlay.root, "Settings");
    const panel = /** @type {HTMLElement | null} */ (
      overlay.root.querySelector(".rs-settings-panel")
    );
    expect(panel?.hidden).toBe(false);
    overlay.root.dispatchEvent(new Event("mouseleave")); // leave → idle
    expect(panel?.hidden).toBe(true);
    expect(overlay.root.classList.contains("rs-idle")).toBe(true);
  });

  it("renders a status message", () => {
    const overlay = createOverlay(noopHandlers());
    overlay.showStatus("No supported media on this page.");
    expect(overlay.root.querySelector(".rs-status")?.textContent).toBe(
      "No supported media on this page.",
    );
  });

  it("clicking play/pause toggles playback without closing the slideshow", () => {
    const onClose = vi.fn();
    /** @type {any} */
    let overlay;
    // The real wiring swaps the icon on toggle, which detaches the click
    // target - the backdrop-close handler must not mistake that for a backdrop.
    const onTogglePlay = vi.fn(() => overlay.setPlaying(false));
    overlay = createOverlay({ ...noopHandlers(), onClose, onTogglePlay });
    overlay.renderCurrent(imageSlide(), {
      index: 0,
      total: 1,
      exhausted: true,
      effectiveSeconds: 5,
      playing: true,
    });
    const play = overlay.root.querySelector(".rs-btn--primary");
    const icon = play?.querySelector(".rs-icon") ?? play;
    icon?.dispatchEvent(new Event("click", { bubbles: true }));
    expect(onTogglePlay).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("shows a branded logo splash while loading", () => {
    const overlay = createOverlay(noopHandlers());
    overlay.showLoading();
    expect(overlay.root.querySelector(".rs-logo__mark")).toBeTruthy();
    expect(overlay.root.querySelector(".rs-logo__name")?.textContent).toBe(
      "Reddit Slideshow Spectacular!",
    );
    expect(overlay.root.querySelector(".rs-logo__sub")?.textContent).toBe(
      "Loading…",
    );
  });

  it("clears the loading splash once the first slide renders", () => {
    const overlay = createOverlay(noopHandlers());
    overlay.showLoading();
    expect(overlay.root.querySelector(".rs-logo")).toBeTruthy();
    overlay.renderCurrent(imageSlide(), {
      index: 0,
      total: 1,
      exhausted: true,
      effectiveSeconds: 5,
      playing: true,
    });
    // The splash must not linger as a second grid item beneath the slide.
    expect(overlay.root.querySelector(".rs-logo")).toBeNull();
  });

  it("pins the meta with rs-pin-meta only when alwaysShowMeta is set", () => {
    const overlay = createOverlay(noopHandlers());
    overlay.setSettings(
      /** @type {any} */ ({ ...PANEL_SETTINGS, alwaysShowMeta: true }),
    );
    expect(overlay.root.classList.contains("rs-pin-meta")).toBe(true);
    overlay.setSettings(
      /** @type {any} */ ({ ...PANEL_SETTINGS, alwaysShowMeta: false }),
    );
    expect(overlay.root.classList.contains("rs-pin-meta")).toBe(false);
  });

  it("stops and detaches the current video on hide so audio can't keep playing", async () => {
    vi.useRealTimers();
    const overlay = createOverlay({
      ...noopHandlers(),
      resolveMedia: vi.fn(async () => "blob:fake-hide"),
    });
    renderProxiedVideo(overlay);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(overlay.root.querySelector("video")).toBeTruthy();
    overlay.hide();
    expect(overlay.root.querySelector("video")).toBeNull();
  });

  it("tears down the current video when a status card replaces it", async () => {
    vi.useRealTimers();
    const overlay = createOverlay({
      ...noopHandlers(),
      resolveMedia: vi.fn(async () => "blob:fake-status"),
    });
    renderProxiedVideo(overlay);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(overlay.root.querySelector("video")).toBeTruthy();
    overlay.showStatus("No more media to show.");
    expect(overlay.root.querySelector("video")).toBeNull();
    expect(overlay.root.querySelector(".rs-status")?.textContent).toBe(
      "No more media to show.",
    );
  });

  it("reports the true skip total even when the retained list is capped", () => {
    const overlay = createOverlay(noopHandlers());
    const badge = /** @type {HTMLElement | null} */ (
      overlay.root.querySelector(".rs-skipped")
    );
    // 250 skips occurred but only the most recent one is retained.
    overlay.setSkipped([imageSlide({ title: "most recent skip" })], 250);
    expect(badge?.textContent).toBe("250 skipped");
    badge?.dispatchEvent(new Event("click", { bubbles: true }));
    expect(
      overlay.root.querySelector(".rs-skipped-panel__note")?.textContent,
    ).toBe("Showing the most recent 1.");
  });

  it("skips broken media via onMediaFailed instead of dwelling", () => {
    const onMediaFailed = vi.fn();
    const overlay = createOverlay({ ...noopHandlers(), onMediaFailed });
    overlay.renderCurrent(imageSlide({ title: "Broken" }), {
      index: 0,
      total: 2,
      exhausted: false,
      effectiveSeconds: 5,
      playing: true,
    });
    overlay.root
      .querySelector(".reddit-slideshow-media")
      ?.dispatchEvent(new Event("error"));
    expect(onMediaFailed).toHaveBeenCalledTimes(1);
    expect(overlay.root.querySelector(".rs-placeholder")).toBeNull();
  });

  it("shows a clickable skipped count and lists the skipped items", () => {
    const onOpenOriginal = vi.fn();
    const overlay = createOverlay({ ...noopHandlers(), onOpenOriginal });
    const badge = /** @type {HTMLElement | null} */ (
      overlay.root.querySelector(".rs-skipped")
    );
    expect(badge?.hidden).toBe(true);

    overlay.setSkipped([
      imageSlide({ title: "Dead clip", sourceUrl: "https://v.redd.it/x" }),
    ]);
    expect(badge?.hidden).toBe(false);
    expect(badge?.textContent).toBe("1 skipped");

    badge?.dispatchEvent(new Event("click", { bubbles: true }));
    const item = overlay.root.querySelector(".rs-skipped-panel__item");
    expect(item?.textContent).toBe("Dead clip");
    item?.dispatchEvent(new Event("click", { bubbles: true }));
    expect(onOpenOriginal).toHaveBeenCalledTimes(1);
  });

  it("shows the skip reason next to each skipped item", () => {
    const overlay = createOverlay(noopHandlers());
    overlay.setSkipped(
      [imageSlide({ title: "Dupe", skipReason: "Duplicate image" })],
      1,
    );
    /** @type {HTMLElement} */ (
      overlay.root.querySelector(".rs-skipped")
    ).dispatchEvent(new Event("click", { bubbles: true }));
    expect(
      overlay.root.querySelector(".rs-skipped-panel__text")?.textContent,
    ).toBe("Dupe");
    expect(
      overlay.root.querySelector(".rs-skipped-panel__reason")?.textContent,
    ).toBe("Duplicate image");
  });

  it("dims and tags auto-skipped slides in the jump list", () => {
    const overlay = createOverlay(noopHandlers());
    overlay.setJumpList(
      [
        imageSlide({ title: "kept" }),
        imageSlide({ title: "gone", skipReason: "Unavailable" }),
      ],
      0,
      1,
    );
    /** @type {HTMLElement} */ (
      overlay.root.querySelector(".rs-meta__counter")
    ).dispatchEvent(new Event("click", { bubbles: true }));
    const items = overlay.root.querySelectorAll(".rs-jump-panel__item");
    expect(items[0].classList.contains("rs-jump-panel__item--skipped")).toBe(
      false,
    );
    expect(items[1].classList.contains("rs-jump-panel__item--skipped")).toBe(
      true,
    );
    expect(items[1].querySelector(".rs-jump-panel__tag")?.textContent).toBe(
      "(skipped)",
    );
  });

  it("pulses the position counter on a manual nav", () => {
    const overlay = createOverlay(noopHandlers());
    const counter = overlay.root.querySelector(".rs-meta__counter");
    expect(counter?.classList.contains("rs-meta__counter--pulse")).toBe(false);
    overlay.notifyManualNav();
    expect(counter?.classList.contains("rs-meta__counter--pulse")).toBe(true);
  });

  it("skips a slide whose media URL is unsafe (non-HTTPS)", async () => {
    const onMediaFailed = vi.fn();
    const overlay = createOverlay({ ...noopHandlers(), onMediaFailed });
    overlay.renderCurrent(imageSlide({ mediaUrl: "http://i.redd.it/x.jpg" }), {
      index: 0,
      total: 2,
      exhausted: false,
      effectiveSeconds: 5,
      playing: true,
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(onMediaFailed).toHaveBeenCalledTimes(1);
  });

  it("swaps in a placeholder when media fails to load", () => {
    const overlay = createOverlay(noopHandlers());
    overlay.renderCurrent(imageSlide({ title: "Removed post" }), {
      index: 0,
      total: 1,
      exhausted: true,
      effectiveSeconds: 5,
      playing: true,
    });
    const media = overlay.root.querySelector(".reddit-slideshow-media");
    media?.dispatchEvent(new Event("error"));
    expect(
      overlay.root.querySelector(".rs-placeholder__title")?.textContent,
    ).toBe("Removed post");
  });

  it("shows the timer bar only for video slides under the default mode", async () => {
    vi.useRealTimers();
    const overlay = createOverlay(noopHandlers());
    overlay.show();
    const timer = /** @type {HTMLElement | null} */ (
      overlay.root.querySelector(".rs-timer")
    );

    // Default mode is "video": an image slide gets no bar.
    overlay.renderCurrent(
      imageSlide({ id: "img", mediaUrl: "https://i.redd.it/img.jpg" }),
      {
        index: 0,
        total: 2,
        exhausted: false,
        effectiveSeconds: 5,
        playing: true,
      },
    );
    overlay.root
      .querySelector('img[src="https://i.redd.it/img.jpg"]')
      ?.dispatchEvent(new Event("load"));
    await Promise.resolve();
    await Promise.resolve();
    expect(timer?.hidden).toBe(true);

    // A video slide does get the bar.
    overlay.renderCurrent(
      imageSlide({
        id: "vid",
        kind: "video",
        durationMode: "media",
        mediaUrl: "https://v.redd.it/vid.mp4",
      }),
      {
        index: 1,
        total: 2,
        exhausted: false,
        effectiveSeconds: 5,
        playing: true,
      },
    );
    overlay.root.querySelector("video")?.dispatchEvent(new Event("loadeddata"));
    await Promise.resolve();
    await Promise.resolve();
    expect(timer?.hidden).toBe(false);
  });

  it("shows the timer bar for images when the mode is 'all'", async () => {
    vi.useRealTimers();
    const overlay = createOverlay(noopHandlers());
    overlay.setSettings(
      /** @type {any} */ ({ ...PANEL_SETTINGS, timerBar: "all" }),
    );
    overlay.show();
    overlay.renderCurrent(imageSlide({ mediaUrl: "https://i.redd.it/a.jpg" }), {
      index: 0,
      total: 1,
      exhausted: true,
      effectiveSeconds: 5,
      playing: true,
    });
    overlay.root
      .querySelector('img[src="https://i.redd.it/a.jpg"]')
      ?.dispatchEvent(new Event("load"));
    await Promise.resolve();
    await Promise.resolve();
    expect(
      /** @type {HTMLElement | null} */ (
        overlay.root.querySelector(".rs-timer")
      )?.hidden,
    ).toBe(false);
  });

  it("toggles the buffering hint", () => {
    const overlay = createOverlay(noopHandlers());
    const hint = /** @type {HTMLElement | null} */ (
      overlay.root.querySelector(".rs-buffering")
    );
    expect(hint?.hidden).toBe(true);
    overlay.setBuffering(true);
    expect(hint?.hidden).toBe(false);
    overlay.setBuffering(false);
    expect(hint?.hidden).toBe(true);
  });

  /**
   * @param {Overlay} overlay
   * @param {string} id
   * @param {number} index
   * @param {string} [transition]
   */
  function renderImageAt(overlay, id, index, transition = "fade") {
    overlay.renderCurrent(
      imageSlide({ id, mediaUrl: `https://i.redd.it/${id}.jpg` }),
      {
        index,
        total: 3,
        exhausted: false,
        effectiveSeconds: 5,
        playing: true,
        transition,
      },
    );
  }

  /**
   * @param {Overlay} overlay
   * @param {string} id
   */
  function imgFor(overlay, id) {
    return /** @type {HTMLImageElement | null} */ (
      overlay.root.querySelector(`img[src="https://i.redd.it/${id}.jpg"]`)
    );
  }

  /**
   * Drive an image slide to "ready": dispatch load, then flush the decode()
   * microtask the swap waits on.
   * @param {Overlay} overlay
   * @param {string} id
   */
  async function markImageReady(overlay, id) {
    imgFor(overlay, id)?.dispatchEvent(new Event("load"));
    await Promise.resolve();
    await Promise.resolve();
  }

  it("holds the previous slide on screen until the next is decoded (no gap)", async () => {
    vi.useRealTimers();
    const overlay = createOverlay(noopHandlers());
    overlay.show();

    renderImageAt(overlay, "a", 0);
    await markImageReady(overlay, "a");
    expect(overlay.root.querySelectorAll(".rs-slide").length).toBe(1);

    // Advance: the new slide is not ready yet, so "a" must stay on screen
    // rather than being replaced by a black/loading gap.
    renderImageAt(overlay, "b", 1);
    expect(overlay.root.querySelectorAll(".rs-slide").length).toBe(2);
    expect(imgFor(overlay, "a")).toBeTruthy();

    // Once "b" is decoded, "a" transitions out and is retired.
    await markImageReady(overlay, "b");
    overlay.root
      .querySelector(".rs-slide--exit")
      ?.dispatchEvent(new Event("animationend"));
    expect(imgFor(overlay, "a")).toBeNull();
    expect(imgFor(overlay, "b")).toBeTruthy();
    expect(overlay.root.querySelectorAll(".rs-slide").length).toBe(1);
  });

  it("holds the committed frame, not an undecoded pending one, on a rapid 3rd advance", async () => {
    vi.useRealTimers();
    const overlay = createOverlay(noopHandlers());
    overlay.show();

    // A committed + visible.
    renderImageAt(overlay, "a", 0);
    await markImageReady(overlay, "a");
    expect(overlay.root.querySelectorAll(".rs-slide").length).toBe(1);

    // Advance to B but never ready it - A stays visible under the pending B.
    renderImageAt(overlay, "b", 1);
    expect(overlay.root.querySelectorAll(".rs-slide").length).toBe(2);

    // Advance again to C (also unready). The flush must retire the never-committed
    // pending B and keep the committed A, so the only visible frame is never
    // removed while an undecoded frame is held.
    renderImageAt(overlay, "c", 2);
    expect(imgFor(overlay, "a")).toBeTruthy(); // committed A still on screen
    expect(imgFor(overlay, "b")).toBeNull(); // pending B retired, not held
    expect(imgFor(overlay, "c")).toBeTruthy(); // new pending C layered on
    const a = imgFor(overlay, "a")?.closest(".rs-slide");
    expect(a?.classList.contains("rs-slide--pending")).toBe(false); // A is the live frame

    // Once C decodes, A transitions out and is retired.
    await markImageReady(overlay, "c");
    overlay.root
      .querySelector(".rs-slide--exit")
      ?.dispatchEvent(new Event("animationend"));
    expect(imgFor(overlay, "a")).toBeNull();
    expect(imgFor(overlay, "c")).toBeTruthy();
    expect(overlay.root.querySelectorAll(".rs-slide").length).toBe(1);
  });

  it("tags the incoming frame with the chosen transition and direction", async () => {
    vi.useRealTimers();
    const overlay = createOverlay(noopHandlers());
    overlay.show();

    renderImageAt(overlay, "a", 1, "slide");
    await markImageReady(overlay, "a");
    const frame = /** @type {HTMLElement | null} */ (
      overlay.root.querySelector(".rs-slide")
    );
    expect(frame?.classList.contains("rs-tx-slide")).toBe(true);
    expect(frame?.classList.contains("rs-dir-fwd")).toBe(true);

    // Going backward (lower index) flips the direction class on the next frame.
    renderImageAt(overlay, "b", 0, "slide");
    await markImageReady(overlay, "b");
    const incoming = imgFor(overlay, "b")?.closest(".rs-slide");
    expect(incoming?.classList.contains("rs-dir-back")).toBe(true);
  });

  it("exposes dialog roles and a polite live region", () => {
    const overlay = createOverlay(noopHandlers());
    expect(overlay.root.getAttribute("role")).toBe("dialog");
    expect(overlay.root.getAttribute("aria-modal")).toBe("true");
    expect(overlay.root.getAttribute("aria-label")).toBe("Reddit slideshow");
    const confirm = /** @type {HTMLElement | null} */ (
      overlay.root.querySelector(".rs-confirm")
    );
    expect(confirm?.getAttribute("role")).toBe("alertdialog");
    expect(confirm?.getAttribute("aria-labelledby")).toBe("rs-confirm-text");
    const live = /** @type {HTMLElement | null} */ (
      overlay.root.querySelector(".rs-live")
    );
    expect(live?.getAttribute("aria-live")).toBe("polite");
  });

  it("moves focus into the dialog on show and restores it on hide", () => {
    const prior = document.createElement("button");
    document.body.append(prior);
    prior.focus();
    expect(document.activeElement).toBe(prior);

    const overlay = createOverlay(noopHandlers());
    document.documentElement.append(overlay.root);
    overlay.show();
    expect(document.activeElement).toBe(overlay.root);
    overlay.hide();
    expect(document.activeElement).toBe(prior);

    overlay.root.remove();
    prior.remove();
  });

  it("announces the slide position and title in the live region", () => {
    const overlay = createOverlay(noopHandlers());
    overlay.show();
    overlay.renderCurrent(imageSlide({ title: "Sunset", over18: true }), {
      index: 2,
      total: 50,
      exhausted: false,
      effectiveSeconds: 5,
      playing: true,
    });
    expect(overlay.root.querySelector(".rs-live")?.textContent).toBe(
      "3 of 50, Sunset, NSFW",
    );
  });

  it("announces a fresh auto-skip but not the start-of-run reset", () => {
    const overlay = createOverlay(noopHandlers());
    const live = /** @type {HTMLElement | null} */ (
      overlay.root.querySelector(".rs-live")
    );
    // Start-of-run reset to zero: no announcement.
    overlay.setSkipped([], 0);
    expect(live?.textContent).toBe("");
    // A new skip increments the total → announce it.
    overlay.setSkipped([imageSlide({ title: "Dead clip" })], 1);
    expect(live?.textContent).toBe("Skipped unavailable media: Dead clip");
  });

  it("dismissTopLayer closes the confirm first, then panels, returning false when empty", () => {
    const overlay = createOverlay(noopHandlers());
    expect(overlay.dismissTopLayer()).toBe(false); // nothing open

    // Open the settings panel; dismissTopLayer closes it and reports true.
    clickByLabel(overlay.root, "Settings");
    const panel = /** @type {HTMLElement | null} */ (
      overlay.root.querySelector(".rs-settings-panel")
    );
    expect(panel?.hidden).toBe(false);
    expect(overlay.dismissTopLayer()).toBe(true);
    expect(panel?.hidden).toBe(true);

    // The confirm popover is dismissed before any panel.
    const click = (/** @type {Element | null | undefined} */ el) =>
      el?.dispatchEvent(new Event("click", { bubbles: true }));
    overlay.show();
    // Past slide 20 so a backdrop click raises the confirm.
    overlay.renderCurrent(imageSlide(), {
      index: 24,
      total: 50,
      exhausted: false,
      effectiveSeconds: 5,
      playing: true,
    });
    click(overlay.root.querySelector(".rs-stage")); // backdrop → confirm
    const confirm = /** @type {HTMLElement | null} */ (
      overlay.root.querySelector(".rs-confirm")
    );
    expect(confirm?.hidden).toBe(false);
    expect(overlay.dismissTopLayer()).toBe(true);
    expect(confirm?.hidden).toBe(true);
  });
});

describe("help panel", () => {
  const helpLabel = "Keyboard shortcuts (?)";
  /** @param {Overlay} overlay @returns {HTMLElement | undefined} */
  function helpBtn(overlay) {
    return /** @type {HTMLElement | undefined} */ (
      [...overlay.root.querySelectorAll(".rs-controls .rs-btn")].find(
        (b) => b.getAttribute("aria-label") === helpLabel,
      )
    );
  }
  /** @param {Overlay} overlay @returns {HTMLElement | null} */
  const helpPanel = (overlay) => overlay.root.querySelector(".rs-help-panel");
  /** @param {Overlay} overlay @returns {HTMLElement | null} */
  const settingsPanel = (overlay) =>
    overlay.root.querySelector(".rs-settings-panel");

  it("has a (?) help button in the control rail", () => {
    const overlay = createOverlay(noopHandlers());
    expect(helpBtn(overlay)).toBeTruthy();
  });

  it("toggles the shortcuts panel from the help button", () => {
    const overlay = createOverlay(noopHandlers());
    overlay.show();
    const panel = helpPanel(overlay);
    expect(panel?.hidden).toBe(true);
    helpBtn(overlay)?.click();
    expect(panel?.hidden).toBe(false);
    helpBtn(overlay)?.click();
    expect(panel?.hidden).toBe(true);
  });

  it("opening help closes the settings panel (centered cards don't stack)", () => {
    const overlay = createOverlay(noopHandlers());
    overlay.show();
    const gear = /** @type {HTMLElement | undefined} */ (
      [...overlay.root.querySelectorAll(".rs-controls .rs-btn")].find(
        (b) => b.getAttribute("aria-label") === "Settings",
      )
    );
    gear?.click();
    expect(settingsPanel(overlay)?.hidden).toBe(false);
    helpBtn(overlay)?.click();
    expect(helpPanel(overlay)?.hidden).toBe(false);
    expect(settingsPanel(overlay)?.hidden).toBe(true);
  });

  it("a backdrop click dismisses the help panel, not the show", () => {
    const onClose = vi.fn();
    const overlay = createOverlay({ ...noopHandlers(), onClose });
    overlay.show();
    helpBtn(overlay)?.click();
    expect(helpPanel(overlay)?.hidden).toBe(false);
    overlay.root.dispatchEvent(new Event("click", { bubbles: true }));
    expect(helpPanel(overlay)?.hidden).toBe(true);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("dismissTopLayer closes the help panel and returns true", () => {
    const overlay = createOverlay(noopHandlers());
    overlay.show();
    helpBtn(overlay)?.click();
    expect(overlay.dismissTopLayer()).toBe(true);
    expect(helpPanel(overlay)?.hidden).toBe(true);
    expect(overlay.dismissTopLayer()).toBe(false);
  });

  it("hide() closes the help panel", () => {
    const overlay = createOverlay(noopHandlers());
    overlay.show();
    helpBtn(overlay)?.click();
    overlay.hide();
    expect(helpPanel(overlay)?.hidden).toBe(true);
  });

  it("going idle hides the help panel", () => {
    const overlay = createOverlay(noopHandlers());
    overlay.show();
    helpBtn(overlay)?.click();
    overlay.root.dispatchEvent(new Event("mouseleave"));
    expect(helpPanel(overlay)?.hidden).toBe(true);
  });
});

describe("auto-hide video controls", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    document.body.inert = false;
  });

  /** @param {Overlay} overlay @returns {HTMLVideoElement} */
  function renderVideoSlide(overlay) {
    overlay.renderCurrent(
      imageSlide({
        kind: "video",
        durationMode: "media",
        mediaUrl: "https://v.redd.it/abc123/DASH_720.mp4",
        sourceUrl: "https://v.redd.it/abc123/DASH_720.mp4",
      }),
      {
        index: 0,
        total: 1,
        exhausted: true,
        effectiveSeconds: 5,
        playing: true,
      },
    );
    return /** @type {HTMLVideoElement} */ (
      overlay.root.querySelector("video")
    );
  }

  it("starts with native controls hidden", () => {
    const overlay = createOverlay(noopHandlers());
    overlay.show();
    expect(renderVideoSlide(overlay).controls).toBe(false);
  });

  it("reveals controls on pointer activity over the video", () => {
    const overlay = createOverlay(noopHandlers());
    overlay.show();
    const video = renderVideoSlide(overlay);
    video.dispatchEvent(new Event("pointermove"));
    expect(video.controls).toBe(true);
  });

  it("hides controls when the pointer leaves the video", () => {
    const overlay = createOverlay(noopHandlers());
    overlay.show();
    const video = renderVideoSlide(overlay);
    video.dispatchEvent(new Event("pointerenter"));
    expect(video.controls).toBe(true);
    video.dispatchEvent(new Event("pointerleave"));
    expect(video.controls).toBe(false);
  });

  it("re-hides controls after the pointer goes idle", () => {
    const overlay = createOverlay(noopHandlers());
    overlay.show();
    const video = renderVideoSlide(overlay);
    video.dispatchEvent(new Event("pointermove"));
    expect(video.controls).toBe(true);
    vi.advanceTimersByTime(2000);
    expect(video.controls).toBe(false);
  });

  it("re-shows controls on a later pointer move after idle", () => {
    const overlay = createOverlay(noopHandlers());
    overlay.show();
    const video = renderVideoSlide(overlay);
    video.dispatchEvent(new Event("pointermove"));
    vi.advanceTimersByTime(2000);
    expect(video.controls).toBe(false);
    video.dispatchEvent(new Event("pointermove"));
    expect(video.controls).toBe(true);
  });

  it("does not reveal controls at the start or end of the clip", () => {
    const overlay = createOverlay(noopHandlers());
    overlay.show();
    const video = renderVideoSlide(overlay);
    video.dispatchEvent(new Event("loadeddata")); // playback starts
    expect(video.controls).toBe(false);
    video.dispatchEvent(new Event("ended")); // playback ends
    expect(video.controls).toBe(false);
  });

  it("tears down the pointer listeners when the frame is retired", () => {
    const overlay = createOverlay(noopHandlers());
    overlay.show();
    const video = renderVideoSlide(overlay);
    video.dispatchEvent(new Event("pointermove"));
    expect(video.controls).toBe(true);
    // A new render aborts the old frame's media listeners, which hides its
    // controls; further pointer events on the detached video do nothing.
    overlay.renderCurrent(
      imageSlide({ id: "later", mediaUrl: "https://i.redd.it/later.jpg" }),
      {
        index: 1,
        total: 2,
        exhausted: true,
        effectiveSeconds: 5,
        playing: true,
      },
    );
    expect(video.controls).toBe(false);
    video.dispatchEvent(new Event("pointermove"));
    expect(video.controls).toBe(false);
  });
});
