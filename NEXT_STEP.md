# NEXT_STEP — Reddit Slideshow

**Doc updated:** 2026-05-29 · **Branch:** `main` · **Status:** live-fetch diagnostic path and queue core are built; real Firefox validation and real fixtures are next.

> **Hard rule:** work directly on `main`. Do not create branches or worktrees unless the user explicitly asks. See `AGENTS.md`.

This project is a Firefox-first WebExtension for turning the current `old.reddit.com` feed into a media slideshow. The foundation scaffold is in place, and the first queue/fetch core exists: the browser action can trigger a background listing JSON fetch diagnostic, direct images normalize from `url_overridden_by_dest` or `url`, and queue pagination decisions are tested. The next move is to validate the diagnostic in the user's real Firefox profile and capture sanitized real fixtures.

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
- Use provider adapters later for Reddit images, galleries, videos, and Redgifs.
- Treat Redgifs iframe playback and Reddit session-cookie `.json` pagination as validation spikes until checked in the user's real Firefox profile.

---

## 1. Immediate Todo

The foundation scaffold is complete, and the first queue/fetch core has landed (`lib/reddit-listing.js`, `lib/queue.js`, `lib/reddit-url.js`, `lib/slides.js`, `lib/settings.js`, WXT/MV3 entrypoints, offline fixtures). The next work, in order:

1. **Run the live Firefox `.json` diagnostic.** Build/run the extension in the user's real Firefox environment, open an `old.reddit.com` listing, click the browser action, and confirm the overlay reports listing JSON success using the existing logged-in session. Record status codes, child counts, whether `X-Ratelimit-*` headers appear, and any auth/rate-limit failures.
2. **Capture real sanitized fixtures and harden providers.** Save small sanitized JSON for direct images, galleries, Reddit video, crossposts, and Redgifs. Direct images already handle both `url_overridden_by_dest` and `url`; galleries/video/crossposts/Redgifs still need resolver tests.
3. **Connect queue builder to the slideshow flow.** `buildQueuePage()` and `shouldFetchNextPage()` are tested, but the content/background flow still only shows diagnostics. The next implementation slice should request a first queue page, return normalized slides, and render the first real image in the overlay.
4. Continue down the V1 backlog (§6): overlay shell, keyboard navigation, timer, video, Redgifs, settings polish, RES coexistence.

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

V1 path (foundation + first queue/fetch core complete; remaining):

1. Real Firefox `.json` diagnostic validation and real captured fixtures.
2. First queue page wired into the extension flow.
3. Direct image rendering in the overlay.
4. Gallery support.
5. Overlay shell and keyboard navigation.
6. Timer behavior.
7. Reddit-hosted video.
8. Redgifs iframe provider.
9. Settings/options polish.
10. RES coexistence verification.

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
