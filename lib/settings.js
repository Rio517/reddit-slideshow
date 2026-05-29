import { browser } from "wxt/browser";

/**
 * @typedef {object} Settings
 * @property {3 | 5 | 10} imageTimerSeconds
 * @property {boolean} startMuted
 * @property {boolean} autoplay
 */

/** @type {Settings} */
export const DEFAULT_SETTINGS = Object.freeze({
  imageTimerSeconds: 5,
  startMuted: true,
  autoplay: true,
});

const SUPPORTED_TIMERS = new Set([3, 5, 10]);

/**
 * @param {Partial<Settings> | Record<string, unknown>} [input]
 * @returns {Settings}
 */
export function normalizeSettings(input = {}) {
  return {
    imageTimerSeconds: SUPPORTED_TIMERS.has(Number(input.imageTimerSeconds))
      ? /** @type {3 | 5 | 10} */ (input.imageTimerSeconds)
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

/**
 * @param {Partial<Settings>} patch
 * @returns {Promise<Settings>}
 */
export async function saveSettings(patch) {
  const current = await getSettings();
  const next = normalizeSettings({ ...current, ...patch });
  await browser.storage.local.set(next);
  return next;
}
