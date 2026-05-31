import { beforeEach, describe, expect, it } from "vitest";
import { fakeBrowser } from "wxt/testing";
import {
  DEFAULT_SETTINGS,
  getSettings,
  normalizeSettings,
  saveSettings,
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
    ).toBe(60);
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

  it("defaults maxLoadWaitSeconds to 5 and only accepts preset values", () => {
    expect(normalizeSettings({}).maxLoadWaitSeconds).toBe(5);
    expect(
      normalizeSettings({ maxLoadWaitSeconds: 20 }).maxLoadWaitSeconds,
    ).toBe(20);
    expect(
      normalizeSettings({ maxLoadWaitSeconds: 7 }).maxLoadWaitSeconds,
    ).toBe(5);
  });

  it("defaults transition to fade and only accepts known transitions", () => {
    expect(normalizeSettings({}).transition).toBe("fade");
    expect(normalizeSettings({ transition: "flip" }).transition).toBe("flip");
    expect(normalizeSettings({ transition: "spin" }).transition).toBe("fade");
    expect(normalizeSettings({ transition: 7 }).transition).toBe("fade");
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
    expect((await getSettings()).imageTimerSeconds).toBe(60);
  });
});
