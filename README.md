# Reddit Slideshow

A Firefox-first WebExtension (Manifest V3) that turns the current Reddit
listing — on `old.reddit.com` or `www.reddit.com` — into a full-screen,
keyboard-driven media slideshow. It reuses your existing logged-in Reddit
session — no API keys — and resolves direct images, galleries, Reddit-hosted
video, Redgifs, and crossposts. Each frontend is self-contained (it fetches its
own listing JSON), so the new-Reddit path never depends on old Reddit.

## Features

- Launch a slideshow from any `old.reddit.com` or `www.reddit.com` listing
  (toolbar icon or **Alt+Shift+S**). On old Reddit it starts from the post
  nearest your scroll position; on new Reddit it starts from the top of the
  listing.
- Auto-advance with a configurable timer; videos advance when they finish.
- Automatic pagination — the queue keeps loading the next listing page.
- Per-kind rendering: `<img>` for images/galleries, muted-by-default `<video>`
  for `v.redd.it`, first-party `<iframe>` for Redgifs.
- A refined dark overlay: side-rail controls, a per-slide timer bar, a position
  counter, a loading spinner, and a graceful placeholder for media that fails.
- Settings: image timer, max load wait, autoplay, start-muted, Include-NSFW
  filter, and duplicate skipping.
- Skips duplicate media within a session (reposts, crossposts, repeated
  galleries).

## Install for development

This loads the extension into **your** Firefox, so it uses your real Reddit
session.

```sh
npm install
npm run build
```

Then in Firefox:

1. Open `about:debugging#/runtime/this-firefox`.
2. **Load Temporary Add-on…** and pick `.output/firefox-mv3/manifest.json`.
3. After code changes, re-run `npm run build` and hit **Reload** there.

## Use

- Open an `old.reddit.com` or `www.reddit.com` listing, then click the toolbar
  icon or press **Alt+Shift+S**.
- Keys: **←/→** previous/next, **Space** play/pause, **M** mute, **Esc** close.
- Settings live on the extension's options page (`about:addons` → Reddit
  Slideshow → Preferences).

## Commands

```sh
npm run dev          # WXT dev runner (fresh Firefox profile — not logged in)
npm run build        # Firefox MV3 build → .output/firefox-mv3/
npm run build:chrome # Chrome MV3 build → .output/chrome-mv3/
npm run zip          # packaged zip (Firefox / AMO)
npm run zip:chrome   # packaged zip (Chrome Web Store)
npm run icons        # regenerate PNG icons from public/icon.svg (Bash + librsvg/rsvg-convert; macOS/Linux)
npm test             # Vitest unit tests
npm run typecheck    # tsc --noEmit over JSDoc-typed JS
npm run lint         # ESLint (incl. unsafe-DOM checks)
npm run format       # Prettier check
npm run webext:lint  # Mozilla addons-linter on the built (Firefox) output
```

The same source builds both browsers; WXT emits a Chrome `service_worker`
background and a Firefox event page from one `defineBackground`.

The PNG icons in `public/icon/` are committed and are the source of truth for
the manifest (ADR 0009), so a normal build needs no extra tooling. `npm run
icons` only re-rasterizes them from `public/icon.svg` and requires Bash plus
librsvg (`rsvg-convert`), so it runs on macOS/Linux (or WSL), not bare Windows.

`npm run dev` launches a clean Firefox profile that is **not** logged into
Reddit, so prefer the temporary-add-on flow above for real testing.

## Project layout

```
entrypoints/      background, content script, options page (WXT entrypoints)
lib/              framework-free core: slides, queue, controller, overlay,
                  dedup, settings, session orchestration
assets/           overlay.css
public/           extension icon
tests/            Vitest unit/integration tests + offline fixtures
docs/             product spec, research, and ADRs
```

The core logic in `lib/` is DOM/extension-agnostic and unit-tested; the
`entrypoints/` are thin bindings to the browser.

## Docs

- Architecture decisions: `docs/adr/` (see `docs/README.md` for the index).
- Product spec and research: `docs/product/`, `docs/research/`.
- Current status and next steps: `NEXT_STEP.md`.

## Status

v1 is feature-complete and unit-tested. Distribution (AMO signing/listing) is not
done yet.
