import { renderSlide, mediaUrlIsSafe } from "./overlay-render.js";
import { createSettingsPanel } from "./overlay-settings.js";
import { createHelpPanel } from "./overlay-help.js";
import { panZoomAnimation } from "./pan-zoom.js";

/**
 * @typedef {import("./slides.js").Slide} Slide
 */

const SVG_NS = "http://www.w3.org/2000/svg";
// If media never signals load/error, advance anyway after this long (default;
// overridable per render via info.loadWaitMs).
const READY_FALLBACK_MS = 5000;

// Native video controls are revealed only while the pointer is active over the
// clip, then re-hidden this long after it stops/leaves (so they never linger at
// the start or end of playback).
const VIDEO_CONTROLS_IDLE_MS = 2000;

// Slide-change transitions. The incoming frame is held off-screen until its
// media is decoded (so a UHD image can't flash black mid-swap), then revealed
// with one of these while the outgoing frame animates out. Keep in sync with
// the rs-tx-* / rs-dir-* rules in assets/overlay.css.
const TRANSITIONS = ["none", "fade", "slide", "push", "zoom", "flip"];
const DEFAULT_TRANSITION = "fade";
// Matches the --rs-tx-dur in overlay.css; used to retire the outgoing frame if
// its animationend never fires (e.g. transition: none on the host).
const TRANSITION_MS = 450;

/** @param {unknown} name */
function normalizeTransition(name) {
  return typeof name === "string" && TRANSITIONS.includes(name)
    ? name
    : DEFAULT_TRANSITION;
}

// Cohesive media-player glyphs. `paths` are filled; `strokePaths` are stroked.
/** @type {Record<string, { paths?: string[], strokePaths?: string[] }>} */
const ICONS = {
  prev: { paths: ["M6 5.5h2.2v13H6z", "M18.5 6v12l-9.6-6z"] },
  next: { paths: ["M5.5 6v12l9.6-6z", "M15.8 5.5H18v13h-2.2z"] },
  play: { paths: ["M7.5 5.3v13.4L19 12z"] },
  pause: { paths: ["M7 5.5h3.2v13H7z", "M13.8 5.5H17v13h-3.2z"] },
  unmute: {
    paths: ["M11 5 6 9.5H4v5h2L11 19z"],
    strokePaths: ["M14.5 9.2a4 4 0 0 1 0 5.6", "M16.8 7a7 7 0 0 1 0 10"],
  },
  mute: {
    paths: ["M11 5 6 9.5H4v5h2L11 19z"],
    strokePaths: ["M15.5 9.5l5 5", "M20.5 9.5l-5 5"],
  },
  open: {
    paths: [
      "M13 4a1 1 0 0 0 0 2h2.59l-6.3 6.29a1 1 0 0 0 1.42 1.42L17 7.41V10a1 1 0 0 0 2 0V5a1 1 0 0 0-1-1z",
      "M6 7a1 1 0 0 1 1-1h3a1 1 0 0 1 0 2H8v8h8v-2a1 1 0 0 1 2 0v3a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1z",
    ],
  },
  prefs: {
    paths: [
      "M19.14 12.94c.04-.31.06-.62.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.61-.22l-2.39.96a7 7 0 0 0-1.62-.94l-.36-2.54a.5.5 0 0 0-.5-.42h-3.84a.5.5 0 0 0-.5.42l-.36 2.54a7 7 0 0 0-1.62.94l-2.39-.96a.5.5 0 0 0-.61.22L2.74 8.84a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.62-.06.94s.02.63.06.94l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32a.5.5 0 0 0 .61.22l2.39-.96c.5.38 1.05.7 1.62.94l.36 2.54a.5.5 0 0 0 .5.42h3.84a.5.5 0 0 0 .5-.42l.36-2.54a7 7 0 0 0 1.62-.94l2.39.96a.5.5 0 0 0 .61-.22l1.92-3.32a.5.5 0 0 0-.12-.64zM12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z",
    ],
  },
  help: {
    paths: [
      "M11 18h2v-2h-2v2zm1-16C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14c-2.21 0-4 1.79-4 4h2c0-1.1.9-2 2-2s2 .9 2 2c0 2-3 1.75-3 5h2c0-2.25 3-2.5 3-5 0-2.21-1.79-4-4-4z",
    ],
  },
  fullscreen: {
    strokePaths: [
      "M4 8.5V4h4.5",
      "M20 8.5V4h-4.5",
      "M4 15.5V20h4.5",
      "M20 15.5V20h-4.5",
    ],
  },
  popout: {
    strokePaths: [
      "M11 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-5",
      "M14 4h6v6",
      "M20 4l-8 8",
    ],
  },
  fullscreenExit: {
    strokePaths: [
      "M8.5 4v4.5H4",
      "M15.5 4v4.5H20",
      "M8.5 20v-4.5H4",
      "M15.5 20v-4.5H20",
    ],
  },
  close: {
    paths: [
      "M6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12 19 6.4 17.6 5 12 10.6z",
    ],
  },
};

/**
 * Build the slideshow overlay chrome. DOM-only; the caller wires controller
 * callbacks through `handlers`.
 *
 * @param {{
 *   onPrev: () => void,
 *   onNext: () => void,
 *   onTogglePlay: () => void,
 *   onClose: () => void,
 *   onOpenOriginal: (slide: Slide) => void,
 *   onMediaEnded: () => void,
 *   onMediaReady: () => void,
 *   onToggleMute: () => void,
 *   isMuted?: () => boolean,
 *   onAutoMuted?: () => void,
 *   onOpenPreferences: () => void,
 *   onChangeSetting?: (patch: Record<string, unknown>) => void,
 *   onMediaFailed?: (slide: Slide, reason: string) => void,
 *   onJumpTo?: (index: number) => void,
 *   onPopout?: () => void,
 *   resolveMedia?: (url: string) => Promise<string | null>,
 * }} handlers
 * @param {Document} [doc]
 * @param {string} [styleText] Overlay CSS injected into the shadow root. The
 *   caller (content script / screenshot harness) passes the bundled stylesheet
 *   so the overlay is styled in isolation; omitted in unit tests.
 */
