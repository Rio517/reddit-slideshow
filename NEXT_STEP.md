# NEXT_STEP — Reddit Slideshow

**Doc updated:** 2026-05-29 · **Branch:** `main` · **Status:** end-to-end slideshow is built (fetch → queue → overlay with navigation, timer, pagination, resilience); a real-Firefox validation pass is next.

> **Hard rule:** work directly on `main`. Do not create branches or worktrees unless the user explicitly asks. See `AGENTS.md`.

This project is a Firefox-first WebExtension for turning the current `old.reddit.com` feed into a media slideshow. The full v1 path is implemented and unit-tested: session-cookie `.json` access (validated against live Reddit), media resolvers (images, galleries, Reddit video, Redgifs, crossposts — run against ~400 real posts), a headless slideshow controller (navigation, timer auto-advance, pagination, a safety timer), and a designed overlay (per-kind rendering, control bar, position counter, per-slide timer sweep, failure placeholder, preload, buffering hint). old.reddit.com sets no CSP, so injected cross-origin media loads directly. What remains is verification in a real Firefox profile and settings polish.

---

## 0. Current Source Of Truth

Read these before coding:

- Product spec: `docs/product/reddit-slideshow-product-spec.md`
- Development practices: `docs/research/extension-development-best-practices.md`
- WXT/MV3 ADR: `docs/adr/0005-manifest-v3-event-page-and-wxt-build.md`
- Foundation plan: `docs/superpowers/plans/2026-05-29-foundation-wxt-mv3.md`
- Agent workflow: `AGENTS.md`

Key decisions already made:

- Build a standalone Firefox-first WebExtension.
- Use WXT + MV3 event page.
- Keep v1 old-Reddit-only: `old.reddit.com`.
- Use offline fixtures for unit tests instead of live Reddit.
- Resolve Reddit images, galleries, videos, Redgifs, and crossposts via the provider dispatch in `lib/slides.js`.
- Treat Redgifs iframe playback as a validation spike. Reddit session-cookie `.json` access is validated; the toolbar-triggered extension diagnostic still needs UI validation.

---

## 1. Immediate Todo

The end-to-end slideshow is built (`lib/slides.js`, `lib/queue.js`, `lib/slideshow.js`, `lib/overlay-render.js`, `lib/overlay-ui.js`, the content/background entrypoints, and unit tests across all of them). The next work, in order:

1. **Real-Firefox validation pass (needs a human).** `npm run dev`, open an `old.reddit.com` listing, launch the slideshow (toolbar or `?reddit_slideshow_probe`), and confirm: images/galleries paint, v.redd.it video plays muted and advances, the Redgifs `/ifr/<id>` iframe plays **without** a `redgifs.com` host permission, navigation/timer/pagination work, and there are no RES keyboard/DOM conflicts. Capture anything that breaks.
2. **Settings polish.** Add the custom image-timer value and the Include-NSFW option (follow Reddit / always hide → filter `over_18` in the queue) to `lib/settings.js` + the options page.
3. **Remove the `?reddit_slideshow_probe` content-script trigger** once toolbar launch is confirmed (it auto-starts on any matching URL).
4. **Mute control** once an audio-capable (DASH/HLS) playback path exists — deferred while v1 plays the silent `fallback_url`.

Keep small commits. Do not batch multiple slices into one giant commit.

---

## 2. Target Development Flow

For each task or feature:

1. **Write the failing test**
   - Unit test first for parser/resolver/state logic.
   - Fixture-backed test for Reddit data shape.
   - Browser/integration test for overlay behavior once UI exists.

2. **Run the focused test and confirm it fails**
   - The failure should prove the test is meaningful.

3. **Write the smallest code that makes it pass**
   - Keep modules small.
   - Prefer shared `lib/` logic over stuffing behavior into content scripts.
   - Keep content script thin: page integration and overlay only.

4. **Run focused verification**
   - Re-run the specific test.
   - Fix only the thing under test.

