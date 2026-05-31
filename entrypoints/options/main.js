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
const alwaysShowMeta = /** @type {HTMLInputElement} */ (
  document.querySelector("#alwaysShowMeta")
);
const maxLoadWait = /** @type {HTMLSelectElement} */ (
  document.querySelector("#maxLoadWaitSeconds")
);
const transition = /** @type {HTMLSelectElement} */ (
  document.querySelector("#transition")
);
const contentDedup = /** @type {HTMLInputElement} */ (
  document.querySelector("#contentDedup")
);
const panZoom = /** @type {HTMLInputElement} */ (
  document.querySelector("#panZoom")
);
const panZoomCard = /** @type {HTMLElement} */ (
  document.querySelector("#panZoomCard")
);

/** Pan-zoom range inputs paired with their <output> id. */
const PAN_ZOOM_RANGES = [
  ["panZoomMinOversize", "panZoomMinOversizeValue"],
  ["panZoomScale", "panZoomScaleValue"],
  ["panZoomShowSeconds", "panZoomShowValue"],
  ["panZoomZoomInSeconds", "panZoomZoomInValue"],
  ["panZoomPanSeconds", "panZoomPanValue"],
  ["panZoomZoomOutSeconds", "panZoomZoomOutValue"],
  ["panZoomShowEndSeconds", "panZoomShowEndValue"],
];

function syncPanZoomEnabled() {
  panZoomCard.dataset.off = String(!panZoom.checked);
}
const panZoomInputs = Object.fromEntries(
  PAN_ZOOM_RANGES.map(([id]) => [
    id,
    /** @type {HTMLInputElement} */ (document.querySelector(`#${id}`)),
  ]),
);

async function load() {
  const settings = await getSettings();
  timerSlider.value = String(settings.imageTimerSeconds);
  timerValue.textContent = String(settings.imageTimerSeconds);
  autoplay.checked = settings.autoplay;
  startMuted.checked = settings.startMuted;
  includeNsfw.checked = settings.includeNsfw;
  dedupe.checked = settings.dedupe;
  alwaysShowMeta.checked = settings.alwaysShowMeta;
  maxLoadWait.value = String(settings.maxLoadWaitSeconds);
  transition.value = settings.transition;
  contentDedup.checked = settings.contentDedup;
  panZoom.checked = settings.panZoom;
  for (const [id, outId] of PAN_ZOOM_RANGES) {
    const value = String(/** @type {any} */ (settings)[id]);
    panZoomInputs[id].value = value;
    const out = document.querySelector(`#${outId}`);
    if (out) out.textContent = value;
  }
  syncPanZoomEnabled();
}

async function persist() {
  try {
    await saveSettings({
      imageTimerSeconds: Number(timerSlider.value),
      autoplay: autoplay.checked,
      startMuted: startMuted.checked,
      includeNsfw: includeNsfw.checked,
      dedupe: dedupe.checked,
      alwaysShowMeta: alwaysShowMeta.checked,
      maxLoadWaitSeconds: Number(maxLoadWait.value),
      transition: transition.value,
      contentDedup: contentDedup.checked,
      panZoom: panZoom.checked,
      panZoomMinOversize: Number(panZoomInputs.panZoomMinOversize.value),
      panZoomScale: Number(panZoomInputs.panZoomScale.value),
      panZoomShowSeconds: Number(panZoomInputs.panZoomShowSeconds.value),
      panZoomZoomInSeconds: Number(panZoomInputs.panZoomZoomInSeconds.value),
      panZoomPanSeconds: Number(panZoomInputs.panZoomPanSeconds.value),
      panZoomZoomOutSeconds: Number(panZoomInputs.panZoomZoomOutSeconds.value),
      panZoomShowEndSeconds: Number(panZoomInputs.panZoomShowEndSeconds.value),
    });
  } catch {
    // Used as a change listener; a failed settings write isn't actionable here.
  }
}

timerSlider.addEventListener("input", () => {
  timerValue.textContent = timerSlider.value;
});
timerSlider.addEventListener("change", persist);
autoplay.addEventListener("change", persist);
startMuted.addEventListener("change", persist);
includeNsfw.addEventListener("change", persist);
dedupe.addEventListener("change", persist);
alwaysShowMeta.addEventListener("change", persist);
maxLoadWait.addEventListener("change", persist);
transition.addEventListener("change", persist);
panZoom.addEventListener("change", () => {
  syncPanZoomEnabled();
  persist();
});

for (const [id, outId] of PAN_ZOOM_RANGES) {
  const input = panZoomInputs[id];
  const out = document.querySelector(`#${outId}`);
  input.addEventListener("input", () => {
    if (out) out.textContent = input.value;
  });
  input.addEventListener("change", persist);
}

// Enabling content dedup requires an optional host permission (read pixels);
// disabling it drops that permission again.
contentDedup.addEventListener("change", async () => {
  if (contentDedup.checked) {
    const granted = await browser.permissions.request({
      origins: CONTENT_DEDUP_ORIGINS,
    });
    if (!granted) contentDedup.checked = false;
  } else {
    await browser.permissions
      .remove({ origins: CONTENT_DEDUP_ORIGINS })
      .catch(() => {});
  }
  await persist();
});

load();
