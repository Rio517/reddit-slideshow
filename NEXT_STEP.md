# NEXT_STEP - Reddit Slideshow Spectacular!

**Doc updated:** 2026-06-02 · **Branch:** `main` · **Status:** CI green and a full 1.0 audit done this session (blockers + should-fix addressed), BUT real-browser testing surfaced **active functional bugs** - see §1 "Active bugs" first. Not 1.0-shippable until those are resolved. The version bump to 1.0.0 is deliberately not done (user's call).

> **Hard rule:** work directly on `main`. Do not create branches or worktrees unless the user explicitly asks. See `AGENTS.md`.

This is a Firefox-first (also Chrome) WebExtension that turns the current `old.reddit.com` or `www.reddit.com` feed into a keyboard-driven media slideshow. It reuses the logged-in session (no API keys) and resolves images, galleries, v.redd.it video, Redgifs, Imgur `.gifv`, Imgur albums, Streamable, Giphy, Catbox video, and crossposts via the provider dispatch in `lib/slides.js`. The overlay does a gap-free, decode-gated slide swap with six transitions (none/fade/slide/push/zoom/flip), a top-right close + a backdrop close-confirm with countdown, an idle auto-hide that respects focus, a popout/AirPlay window, a jump-to-post list (skipped slides dimmed + tagged), a skipped list with a per-item reason, a position counter that pulses on manual nav (with a dim/spinner when the next slide is slow), an end-of-show replay card, and ARIA + a real focus trap. The overlay mounts inside a shadow root (its CSS injected there, isolated from old.reddit/RES page styles) and makes the page `inert` while open. Settings (per-image timer, transition, top-timer-bar mode, load-wait, autoplay, mute, Include-NSFW, dedup, pan & zoom) live in an in-overlay gear panel and a light/dark options page, applied live. A DEV-gated logger (`lib/log.js`) aids debugging; CI runs typecheck/lint/format/test + build (both browsers) + web-ext lint; `npm run screenshots` regenerates the options shots and an offline, deterministic slideshow shot (the real overlay + session over fixture slides in `scripts/slideshow-harness/`). old.reddit.com sets no CSP, so injected cross-origin media loads directly; the image/video sinks are still host/HTTPS-gated (`safeMediaUrl`).

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
- Resolve images, galleries, video, Redgifs, Imgur `.gifv`, Imgur albums, Streamable, Giphy, Catbox, and crossposts via the provider dispatch in `lib/slides.js`; CDN-subdomain providers use a dot-prefixed host-suffix allowlist.
- Launch from the toolbar action (icon) or Alt+Shift+S; the slideshow starts from the top of the current listing (the page's own sort).

---

## 1. Open work

Near-term items, roughly in priority; most have a real blocker noted. Keep small
commits - do not batch multiple slices into one giant commit.

### Active bugs (reported from real-browser testing, 2026-06-02)

These came back from the user testing the rebuilt extension and are the **top
priority**. All three are real-browser behaviors the offline gate can't catch, so
they need a logged-in profile + devtools to diagnose. Get the specifics noted
below before changing code.

- **FF: Imgur album not shown.** The album list comes from a background fetch of
  `imgur.com/ajaxalbums/getimages/<id>/hit.json` (`entrypoints/background.js` →
  `createImgurAlbumResolver` → `lib/imgur.js`; expanded by `resolveImgurAlbumSlides`).
  **Prime suspect:** this session narrowed the host permission from
  `https://imgur.com/*` to `https://imgur.com/ajaxalbums/*` (`wxt.config.ts`,
  commit "refactor: correct now-stale proxy comments, narrow imgur permission").
  Firefox may not grant a **path-scoped** host permission for a background
  cross-origin fetch the way it grants an origin-scoped one - if so the fetch is
  CORS-blocked, the album resolve throws, and the post is dropped (fail-soft →
  "not shown"). **First thing to try: revert the narrowing back to
  `https://imgur.com/*`, rebuild, re-test.** If that fixes it, keep the broad
  permission (and note why in the manifest comment). Confirm via the FF background
  console: a network error / CORS rejection on the ajaxalbums URL.
- **Chrome: Redgifs doesn't work.** Direct path is
  `<video src="https://media.redgifs.com/<X>.mp4" referrerpolicy="no-referrer">`
  (`lib/overlay-render.js`, scoped to the Redgifs host). `referrerpolicy` on a
  `<video>` is **unverified in real Chrome**. Need from devtools (Network tab, on
  `old.reddit.com`): (a) does `api.redgifs.com` resolve succeed? (b) on the
  `media.redgifs.com` request, is a `Referer` still being sent, and what's the
  response status? If Chrome still sends a referer (→403) or blocks for another
  reason, the direct load fails; on old.reddit there's no CSP-fallback trigger
  unless the `<video>` fires an `error` event (which then flips to `proxied`, but
  Chrome's SW can't read the CORS-less bytes → skip). Possible fixes depending on
  findings: a `referrerpolicy` that the CDN accepts, or a different no-referer
  mechanism, or accept the proxy path and make it work in Chrome.
- **Dedup doesn't work.** Clarify which: Layer 1 (exact-URL, always on) or Layer 2
  (perceptual hash, `dedupe && contentDedup`, default on). Layer 2 needs the
  background `fetchImage` bytes from `i.redd.it` / `preview.redd.it` /
  `external-preview.redd.it` / `i.imgur.com`. The dedup-pause guard added this
  session (`lib/session.js` `maybeHashCurrent`) only suppresses the advance when
  `autoplay && paused`; normal playing/manual dedup still advances (unit-tested),
  so that change shouldn't have broken it - but verify. Get: which feed, is
  `contentDedup` on, any console error from the hash fetch, and whether the dupes
  are exact-URL or perceptual.

### Regression to fix (introduced this session)

- **Jump list dropped the post title.** The counter→jump list was reworked this
  session into two columns (domain + asset type), which **removed the truncated
  post title** the user did not ask to drop. Restore the title alongside the new
  columns - e.g. title as the primary (CSS-ellipsized) line with `domain · type`
  as a muted subline. Touch `renderJumpPanel` + the `.rs-jump-panel__*` rules
  (`lib/overlay-ui.js`, `assets/overlay.css`) and the jump-list test in
  `tests/unit/overlay-ui.test.js`. (Domain helper `slideDomain`, type helper
  `slideAssetType` already exist.)

### Requested, not yet done

- **Run the `code-simplifier` skill over the codebase** (user asked). Focus on
  recently-touched files (the overlay/session work this session); behavior-
  preserving only, and mind the "prefer restraint on refactors" guidance - lead
  with whether a simplification is worth it.
- **Version bump to 1.0.0** when the user gives the go: only `package.json:3`
  (WXT propagates it to both manifests), then tag + publish `v1.0.0` to trigger
  `release.yml`. Left undone deliberately.

### Backlog

- **Options-page donation link** - the in-overlay help-panel about line and the
  repo Sponsor button (`.github/FUNDING.yml`) already point at
  `github.com/sponsors/Rio517`; optionally add a small Sponsors link to the
  options-page footer too. Keep it a plain external link; mind each store's
  donation policy.
- **Streaming on the proxy fallback** - direct playback already streams the mp4
  (no whole-file blob), and the nearest upcoming direct clip is cache-warmed by
  `preloadUpcoming`. The remaining gap is the CSP-fallback path on `www.reddit`,
  where a blocked direct load still downloads the whole mp4 to a blob before it
  plays. Streaming that (MediaSource / range requests) is browser-only, can't be
  verified headless, and risks regressing working blob playback - defer to a
  focused real-Firefox effort.

### Media providers - the pattern

Each provider mirrors Redgifs: detection in the `lib/slides.js` provider
dispatch, a background resolver (`lib/redgifs.js` / `lib/streamable.js`-style)
where a network resolve is needed, then play the mp4 directly in a `<video>`
(the CDN serves it; Redgifs alone needs `referrerpolicy="no-referrer"`) or render
as images. The background blob proxy is the per-slide fallback for pages whose
CSP blocks cross-origin media (`www.reddit`): a failed direct load flips the slide
to proxied and re-renders once. Every new fetch host needs a scoped
`host_permission` + an ADR, plus a fixture and a resolver/detection test.
Providers whose media is on varying CDN subdomains use the dot-prefixed
domain-suffix rule in the host allowlists (`lib/provider-hosts.js`).

Done: Redgifs, Imgur `.gifv`, Imgur albums, Streamable, Giphy, Catbox (ADRs 0010-0015).
Skip: Gfycat (shut down 2023 → Redgifs); YouTube / Vimeo / Twitter (poor
slideshow fit).

### Also deferred (lower priority)

- **Real-Firefox re-check (shadow-root overlay):** code-complete and green (unit
  suite + the offline screenshot renders the overlay styled inside the shadow).
  Confirm in a logged-in profile what headless can't: CSS isolation against real
  RES/old.reddit, the `inert` focus trap (Tab can't escape the overlay),
  backdrop/control clicks, and `f` fullscreen from inside the shadow.
- **Real-Firefox/Chrome re-check (providers):** Chrome-Redgifs and FF-Imgur-album
  are now **confirmed failing** - see §1 "Active bugs". Still want a live look at
  Giphy, Catbox, Imgur `.gifv`, Imgur-album members (images + `.mp4`), and the
  `www.reddit` CSP blob-proxy fallback. Streamable direct video is confirmed in
  **both Firefox and Chrome** (the Chrome ORB fix works).
- **Real-Firefox re-check:** the dropped iframe `allow-same-origin` (security M1).
  Confirm Redgifs `/ifr/` playback still works while logged in; revert that one
  line if it regresses.
- **Real-Firefox re-check (core dedup):** confirm the default perceptual hash
  skips the solo-vs-gallery duplicate (including an Imgur copy vs a reddit one),
  and that the install prompt for the hashable hosts (`i.redd.it`,
  `preview.redd.it`, `external-preview.redd.it`, `i.imgur.com`) reads acceptably.
- **Reddit-video / real audio** - `v.redd.it` serves video and audio as separate
  streams; we play the silent fallback, so unmuting gives no Reddit-video sound.
  Real audio needs muxing the DASH audio track (bundled MediaSource/HLS player).
  Browser-only, risks regressing playback - do it in a focused real-Firefox pass.
- **Redgifs lazy resolution** (push a page before its embeds resolve).
- **Content-dedup hashing** from a Reddit preview URL (or HEAD-gate on size)
  instead of the full display image.
- **Split `lib/overlay-ui.js`** if it keeps growing - jump-list, skipped-list, and
  media-lifecycle seams, with `createOverlay` as the assembly point.
- **AMO + Chrome Web Store submission** - copy is ready in `docs/store-listing.md`;
  package with `npm run zip` / `npm run zip:chrome`.

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

Confirmed in a real logged-in profile:

- Session-cookie `.json` access returns logged-in JSON (incl. NSFW), with `X-Ratelimit-*` headers.
- v.redd.it video plays and Redgifs `/ifr/<id>` iframe plays **without** a `redgifs.com` host permission.
- Navigation, automatic pagination to subsequent pages, and RES coexistence (with RES + Reddit Deduplicator) - no keyboard/DOM conflicts.
- **Streamable direct video plays in Chrome** (the ORB fix) - user-confirmed.
- Sanitized fixtures exist for image/gallery/video/redgifs/crosspost (crosspost hand-authored; capture a real one if convenient).

Not yet verified in a real browser (see the §1 re-check items): the shadow-root
overlay (CSS isolation, `inert` focus trap, fullscreen), the solo-vs-gallery
dedup skip, and the newly-direct provider playback in both browsers - Imgur
`.gifv` + albums (now including `.mp4` members), Giphy, Redgifs, Catbox - plus the
`www.reddit` CSP blob-proxy fallback.

---

## 6. Longer-term (V2)

Near-term work is in §1. Further out:

- Download the current media.
- Highest-resolution inspection indicators.

---

## 7. Things Not To Do Yet

- Do not add all-URLs host permissions (each new provider host is scoped + ADR'd).
- Do not add analytics.
- Do not build the downloader yet (it's V2).
- Do not rely on live Reddit in unit tests.
- Do not create a branch/worktree unless explicitly asked.
