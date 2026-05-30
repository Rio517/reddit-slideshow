# Performance Review

Date: 2026-05-30

## Scope

Reviewed slideshow state, pagination, preloading, duplicate detection, media
rendering, timers, CSS effects, and memory behavior during long-running
sessions.

## Findings

### P2 — DuplicateTracker state is unbounded across long sessions

Reference: `lib/dedup.js:93`

ADR 0007 bounds retained slide history in `SlideshowController`, and
`SlideshowController.trim()` evicts old slides. However, `DuplicateTracker.keys`
keeps every media key seen during the session.

Why it matters: the extension is meant to auto-paginate through long feeds.
Thousands of slides are probably fine, but an extended lean-back session can
grow the set indefinitely even after slide objects are evicted.

Recommendation: bound duplicate keys with a FIFO window matching, or modestly
exceeding, the retained queue/back-history window. Preserve dedupe usefulness
for recent repeats without making memory growth session-unbounded.

### P3 — Image `drop-shadow()` may be expensive for large 4K media

Reference: `assets/overlay.css:94`

Video rendering avoids per-frame `drop-shadow()` by switching to `box-shadow`,
but all images still use:

```css
filter: drop-shadow(0 24px 60px rgba(0, 0, 0, 0.55));
```

Why it matters: a major use case is very high-resolution image viewing on a 4K
display. CSS filters can force extra rasterization work on large images.

Recommendation: prefer a cheap `box-shadow`, remove the image shadow, or make it
conditional after profiling in Firefox with large images.

### P3 — Preloading is bounded and simple, but cancellation is best-effort

Reference: `entrypoints/content.js:67`

The image preload window is intentionally small (`peekNext(2)`), and dropped
preloads have `img.src = ""`. This is good enough for v1.

Why it matters: browser cancellation is best-effort. Fast navigation across many
large images can still leave transient network/decoder work in flight.

Recommendation: no immediate change needed. If large-image sessions stutter,
consider delaying preloads while pagination is fetching, or preloading only one
image ahead when the current slide is very large.

## Positive Notes

- Queue memory is bounded by `DEFAULT_MAX_BACK_HISTORY` in
  `lib/slideshow.js:13`.
- Pagination is locked while a request is in flight by clearing `after` in
  `lib/slideshow.js:240`.
- Media timers start after `onMediaReady`, avoiding timer burn while media is
  still loading.
- Video has a safety timer so missing `ended` events cannot freeze the queue.
- Redgifs embeds use fixed dwell timers, avoiding impossible native `ended`
  coupling through the iframe.