export function createOverlay(handlers, doc = document, styleText) {
  const root = doc.createElement("div");
  root.id = "reddit-slideshow-root";
  root.hidden = true;
  // Modal dialog over the page; focus is moved in on show(), and the page is made
  // inert so focus is really trapped (see show()/hide()).
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-label", "Reddit slideshow");
  root.tabIndex = -1;

  // Mount the whole overlay inside a shadow root so host/RES page CSS can't reach
  // it (and our CSS can't leak out). `host` is what the caller attaches to the
  // page; `root` (and all the chrome below) lives in the shadow. Event listeners
  // stay on `root`, inside the shadow, so event.target isn't retargeted.
  const host = doc.createElement("div");
  host.id = "reddit-slideshow-host";
  const shadow = host.attachShadow({ mode: "open" });
  if (styleText) {
    const style = doc.createElement("style");
    style.textContent = styleText;
    shadow.append(style);
  }
  shadow.append(root);

  // Visually-hidden polite live region announcing the current slide and skips.
  const liveRegion = doc.createElement("div");
  liveRegion.className = "rs-live";
  liveRegion.setAttribute("aria-live", "polite");
  liveRegion.setAttribute("aria-atomic", "true");

  const timerBar = doc.createElement("div");
  timerBar.className = "rs-timer";
  const timerFill = doc.createElement("div");
  timerFill.className = "rs-timer__fill";
  timerBar.append(timerFill);

  const stage = doc.createElement("div");
  stage.className = "rs-stage";

  const meta = doc.createElement("div");
  meta.className = "rs-meta";
  // The position counter doubles as the jump-to-post toggle.
  const counter = doc.createElement("button");
  counter.type = "button";
  counter.className = "rs-meta__counter";
  counter.title = "Jump to a post";
  counter.setAttribute("aria-label", "Jump to a post");
  // Drop the pulse class when it finishes so a later manual nav can re-trigger it.
  counter.addEventListener("animationend", () =>
    counter.classList.remove("rs-meta__counter--pulse"),
  );
  const openMetaBtn = controlButton(doc, "open", "Open original", () => {
    if (current) handlers.onOpenOriginal(current);
  });
  openMetaBtn.classList.add("rs-meta__open");
  const title = doc.createElement("span");
  title.className = "rs-meta__title";
  // Persistent title children: truncated text, the author byline, and an inline
  // spinner shown while the next slide's media is still loading.
  const titleText = doc.createElement("span");
  titleText.className = "rs-meta__title-text";
  const author = doc.createElement("a");
  author.className = "rs-meta__author";
  author.target = "_blank";
  author.rel = "noopener noreferrer";
  author.hidden = true;
  const titleSpinner = doc.createElement("span");
  titleSpinner.className = "rs-meta__spinner";
  titleSpinner.setAttribute("aria-hidden", "true");
  title.append(titleText, author, titleSpinner);
  const nsfw = doc.createElement("span");
  nsfw.className = "rs-meta__nsfw";
  nsfw.textContent = "NSFW";
  nsfw.hidden = true;
  meta.append(counter, openMetaBtn, nsfw, title);

  // Jump-to-post list, toggled by clicking the counter.
  const jumpPanel = doc.createElement("div");
  jumpPanel.className = "rs-jump-panel";
  jumpPanel.hidden = true;

  const controls = doc.createElement("div");
  controls.className = "rs-controls";
  const prevBtn = controlButton(doc, "prev", "Previous (←)", handlers.onPrev);
  const playBtn = controlButton(
    doc,
    "pause",
    "Play/pause (Space)",
    handlers.onTogglePlay,
  );
  playBtn.classList.add("rs-btn--primary");
  const nextBtn = controlButton(doc, "next", "Next (→)", handlers.onNext);
  const muteBtn = controlButton(
    doc,
    "mute",
    "Mute/unmute (M)",
    handlers.onToggleMute,
  );
  const fullscreenBtn = controlButton(
    doc,
    "fullscreen",
    "Fullscreen (F)",
    toggleFullscreen,
  );
  const popoutBtn = controlButton(doc, "popout", "Open in a window", () =>
    handlers.onPopout?.(),
  );
  const helpBtn = controlButton(doc, "help", "Keyboard shortcuts (?)", () => {
    const show = helpPanel.root.hidden;
    helpPanel.root.hidden = !show;
    // Help and settings are both centered cards; opening one closes the other
    // so they can't stack on top of each other.
    if (show) settingsPanel.root.hidden = true;
  });
  const prefsBtn = controlButton(doc, "prefs", "Settings", () => {
    const show = settingsPanel.root.hidden;
    settingsPanel.root.hidden = !show;
    if (show) helpPanel.root.hidden = true;
  });
  const closeBtn = controlButton(doc, "close", "Close (Esc)", handlers.onClose);
  // The close button lives in the top-right corner, not the rail.
  closeBtn.classList.add("rs-close-top");
  controls.append(
    prevBtn,
    playBtn,
    nextBtn,
    muteBtn,
    fullscreenBtn,
    popoutBtn,
    helpBtn,
    prefsBtn,
  );

  function toggleFullscreen() {
    if (doc.fullscreenElement) doc.exitFullscreen?.();
    else root.requestFullscreen?.().catch(() => {});
  }
  // Keep the icon in sync whether fullscreen is toggled by the button, the F
  // key, or the browser's own Esc.
  doc.addEventListener("fullscreenchange", () => {
    setIcon(
      fullscreenBtn,
      doc.fullscreenElement ? "fullscreenExit" : "fullscreen",
      doc,
    );
    fullscreenBtn.title = doc.fullscreenElement
      ? "Exit fullscreen (F)"
      : "Fullscreen (F)";
  });

  const buffering = doc.createElement("div");
  buffering.className = "rs-buffering";
  buffering.hidden = true;
  const bufferingDot = doc.createElement("span");
  bufferingDot.className = "rs-buffering__dot";
  const bufferingLabel = doc.createElement("span");
  bufferingLabel.textContent = "Loading more";
  buffering.append(bufferingDot, bufferingLabel);

  const loading = doc.createElement("div");
  loading.className = "rs-loading";
  loading.hidden = true;
  loading.append(doc.createElement("span"));

  // Count of media that failed to load and was auto-skipped; click to list them.
  const skippedBtn = doc.createElement("button");
  skippedBtn.type = "button";
  skippedBtn.className = "rs-skipped";
  skippedBtn.hidden = true;
  const skippedPanel = doc.createElement("div");
  skippedPanel.className = "rs-skipped-panel";
  skippedPanel.hidden = true;

  // In-overlay settings, toggled by the gear control.
  const settingsPanel = createSettingsPanel(doc, {
    onChange: (patch) => handlers.onChangeSetting?.(patch),
    onOpenFullPreferences: () => handlers.onOpenPreferences(),
  });

  // In-overlay keyboard-shortcuts list, toggled by the (?) control.
  const helpPanel = createHelpPanel(doc);

  // Confirm popover guarding an accidental backdrop click. Esc and the X close
  // immediately; a backdrop click asks here first.
  const confirmClose = doc.createElement("div");
  confirmClose.className = "rs-confirm";
  confirmClose.hidden = true;
  confirmClose.setAttribute("role", "alertdialog");
  confirmClose.setAttribute("aria-modal", "true");
  confirmClose.setAttribute("aria-labelledby", "rs-confirm-text");
  const confirmText = doc.createElement("p");
  confirmText.className = "rs-confirm__text";
  confirmText.id = "rs-confirm-text";
  confirmText.textContent =
    "You are pretty far into this slideshow… are you sure you want to close?";
  const confirmActions = doc.createElement("div");
  confirmActions.className = "rs-confirm__actions";
  const confirmKeep = doc.createElement("button");
  confirmKeep.type = "button";
  confirmKeep.className = "rs-confirm__btn";
  confirmKeep.textContent = "Keep watching";
  const confirmDo = doc.createElement("button");
  confirmDo.type = "button";
  confirmDo.className = "rs-confirm__btn rs-confirm__btn--danger";
  confirmDo.textContent = "Close";
  confirmActions.append(confirmKeep, confirmDo);
  confirmClose.append(confirmText, confirmActions);
  const CONFIRM_SECONDS = 5;
  /** @type {ReturnType<typeof setInterval> | null} */
  let confirmTimer = null;
  function stopConfirmCountdown() {
    if (confirmTimer != null) {
      clearInterval(confirmTimer);
      confirmTimer = null;
    }
  }
  function hideConfirm() {
    confirmClose.hidden = true;
    stopConfirmCountdown();
    confirmKeep.textContent = "Keep watching";
  }
  // The popover self-dismisses (keeps watching) after a visible countdown shown
  // in the Keep-watching button, so an ignored prompt doesn't sit forever.
  function startConfirmCountdown() {
    stopConfirmCountdown();
    let remaining = CONFIRM_SECONDS;
    confirmKeep.textContent = `Keep watching (${remaining}s)`;
    confirmTimer = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        hideConfirm();
        return;
      }
      confirmKeep.textContent = `Keep watching (${remaining}s)`;
    }, 1000);
  }
  confirmKeep.addEventListener("click", hideConfirm);
  confirmDo.addEventListener("click", () => {
    hideConfirm();
    handlers.onClose();
  });

  root.append(
    timerBar,
    stage,
    meta,
    jumpPanel,
    controls,
    closeBtn,
    buffering,
    loading,
    skippedBtn,
    skippedPanel,
    settingsPanel.root,
    helpPanel.root,
    confirmClose,
    liveRegion,
  );

  /** @type {Slide | null} */
  let current = null;
  /** @type {Slide[]} */
  let skippedSlides = [];
  // True skip count; `skippedSlides` may hold only the most recent subset.
  let skippedTotal = 0;
  /** @type {{ slides: Slide[], currentIndex: number, baseNumber: number }} */
  let jumpData = { slides: [], currentIndex: 0, baseNumber: 1 };
  // The element focused before the overlay opened, restored on hide().
  /** @type {Element | null} */
  let lastFocused = null;
  // Top timer-bar visibility: "none" | "video" | "all".
  let timerBarMode = "video";
  /** @type {ReturnType<typeof setTimeout> | null} */
  let idleTimer = null;
  /** @type {ReturnType<typeof setTimeout> | null} */
  let readyFallback = null;
  /** @type {AbortController | null} */
  let mediaListeners = null;
  /** @type {Animation | null} */
  let panZoomAnim = null;
  // The frame holding the slide currently considered "live". A render layers the
  // next frame over it and only retires it once the new media is ready.
  /** @type {HTMLElement | null} */
  let shownFrame = null;
  // The last frame that actually committed (became visible). On a rapid 3rd
  // advance the pending (never-committed) frame must be retired, not held, so the
  // outgoing frame is always the visible one - keyed on commit, not shownFrame.
  /** @type {HTMLElement | null} */
  let committedFrame = null;
  // Absolute index of the last rendered slide, for transition direction.
  let lastIndex = -1;
  // Absolute index of the slide currently on screen, set synchronously on each
  // render (unlike lastIndex, which only moves once a frame commits). Drives the
  // "deep into the show" backdrop-close guard.
  let shownIndex = -1;
  // One-shot: the imminent render came from a manual Next/Prev (not the timer),
  // so it should give loading feedback over a still-held frame.
  let manualNavPending = false;
  // Bumped per renderCurrent so a stale retire-timeout from an earlier render
  // (or after hide()) no-ops instead of retiring the wrong/detached frame.
  let renderGen = 0;
  // Per-frame blob: URL (proxied video) to revoke when that frame is retired.
  /** @type {WeakMap<HTMLElement, string>} */
  const frameObjectUrls = new WeakMap();

  const TITLE_MAX = 50;
  /** @param {Slide} slide */
  function renderTitle(slide) {
    const full = slide.title ?? "";
    titleText.textContent =
      full.length > TITLE_MAX ? `${full.slice(0, TITLE_MAX).trimEnd()}…` : full;
    titleText.title = full; // hover shows the untruncated title
    if (slide.author) {
      author.hidden = false;
      author.textContent = `/u/${slide.author}`;
      author.href = `${profileOrigin(slide.permalink)}/user/${encodeURIComponent(slide.author)}`;
    } else {
      author.hidden = true;
      author.removeAttribute("href");
      author.textContent = "";
    }
  }
  /** @param {string | undefined} permalink */
  function profileOrigin(permalink) {
    try {
      return new URL(permalink ?? "").origin;
    } catch {
      return "https://www.reddit.com";
    }
  }
  function showTitleSpinner() {
    titleSpinner.classList.add("rs-meta__spinner--on");
  }
  function hideTitleSpinner() {
    titleSpinner.classList.remove("rs-meta__spinner--on");
  }

  function cancelPanZoom() {
    if (panZoomAnim) {
      panZoomAnim.cancel();
      panZoomAnim = null;
    }
  }

  // Stop a frame's <video> (so an unmuted clip can't keep playing), revoke its
  // blob, and detach it.
  /** @param {HTMLElement | null} frame */
  function retireFrame(frame) {
    if (!frame) return;
    const video = /** @type {HTMLVideoElement | null} */ (
      frame.querySelector("video")
    );
    if (video) {
      video.pause();
      video.removeAttribute("src");
      video.load();
    }
    const url = frameObjectUrls.get(frame);
    if (url) {
      URL.revokeObjectURL(url);
      frameObjectUrls.delete(frame);
    }
    frame.remove();
  }

  function retireAllFrames() {
    for (const frame of stage.querySelectorAll(".rs-slide")) {
      retireFrame(/** @type {HTMLElement} */ (frame));
    }
    shownFrame = null;
    committedFrame = null;
  }

  // Strip the transition classes a frame kept from when it entered, so a later
  // exit animation can't collide with the stale enter one.
  /** @param {HTMLElement} frame */
  function clearTxClasses(frame) {
    frame.classList.remove(
      "rs-slide--enter",
      "rs-slide--exit",
      "rs-dir-fwd",
      "rs-dir-back",
    );
    for (const cls of [...frame.classList]) {
      if (cls.startsWith("rs-tx-")) frame.classList.remove(cls);
    }
  }

  // Auto-hide chrome after a brief idle. Hovering the controls (or the open
  // settings panel) keeps them up; going idle also dismisses any open panel.
  let overChrome = false;
  function goIdle() {
    if (root.hidden) return; // don't mutate a closed overlay (mirrors wake())
    root.classList.add("rs-idle");
    settingsPanel.root.hidden = true;
    helpPanel.root.hidden = true;
    jumpPanel.hidden = true;
    skippedPanel.hidden = true;
  }
  // Selector for interactive chrome whose focus should keep the overlay awake.
  const CHROME_SELECTOR =
    ".rs-controls, .rs-close-top, .rs-meta, .rs-settings-panel, .rs-help-panel, .rs-jump-panel, .rs-skipped-panel, .rs-skipped, .rs-confirm";
  // True while focus rests on the chrome, so the idle timer can't fade controls
  // out from under a keyboard user (mirrors overChrome for the pointer). Reads
  // the shadow's activeElement: at the document level focus retargets to the host.
  function focusInChrome() {
    const active = shadow.activeElement;
    return Boolean(active && active.closest(CHROME_SELECTOR));
  }
  function wake() {
    if (root.hidden) return; // a queued mousemove must not reschedule after hide()
    // Only touch the DOM when actually idle - mousemove fires this constantly.
    if (root.classList.contains("rs-idle")) root.classList.remove("rs-idle");
    if (idleTimer != null) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      if (!overChrome && !focusInChrome()) goIdle();
    }, 2600);
  }
  root.addEventListener("mousemove", wake);
  root.addEventListener("mouseleave", goIdle);
  // Keyboard focus entering the overlay wakes it; the idle timer then defers to
  // focusInChrome() so it won't fade out while a control is focused.
  root.addEventListener("focusin", wake);
  // Keep the chrome up while the pointer rests on the controls or the open
  // settings panel, even when it isn't moving.
  for (const el of [controls, settingsPanel.root, helpPanel.root]) {
    el.addEventListener("mouseenter", () => {
      overChrome = true;
      if (idleTimer != null) clearTimeout(idleTimer);
      root.classList.remove("rs-idle");
    });
    el.addEventListener("mouseleave", () => {
      overChrome = false;
      wake();
    });
  }

  // Click the backdrop (the black area, or any chrome that isn't an icon) to
  // close - like a lightbox. Clicks on a control button or the media itself are
  // left to their own handlers.
  root.addEventListener("click", (event) => {
    const target = /** @type {Element | null} */ (event.target);
    if (!target) return;
    if (
      target.closest(".rs-btn") || // a control button (incl. the X)
      target.closest(".rs-slide") || // the media frame
      target.closest(".rs-placeholder") || // the failure card (has its own button)
      target.closest(".rs-skipped") || // the skipped badge
      target.closest(".rs-skipped-panel") || // the skipped list
      target.closest(".rs-settings-panel") || // the inline settings
      target.closest(".rs-help-panel") || // the shortcuts list
      target.closest(".rs-meta") || // the meta bar (counter / open / title)
      target.closest(".rs-jump-panel") || // the jump-to-post list
      target.closest(".rs-confirm") // the close-confirm popover
    ) {
      return;
    }
    // A backdrop click while the confirm is up dismisses it.
    if (!confirmClose.hidden) {
      hideConfirm();
      return;
    }
    // A backdrop click while a panel is open dismisses the panel, not the show.
    if (
      !settingsPanel.root.hidden ||
      !helpPanel.root.hidden ||
      !skippedPanel.hidden ||
      !jumpPanel.hidden
    ) {
      settingsPanel.root.hidden = true;
      helpPanel.root.hidden = true;
      skippedPanel.hidden = true;
      jumpPanel.hidden = true;
      return;
    }
    // Only guard an accidental backdrop click once the viewer is well into the
    // show (past 20 slides); earlier on, a misclick costs little, so close at once.
    if (shownIndex >= 20) {
      showConfirmAt(/** @type {MouseEvent} */ (event));
    } else {
      handlers.onClose();
    }
  });

  /** @param {MouseEvent} event */
  function showConfirmAt(event) {
    const view = doc.defaultView;
    const vw = view?.innerWidth ?? 0;
    const vh = view?.innerHeight ?? 0;
    // Place it under the click, clamped so it can't spill off the edges (half
    // the 300px width, plus headroom below for the taller card).
    const x = vw
      ? Math.min(Math.max(event.clientX || vw / 2, 160), vw - 160)
      : event.clientX;
    // Clamp the top too so the popover can't clip off the top or bottom edge.
    const y = vh
      ? Math.min(Math.max(event.clientY || vh / 2, 70), vh - 170)
      : Math.max(event.clientY, 70);
    confirmClose.style.left = `${x}px`;
    confirmClose.style.top = `${y}px`;
    confirmClose.hidden = false;
    startConfirmCountdown();
  }

  skippedBtn.addEventListener("click", () => {
    if (skippedPanel.hidden) renderSkippedPanel();
    skippedPanel.hidden = !skippedPanel.hidden;
  });

  counter.addEventListener("click", () => {
    const opening = jumpPanel.hidden;
    if (opening) renderJumpPanel();
    jumpPanel.hidden = !jumpPanel.hidden;
    // Scroll to the current post only once the panel is actually displayed -
    // scrollIntoView does nothing while the panel is still `display:none`.
    if (opening) scrollJumpToCurrent();
  });

  function scrollJumpToCurrent() {
    jumpPanel
      .querySelector(".rs-jump-panel__item--current")
      ?.scrollIntoView({ block: "nearest" });
  }

  function renderJumpPanel() {
    const { slides, currentIndex, baseNumber } = jumpData;
    const heading = doc.createElement("p");
    heading.className = "rs-jump-panel__title";
    heading.textContent = "Jump to a post";
    const items = slides.map((slide, i) => {
      const item = doc.createElement("button");
      item.type = "button";
      item.className = "rs-jump-panel__item";
      if (i === currentIndex)
        item.classList.add("rs-jump-panel__item--current");
      const num = doc.createElement("span");
      num.className = "rs-jump-panel__num";
      num.textContent = String(baseNumber + i);
      const text = doc.createElement("span");
      text.className = "rs-jump-panel__text";
      const label = slide.title || slide.sourceUrl || "Untitled";
      text.textContent =
        slide.galleryTotal && slide.galleryTotal > 1
          ? `${label} (${slide.galleryIndex}/${slide.galleryTotal})`
          : label;
      item.append(num, text);
      // Auto-skipped slides stay in the list but read as dimmed and tagged, so
      // the numbering still lines up with what played.
      if (slide.skipReason) {
        item.classList.add("rs-jump-panel__item--skipped");
        const tag = doc.createElement("span");
        tag.className = "rs-jump-panel__tag";
        tag.textContent = "(skipped)";
        item.append(tag);
      }
      item.addEventListener("click", () => {
        jumpPanel.hidden = true;
        handlers.onJumpTo?.(i);
      });
      return item;
    });
    jumpPanel.replaceChildren(heading, ...items);
  }

  /**
   * @param {Slide[]} slides Loaded slides (the retained window).
   * @param {number} currentIndex Index of the current slide within `slides`.
   * @param {number} baseNumber Absolute 1-based number of the first slide.
   */
  function setJumpList(slides, currentIndex, baseNumber) {
    jumpData = { slides, currentIndex, baseNumber };
    if (!jumpPanel.hidden) {
      renderJumpPanel();
      scrollJumpToCurrent();
    }
  }

  function renderSkippedPanel() {
    const heading = doc.createElement("p");
    heading.className = "rs-skipped-panel__title";
    heading.textContent = `Skipped (${skippedTotal})`;
    const items = skippedSlides.map((slide) => {
      const item = doc.createElement("button");
      item.type = "button";
      item.className = "rs-skipped-panel__item";
      const text = doc.createElement("span");
      text.className = "rs-skipped-panel__text";
      text.textContent = slide.title || slide.sourceUrl || "Untitled";
      item.append(text);
      if (slide.skipReason) {
        const reason = doc.createElement("span");
        reason.className = "rs-skipped-panel__reason";
        reason.textContent = slide.skipReason;
        item.append(reason);
      }
      item.addEventListener("click", () => handlers.onOpenOriginal(slide));
      return item;
    });
    const nodes = [heading, ...items];
    if (skippedTotal > skippedSlides.length) {
      const note = doc.createElement("p");
      note.className = "rs-skipped-panel__note";
      note.textContent = `Showing the most recent ${skippedSlides.length}.`;
      nodes.push(note);
    }
    skippedPanel.replaceChildren(...nodes);
  }

  /**
   * @param {Slide[]} slides Retained skipped slides (most recent).
   * @param {number} [total] True skip count (defaults to slides.length).
   */
  function setSkipped(slides, total = slides.length) {
    // Announce only when the count grew (a fresh auto-skip), not on the reset
    // each run does at start.
    if (total > skippedTotal) {
      const last = slides[slides.length - 1];
      announce(
        `Skipped unavailable media${last?.title ? `: ${last.title}` : ""}`,
      );
    }
    skippedSlides = slides;
    skippedTotal = total;
    skippedBtn.hidden = total === 0;
    skippedBtn.textContent = `${total} skipped`;
    skippedBtn.title = `${total} item${
      total === 1 ? "" : "s"
    } skipped - click to view`;
    if (!skippedPanel.hidden) renderSkippedPanel();
  }

  /**
   * @param {Slide} slide
   * @param {{ index: number, total: number, exhausted: boolean, effectiveSeconds?: number, loadWaitMs?: number, playing: boolean, transition?: string, panZoom?: import("./pan-zoom.js").PanZoomConfig | null }} info
   */
  function renderCurrent(slide, info) {
    current = slide;
    clearReadyFallback();
    renderGen += 1;
    const myGen = renderGen;
    // Drop the previous slide's media listeners so a detached video that fires
    // `ended` late cannot advance the queue.
    mediaListeners?.abort();
    mediaListeners = new AbortController();
    const { signal } = mediaListeners;
    cancelPanZoom();
    timerFill.style.animation = "none";
    timerBar.hidden = true;

    const transition = normalizeTransition(info.transition);
    const forward = info.index >= lastIndex;
    const dirClass = forward ? "rs-dir-fwd" : "rs-dir-back";

    // Flush every frame except the last committed (visible) one, which becomes
    // this render's outgoing frame. Keying on committedFrame (not shownFrame)
    // means a rapid 3rd advance retires the undecoded pending frame and holds the
    // visible one - no black gap.
    for (const f of stage.querySelectorAll(".rs-slide")) {
      if (f !== committedFrame) retireFrame(/** @type {HTMLElement} */ (f));
    }
    // Remove any loading splash / status card so it can't linger beneath the
    // slides - a render appends its frame rather than replacing the stage.
    for (const child of [...stage.children]) {
      if (!child.classList.contains("rs-slide")) child.remove();
    }
    const outgoing = committedFrame;
    // Pause the outgoing clip; its last frame stays visible under the incoming
    // one until the transition retires it.
    /** @type {HTMLVideoElement | null} */ (
      outgoing?.querySelector("video") ?? null
    )?.pause();

    const media = renderSlide(slide, doc);
    // The frame is "pending" (hidden) until its media is ready, so the entrance
    // animation never plays over an undecoded/blank image.
    const frame = doc.createElement("div");
    frame.className = "rs-slide rs-slide--pending";
    frame.append(media);
    stage.append(frame);
    shownFrame = frame;
    // Show before the media-load listeners run so the spinner is on during the
    // pending window even when an already-decoded image commits synchronously.
    showTitleSpinner();

    let readyFired = false;
    // Reveal the new frame and animate the old one out - once the media is
    // decoded/ready, so the swap is gap-free.
    const commit = () => {
      if (readyFired) return;
      readyFired = true;
      hideTitleSpinner();
      clearReadyFallback();
      loading.hidden = true;
      root.classList.remove("rs-nav-loading");
      // Record direction only once a frame goes live, so a failed/skipped render
      // can't advance it.
      lastIndex = info.index;
      committedFrame = frame;
      frame.classList.remove("rs-slide--pending");
      if (transition !== "none") {
        frame.classList.add("rs-slide--enter", `rs-tx-${transition}`, dirClass);
      }
      retireOutgoing(outgoing, transition, dirClass, myGen);
      if (shouldShowTimerBar(slide)) {
        startTimerBar(info.effectiveSeconds, info.playing);
      }
      // A pan-zoomed image advances when its animation finishes; everything
      // else advances on the controller's dwell timer (started by onMediaReady).
      const animating = startPanZoom(media, info, signal);
      if (!animating) handlers.onMediaReady();
    };
    /** @param {string} reason Specific cause, shown in the skipped list. */
    const fail = (reason) => {
      if (readyFired) return;
      readyFired = true;
      hideTitleSpinner();
      clearReadyFallback();
      loading.hidden = true;
      root.classList.remove("rs-nav-loading");
      // Skip broken media immediately (record it for the skipped list) rather
      // than dwelling on a placeholder. Falls back to the placeholder when no
      // skip handler is wired.
      if (handlers.onMediaFailed) {
        handlers.onMediaFailed(slide, reason);
      } else {
        retireAllFrames();
        showPlaceholder(slide);
      }
    };

    if (media.tagName === "VIDEO") {
      const video = /** @type {HTMLVideoElement} */ (media);
      // Mute state lives in the session (the owner); read it per render.
      video.muted = handlers.isMuted?.() ?? true;
      // Arm before any src so controls work the instant a proxied blob lands.
      armVideoControls(video, signal);
      media.addEventListener("ended", handlers.onMediaEnded, { signal });
      media.addEventListener("error", () => fail("Video didn't load"), {
        signal,
      });
      // Try to play; if unmuted autoplay is blocked, fall back to muted (and
      // sync the mute button) so the clip still plays.
      media.addEventListener(
        "loadeddata",
        () => {
          commit();
          const playback = video.play();
          if (playback) {
            playback.catch(() => {
              // Autoplay blocked unmuted: fall back to muted, and tell the
              // session (the mute owner) so later slides stay muted too.
              handlers.onAutoMuted?.();
              setMuted(true);
              video.play().catch(() => {});
            });
          }
        },
        { signal },
      );
      // Proxied (Redgifs) clips have no direct src - the background fetches the
      // bytes and we play them as a blob. The loader shows until it arrives.
      if (slide.proxied) {
        Promise.resolve(handlers.resolveMedia?.(slide.mediaUrl) ?? null)
          .then((objectUrl) => {
            if (signal.aborted) {
              if (objectUrl) URL.revokeObjectURL(objectUrl);
              return;
            }
            if (objectUrl) {
              frameObjectUrls.set(frame, objectUrl);
              video.src = objectUrl;
            } else {
              fail("Couldn't fetch video");
            }
          })
          .catch(() => {
            if (!signal.aborted) fail("Couldn't fetch video");
          });
      }
    } else if (media.tagName === "IFRAME") {
      media.addEventListener("load", commit, { signal });
      media.addEventListener("error", () => fail("Embed didn't load"), {
        signal,
      });
    } else {
      // Image: gate the swap on decode() so the bitmap is paintable before the
      // old frame leaves. This is what stops a UHD image from flashing black -
      // decode time scales with pixels and outlasts the `load` event.
      const img = /** @type {HTMLImageElement} */ (media);
      media.addEventListener("error", () => fail("Image didn't load"), {
        signal,
      });
      const revealWhenDecoded = () => {
        if (typeof img.decode === "function") {
          // Even if decode rejects after a successful load, show it anyway.
          img.decode().then(commit, commit);
        } else {
          commit();
        }
      };
      if (img.complete && img.naturalWidth > 0) {
        revealWhenDecoded();
      } else {
        media.addEventListener("load", revealWhenDecoded, { signal });
      }
    }

    // Reject a URL the sink won't load (non-HTTPS / off-host) like a broken
    // load - deferred so it can't re-enter renderCurrent synchronously.
    if (!mediaUrlIsSafe(slide)) {
      Promise.resolve().then(() => {
        if (!signal.aborted) fail("Unsupported link");
      });
    }

    shownIndex = info.index;
    counter.textContent = `${info.index + 1} / ${info.total}${info.exhausted ? "" : "+"}`;
    renderTitle(slide);
    nsfw.hidden = !slide.over18;
    setPlaying(info.playing);

    // Announce position + title (and NSFW) for screen readers.
    const where = `${info.index + 1} of ${info.total}`;
    const what = slide.title ? `, ${slide.title}` : "";
    announce(`${where}${what}${slide.over18 ? ", NSFW" : ""}`);

    if (!readyFired) {
      // Normally the held frame stays clean (no loader flicker on a fast auto-
      // advance). But a *manual* Next/Prev that's slow to load should say so -
      // dim the held image and show the spinner so it doesn't look frozen.
      const manual = manualNavPending;
      loading.hidden = Boolean(outgoing) && !manual;
      root.classList.toggle("rs-nav-loading", Boolean(outgoing) && manual);
      // Never let a stuck load freeze the slideshow.
      readyFallback = setTimeout(commit, info.loadWaitMs ?? READY_FALLBACK_MS);
    }
  }

  /**
   * Animate the outgoing frame out (matching the incoming transition) and retire
   * it when the animation ends, with a timeout fallback. The fallback is keyed to
   * the render that armed it (`gen`) so a stale timer firing after hide() or a
   * later render no-ops instead of retiring the wrong/detached frame.
   * @param {HTMLElement | null} outgoing
   * @param {string} transition
   * @param {string} dirClass
   * @param {number} gen
   */
  function retireOutgoing(outgoing, transition, dirClass, gen) {
    if (!outgoing) return;
    if (transition === "none") {
      retireFrame(outgoing);
      return;
    }
    clearTxClasses(outgoing);
    outgoing.classList.add("rs-slide--exit", `rs-tx-${transition}`, dirClass);
    let done = false;
    const finish = () => {
      if (done || gen !== renderGen) return;
      done = true;
      retireFrame(outgoing);
    };
    outgoing.addEventListener("animationend", finish, { once: true });
    setTimeout(finish, TRANSITION_MS + 80);
  }

  /** @param {Slide | null} slide */
  function shouldShowTimerBar(slide) {
    if (!slide || timerBarMode === "none") return false;
    if (timerBarMode === "video") return slide.durationMode === "media";
    return true;
  }

  /**
   * @param {number | undefined} seconds
   * @param {boolean} playing
   */
  function startTimerBar(seconds, playing) {
    timerFill.style.animation = "none";
    if (!seconds || seconds <= 0) {
      timerBar.hidden = true;
      return;
    }
    timerBar.hidden = false;
    // Force reflow so the animation restarts for the new slide.
    timerFill.getBoundingClientRect();
    timerFill.style.animation = `rs-sweep ${seconds}s linear forwards`;
    timerFill.style.animationPlayState = playing ? "running" : "paused";
  }

  /**
   * Run the Ken Burns pan & zoom on an image slide. Resolution-independent
   * (scale + transform-origin, clipped by the frame). The animation length is
   * the dwell, so its `finish` advances the slide. Returns true when it took
   * over advancing (so the caller skips the normal dwell timer).
   * @param {HTMLElement} media
   * @param {{ panZoom?: import("./pan-zoom.js").PanZoomConfig | null, playing: boolean }} info
   * @param {AbortSignal} signal
   * @returns {boolean}
   */
  function startPanZoom(media, info, signal) {
    if (!info.panZoom || media.tagName !== "IMG") return false;
    if (typeof media.animate !== "function") return false; // WAAPI unavailable
    // Honor reduced-motion: skip the Ken Burns move and fall back to the dwell
    // timer (the caller starts it when this returns false).
    if (
      doc.defaultView?.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
      return false;
    }
    const { keyframes, options } = panZoomAnimation(info.panZoom);
    panZoomAnim = media.animate(keyframes, options);
    panZoomAnim.addEventListener("finish", () => handlers.onMediaEnded(), {
      signal,
    });
    if (!info.playing) panZoomAnim.pause();
    return true;
  }

  function clearReadyFallback() {
    if (readyFallback != null) {
      clearTimeout(readyFallback);
      readyFallback = null;
    }
  }

  /** @param {string} text Polite screen-reader announcement. */
  function announce(text) {
    liveRegion.textContent = text;
  }

  /** @param {boolean} playing */
  function setPlaying(playing) {
    setIcon(playBtn, playing ? "pause" : "play", doc);
    playBtn.title = playing ? "Pause (Space)" : "Play (Space)";
    // Paused: the play button pulses turquoise so it's obvious the show is stopped.
    playBtn.classList.toggle("rs-btn--paused", !playing);
    if (
      timerFill.style.animationName &&
      timerFill.style.animationName !== "none"
    ) {
      timerFill.style.animationPlayState = playing ? "running" : "paused";
    }
    const media = shownFrame?.querySelector("video");
    if (media) {
      if (playing) media.play().catch(() => {});
      else media.pause();
    }
    if (panZoomAnim) {
      if (playing) panZoomAnim.play();
      else panZoomAnim.pause();
    }
  }

  /**
   * Failure card for media that should have rendered but did not.
   * @param {Slide} slide
   */
  function showPlaceholder(slide) {
    const card = doc.createElement("div");
    card.className = "rs-placeholder";

    const heading = doc.createElement("p");
    heading.className = "rs-placeholder__title";
    heading.textContent = slide.title || "Media unavailable";

    const note = doc.createElement("p");
    note.className = "rs-placeholder__note";
    note.textContent = "This media could not be loaded.";

    const open = doc.createElement("button");
    open.type = "button";
    open.className = "rs-placeholder__open";
    open.textContent = "Open original ↗";
    open.addEventListener("click", () => handlers.onOpenOriginal(slide));

    card.append(heading, note, open);
    stage.replaceChildren(card);
  }

  // A status/loading card can replace a live slide, so tear its media down first.
  function clearStageForStatus() {
    current = null;
    clearReadyFallback();
    mediaListeners?.abort();
    cancelPanZoom();
    retireAllFrames();
    setBuffering(false);
    timerBar.hidden = true;
    loading.hidden = true;
  }

  /** @param {string} text */
  function showStatus(text) {
    clearStageForStatus();
    const status = doc.createElement("p");
    status.className = "rs-status";
    status.textContent = text;
    stage.replaceChildren(status);
    wake();
  }

  // Branded splash shown while the first page loads.
  function showLoading() {
    clearStageForStatus();
    stage.replaceChildren(buildLogo(doc, "Loading…"));
    wake();
  }

  // Manual Next/Prev: pulse the counter so the press always registers visibly,
  // and arm the next render to show loading feedback even over a held frame.
  function notifyManualNav() {
    manualNavPending = true;
    // If the press doesn't actually move (clamped at an end), don't leave the
    // flag armed for a later auto-advance. renderCurrent runs synchronously
    // inside the same tick, so it still sees the flag before this clears it.
    Promise.resolve().then(() => {
      manualNavPending = false;
    });
    counter.classList.remove("rs-meta__counter--pulse");
    void counter.offsetWidth; // reflow so the animation restarts on rapid presses
    counter.classList.add("rs-meta__counter--pulse");
  }

  // End card once the queue is exhausted: the logo again, with a prompt to
  // replay from the top (the session wires the next/right press to a restart).
  function showEnd() {
    clearStageForStatus();
    stage.replaceChildren(
      buildLogo(doc, "That's everything - press → to start over"),
    );
    wake();
  }

  /** @param {boolean} active */
  function setBuffering(active) {
    buffering.hidden = !active;
  }

  /** @param {boolean} value */
  function setMuted(value) {
    setIcon(muteBtn, value ? "mute" : "unmute", doc);
    muteBtn.title = value ? "Unmute (M)" : "Mute (M)";
    const video = shownFrame?.querySelector("video");
    if (video) {
      video.muted = value;
      if (!value) video.play().catch(() => {});
    }
  }

  return {
    root,
    host,
    show() {
      // Remember where focus was so hide() can return it, then move focus into
      // the dialog for keyboard users.
      lastFocused = doc.activeElement;
      root.hidden = false;
      // Make the rest of the page inert: a real focus trap (Tab can't leave the
      // overlay) and it blocks pointer/AT access to the page behind the modal.
      // The overlay host is a sibling of <body>, so it stays interactive.
      if (doc.body) doc.body.inert = true;
      root.focus?.();
      wake();
    },
    hide() {
      root.hidden = true;
      if (doc.body) doc.body.inert = false;
      hideTitleSpinner(); // a stale spinner must not persist across opens
      loading.hidden = true;
      skippedPanel.hidden = true;
      settingsPanel.root.hidden = true;
      helpPanel.root.hidden = true;
      jumpPanel.hidden = true;
      hideConfirm(); // also stops the countdown interval and resets the button
      setBuffering(false);
      clearReadyFallback();
      // Move the render generation on so any armed retire-timeout no-ops.
      renderGen += 1;
      mediaListeners?.abort();
      cancelPanZoom();
      retireAllFrames();
      stage.replaceChildren();
      if (idleTimer != null) clearTimeout(idleTimer);
      // Return focus to whatever was focused before the overlay opened.
      if (lastFocused && lastFocused.isConnected) {
        /** @type {HTMLElement} */ (lastFocused).focus?.();
      }
      lastFocused = null;
    },
    isOpen() {
      return !root.hidden;
    },
    // Dismiss the topmost open layer (confirm popover, then a settings/jump/
    // skipped panel). Returns true when something was dismissed, so the caller
    // (Escape handling) can decide whether to close the whole show.
    dismissTopLayer() {
      if (!confirmClose.hidden) {
        hideConfirm();
        return true;
      }
      if (!settingsPanel.root.hidden) {
        settingsPanel.root.hidden = true;
        return true;
      }
      if (!helpPanel.root.hidden) {
        helpPanel.root.hidden = true;
        return true;
      }
      if (!jumpPanel.hidden) {
        jumpPanel.hidden = true;
        return true;
      }
      if (!skippedPanel.hidden) {
        skippedPanel.hidden = true;
        return true;
      }
      return false;
    },
    renderCurrent,
    // Tear down the current frames and show the broken-media card. Used when a
    // paused viewer's slide fails, so it holds on the card instead of advancing.
    /** @param {Slide} slide */
    showFailed(slide) {
      retireAllFrames();
      showPlaceholder(slide);
    },
    showStatus,
    showLoading,
    showEnd,
    notifyManualNav,
    setPlaying,
    setBuffering,
    setMuted,
    setSkipped,
    setJumpList,
    /** @param {import("./settings.js").Settings} s */
    setSettings(s) {
      settingsPanel.setValues(s);
      timerBarMode = s.timerBar;
      // Pin the counter + title so they survive the idle fade.
      root.classList.toggle("rs-pin-meta", s.alwaysShowMeta);
      // A live change that now hides the bar applies at once; turning it on
      // shows on the next slide.
      if (current && !shouldShowTimerBar(current)) {
        timerFill.style.animation = "none";
        timerBar.hidden = true;
      }
    },
    toggleFullscreen,
    // Restart the visual countdown for the current slide (e.g. the dwell changed
    // live in preferences). The dwell itself is restarted by the controller.
    restartTimer(
      /** @type {number} */ seconds,
      /** @type {boolean} */ playing,
    ) {
      if (!current) return;
      if (shouldShowTimerBar(current)) startTimerBar(seconds, playing);
      else {
        timerFill.style.animation = "none";
        timerBar.hidden = true;
      }
    },
  };
}

