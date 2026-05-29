import { getSettings, saveSettings } from "@/lib/settings.js";

const timerSelect = /** @type {HTMLSelectElement} */ (
  document.querySelector("#imageTimerSeconds")
);
const mutedCheckbox = /** @type {HTMLInputElement} */ (
  document.querySelector("#startMuted")
);
const autoplayCheckbox = /** @type {HTMLInputElement} */ (
  document.querySelector("#autoplay")
);

async function load() {
  const settings = await getSettings();
  timerSelect.value = String(settings.imageTimerSeconds);
  mutedCheckbox.checked = settings.startMuted;
  autoplayCheckbox.checked = settings.autoplay;
}

async function persist() {
  const imageTimerSeconds = /** @type {3 | 5 | 10} */ (
    Number(timerSelect.value)
  );
  await saveSettings({
    imageTimerSeconds,
    startMuted: mutedCheckbox.checked,
    autoplay: autoplayCheckbox.checked,
  });
}

timerSelect.addEventListener("change", persist);
mutedCheckbox.addEventListener("change", persist);
autoplayCheckbox.addEventListener("change", persist);

load();
