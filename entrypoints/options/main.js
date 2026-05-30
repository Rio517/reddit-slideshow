import { getSettings, saveSettings } from "@/lib/settings.js";

const timerSlider = /** @type {HTMLInputElement} */ (
  document.querySelector("#imageTimerSeconds")
);
const timerValue = /** @type {HTMLOutputElement} */ (
  document.querySelector("#timerValue")
);
const autoplay = /** @type {HTMLInputElement} */ (
  document.querySelector("#autoplay")
);
const startMuted = /** @type {HTMLInputElement} */ (
  document.querySelector("#startMuted")
);
const includeNsfw = /** @type {HTMLInputElement} */ (
  document.querySelector("#includeNsfw")
);
const dedupe = /** @type {HTMLInputElement} */ (
  document.querySelector("#dedupe")
);
const maxLoadWait = /** @type {HTMLSelectElement} */ (
  document.querySelector("#maxLoadWaitSeconds")
);

async function load() {
  const settings = await getSettings();
  timerSlider.value = String(settings.imageTimerSeconds);
  timerValue.textContent = String(settings.imageTimerSeconds);
  autoplay.checked = settings.autoplay;
  startMuted.checked = settings.startMuted;
  includeNsfw.checked = settings.includeNsfw;
  dedupe.checked = settings.dedupe;
  maxLoadWait.value = String(settings.maxLoadWaitSeconds);
}

async function persist() {
  await saveSettings({
    imageTimerSeconds: Number(timerSlider.value),
    autoplay: autoplay.checked,
    startMuted: startMuted.checked,
    includeNsfw: includeNsfw.checked,
    dedupe: dedupe.checked,
    maxLoadWaitSeconds: Number(maxLoadWait.value),
  });
}

timerSlider.addEventListener("input", () => {
  timerValue.textContent = timerSlider.value;
});
timerSlider.addEventListener("change", persist);
autoplay.addEventListener("change", persist);
startMuted.addEventListener("change", persist);
includeNsfw.addEventListener("change", persist);
dedupe.addEventListener("change", persist);
maxLoadWait.addEventListener("change", persist);

load();