/**
 * Reveal a video's native controls only while the pointer is active over it,
 * re-hiding shortly after it stops moving or leaves. They start (and end)
 * hidden, so the control bar never pops in disruptively at the start or end of
 * a clip. Bound to the render's AbortSignal so the listeners and idle timer die
 * when the frame is retired.
 * @param {HTMLVideoElement} video
 * @param {AbortSignal} signal
 */
function armVideoControls(video, signal) {
  /** @type {ReturnType<typeof setTimeout> | null} */
  let idle = null;
  const hide = () => {
    if (idle != null) {
      clearTimeout(idle);
      idle = null;
    }
    video.controls = false;
  };
  const reveal = () => {
    if (!video.controls) video.controls = true;
    if (idle != null) clearTimeout(idle);
    idle = setTimeout(hide, VIDEO_CONTROLS_IDLE_MS);
  };
  video.addEventListener("pointerenter", reveal, { signal });
  video.addEventListener("pointermove", reveal, { signal });
  video.addEventListener("pointerleave", hide, { signal });
  // Stop the idle timer once the frame is retired so it can't fire afterwards.
  signal.addEventListener("abort", hide, { once: true });
}

/**
 * @param {Document} doc
 * @param {keyof typeof ICONS} name
 * @param {string} label
 * @param {() => void} onClick
 */
