/**
 * Ken Burns pan & zoom for image slides.
 *
 * The sequence, per the configurable phase durations:
 *   1. show the whole image
 *   2. zoom in (anchored to the top)
 *   3. pan top → bottom (while zoomed)
 *   4. zoom out
 *   5. show the whole image again, then advance
 *
 * It's resolution-independent: we animate `transform: scale()` plus
 * `transform-origin` (top → bottom) and let the slide frame clip the overflow,
 * so no per-image pixel measuring is needed. The total duration equals the sum
 * of the phases, which is also the image's dwell, so the visual and the
 * auto-advance stay in lock-step.
 */

/**
 * @typedef {object} PanZoomConfig
 * @property {number} scale Zoom factor (> 1).
 * @property {number} showSeconds
 * @property {number} zoomInSeconds
 * @property {number} panSeconds
 * @property {number} zoomOutSeconds
 * @property {number} showEndSeconds
 */

/**
 * @param {PanZoomConfig} c
 * @returns {number} Total sequence length in seconds.
 */
export function panZoomTotalSeconds(c) {
  return (
    c.showSeconds +
    c.zoomInSeconds +
    c.panSeconds +
    c.zoomOutSeconds +
    c.showEndSeconds
  );
}

/**
 * Build Web Animations API keyframes + options for the sequence.
 *
 * @param {PanZoomConfig} c
 * @returns {{ keyframes: Keyframe[], options: KeyframeAnimationOptions }}
 */
export function panZoomAnimation(c) {
  const total = panZoomTotalSeconds(c);
  const at = (/** @type {number} */ seconds) =>
    total > 0 ? seconds / total : 0;
  const z = c.scale;

  const top = "50% 0%";
  const bottom = "50% 100%";
  const t1 = c.showSeconds;
  const t2 = t1 + c.zoomInSeconds;
  const t3 = t2 + c.panSeconds;
  const t4 = t3 + c.zoomOutSeconds;

  const keyframes = [
    { offset: 0, transform: "scale(1)", transformOrigin: top },
    { offset: at(t1), transform: "scale(1)", transformOrigin: top },
    { offset: at(t2), transform: `scale(${z})`, transformOrigin: top },
    { offset: at(t3), transform: `scale(${z})`, transformOrigin: bottom },
    { offset: at(t4), transform: "scale(1)", transformOrigin: bottom },
    { offset: 1, transform: "scale(1)", transformOrigin: bottom },
  ];

  return {
    keyframes,
    options: {
      duration: total * 1000,
      easing: "ease-in-out",
      fill: "both",
    },
  };
}

/**
 * Extract the pan-zoom config from settings.
 * @param {import("./settings.js").Settings} s
 * @returns {PanZoomConfig}
 */
export function panZoomConfig(s) {
  return {
    scale: s.panZoomScale,
    showSeconds: s.panZoomShowSeconds,
    zoomInSeconds: s.panZoomZoomInSeconds,
    panSeconds: s.panZoomPanSeconds,
    zoomOutSeconds: s.panZoomZoomOutSeconds,
    showEndSeconds: s.panZoomShowEndSeconds,
  };
}
