import { browser } from "wxt/browser";

/**
 * @typedef {object} Settings
 * @property {number} imageTimerSeconds
 * @property {boolean} startMuted
 * @property {boolean} autoplay
 * @property {boolean} includeNsfw
 * @property {boolean} dedupe
 * @property {boolean} contentDedup
 * @property {boolean} alwaysShowMeta Keep the position counter and title visible
 *   even when the controls auto-hide on idle.
 * @property {number} maxLoadWaitSeconds
 * @property {string} transition Slide-change animation: one of TRANSITIONS.
 * @property {string} timerBar Top timer-bar visibility: one of TIMER_BAR_MODES.
 * @property {boolean} panZoom Ken Burns pan & zoom on image slides.
 * @property {number} panZoomScale Zoom factor (> 1).
 * @property {number} panZoomShowSeconds Show the whole image.
 * @property {number} panZoomZoomInSeconds Zoom-in transition.
 * @property {number} panZoomPanSeconds Pan top → bottom.
 * @property {number} panZoomZoomOutSeconds Zoom-out transition.
 * @property {number} panZoomShowEndSeconds Show the whole image again.
 * @property {number} panZoomMinOversize Only pan & zoom when the image's longest
 *   side exceeds the display window's by at least this factor.
 */

export const TIMER_MIN_SECONDS = 1;
export const TIMER_MAX_SECONDS = 60;
export const LOAD_WAIT_CHOICES = [1, 3, 5, 10, 15, 20, 30];
// Slide-change transitions, in the order shown in the options page.
export const TRANSITIONS = ["none", "fade", "slide", "push", "zoom", "flip"];
// Top timer-bar visibility: never, video slides only, or every slide.
export const TIMER_BAR_MODES = ["none", "video", "all"];
export const PAN_ZOOM_PHASE_MAX_SECONDS = 30;
export const PAN_ZOOM_SCALE_MIN = 1.1;
export const PAN_ZOOM_SCALE_MAX = 5;
export const PAN_ZOOM_OVERSIZE_MIN = 1.25;
export const PAN_ZOOM_OVERSIZE_MAX = 3;

/** @type {Settings} */
export const DEFAULT_SETTINGS = Object.freeze({
  imageTimerSeconds: 5,
  startMuted: true,
  autoplay: true,
  // Follow Reddit: show over-18 content only insofar as the session exposes it.
  includeNsfw: true,
  // Skip media already shown this session (ADR 0006, identity-key layer).
  dedupe: true,
  // Perceptual-hash dedup of re-uploads (ADR 0006 Layer 2). Opt-in: needs an
  // optional host permission.
  contentDedup: false,
  // Keep the position counter and title pinned even after the controls fade.
  alwaysShowMeta: true,
  // How long to wait for slow media to load before moving on.
  maxLoadWaitSeconds: 5,
  // Animation when advancing between slides (the incoming frame is held until
  // its media decodes, so any choice is gap-free).
  transition: "fade",
  // Show the top countdown bar on video slides only by default.
  timerBar: "video",
  // Ken Burns pan & zoom on image slides (off by default). When on, the image
  // dwell becomes the sum of the phase durations below.
  panZoom: false,
  panZoomScale: 2,
  panZoomShowSeconds: 2,
  panZoomZoomInSeconds: 2,
  panZoomPanSeconds: 6,
  panZoomZoomOutSeconds: 2,
  panZoomShowEndSeconds: 2,
  // Only pan & zoom images whose longest side is at least this many times the
  // display window's longest side — i.e. genuinely too big for the view.
  panZoomMinOversize: 1.5,
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
 * @param {unknown} value
 * @returns {number}
 */
function normalizeLoadWait(value) {
  const seconds = Math.round(Number(value));
  return LOAD_WAIT_CHOICES.includes(seconds)
    ? seconds
    : DEFAULT_SETTINGS.maxLoadWaitSeconds;
}

/**
 * @param {unknown} value
 * @param {number} fallback
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clampNumber(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/**
 * @param {unknown} value
 * @param {boolean} fallback
 * @returns {boolean}
 */
function boolOr(value, fallback) {
  return typeof value === "boolean" ? value : fallback;
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
    dedupe:
      typeof input.dedupe === "boolean"
        ? input.dedupe
        : DEFAULT_SETTINGS.dedupe,
    contentDedup:
      typeof input.contentDedup === "boolean"
        ? input.contentDedup
        : DEFAULT_SETTINGS.contentDedup,
    alwaysShowMeta: boolOr(
      input.alwaysShowMeta,
      DEFAULT_SETTINGS.alwaysShowMeta,
    ),
    maxLoadWaitSeconds: normalizeLoadWait(input.maxLoadWaitSeconds),
    transition:
      typeof input.transition === "string" &&
      TRANSITIONS.includes(input.transition)
        ? input.transition
        : DEFAULT_SETTINGS.transition,
    timerBar:
      typeof input.timerBar === "string" &&
      TIMER_BAR_MODES.includes(input.timerBar)
        ? input.timerBar
        : DEFAULT_SETTINGS.timerBar,
    panZoom: boolOr(input.panZoom, DEFAULT_SETTINGS.panZoom),
    panZoomScale: clampNumber(
      input.panZoomScale,
      DEFAULT_SETTINGS.panZoomScale,
      PAN_ZOOM_SCALE_MIN,
      PAN_ZOOM_SCALE_MAX,
    ),
    panZoomShowSeconds: clampNumber(
      input.panZoomShowSeconds,
      DEFAULT_SETTINGS.panZoomShowSeconds,
      0,
      PAN_ZOOM_PHASE_MAX_SECONDS,
    ),
    panZoomZoomInSeconds: clampNumber(
      input.panZoomZoomInSeconds,
      DEFAULT_SETTINGS.panZoomZoomInSeconds,
      0,
      PAN_ZOOM_PHASE_MAX_SECONDS,
    ),
    panZoomPanSeconds: clampNumber(
      input.panZoomPanSeconds,
      DEFAULT_SETTINGS.panZoomPanSeconds,
      0,
      PAN_ZOOM_PHASE_MAX_SECONDS,
    ),
    panZoomZoomOutSeconds: clampNumber(
      input.panZoomZoomOutSeconds,
      DEFAULT_SETTINGS.panZoomZoomOutSeconds,
      0,
      PAN_ZOOM_PHASE_MAX_SECONDS,
    ),
    panZoomShowEndSeconds: clampNumber(
      input.panZoomShowEndSeconds,
      DEFAULT_SETTINGS.panZoomShowEndSeconds,
      0,
      PAN_ZOOM_PHASE_MAX_SECONDS,
    ),
    panZoomMinOversize: clampNumber(
      input.panZoomMinOversize,
      DEFAULT_SETTINGS.panZoomMinOversize,
      PAN_ZOOM_OVERSIZE_MIN,
      PAN_ZOOM_OVERSIZE_MAX,
    ),
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
