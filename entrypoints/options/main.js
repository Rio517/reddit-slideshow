import { browser } from "wxt/browser";
import { getSettings, saveSettings } from "@/lib/settings.js";

const CONTENT_DEDUP_ORIGINS = [
  "https://preview.redd.it/*",
  "https://external-preview.redd.it/*",
];

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
const contentDedup = /** @type {HTMLInputElement} */ (
  document.querySelector("#contentDedup")
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
  contentDedup.checked = settings.contentDedup;
}

async function persist() {
  await saveSettings({
    imageTimerSeconds: Number(timerSlider.value),
    autoplay: autoplay.checked,
    startMuted: startMuted.checked,
    includeNsfw: includeNsfw.checked,
    dedupe: dedupe.checked,
    maxLoadWaitSeconds: Number(maxLoadWait.value),
    contentDedup: contentDedup.checked,
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

// Enabling content dedup requires an optional host permission (read pixels).
contentDedup.addEventListener("change", async () => {
  if (contentDedup.checked) {
    const granted = await browser.permissions.request({
      origins: CONTENT_DEDUP_ORIGINS,
    });
    if (!granted) contentDedup.checked = false;
  }
  await persist();
});

load();
