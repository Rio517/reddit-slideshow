# NEXT_STEP - Reddit Slideshow Spectacular!

**Branch:** `main` · **Status:** CI green. Remaining work is polish plus the
deferred real-browser re-checks in §1. The version bump to 1.0.0 is deliberately
not done (user's call).

> **Hard rule:** work directly on `main`. Do not create branches or worktrees unless the user explicitly asks. See `AGENTS.md`.

This is a Firefox-first (also Chrome) WebExtension that turns the current `old.reddit.com` or `www.reddit.com` feed into a keyboard-driven media slideshow. It reuses the logged-in session (no API keys) and resolves images, galleries, v.redd.it video, Redgifs, Imgur `.gifv`, Imgur albums, Streamable, Giphy, Catbox video, and crossposts via the provider dispatch in `lib/slides.js`. The overlay does a gap-free, decode-gated slide swap with six transitions (none/fade/slide/push/zoom/flip), a top-right close + a backdrop close-confirm with countdown, an idle auto-hide that respects focus, a popout/AirPlay window, a jump-to-post list (title + domain/type, skipped slides dimmed + tagged), a skipped list with a per-item reason, a position counter that pulses on manual nav (with a dim/spinner when the next slide is slow), an end-of-show replay card, and ARIA + a real focus trap. The overlay mounts inside a shadow root (its CSS injected there, isolated from old.reddit/RES page styles) and makes the page `inert` while open. Settings (per-image timer, transition, top-timer-bar mode, load-wait, autoplay, mute, Include-NSFW, dedup, pan & zoom) live in an in-overlay gear panel and a light/dark options page, applied live. A DEV-gated logger (`lib/log.js`) aids debugging; CI runs typecheck/lint/format/test + build (both browsers) + web-ext lint; `npm run screenshots` regenerates the options shots and an offline, deterministic slideshow shot (the real overlay + session over fixture slides in `scripts/slideshow-harness/`). old.reddit.com sets no CSP, so injected cross-origin media loads directly; on www.reddit a blocked direct load falls back to the background blob proxy. The image/video sinks are host/HTTPS-gated (`safeMediaUrl`).

---

## 0. Current Source Of Truth

Read these before coding:

- Product spec: `docs/product/reddit-slideshow-product-spec.md`
- Development practices: `docs/research/extension-development-best-practices.md`
- WXT/MV3 ADR: `docs/adr/0005-manifest-v3-event-page-and-wxt-build.md`
- Agent workflow: `AGENTS.md`

Key decisions already made:

- Build a standalone Firefox-first WebExtension; also ship Chrome.
- Use WXT + MV3 (Firefox event page; Chrome service worker).
- Support `old.reddit.com` and `www.reddit.com` (www's CSP triggers the blob-proxy fallback for cross-origin media).
- Use offline fixtures for unit tests instead of live Reddit.
- Resolve images, galleries, video, Redgifs, Imgur `.gifv`, Imgur albums, Streamable, Giphy, Catbox, and crossposts via the provider dispatch in `lib/slides.js`; CDN-subdomain providers use a dot-prefixed host-suffix allowlist (`lib/provider-hosts.js`).
- Move bytes off the `runtime.sendMessage` boundary: the background returns a perceptual-hash hex for dedup and base64 for the blob proxy (raw `ArrayBuffer` is dropped by the JSON-serialized message channel).
- Launch from the toolbar action (icon) or Alt+Shift+S; the slideshow starts from the top of the current listing (the page's own sort).

---

## 1. Open work

Roughly in priority. Keep small commits - do not batch multiple slices into one
giant commit.

### Requested, not yet done

- **Version bump to 1.0.0** when the user gives the go: only `package.json:3`
  (WXT propagates it to both manifests), then tag + publish `v1.0.0` to trigger
  `release.yml`. Left undone deliberately.

### Core improvements

- **Dedup: hash the preload window, not the current slide.** Dedup is reactive
  today - a slide displays, its hash resolves a beat later (background fetch +
  decode), then a duplicate is skipped, so a dupe flashes briefly before
  advancing. Hashing upcoming slides during preload (or HEAD/size-gating, or
  hashing a smaller preview URL) would filter duplicates _before_ they show. See
  `preloadUpcoming` + `maybeHashCurrent` in `lib/session.js`, ADR 0006.
- **Streaming on the proxy fallback** - direct playback streams the mp4; the
  blob-proxy path (Redgifs on Chrome, and the www.reddit CSP fallback) downloads
  the whole mp4 to a blob before it plays. Streaming it (MediaSource / range
  requests) is browser-only and risks regressing working blob playback - do it in
  a focused real-browser effort.
- **Reddit-video / real audio** - `v.redd.it` serves video and audio as separate
  streams; we play the silent fallback, so unmuting gives no Reddit-video sound.
  Real audio needs muxing the DASH audio track (bundled MediaSource/HLS player).
  Browser-only, risks regressing playback.
- **Redgifs lazy resolution** - push a page before its embeds resolve.
- **Options-page donation link** - the in-overlay help-panel about line and the
  repo Sponsor button (`.github/FUNDING.yml`) already point at
  `github.com/sponsors/Rio517`; add a small Sponsors link to the
  options-page footer. Keep it a plain external link; mind each store's policy.
- Download the current media.
- Highest-resolution inspection indicators.
- switch the order of the bottom left image title elements so the orde rhousld be username, title, popout arrow, loading spinner
- add resolution and domain on the right side. subtle.

### Hardening / polish

- **Pin the permalink/author host to reddit** (defense-in-depth): `absolutePermalink`
  (`lib/slides.js`) resolves a post permalink against the page origin. Downstream
  sinks are already gated (HTTPS-only "open original"; the byline link only takes
  the resolved `.origin`), but rejecting a non-`*.reddit.com` resolved host would
  close the byline sink entirely. Low severity.
- **Small fail-closed test gaps**: `slideshow.fetchMedia` from a non-content-script
  sender; the unparseable-URL catch in `handleHashImage` / `proxyFetch`; the
  redgifs `urls.sd` fallback. Cheap to add to the existing router/redgifs suites.

### Media providers - the pattern

Each provider mirrors Redgifs: detection in the `lib/slides.js` provider
dispatch, a background resolver (`lib/redgifs.js` / `lib/streamable.js`-style)
where a network resolve is needed, then play the mp4 in a `<video>` or render as
images. Direct play uses the provider CDN; the background blob proxy is the
per-slide fallback for pages whose CSP blocks cross-origin media (www.reddit) and
the primary path for Redgifs on Chrome (where `referrerpolicy` is a no-op on
`<video>`). Every new fetch host needs a scoped `host_permission` + an ADR, plus a
fixture and a resolver/detection test. Providers whose media is on varying CDN
subdomains use the dot-prefixed domain-suffix rule in `lib/provider-hosts.js`.

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
   - Provider/byte-transfer changes need a real logged-in browser (offline gates can't catch CORS, referrerpolicy, host-permission grants, or message-boundary serialization).

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
- `npm run build`: WXT MV3 build (both Firefox and Chrome).
- `npm run webext:lint`: Mozilla extension lint against built output.
- `npm run dev`: WXT dev runner for Firefox (DEV logger on).

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
- Confirmed in a real logged-in browser (both Firefox and Chrome where the path differs).

---

## 7. Things Not To Do Yet

- Do not add all-URLs host permissions (each new provider host is scoped + ADR'd).
- Do not add analytics.
- Do not build the downloader yet (it's V2).
- Do not rely on live Reddit in unit tests.
- Do not send raw binary over `runtime.sendMessage` (it's dropped) - return a hash or base64.
- Do not create a branch/worktree unless explicitly asked.
