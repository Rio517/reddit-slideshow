# ADR 0009: Build for Chrome (cross-browser via WXT)

Date: 2026-05-30
Status: Accepted

## Context

v1 shipped Firefox-MV3 only. The core is already browser-agnostic — it uses
`browser.*` through WXT, a fetch-based background, and no Firefox-only runtime
APIs — and both old and new Reddit work in Chrome. WXT builds multiple browsers
from one source. Research: `docs/research/chrome-support.md`.

The only real divergences are manifest-level (background type, icon format, a
Firefox-only settings block), which WXT can express per browser.

## Decision

1. **Maintain a Chrome MV3 target from the same source** (`wxt build -b chrome`),
   alongside the Firefox build. WXT emits a `service_worker` background for Chrome
   and a non-persistent event page for Firefox from one `defineBackground`.
2. **Ship PNG icons.** Chrome rejects SVG manifest icons, so the manifest
   references rasterized PNGs (16/32/48/96/128) generated from `public/icon.svg`
   via `rsvg-convert` (`npm run icons`). The committed PNGs are used by both
   browsers.
3. **Make the manifest browser-conditional.** Emit
   `browser_specific_settings.gecko` (id + `data_collection_permissions`) only
   when `browser === "firefox"`, so Chrome's manifest has no unrecognized key.
4. **Keep the background-routed Layer 2 image fetch** (it works on both; Chrome's
   content scripts could fetch cross-origin directly, but routing through the
   background keeps one code path).
5. **Distribute via the Chrome Web Store** (`npm run zip:chrome`) in addition to
   AMO.

## Consequences

- Two build targets and two store listings to maintain, from one codebase.
- The icon source of truth is `public/icon.svg`; PNGs are regenerated with
  `npm run icons` and committed (deterministic, no build-time rasterizer
  dependency).
- WXT handles the per-browser `background` shape, so the background code is
  unchanged.
- `web-ext lint` covers the Firefox output only (it is a Mozilla tool); the
  Chrome build is validated by inspecting its generated manifest and a real-Chrome
  smoke test (loaded unpacked via Playwright). Verified: the extension loads, the
  MV3 service worker registers, the content script injects on Reddit, the overlay
  (`#reddit-slideshow-root`) renders, and the SW's `credentials: "include"`
  listing fetch attaches the user's Reddit cookies. A full media-render pass needs
  a logged-in session — Reddit `403`s anonymous `.json` from a fresh automated
  profile — so that last step is a manual check.

## Alternatives Considered

- **Firefox-only:** simplest, but Chrome is the larger audience and the
  cross-browser cost here is low. Rejected.
- **A separate Chrome codebase:** unnecessary — WXT gives one source, two
  outputs. Rejected.
- **SVG icons only:** incompatible with Chrome. Rejected.
- **Generate icons at build time** (e.g. a WXT auto-icons module): committed PNGs
  are simpler and deterministic. Deferred.

## Follow-Up

- Confirm a logged-in media-render pass in real Chrome (load unpacked, log into
  Reddit, run the slideshow on old + www) — the one smoke-test step that needs a
  human session.
- Create the Chrome Web Store listing.