function controlButton(doc, name, label, onClick) {
  const button = doc.createElement("button");
  button.type = "button";
  button.className = "rs-btn";
  button.title = label;
  button.setAttribute("aria-label", label);
  button.append(buildIcon(doc, name));
  button.addEventListener("click", (event) => {
    // A handled control click must not reach the backdrop-close handler.
    event.stopPropagation();
    onClick();
  });
  return button;
}

/**
 * @param {HTMLButtonElement} button
 * @param {keyof typeof ICONS} name
 * @param {Document} doc
 */
function setIcon(button, name, doc) {
  button.replaceChildren(buildIcon(doc, name));
}

/**
 * @param {Document} doc
 * @param {keyof typeof ICONS} name
 */
function buildIcon(doc, name) {
  const def = ICONS[name];
  const svg = doc.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("class", "rs-icon");
  const addPath = (/** @type {string} */ d, /** @type {boolean} */ stroke) => {
    const path = doc.createElementNS(SVG_NS, "path");
    path.setAttribute("d", d);
    if (stroke) path.setAttribute("class", "rs-stroke");
    svg.append(path);
  };
  for (const d of def.paths ?? []) addPath(d, false);
  for (const d of def.strokePaths ?? []) addPath(d, true);
  return svg;
}

/**
 * @param {Document} doc
 * @param {string} tag
 * @param {Record<string, string | number>} attrs
 */
