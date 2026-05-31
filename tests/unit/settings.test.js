import { beforeEach, describe, expect, it } from "vitest";
import { fakeBrowser } from "wxt/testing";
import {
  DEFAULT_SETTINGS,
  getSettings,
  normalizeSettings,
  saveSettings,
  imageTimerStopIndex,
  imageTimerStopSeconds,
  formatImageTimer,
} from "../../lib/settings.js";

describe("normalizeSettings", () => {
  it("returns defaults for empty input", () => {
    expect(normalizeSettings({})).toEqual(DEFAULT_SETTINGS);
  });

  it("accepts a custom timer value within range", () => {
    expect(normalizeSettings({ imageTimerSeconds: 7 }).imageTimerSeconds).toBe(
      7,
    );
  });

  it("clamps and rounds out-of-range timer values", () => {
    expect(
      normalizeSettings({ imageTimerSeconds: 999 }).imageTimerSeconds,
    ).toBe(300);
    expect(normalizeSettings({ imageTimerSeconds: 0 }).imageTimerSeconds).toBe(
      1,
    );
    expect(
      normalizeSettings({ imageTimerSeconds: 4.6 }).imageTimerSeconds,
    ).toBe(5);
    expect(
      normalizeSettings({ imageTimerSeconds: "abc" }).imageTimerSeconds,
    ).toBe(5);
  });

  it("normalizes startMuted to a boolean", () => {
    expect(normalizeSettings({ startMuted: false }).startMuted).toBe(false);
    expect(normalizeSettings({ startMuted: "no" }).startMuted).toBe(true);
  });

  it("defaults includeNsfw to follow Reddit (true) and accepts a boolean", () => {
    expect(normalizeSettings({}).includeNsfw).toBe(true);
    expect(normalizeSettings({ includeNsfw: false }).includeNsfw).toBe(false);
  });

  it("defaults dedupe to on and accepts a boolean", () => {
    expect(normalizeSettings({}).dedupe).toBe(true);
    expect(normalizeSettings({ dedupe: false }).dedupe).toBe(false);
  });

  it("defaults contentDedup off (opt-in) and accepts a boolean", () => {
    expect(normalizeSettings({}).contentDedup).toBe(false);
    expect(normalizeSettings({ contentDedup: true }).contentDedup).toBe(true);
  });

  it("defaults maxLoadWaitSeconds to 5 and clamps to 1-30", () => {
    expect(normalizeSettings({}).maxLoadWaitSeconds).toBe(5);
    expect(
      normalizeSettings({ maxLoadWaitSeconds: 7 }).maxLoadWaitSeconds,
    ).toBe(7);
    expect(
      normalizeSettings({ maxLoadWaitSeconds: 999 }).maxLoadWaitSeconds,
    ).toBe(30);
    expect(
      normalizeSettings({ maxLoadWaitSeconds: 0 }).maxLoadWaitSeconds,
    ).toBe(1);
    expect(
      normalizeSettings({ maxLoadWaitSeconds: "x" }).maxLoadWaitSeconds,
    ).toBe(5);
  });

  it("defaults transition to fade and only accepts known transitions", () => {
    expect(normalizeSettings({}).transition).toBe("fade");
    expect(normalizeSettings({ transition: "flip" }).transition).toBe("flip");
    expect(normalizeSettings({ transition: "spin" }).transition).toBe("fade");
    expect(normalizeSettings({ transition: 7 }).transition).toBe("fade");
  });

  it("defaults timerBar to video and only accepts known modes", () => {
    expect(normalizeSettings({}).timerBar).toBe("video");
    expect(normalizeSettings({ timerBar: "all" }).timerBar).toBe("all");
    expect(normalizeSettings({ timerBar: "none" }).timerBar).toBe("none");
    expect(normalizeSettings({ timerBar: "bogus" }).timerBar).toBe("video");
  });

  it("defaults pan-zoom off with sensible phase durations", () => {
    const s = normalizeSettings({});
    expect(s.panZoom).toBe(false);
    expect(s.panZoomScale).toBe(2);
    expect(s.panZoomPanSeconds).toBe(6);
  });

  it("clamps the pan-zoom scale and phase durations", () => {
    expect(normalizeSettings({ panZoomScale: 99 }).panZoomScale).toBe(5);
    expect(normalizeSettings({ panZoomScale: 1 }).panZoomScale).toBe(1.1);
    expect(
      normalizeSettings({ panZoomPanSeconds: 999 }).panZoomPanSeconds,
    ).toBe(30);
    expect(
      normalizeSettings({ panZoomShowSeconds: -4 }).panZoomShowSeconds,
    ).toBe(0);
    expect(
      normalizeSettings({ panZoomZoomInSeconds: "x" }).panZoomZoomInSeconds,
    ).toBe(2);
  });
});

describe("getSettings / saveSettings", () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it("returns normalized defaults when storage is empty", async () => {
    expect(await getSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it("round-trips saved settings through normalization", async () => {
    await saveSettings({
      imageTimerSeconds: 12,
      autoplay: false,
      startMuted: false,
      includeNsfw: false,
      dedupe: false,
      contentDedup: true,
      maxLoadWaitSeconds: 10,
    });
    expect(await getSettings()).toEqual({
      imageTimerSeconds: 12,
      startMuted: false,
      autoplay: false,
      includeNsfw: false,
      dedupe: false,
      contentDedup: true,
      alwaysShowMeta: true,
      maxLoadWaitSeconds: 10,
      transition: "fade",
      timerBar: "video",
      panZoom: false,
      panZoomScale: 2,
      panZoomShowSeconds: 2,
      panZoomZoomInSeconds: 2,
      panZoomPanSeconds: 6,
      panZoomZoomOutSeconds: 2,
      panZoomShowEndSeconds: 2,
      panZoomMinOversize: 1.5,
    });
  });

  it("clamps out-of-range stored values on read", async () => {
    await browser.storage.local.set({ imageTimerSeconds: 999 });
    expect((await getSettings()).imageTimerSeconds).toBe(300);
  });
});

describe("image timer stops", () => {
  it("maps a slider index to seconds and a seconds value to the nearest index", () => {
    expect(imageTimerStopSeconds(0)).toBe(1);
    expect(imageTimerStopSeconds(4)).toBe(5);
    expect(imageTimerStopSeconds(24)).toBe(300);
    expect(imageTimerStopIndex(5)).toBe(4);
    expect(imageTimerStopIndex(300)).toBe(24);
    // Off-stop values snap to the nearest stop.
    expect(imageTimerStopSeconds(imageTimerStopIndex(12))).toBe(10);
    expect(imageTimerStopSeconds(imageTimerStopIndex(200))).toBe(210);
  });

  it("clamps the slider index into range", () => {
    expect(imageTimerStopSeconds(-5)).toBe(1);
    expect(imageTimerStopSeconds(999)).toBe(300);
  });

  it("formats durations compactly", () => {
    expect(formatImageTimer(5)).toBe("5s");
    expect(formatImageTimer(60)).toBe("1m");
    expect(formatImageTimer(90)).toBe("1m 30s");
    expect(formatImageTimer(300)).toBe("5m");
  });
});
