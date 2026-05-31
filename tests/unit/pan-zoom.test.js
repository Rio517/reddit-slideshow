import { describe, expect, it } from "vitest";
import {
  panZoomTotalSeconds,
  panZoomAnimation,
  panZoomConfig,
} from "../../lib/pan-zoom.js";

const CFG = {
  scale: 2,
  showSeconds: 2,
  zoomInSeconds: 2,
  panSeconds: 6,
  zoomOutSeconds: 2,
  showEndSeconds: 2,
};

describe("panZoomTotalSeconds", () => {
  it("sums the five phases", () => {
    expect(panZoomTotalSeconds(CFG)).toBe(14);
  });
});

describe("panZoomAnimation", () => {
  it("builds keyframes at the phase boundaries", () => {
    const { keyframes, options } = panZoomAnimation(CFG);
    expect(options.duration).toBe(14000);
    expect(keyframes.map((k) => k.offset)).toEqual([
      0,
      2 / 14,
      4 / 14,
      10 / 14,
      12 / 14,
      1,
    ]);
    // Zoomed-in phases carry the scale factor...
    expect(keyframes[2].transform).toBe("scale(2)");
    expect(keyframes[3].transform).toBe("scale(2)");
    // ...and the pan moves the origin top -> bottom.
    expect(keyframes[2].transformOrigin).toBe("50% 0%");
    expect(keyframes[3].transformOrigin).toBe("50% 100%");
    // Begins and ends on the whole image.
    expect(keyframes[0].transform).toBe("scale(1)");
    expect(keyframes[5].transform).toBe("scale(1)");
  });

  it("guards against a zero total", () => {
    const { keyframes, options } = panZoomAnimation({
      scale: 2,
      showSeconds: 0,
      zoomInSeconds: 0,
      panSeconds: 0,
      zoomOutSeconds: 0,
      showEndSeconds: 0,
    });
    expect(options.duration).toBe(0);
    expect(keyframes.every((k) => Number.isFinite(k.offset))).toBe(true);
  });
});

describe("panZoomConfig", () => {
  it("extracts the config from settings", () => {
    const s = /** @type {any} */ ({
      panZoomScale: 3,
      panZoomShowSeconds: 1,
      panZoomZoomInSeconds: 2,
      panZoomPanSeconds: 3,
      panZoomZoomOutSeconds: 4,
      panZoomShowEndSeconds: 5,
    });
    expect(panZoomConfig(s)).toEqual({
      scale: 3,
      showSeconds: 1,
      zoomInSeconds: 2,
      panSeconds: 3,
      zoomOutSeconds: 4,
      showEndSeconds: 5,
    });
  });
});
