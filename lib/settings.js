import { browser } from "wxt/browser";

/**
 * @typedef {object} Settings
 * @property {number} imageTimerSeconds
 * @property {boolean} startMuted
 * @property {boolean} autoplay
 * @property {boolean} includeNsfw
 */

export const TIMER_MIN_SECONDS = 1;
export const TIMER_MAX_SECONDS = 60;

/** @type {Settings} */
export const DEFAULT_SETTINGS = Object.freeze({
  imageTimerSeconds: 5,
  startMuted: true,
  autoplay: true,
  // Follow Reddit: show over-18 content only insofar as the session exposes it.
  includeNsfw: true,
});

/**
 * @param {unknown} value
 * @returns {number}
 */
function normalizeTimer(value) {
  const seconds = Math.round(Number(value));
  if (!Number.isFinite(seconds)) return DEFAULT_SETTINGS.imageTimerSeconds;
  return Math.min(TIMER_MAX_SECONDS, Math.max(TIMER_MIN_SECONDS, seconds));
}

/**
 * @param {Partial<Settings> | Record<string, unknown>} [input]
 * @returns {Settings}
 */
export function normalizeSettings(input = {}) {
  return {
    imageTimerSeconds: normalizeTimer(input.imageTimerSeconds),
    startMuted:
      typeof input.startMuted === "boolean"
        ? input.startMuted
        : DEFAULT_SETTINGS.startMuted,
    autoplay:
      typeof input.autoplay === "boolean"
        ? input.autoplay
        : DEFAULT_SETTINGS.autoplay,
    includeNsfw:
      typeof input.includeNsfw === "boolean"
        ? input.includeNsfw
        : DEFAULT_SETTINGS.includeNsfw,
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
