import { getSettings, saveSettings } from "@/lib/settings.js";

const timerSelect = document.querySelector("#imageTimerSeconds");
const mutedCheckbox = document.querySelector("#startMuted");
const autoplayCheckbox = document.querySelector("#autoplay");

async function load() {
  const settings = await getSettings();
  timerSelect.value = String(settings.imageTimerSeconds);
  mutedCheckbox.checked = settings.startMuted;
  autoplayCheckbox.checked = settings.autoplay;
}

async function persist() {
  await saveSettings({
    imageTimerSeconds: Number(timerSelect.value),
    startMuted: mutedCheckbox.checked,
    autoplay: autoplayCheckbox.checked,
  });
}

timerSelect.addEventListener("change", persist);
mutedCheckbox.addEventListener("change", persist);
autoplayCheckbox.addEventListener("change", persist);

load();
