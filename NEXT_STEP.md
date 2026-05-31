# NEXT_STEP — Reddit Slideshow

**Doc updated:** 2026-05-30 · **Branch:** `main` · **Status:** v1 feature-complete (verified once in real Firefox); new Reddit (`www.reddit.com`) support is now implemented (ADR 0008) and needs a logged-in Firefox check.

> **Hard rule:** work directly on `main`. Do not create branches or worktrees unless the user explicitly asks. See `AGENTS.md`.

This project is a Firefox-first WebExtension for turning the current `old.reddit.com` feed into a media slideshow. The full v1 is implemented and unit-tested: session-cookie `.json` access (validated against live Reddit), media resolvers (images, galleries, Reddit video, Redgifs, crossposts — run against ~400 real posts), a headless controller (navigation, load-gated timer, pagination, safety timer), a designed overlay (per-kind rendering, side-rail controls, position counter, per-slide timer sweep, loading spinner, failure placeholder, preload, buffering hint), settings (custom timer slider, autoplay, Include-NSFW filter), start-from-current-scroll, and an SVG icon. A real-Firefox pass confirmed v.redd.it, Redgifs, navigation, pagination, and RES coexistence (with RES + Reddit Deduplicator). old.reddit.com sets no CSP, so injected cross-origin media loads directly.

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
- Launch from the toolbar action (icon) or Alt+Shift+S; the slideshow seeds from the post nearest the current viewport.

---

## 1. Immediate Todo

1. Is there a runtime introspection tool we could use to improve iteration speed and debugging speed?
2. please add build/publishing instructions to readme if not there already.
3. Slide transitions: bbetween images i see a roughly 1s delay between one image going away and a new one coming in.... i dont want that. Ideally we could have a transition preference. with 6 options, including fade, slide, none, and maybe you can suggest others that users might like. i think this would be best in the full settings section.
4. Please create a new popout button in the control slider that opens the slideshow in a dedicated minimal window. i would use this for airplay. Ideally no browser bar or url bar or title. very minmal.
5. Please audit our test suite speed, can it be faster, especially when we go to CI
6. go to CI.
   CHECK IF DONE

7. **Full HLS/DASH audio** — only if the unmute check shows many clips are silent (muxed-fallback assumption wrong).
8. **Packaging:** `npm run zip` (Firefox/AMO) and `npm run zip:chrome` (Chrome Web Store) when ready.

MIGHT BE DONE ALREDY:

### Quality follow-ups (lower priority)

- **Content-dedup hashing:** hash from a Reddit preview URL (or HEAD-gate on
  size) instead of the full display image, to cut bandwidth/decode for the opt-in
  re-upload detection.
- **Redgifs lazy resolution:** deliver a page before its Redgifs embeds resolve,
  pushing upgraded native-video slides as they arrive, so a Redgifs-heavy page
  isn't delayed.
- **Redgifs streaming:** avoid buffering the whole mp4 (background → blob) before
  playback — investigate a streaming or extension-served-URL path.
- **Narrow typedefs for Reddit listing JSON** (`lib/slides.js` et al. currently
  use `any`).
- **`requiredElement(selector, ctor)` helper** for the options-page lookups.
- **Split `lib/overlay-ui.js`** if it keeps growing — candidate seams are the
  jump-list panel, the skipped-list panel, and a media-lifecycle module (object
  URL revoke, video stop, ready fallback, listener aborts), with `createOverlay`
  as the assembly point.

The content↔overlay↔background glue now lives in `lib/session.js` (injected deps),
covered by `tests/unit/session.test.js`.

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

## 5. Validation Status

Confirmed in a real logged-in Firefox profile:

- Session-cookie `.json` access returns logged-in JSON (incl. NSFW), with `X-Ratelimit-*` headers.
- v.redd.it video plays and Redgifs `/ifr/<id>` iframe plays **without** a `redgifs.com` host permission.
- Navigation, automatic pagination to subsequent pages, and RES coexistence (with RES + Reddit Deduplicator) — no keyboard/DOM conflicts.
- Sanitized fixtures exist for image/gallery/video/redgifs/crosspost (crosspost hand-authored; capture a real one if convenient).

---

## 6. Current Backlog Shape

V1 is feature-complete. Open items:

1. Mute control + audio playback (needs a bundled HLS/DASH player).
2. Packaging and AMO submission (`npm run zip`).

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
