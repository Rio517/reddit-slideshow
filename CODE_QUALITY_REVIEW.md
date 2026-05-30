# Code Quality Review

Date: 2026-05-30

## Scope

Reviewed module boundaries, tests, type/JSDoc quality, maintainability, and
correctness risks in the v1 code.

## Findings

### C2 — Content script is carrying too many responsibilities

Reference: `entrypoints/content.js:19`

The content script currently owns overlay creation, settings loading, scroll
locking, preloading, page requests, NSFW filtering, duplicate tracking,
controller wiring, keyboard capture, and lifecycle cleanup.

Why it matters: this file is the integration point most exposed to old Reddit
and RES behavior. As v2 adds downloads, zoom/pan, audio, and more providers,
this file will become harder to reason about and harder to test.

Recommendation: extract one or two small modules before the next feature push:

- `lib/preload.js` for bounded image preloading.
- `lib/slideshow-session.js` or similar for settings/filter/dedupe/controller
  orchestration.

Keep `entrypoints/content.js` focused on page integration and message/keyboard
binding.

### C3 — Reddit listing shapes are typed as `any`

References:

- `lib/slides.js:30`
- `lib/reddit-listing.js:36`
- `lib/queue.js:35`

The parser code relies on fixture-backed tests, but the core listing/post/media
objects are still mostly `any`.

Why it matters: this is acceptable for the first prototype, but provider
expansion will make field-shape regressions harder to catch at authoring time.
It also weakens editor support for subtle fields like `media_metadata`,
`gallery_data`, and `crosspost_parent_list`.

Recommendation: add small local typedefs for the subset of Reddit listing data
we consume. Avoid a giant Reddit API model; just type the fields this extension
reads.

### C3 — Hash-based duplicate helpers are implemented but not integrated

Reference: `lib/dedup.js:36`

The code includes dHash and Hamming distance helpers plus tests, but production
dedupe currently uses only identity keys via `filterNewByKey()`.

Why it matters: unused algorithmic helpers increase maintenance surface and may
confuse future reviewers into thinking perceptual dedupe is active.

Recommendation: either document this as deliberate dormant v2 work in
`lib/dedup.js`, or move hash helpers behind a separate future task until there
is an actual image-hash pipeline.

### C3 — Options page element casts have no runtime assertions

Reference: `entrypoints/options/main.js:3`

The options script casts queried elements to concrete element types. If the HTML
IDs drift, failures happen later as null/property errors.

Why it matters: low risk in a bundled extension, but it is easy to make this
more maintainable.

Recommendation: add a tiny `requiredElement(selector, type)` helper for clearer
failures and less repeated casting.

## Positive Notes

- Core slideshow behavior is DOM-free in `SlideshowController` and has broad
  unit coverage.
- Provider normalization is fixture-backed for images, galleries, Reddit video,
  Redgifs, and crossposts.
- Overlay rendering avoids unsafe HTML sinks and is tested separately from the
  controller.
- Settings normalization is centralized and tested.
- Recent commits show a healthy pattern: small, focused fixes for security and
  performance.
