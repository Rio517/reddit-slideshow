import { TIMER_MIN_SECONDS, TIMER_MAX_SECONDS } from "./settings.js";

/**
 * The in-overlay settings panel: the most-used preferences, controllable
 * without leaving the slideshow. Each change emits a partial-settings patch;
 * the session persists it and applies it live. The full options page (for the
 * permission-gated content dedup) is one click away.
 *
 * @param {Document} doc
 * @param {{
 *   onChange: (patch: Record<string, unknown>) => void,
 *   onOpenFullPreferences: () => void,
 * }} handlers
 * @returns {{ root: HTMLElement, setValues: (s: import("./settings.js").Settings) => void }}
 */
export function createSettingsPanel(doc, handlers) {
  const root = doc.createElement("div");
  root.className = "rs-settings-panel";
  root.hidden = true;

  const header = doc.createElement("div");
  header.className = "rs-settings-panel__header";
  const heading = doc.createElement("p");
  heading.className = "rs-settings-panel__title";
  heading.textContent = "Settings";
  const closeBtn = doc.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "rs-settings-panel__close";
  closeBtn.setAttribute("aria-label", "Close settings");
  closeBtn.textContent = "×";
  closeBtn.addEventListener("click", () => {
    root.hidden = true;
  });
  header.append(heading, closeBtn);
  root.append(header);

  const timer = /** @type {HTMLInputElement} */ (doc.createElement("input"));
  timer.type = "range";
  timer.min = String(TIMER_MIN_SECONDS);
  timer.max = String(TIMER_MAX_SECONDS);
  timer.className = "rs-set__range";
  const timerOut = doc.createElement("output");
  timerOut.className = "rs-set__out";
  timer.addEventListener("input", () => {
    timerOut.textContent = `${timer.value}s`;
  });
  timer.addEventListener("change", () =>
    handlers.onChange({ imageTimerSeconds: Number(timer.value) }),
  );
  const timerWrap = doc.createElement("span");
  timerWrap.className = "rs-set__rangewrap";
  timerWrap.append(timer, timerOut);
  root.append(field(doc, "Seconds per image", timerWrap));

  const timerBar = radioGroup(
    doc,
    "rs-timerbar",
    [
      ["none", "None"],
      ["video", "Video"],
      ["all", "All"],
    ],
    (v) => handlers.onChange({ timerBar: v }),
  );
  root.append(field(doc, "Timer bar", timerBar.control));

  const autoplay = checkbox(doc, "Autoplay", (v) =>
    handlers.onChange({ autoplay: v }),
  );
  const startMuted = checkbox(doc, "Start muted", (v) =>
    handlers.onChange({ startMuted: v }),
  );
  const includeNsfw = checkbox(doc, "Include NSFW", (v) =>
    handlers.onChange({ includeNsfw: v }),
  );
  const dedupe = checkbox(doc, "Skip duplicates", (v) =>
    handlers.onChange({ dedupe: v }),
  );
  const panZoom = checkbox(doc, "Pan & zoom UHD images", (v) =>
    handlers.onChange({ panZoom: v }),
  );
  const alwaysShowMeta = checkbox(doc, "Always show count & title", (v) =>
    handlers.onChange({ alwaysShowMeta: v }),
  );
  root.append(
    autoplay.row,
    startMuted.row,
    includeNsfw.row,
    dedupe.row,
    panZoom.row,
    alwaysShowMeta.row,
  );

  const more = doc.createElement("button");
  more.type = "button";
  more.className = "rs-settings-panel__more";
  more.textContent = "Full preferences ↗";
  more.addEventListener("click", handlers.onOpenFullPreferences);
  root.append(more);

  /** @param {import("./settings.js").Settings} s */
  function setValues(s) {
    timer.value = String(s.imageTimerSeconds);
    timerOut.textContent = `${s.imageTimerSeconds}s`;
    timerBar.setValue(s.timerBar);
    autoplay.input.checked = s.autoplay;
    startMuted.input.checked = s.startMuted;
    includeNsfw.input.checked = s.includeNsfw;
    dedupe.input.checked = s.dedupe;
    panZoom.input.checked = s.panZoom;
    alwaysShowMeta.input.checked = s.alwaysShowMeta;
  }

  return { root, setValues };
}

/**
 * @param {Document} doc
 * @param {string} label
 * @param {HTMLElement} control
 */
function field(doc, label, control) {
  const row = doc.createElement("label");
  row.className = "rs-set__field";
  const span = doc.createElement("span");
  span.className = "rs-set__label";
  span.textContent = label;
  row.append(span, control);
  return row;
}

/**
 * A horizontal radio group emitting the selected value on change.
 * @param {Document} doc
 * @param {string} name
 * @param {Array<[string, string]>} options [value, label] pairs.
 * @param {(value: string) => void} onChange
 */
function radioGroup(doc, name, options, onChange) {
  const control = doc.createElement("div");
  control.className = "rs-set__radio";
  /** @type {HTMLInputElement[]} */
  const inputs = [];
  for (const [value, label] of options) {
    const wrap = doc.createElement("label");
    wrap.className = "rs-set__radio-opt";
    const input = /** @type {HTMLInputElement} */ (doc.createElement("input"));
    input.type = "radio";
    input.name = name;
    input.value = value;
    input.addEventListener("change", () => {
      if (input.checked) onChange(value);
    });
    const span = doc.createElement("span");
    span.textContent = label;
    wrap.append(input, span);
    control.append(wrap);
    inputs.push(input);
  }
  return {
    control,
    /** @param {string} value */
    setValue(value) {
      for (const input of inputs) input.checked = input.value === value;
    },
  };
}

/**
 * @param {Document} doc
 * @param {string} label
 * @param {(value: boolean) => void} onToggle
 */
function checkbox(doc, label, onToggle) {
  const row = doc.createElement("label");
  row.className = "rs-set__check";
  const input = /** @type {HTMLInputElement} */ (doc.createElement("input"));
  input.type = "checkbox";
  input.addEventListener("change", () => onToggle(input.checked));
  const span = doc.createElement("span");
  span.textContent = label;
  row.append(input, span);
  return { row, input };
}
