import { browser } from "wxt/browser";

export const DEFAULT_SETTINGS = Object.freeze({
  imageTimerSeconds: 5,
  startMuted: true,
  autoplay: true,
});

const SUPPORTED_TIMERS = new Set([3, 5, 10]);

/**
 * @param {Partial<typeof DEFAULT_SETTINGS>} [input]
 * @returns {typeof DEFAULT_SETTINGS}
 */
export function normalizeSettings(input = {}) {
  return {
    imageTimerSeconds: SUPPORTED_TIMERS.has(input.imageTimerSeconds)
      ? input.imageTimerSeconds
      : DEFAULT_SETTINGS.imageTimerSeconds,
    startMuted:
      typeof input.startMuted === "boolean"
        ? input.startMuted
        : DEFAULT_SETTINGS.startMuted,
    autoplay:
      typeof input.autoplay === "boolean"
        ? input.autoplay
        : DEFAULT_SETTINGS.autoplay,
  };
}

export async function getSettings() {
  const stored = await browser.storage.local.get(DEFAULT_SETTINGS);
  return normalizeSettings(stored);
}

export async function saveSettings(patch) {
  const current = await getSettings();
  const next = normalizeSettings({ ...current, ...patch });
  await browser.storage.local.set(next);
  return next;
}
