# ADR 0010: Ken Burns pan & zoom for image slides

Date: 2026-05-31
Status: Accepted

## Context

Static images dwell for a fixed number of seconds and then cut to the next.
High-resolution images (the motivating case) have detail a full-frame static
view never reveals. A "Ken Burns" motion — show the whole image, zoom in, pan
top → bottom, zoom out, show the whole image again — surfaces that detail and
makes a lean-back slideshow feel less static. It must be opt-in (a checkbox) and
fully configurable (per-phase durations), and it must not desync from the
auto-advance.

Two implementation questions drove the decision:

1. **How to render the motion.** A pixel-accurate pan needs the image's rendered
   fit size and the container size to compute translate offsets per image and
   per viewport — measurement that varies with aspect ratio and resize.
2. **How to keep the advance in sync** with a multi-phase animation, given image
   slides have no `ended` event.

## Decision

Animate the image with `transform: scale()` plus `transform-origin` moving from
top (`50% 0%`) to bottom (`50% 100%`), and let the slide frame (`.rs-slide`,
`overflow: hidden`) clip the overflow. This is **resolution-independent**: no
per-image pixel measuring — the origin shift pans the visible window from top to
bottom at any aspect ratio. The keyframes are built in `lib/pan-zoom.js` and run
via the **Web Animations API** (`element.animate`), which takes fractional
`offset`s computed from the phase durations.

The five phases and their durations are settings
(`panZoomShowSeconds`, `panZoomZoomInSeconds`, `panZoomPanSeconds`,
`panZoomZoomOutSeconds`, `panZoomShowEndSeconds`), plus a `panZoomScale` zoom
factor. The whole feature is gated by `panZoom` (off by default).

**Advance stays in lock-step by construction:** when `panZoom` is on, an image
slide's dwell becomes the _sum_ of the phase durations (the session sets the
controller's per-image dwell to `panZoomTotalSeconds`). The animation's total
duration is that same sum, so the existing image-dwell timer advances exactly as
the animation finishes — no `ended` event, no second timer, no double-advance.
The visual countdown bar uses the same total.

When enabled it applies to **all** image slides (not only "UHD" ones): per-image
opt-in would mean mixed dwells in one queue, and small images still animate
acceptably. Videos and embeds are unaffected (they keep their own duration).

## Consequences

- No pixel math, no `ResizeObserver`; the effect is correct at any aspect ratio
  and survives viewport resize.
- The animation and the auto-advance share one source of truth (the phase
  durations), so they cannot drift apart.
- Requires the Web Animations API. It is universally available in current
  Firefox/Chrome (the only targets); the call is feature-guarded so a missing
  implementation degrades to a normal static image, and unit tests (happy-dom,
  no WAAPI) exercise the pure keyframe/timing logic rather than the animation.
- Pausing the slideshow pauses the animation; changing the toggle or durations
  mid-session applies to subsequently rendered images.
- The pan direction is fixed (top → bottom) and the zoom anchors to the top;
  these are deliberately not configurable yet to keep the settings surface small.

## Alternatives Considered

- **Pixel-measured translate (`scale` + `translateY(px)`):** the most precise
  framing, but needs the rendered fit size and container size per image and on
  resize. More code and failure modes for no visible benefit over the
  origin-shift approach. Rejected.
- **CSS `@keyframes` classes:** keyframe percentages depend on the per-render
  phase durations, so the rules would have to be generated dynamically into a
  `<style>` tag. WAAPI takes computed offsets directly and is cleaner. Rejected.
- **Advance on an animation `finish` event (like video `ended`):** workable, but
  then the controller's safety timer and the finish event both advance and must
  be de-raced. Setting the dwell equal to the animation total removes the second
  timer entirely. Rejected in favor of the single-source-of-truth dwell.
- **Per-image (UHD-only) application:** mixes dwell lengths within one queue and
  needs a resolution threshold. Deferred.
