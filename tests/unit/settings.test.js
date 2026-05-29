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

  it("accepts supported timer values", () => {
    expect(normalizeSettings({ imageTimerSeconds: 10 }).imageTimerSeconds).toBe(
      10,
    );
  });

  it("falls back when timer value is unsupported", () => {
    expect(
      normalizeSettings({ imageTimerSeconds: 999 }).imageTimerSeconds,
    ).toBe(5);
  });

  it("normalizes startMuted to a boolean", () => {
    expect(normalizeSettings({ startMuted: false }).startMuted).toBe(false);
    expect(normalizeSettings({ startMuted: "no" }).startMuted).toBe(true);
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
      imageTimerSeconds: 10,
      autoplay: false,
      startMuted: false,
    });
    expect(await getSettings()).toEqual({
      imageTimerSeconds: 10,
      startMuted: false,
      autoplay: false,
    });
  });

  it("repairs out-of-range stored values on read", async () => {
    await browser.storage.local.set({ imageTimerSeconds: 999 });
    expect((await getSettings()).imageTimerSeconds).toBe(5);
  });
});
