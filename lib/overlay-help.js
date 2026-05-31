/**
 * In-overlay keyboard-shortcuts help panel: a static list of every shortcut the
 * slideshow handles, so users can discover them without leaving the show.
 * Toggled by the (?) control in overlay-ui.js; mirrors the settings panel
 * (centered card, header + close button), so the same idle/dismiss/backdrop
 * plumbing applies.
 *
 * @param {Document} doc
 * @returns {{ root: HTMLElement }}
 */
export function createHelpPanel(doc) {
  const root = doc.createElement("div");
  root.className = "rs-help-panel";
  root.hidden = true;
  root.setAttribute("role", "region");
  root.setAttribute("aria-label", "Keyboard shortcuts");

  const header = doc.createElement("div");
  header.className = "rs-help-panel__header";
  const heading = doc.createElement("p");
  heading.className = "rs-help-panel__title";
  heading.textContent = "Keyboard shortcuts";
  const closeBtn = doc.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "rs-help-panel__close";
  closeBtn.setAttribute("aria-label", "Close keyboard shortcuts");
  closeBtn.textContent = "×";
  closeBtn.addEventListener("click", () => {
    root.hidden = true;
  });
  header.append(heading, closeBtn);

  const list = doc.createElement("div");
  list.className = "rs-help-panel__list";
  for (const { chords, desc } of SHORTCUTS) {
    list.append(shortcutRow(doc, chords, desc));
  }

  root.append(header, list);
  return { root };
}

// Every shortcut the slideshow handles. `chords` is a list of alternatives;
// each alternative is a chord of one or more keys (rendered joined with +).
// Keep in sync with the keydown handler in session.js and the manifest launch
// command in wxt.config.ts.
/** @type {Array<{ chords: string[][], desc: string }>} */
const SHORTCUTS = [
  { chords: [["Alt", "Shift", "S"]], desc: "Launch the slideshow" },
  { chords: [["←"], ["→"]], desc: "Previous / next slide" },
  { chords: [["Page Up"], ["Page Down"]], desc: "Jump back / ahead 10" },
  { chords: [["Space"]], desc: "Play / pause" },
  { chords: [["M"]], desc: "Mute / unmute" },
  { chords: [["F"]], desc: "Fullscreen" },
  { chords: [["Esc"]], desc: "Close, or dismiss an open panel" },
];

/**
 * @param {Document} doc
 * @param {string[][]} chords Alternatives; each is a chord of keys.
 * @param {string} desc
 */
function shortcutRow(doc, chords, desc) {
  const row = doc.createElement("div");
  row.className = "rs-help-panel__row";

  const keys = doc.createElement("span");
  keys.className = "rs-help-panel__keys";
  chords.forEach((chord, ci) => {
    if (ci > 0) keys.append(sep(doc, "/"));
    chord.forEach((k, ki) => {
      if (ki > 0) keys.append(sep(doc, "+"));
      const kbd = doc.createElement("kbd");
      kbd.className = "rs-help-panel__key";
      kbd.textContent = k;
      keys.append(kbd);
    });
  });

  const description = doc.createElement("span");
  description.className = "rs-help-panel__desc";
  description.textContent = desc;

  row.append(keys, description);
  return row;
}

/**
 * @param {Document} doc
 * @param {string} text
 */
function sep(doc, text) {
  const span = doc.createElement("span");
  span.className = "rs-help-panel__sep";
  span.setAttribute("aria-hidden", "true");
  span.textContent = text;
  return span;
}