function svgEl(doc, tag, attrs) {
  const el = doc.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}

/**
 * The extension mark (mirrors public/icon.svg), built inline so the loading
 * splash needs no web-accessible image.
 * @param {Document} doc
 */
function buildLogoMark(doc) {
  const svg = svgEl(doc, "svg", {
    viewBox: "0 0 128 128",
    "aria-hidden": "true",
    class: "rs-logo__mark",
  });
  const defs = doc.createElementNS(SVG_NS, "defs");
  // Page-unique gradient ids so they can't collide with the host document.
  const bg = svgEl(doc, "linearGradient", {
    id: "rs-logo-bg",
    x1: 0,
    y1: 0,
    x2: 0,
    y2: 1,
  });
  bg.append(
    svgEl(doc, "stop", { offset: 0, "stop-color": "#1b2331" }),
    svgEl(doc, "stop", { offset: 1, "stop-color": "#0b0d12" }),
  );
  const card = svgEl(doc, "linearGradient", {
    id: "rs-logo-card",
    x1: 0,
    y1: 0,
    x2: 1,
    y2: 1,
  });
  card.append(
    svgEl(doc, "stop", { offset: 0, "stop-color": "#ffb066" }),
    svgEl(doc, "stop", { offset: 1, "stop-color": "#ff6a00" }),
  );
  defs.append(bg, card);
  svg.append(
    defs,
    svgEl(doc, "rect", {
      x: 4,
      y: 4,
      width: 120,
      height: 120,
      rx: 28,
      fill: "url(#rs-logo-bg)",
      stroke: "#2a3340",
      "stroke-width": 2,
    }),
    svgEl(doc, "rect", {
      x: 42,
      y: 30,
      width: 56,
      height: 62,
      rx: 9,
      fill: "#ffffff",
      opacity: 0.13,
      transform: "rotate(10 64 64)",
    }),
  );
  const front = svgEl(doc, "g", { transform: "rotate(-6 64 64)" });
  front.append(
    svgEl(doc, "rect", {
      x: 33,
      y: 34,
      width: 62,
      height: 60,
      rx: 11,
      fill: "url(#rs-logo-card)",
    }),
  );
  const perfs = svgEl(doc, "g", { fill: "#0b0d12", opacity: 0.5 });
  for (const y of [42, 60, 78]) {
    perfs.append(svgEl(doc, "rect", { x: 37, y, width: 6, height: 8, rx: 2 }));
  }
  front.append(
    perfs,
    svgEl(doc, "circle", {
      cx: 78,
      cy: 51,
      r: 8,
      fill: "#0b0d12",
      opacity: 0.82,
    }),
    svgEl(doc, "path", {
      d: "M52 87 L66 66 L75 77 L83 69 L93 87 Z",
      fill: "#0b0d12",
      opacity: 0.82,
    }),
  );
  svg.append(front);
  return svg;
}

/**
 * The mark plus the wordmark and a subtitle, for the loading splash.
 * @param {Document} doc
 * @param {string} subtitle
 */
function buildLogo(doc, subtitle) {
  const wrap = doc.createElement("div");
  wrap.className = "rs-logo";
  const name = doc.createElement("p");
  name.className = "rs-logo__name";
  name.textContent = "Reddit Slideshow Spectacular!";
  const sub = doc.createElement("p");
  sub.className = "rs-logo__sub";
  sub.textContent = subtitle;
  wrap.append(buildLogoMark(doc), name, sub);
  return wrap;
}
