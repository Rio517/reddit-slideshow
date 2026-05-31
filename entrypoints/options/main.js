import {
  getSettings,
  saveSettings,
  imageTimerStopIndex,
  imageTimerStopSeconds,
  formatImageTimer,
} from "@/lib/settings.js";
import { requiredElement } from "@/lib/dom.js";

const timerSlider = requiredElement("#imageTimerSeconds", HTMLInputElement);
const timerValue = requiredElement("#timerValue", HTMLOutputElement);
const autoplay = requiredElement("#autoplay", HTMLInputElement);
const startMuted = requiredElement("#startMuted", HTMLInputElement);
const includeNsfw = requiredElement("#includeNsfw", HTMLInputElement);
const dedupe = requiredElement("#dedupe", HTMLInputElement);
const alwaysShowMeta = requiredElement("#alwaysShowMeta", HTMLInputElement);
const maxLoadWait = requiredElement("#maxLoadWaitSeconds", HTMLInputElement);
const maxLoadWaitValue = requiredElement(
  "#maxLoadWaitValue",
  HTMLOutputElement,
);
const transition = requiredElement("#transition", HTMLSelectElement);
const timerBarRadios = /** @type {NodeListOf<HTMLInputElement>} */ (
  document.querySelectorAll('input[name="timerBar"]')
);
const timerBarValue = () =>
  [...timerBarRadios].find((r) => r.checked)?.value ?? "video";
const contentDedup = requiredElement("#contentDedup", HTMLInputElement);
const panZoom = requiredElement("#panZoom", HTMLInputElement);
const panZoomCard = requiredElement("#panZoomCard", HTMLElement);

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
    requiredElement(`#${id}`, HTMLInputElement),
  ]),
);

/**
 * Display text for a pan-zoom range value. Only the oversize threshold is
 * special: at its 1× minimum it reads "All images" - pan & zoom every image,
 * not just oversized ones. (The "×" lives in the output, not static markup.)
 * @param {string} id
 * @param {string} value
 */
function panZoomOutText(id, value) {
  if (id === "panZoomMinOversize") {
    return Number(value) <= 1 ? "All images" : `${value}×`;
  }
  return value;
}

async function load() {
  const settings = await getSettings();
  timerSlider.value = String(imageTimerStopIndex(settings.imageTimerSeconds));
  timerValue.textContent = formatImageTimer(settings.imageTimerSeconds);
  autoplay.checked = settings.autoplay;
  startMuted.checked = settings.startMuted;
  includeNsfw.checked = settings.includeNsfw;
  dedupe.checked = settings.dedupe;
  alwaysShowMeta.checked = settings.alwaysShowMeta;
  maxLoadWait.value = String(settings.maxLoadWaitSeconds);
  maxLoadWaitValue.textContent = String(settings.maxLoadWaitSeconds);
  transition.value = settings.transition;
  for (const radio of timerBarRadios) {
    radio.checked = radio.value === settings.timerBar;
  }
  contentDedup.checked = settings.contentDedup;
  panZoom.checked = settings.panZoom;
  for (const [id, outId] of PAN_ZOOM_RANGES) {
    const value = String(/** @type {any} */ (settings)[id]);
    panZoomInputs[id].value = value;
    const out = document.querySelector(`#${outId}`);
    if (out) out.textContent = panZoomOutText(id, value);
  }
  syncPanZoomEnabled();
}

async function persist() {
  try {
    await saveSettings({
      imageTimerSeconds: imageTimerStopSeconds(timerSlider.value),
      autoplay: autoplay.checked,
      startMuted: startMuted.checked,
      includeNsfw: includeNsfw.checked,
      dedupe: dedupe.checked,
      alwaysShowMeta: alwaysShowMeta.checked,
      maxLoadWaitSeconds: Number(maxLoadWait.value),
      transition: transition.value,
      timerBar: timerBarValue(),
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
  timerValue.textContent = formatImageTimer(
    imageTimerStopSeconds(timerSlider.value),
  );
});
timerSlider.addEventListener("change", persist);
autoplay.addEventListener("change", persist);
startMuted.addEventListener("change", persist);
includeNsfw.addEventListener("change", persist);
dedupe.addEventListener("change", persist);
alwaysShowMeta.addEventListener("change", persist);
maxLoadWait.addEventListener("input", () => {
  maxLoadWaitValue.textContent = maxLoadWait.value;
});
maxLoadWait.addEventListener("change", persist);
transition.addEventListener("change", persist);
for (const radio of timerBarRadios) radio.addEventListener("change", persist);
panZoom.addEventListener("change", () => {
  syncPanZoomEnabled();
  persist();
});

for (const [id, outId] of PAN_ZOOM_RANGES) {
  const input = panZoomInputs[id];
  const out = document.querySelector(`#${outId}`);
  input.addEventListener("input", () => {
    if (out) out.textContent = panZoomOutText(id, input.value);
  });
  input.addEventListener("change", persist);
}

contentDedup.addEventListener("change", persist);

load();
