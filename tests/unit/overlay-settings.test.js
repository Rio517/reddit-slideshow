import { afterEach, describe, expect, it, vi } from "vitest";
import { createSettingsPanel } from "../../lib/overlay-settings.js";

afterEach(() => {
  document.body.innerHTML = "";
});

const SETTINGS = {
  imageTimerSeconds: 8,
  startMuted: false,
  autoplay: false,
  includeNsfw: false,
  dedupe: false,
  contentDedup: false,
  maxLoadWaitSeconds: 10,
};

function make() {
  const onChange = vi.fn();
  const onOpenFullPreferences = vi.fn();
  const panel = createSettingsPanel(document, {
    onChange,
    onOpenFullPreferences,
  });
  document.body.append(panel.root);
  return { panel, onChange, onOpenFullPreferences };
}

describe("createSettingsPanel", () => {
  it("populates controls from settings via setValues", () => {
    const { panel } = make();
    panel.setValues(/** @type {any} */ (SETTINGS));
    const range = /** @type {HTMLInputElement} */ (
      document.querySelector(".rs-set__range")
    );
    const select = /** @type {HTMLSelectElement} */ (
      document.querySelector(".rs-set__select")
    );
    const checks = /** @type {NodeListOf<HTMLInputElement>} */ (
      document.querySelectorAll(".rs-set__check input")
    );
    expect(range.value).toBe("8");
    expect(select.value).toBe("10");
    // autoplay, start-muted, NSFW, dedupe — all false here
    expect([...checks].map((c) => c.checked)).toEqual([
      false,
      false,
      false,
      false,
    ]);
  });

  it("emits a patch when the timer changes", () => {
    const { onChange } = make();
    const range = /** @type {HTMLInputElement} */ (
      document.querySelector(".rs-set__range")
    );
    range.value = "15";
    range.dispatchEvent(new Event("change", { bubbles: true }));
    expect(onChange).toHaveBeenCalledWith({ imageTimerSeconds: 15 });
  });

  it("emits a boolean patch when a checkbox toggles", () => {
    const { panel, onChange } = make();
    panel.setValues(/** @type {any} */ (SETTINGS));
    const autoplay = /** @type {HTMLInputElement} */ (
      document.querySelectorAll(".rs-set__check input")[0]
    );
    autoplay.checked = true;
    autoplay.dispatchEvent(new Event("change", { bubbles: true }));
    expect(onChange).toHaveBeenCalledWith({ autoplay: true });
  });

  it("opens the full preferences page", () => {
    const { onOpenFullPreferences } = make();
    /** @type {HTMLElement} */ (
      document.querySelector(".rs-settings-panel__more")
    ).click();
    expect(onOpenFullPreferences).toHaveBeenCalledTimes(1);
  });
});
