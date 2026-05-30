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

  it("defaults maxLoadWaitSeconds to 5 and only accepts preset values", () => {
    expect(normalizeSettings({}).maxLoadWaitSeconds).toBe(5);
    expect(
      normalizeSettings({ maxLoadWaitSeconds: 20 }).maxLoadWaitSeconds,
    ).toBe(20);
    expect(
      normalizeSettings({ maxLoadWaitSeconds: 7 }).maxLoadWaitSeconds,
    ).toBe(5);
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
      maxLoadWaitSeconds: 10,
    });
    expect(await getSettings()).toEqual({
      imageTimerSeconds: 12,
      startMuted: false,
      autoplay: false,
      includeNsfw: false,
      dedupe: false,
      maxLoadWaitSeconds: 10,
    });
  });

  it("clamps out-of-range stored values on read", async () => {
    await browser.storage.local.set({ imageTimerSeconds: 999 });
    expect((await getSettings()).imageTimerSeconds).toBe(60);
  });
});
