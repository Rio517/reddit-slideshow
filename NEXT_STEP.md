# NEXT_STEP - Reddit Slideshow Spectacular!

**Doc updated:** 2026-05-31 · **Branch:** `main` · **Status:** shipped-ready on `old.reddit.com` + `www.reddit.com`; CI green; store-listing copy drafted. The single-clip providers (Redgifs, Imgur `.gifv`, Streamable, Giphy, Catbox) and the shadow-root overlay have landed. Open: tip jar, Imgur albums, Redgifs streaming (§1). The shadow-root overlay and the new providers still need a real-Firefox pass (§5).

> **Hard rule:** work directly on `main`. Do not create branches or worktrees unless the user explicitly asks. See `AGENTS.md`.

This is a Firefox-first (also Chrome) WebExtension that turns the current `old.reddit.com` or `www.reddit.com` feed into a keyboard-driven media slideshow. It reuses the logged-in session (no API keys) and resolves images, galleries, v.redd.it video, Redgifs, Imgur `.gifv`, Streamable, Giphy, Catbox video, and crossposts via the provider dispatch in `lib/slides.js`. The overlay does a gap-free, decode-gated slide swap with six transitions (none/fade/slide/push/zoom/flip), a top-right close + a backdrop close-confirm with countdown, an idle auto-hide that respects focus, a popout/AirPlay window, a jump-to-post list, a skipped list, a position counter, and ARIA + a real focus trap. The overlay mounts inside a shadow root (its CSS injected there, isolated from old.reddit/RES page styles) and makes the page `inert` while open. Settings (per-image timer, transition, top-timer-bar mode, load-wait, autoplay, mute, Include-NSFW, dedup, pan & zoom) live in an in-overlay gear panel and a light/dark options page, applied live. A DEV-gated logger (`lib/log.js`) aids debugging; CI runs typecheck/lint/format/test + build (both browsers) + web-ext lint; `npm run screenshots` regenerates the options shots and an offline, deterministic slideshow shot (the real overlay + session over fixture slides in `scripts/slideshow-harness/`). old.reddit.com sets no CSP, so injected cross-origin media loads directly; the image/video sinks are still host/HTTPS-gated (`safeMediaUrl`).

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
- Resolve images, galleries, video, Redgifs, Imgur `.gifv`, Streamable, Giphy, Catbox, and crossposts via the provider dispatch in `lib/slides.js`; CDN-subdomain providers use a dot-prefixed host-suffix allowlist.
- Launch from the toolbar action (icon) or Alt+Shift+S; the slideshow seeds from the post nearest the current viewport.

---

## 1. Open work

Three near-term items remain; each has a real blocker. Keep small commits - do
not batch multiple slices into one giant commit.

- **Tip jar** - on hold. Intended: a GitHub Sponsors link in the options-page
  footer and a small one in the overlay (by the "Full preferences" link). Keep it
  a plain external link; mind each store's donation policy. Blocker: confirm the
  exact Sponsors URL (e.g. `github.com/sponsors/Rio517`) and that Sponsors is
  enabled before wiring - don't ship a dead link.
- **Imgur albums** (`imgur.com/a/…`, `/gallery/…`) → expand one post into the
  image list. The only provider that's a 1→N async resolve (a queue change).
  Blocker: needs an Imgur API **Client-ID** (a registered Imgur app), or the
  fragile unofficial `ajaxalbums` endpoint. `.gifv` → `.mp4` native video (ADR 0011) and single `i.imgur.com` images already work.
- **Redgifs streaming** - avoid buffering the whole mp4 to a blob first
  (MediaSource / range requests). Browser-only: can't be verified headless, and
  it risks regressing the working proxied-blob playback. Recommended: defer to a
  focused real-Firefox effort.

### Media providers - the pattern

Each provider mirrors Redgifs: detection in the `lib/slides.js` provider
dispatch, a background resolver (`lib/redgifs.js` / `lib/streamable.js`-style)
where a network resolve is needed, then play as a proxied `<video>` blob or
render as images. Every new fetch host needs a scoped `host_permission` + an ADR,
plus a fixture and a resolver/detection test. Providers whose media is on varying
CDN subdomains use the proxy allowlist's dot-prefixed domain-suffix rule in
`lib/background-router.js`.

Done: Redgifs, Imgur `.gifv`, Streamable, Giphy, Catbox (ADRs 0010-0014).
Skip: Gfycat (shut down 2023 → Redgifs); YouTube / Vimeo / Twitter (poor
slideshow fit).

### Also deferred (lower priority)

- **Real-Firefox re-check (shadow-root overlay):** code-complete and green (unit
  suite + the offline screenshot renders the overlay styled inside the shadow).
  Confirm in a logged-in profile what headless can't: CSS isolation against real
  RES/old.reddit, the `inert` focus trap (Tab can't escape the overlay),
  backdrop/control clicks, and `f` fullscreen from inside the shadow.
- **Real-Firefox re-check (new providers):** confirm Imgur `.gifv`, Streamable,
  and Giphy proxied playback and Catbox direct video in a logged-in profile -
  detection + resolvers are unit-tested, but live playback wasn't exercised here.
- **Real-Firefox re-check:** the dropped iframe `allow-same-origin` (security M1).
  Confirm Redgifs `/ifr/` playback still works while logged in; revert that one
  line if it regresses.
- **Mute control + real audio** (needs a bundled HLS/DASH player).
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

Confirmed in a real logged-in Firefox profile:

- Session-cookie `.json` access returns logged-in JSON (incl. NSFW), with `X-Ratelimit-*` headers.
- v.redd.it video plays and Redgifs `/ifr/<id>` iframe plays **without** a `redgifs.com` host permission.
- Navigation, automatic pagination to subsequent pages, and RES coexistence (with RES + Reddit Deduplicator) - no keyboard/DOM conflicts.
- Sanitized fixtures exist for image/gallery/video/redgifs/crosspost (crosspost hand-authored; capture a real one if convenient).

Not yet verified in real Firefox (see the §1 re-check items): the shadow-root
overlay (CSS isolation, `inert` focus trap, fullscreen) and live playback of the
new providers (Imgur `.gifv`, Streamable, Giphy, Catbox).

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
