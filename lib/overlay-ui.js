import { renderSlide } from "./overlay-render.js";

/**
 * @typedef {import("./slides.js").Slide} Slide
 */

const SVG_NS = "http://www.w3.org/2000/svg";
// If media never signals load/error, advance anyway after this long (default;
// overridable per render via info.loadWaitMs).
const READY_FALLBACK_MS = 5000;

// Cohesive media-player glyphs. `paths` are filled; `strokePaths` are stroked.
/** @type {Record<string, { paths: string[], strokePaths?: string[] }>} */
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
 *   onOpenPreferences: () => void,
 * }} handlers
 * @param {Document} [doc]
 */
export function createOverlay(handlers, doc = document) {
  const root = doc.createElement("div");
  root.id = "reddit-slideshow-root";
  root.hidden = true;

  const timerBar = doc.createElement("div");
  timerBar.className = "rs-timer";
  const timerFill = doc.createElement("div");
  timerFill.className = "rs-timer__fill";
  timerBar.append(timerFill);

  const stage = doc.createElement("div");
  stage.className = "rs-stage";

  const meta = doc.createElement("div");
  meta.className = "rs-meta";
  const counter = doc.createElement("span");
  counter.className = "rs-meta__counter";
  const title = doc.createElement("span");
  title.className = "rs-meta__title";
  const nsfw = doc.createElement("span");
  nsfw.className = "rs-meta__nsfw";
  nsfw.textContent = "NSFW";
  nsfw.hidden = true;
  meta.append(counter, nsfw, title);

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
  const openBtn = controlButton(doc, "open", "Open original", () => {
    if (current) handlers.onOpenOriginal(current);
  });
  const prefsBtn = controlButton(
    doc,
    "prefs",
    "Preferences",
    handlers.onOpenPreferences,
  );
  const closeBtn = controlButton(doc, "close", "Close (Esc)", handlers.onClose);
  controls.append(
    prevBtn,
    playBtn,
    nextBtn,
    muteBtn,
    openBtn,
    prefsBtn,
    closeBtn,
  );

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

  root.append(timerBar, stage, meta, controls, buffering, loading);

  /** @type {Slide | null} */
  let current = null;
  let muted = true;
  /** @type {ReturnType<typeof setTimeout> | null} */
  let idleTimer = null;
  /** @type {ReturnType<typeof setTimeout> | null} */
  let readyFallback = null;
  /** @type {AbortController | null} */
  let mediaListeners = null;

  function wake() {
    root.classList.remove("rs-idle");
    if (idleTimer != null) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => root.classList.add("rs-idle"), 2600);
  }
  root.addEventListener("mousemove", wake);
  root.addEventListener("mouseleave", () => root.classList.add("rs-idle"));

  /**
   * @param {Slide} slide
   * @param {{ index: number, total: number, exhausted: boolean, effectiveSeconds?: number, loadWaitMs?: number, playing: boolean }} info
   */
  function renderCurrent(slide, info) {
    current = slide;
    clearReadyFallback();
    // Drop the previous slide's media listeners so a detached video that fires
    // `ended` late cannot advance the queue.
    mediaListeners?.abort();
    mediaListeners = new AbortController();
    const { signal } = mediaListeners;
    timerFill.style.animation = "none";
    timerBar.hidden = true;

    const media = renderSlide(slide, doc);
    let readyFired = false;
    // Begin the dwell (and the visual timer) only once the media is actually
    // ready, so the timer does not run while a large image is still loading.
    const fireReady = () => {
      if (readyFired) return;
      readyFired = true;
      clearReadyFallback();
      loading.hidden = true;
      startTimerBar(info.effectiveSeconds, info.playing);
      handlers.onMediaReady();
    };
    const fail = () => {
      showPlaceholder(slide);
      fireReady();
    };

    if (media.tagName === "VIDEO") {
      const video = /** @type {HTMLVideoElement} */ (media);
      video.muted = muted;
      media.addEventListener("ended", handlers.onMediaEnded, { signal });
      media.addEventListener("error", fail, { signal });
      // Try to play; if unmuted autoplay is blocked, fall back to muted (and
      // sync the mute button) so the clip still plays.
      media.addEventListener(
        "loadeddata",
        () => {
          fireReady();
          const playback = video.play();
          if (playback) {
            playback.catch(() => {
              setMuted(true);
              video.play().catch(() => {});
            });
          }
        },
        { signal },
      );
    } else if (media.tagName === "IFRAME") {
      media.addEventListener("load", fireReady, { signal });
      media.addEventListener("error", fail, { signal });
    } else {
      media.addEventListener("load", fireReady, { signal });
      media.addEventListener("error", fail, { signal });
    }

    const frame = doc.createElement("div");
    frame.className = "rs-slide";
    frame.append(media);
    stage.replaceChildren(frame);

    counter.textContent = `${info.index + 1} / ${info.total}${info.exhausted ? "" : "+"}`;
    title.textContent = slide.title ?? "";
    nsfw.hidden = !slide.over18;
    setPlaying(info.playing);

    // Already-cached image: ready immediately, no loader flash.
    const img = /** @type {HTMLImageElement} */ (media);
    if (media.tagName === "IMG" && img.complete && img.naturalWidth > 0) {
      fireReady();
    }
    if (!readyFired) {
      loading.hidden = false;
      // Never let a stuck load freeze the slideshow.
      readyFallback = setTimeout(
        fireReady,
        info.loadWaitMs ?? READY_FALLBACK_MS,
      );
    }
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

  function clearReadyFallback() {
    if (readyFallback != null) {
      clearTimeout(readyFallback);
      readyFallback = null;
    }
  }

  /** @param {boolean} playing */
  function setPlaying(playing) {
    setIcon(playBtn, playing ? "pause" : "play", doc);
    playBtn.title = playing ? "Pause (Space)" : "Play (Space)";
    if (
      timerFill.style.animationName &&
      timerFill.style.animationName !== "none"
    ) {
      timerFill.style.animationPlayState = playing ? "running" : "paused";
    }
    const media = stage.querySelector("video");
    if (media) {
      if (playing) media.play().catch(() => {});
      else media.pause();
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

  /** @param {string} text */
  function showStatus(text) {
    current = null;
    clearReadyFallback();
    timerBar.hidden = true;
    loading.hidden = true;
    const status = doc.createElement("p");
    status.className = "rs-status";
    status.textContent = text;
    stage.replaceChildren(status);
    wake();
  }

  /** @param {boolean} active */
  function setBuffering(active) {
    buffering.hidden = !active;
  }

  /** @param {boolean} value */
  function setMuted(value) {
    muted = value;
    setIcon(muteBtn, value ? "mute" : "unmute", doc);
    muteBtn.title = value ? "Unmute (M)" : "Mute (M)";
    const video = stage.querySelector("video");
    if (video) {
      video.muted = value;
      if (!value) video.play().catch(() => {});
    }
  }

  return {
    root,
    show() {
      root.hidden = false;
      wake();
    },
    hide() {
      root.hidden = true;
      loading.hidden = true;
      clearReadyFallback();
      mediaListeners?.abort();
      if (idleTimer != null) clearTimeout(idleTimer);
    },
    isOpen() {
      return !root.hidden;
    },
    renderCurrent,
    showStatus,
    setPlaying,
    setBuffering,
    setMuted,
  };
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
  button.addEventListener("click", onClick);
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
  for (const d of def.paths ?? []) {
    const path = doc.createElementNS(SVG_NS, "path");
    path.setAttribute("d", d);
    svg.append(path);
  }
  for (const d of def.strokePaths ?? []) {
    const path = doc.createElementNS(SVG_NS, "path");
    path.setAttribute("d", d);
    path.setAttribute("class", "rs-stroke");
    svg.append(path);
  }
  return svg;
}
