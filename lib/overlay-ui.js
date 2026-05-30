import { renderSlide } from "./overlay-render.js";

/**
 * @typedef {import("./slides.js").Slide} Slide
 */

const SVG_NS = "http://www.w3.org/2000/svg";
// If media never signals load/error, advance anyway after this long.
const READY_FALLBACK_MS = 15000;

const ICONS = {
  prev: { variant: "fill", paths: ["M14 6v12l-8-6z"] },
  next: { variant: "fill", paths: ["M10 6v12l8-6z"] },
  play: { variant: "fill", paths: ["M8 5v14l11-7z"] },
  pause: { variant: "fill", paths: ["M6 5h4v14H6z", "M14 5h4v14h-4z"] },
  open: {
    variant: "stroke",
    paths: [
      "M14 4h6v6",
      "M20 4l-9 9",
      "M19 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4",
    ],
  },
  close: { variant: "stroke", paths: ["M6 6l12 12", "M6 18L18 6"] },
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
  const nextBtn = controlButton(doc, "next", "Next (→)", handlers.onNext);
  const openBtn = controlButton(doc, "open", "Open original", () => {
    if (current) handlers.onOpenOriginal(current);
  });
  const closeBtn = controlButton(doc, "close", "Close (Esc)", handlers.onClose);
  controls.append(prevBtn, playBtn, nextBtn, openBtn, closeBtn);

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
  /** @type {ReturnType<typeof setTimeout> | null} */
  let idleTimer = null;
  /** @type {ReturnType<typeof setTimeout> | null} */
  let readyFallback = null;

  function wake() {
    root.classList.remove("rs-idle");
    if (idleTimer != null) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => root.classList.add("rs-idle"), 2600);
  }
  root.addEventListener("mousemove", wake);
  root.addEventListener("mouseleave", () => root.classList.add("rs-idle"));

  /**
   * @param {Slide} slide
   * @param {{ index: number, total: number, exhausted: boolean, effectiveSeconds?: number, playing: boolean }} info
   */
  function renderCurrent(slide, info) {
    current = slide;
    clearReadyFallback();
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
      media.addEventListener("ended", handlers.onMediaEnded);
      media.addEventListener("loadeddata", fireReady);
      media.addEventListener("error", fail);
    } else if (media.tagName === "IFRAME") {
      media.addEventListener("load", fireReady);
      media.addEventListener("error", fail);
    } else {
      media.addEventListener("load", fireReady);
      media.addEventListener("error", fail);
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
      readyFallback = setTimeout(fireReady, READY_FALLBACK_MS);
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
      if (idleTimer != null) clearTimeout(idleTimer);
    },
    isOpen() {
      return !root.hidden;
    },
    renderCurrent,
    showStatus,
    setPlaying,
    setBuffering,
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
  svg.setAttribute("class", `rs-icon rs-icon--${def.variant}`);
  for (const d of def.paths) {
    const path = doc.createElementNS(SVG_NS, "path");
    path.setAttribute("d", d);
    svg.append(path);
  }
  return svg;
}
