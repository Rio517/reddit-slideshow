# NEXT_STEP — Reddit Slideshow

**Doc updated:** 2026-05-29 · **Branch:** `main` · **Status:** planning complete, implementation not started.

> **Hard rule:** work directly on `main`. Do not create branches or worktrees unless the user explicitly asks. See `AGENTS.md`.

This project is a Firefox-first WebExtension for turning the current `old.reddit.com` feed into a media slideshow. The next move is to execute the foundation plan, not to jump straight into the slideshow UI.

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
- Treat Redgifs iframe playback and Reddit session-cookie `.json` pagination as validation spikes, not settled facts.

---

## 1. Immediate Todo

Execute the foundation plan in order:

1. Scaffold WXT/MV3 tooling.
2. Add validated settings module.
3. Add background/content/options entrypoints.
4. Add offline fixture docs and sample old Reddit/Reddit JSON fixtures.
5. Add old Reddit listing URL conversion.
6. Add direct-image slide normalization.
7. Run full verification and update fixture docs.

Plan file:

```text
docs/superpowers/plans/2026-05-29-foundation-wxt-mv3.md
```

Use the plan’s small commits. Do not batch the whole thing into one giant commit.

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

The foundation plan will add these commands:

```sh
npm install
npm run typecheck
npm run lint
npm test
npm run build
npm run webext:lint
npm run dev
```

Expected roles:

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

- Live Firefox spike: background fetch of current `old.reddit.com/.../.json?raw_json=1` with existing session.
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

V1 path:

1. Foundation + fixtures.
2. Queue builder and pagination.
3. Direct images and gallery support.
4. Overlay shell and keyboard navigation.
5. Timer behavior.
6. Reddit-hosted video.
7. Redgifs iframe provider.
8. Settings/options polish.
9. RES coexistence verification.

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