5. **Run broader verification**
   - `npm run typecheck`
   - `npm run lint`
   - `npm test`
   - `npm run build`
   - `npm run webext:lint`

6. **Review code**
   - Check diff for scope creep.
   - Check docs if behavior changed.
   - Review security/privacy implications for permissions, DOM injection, and remote media.

7. **Visually verify**
   - For parser-only work: no visual check needed.
   - For extension UI: run the extension in Firefox and inspect manually.
   - Use Playwright when there is a stable local page/fixture or browser target to verify: overlay opens, controls fit, no blank screen, keyboard works, media is visible.
   - Capture screenshots for layout/UI changes when useful.

8. **Commit**
   - Commit after each passing, reviewed slice.
   - Keep commit messages specific.

9. **Push**
   - Only push after the working tree is clean and the full verification set passes.
   - If no remote is configured yet, stop and ask before adding one.

---

## 3. Tooling Target

These commands are available:

```sh
npm install
npm run typecheck
npm run lint
npm test
npm run build
npm run webext:lint
npm run dev
```

Roles:

- `npm run typecheck`: JS/JSDoc type checking via TypeScript.
- `npm run lint`: ESLint, including unsafe DOM sink checks.
- `npm test`: Vitest unit tests with WXT fake browser.
- `npm run build`: WXT Firefox MV3 build.
- `npm run webext:lint`: Mozilla extension lint against built output.
- `npm run dev`: WXT dev runner for Firefox.

Visual/browser tooling:

- Use Playwright for stable browser verification once local fixture pages or extension UI flows exist.
- Use the Browser plugin for quick local URL inspection if needed.
- Use Pencil only for mockups/design artifacts, not implementation.

---

## 4. Verification Gates

Before calling a task done:

- Focused test passes.
- Full relevant command set passes.
- `git status --short` is clean after commit.
- Any changed assumptions are reflected in docs.

Before calling UI work done:

- Firefox manual check completed.
- Playwright or Browser check completed where feasible.
- Controls are keyboard accessible.
- Text does not overflow controls.
- Overlay does not fight old Reddit/RES in the checked scenario.

Before calling provider/media work done:

- Fixture added or updated.
- Resolver test added.
- Unsupported/failure case covered.
- No broad permissions added without ADR/spec update.

---

## 5. Near-Term Validation Spikes

Do these after the foundation scaffold exists:

- Live Firefox spike: background fetch diagnostic for current `old.reddit.com/.../.json?raw_json=1` with existing session.
- Capture real sanitized fixtures for:
  - Direct `i.redd.it` image.
  - Reddit gallery with `gallery_data` + `media_metadata`.
  - Reddit-hosted video with `secure_media.reddit_video`.
  - Crosspost where media lives in `crosspost_parent_list[0]`.
  - Redgifs link.
- Redgifs iframe spike: embed `https://www.redgifs.com/ifr/<id>` in the overlay without `redgifs.com` host permission.
- RES coexistence spike: overlay + keyboard behavior on old Reddit with RES installed.

---

## 6. Current Backlog Shape

V1 path (foundation, resolvers, controller, and overlay complete; remaining):

1. Real-Firefox validation pass (media playback, Redgifs iframe, RES coexistence).
2. Settings polish: custom timer value + Include-NSFW filter.
3. Remove the `?reddit_slideshow_probe` trigger after toolbar launch is confirmed.
4. Mute control once an audio-capable (DASH/HLS) path exists.

V2 backlog:

- Download current media.
- Highest-resolution inspection indicators.
- Pan and zoom for large images.
- More providers beyond Redgifs.

---

## 7. Things Not To Do Yet

- Do not start with Redgifs native `.mp4` embedding.
- Do not add all-URLs host permissions.
- Do not add analytics.
- Do not build a downloader in v1.
- Do not rely on live Reddit in unit tests.
- Do not create a branch unless explicitly asked.
