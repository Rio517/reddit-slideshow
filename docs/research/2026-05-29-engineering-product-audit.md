# Engineering & Product Audit

Date: 2026-05-29
Status: Review
Reviewer: deep audit (multi-agent), verified against current sources

## Purpose

This document audits the existing planning corpus (product spec, research notes,
prior-art survey, four ADRs, and the first implementation plan) from both a
product and an engineering perspective, and verifies the load-bearing technical
claims against current (2026) sources. It is a review artifact: it does not
replace the existing docs, but it records what should change and why, with
citations.

The planning work is unusually thorough and well-organized. The findings below
are concentrated in a few places, and most share one shape: **the riskiest and
most uncertain parts of the product (Reddit access, Redgifs playability, video
audio, filtering) are deferred into "open questions" or later slices, while the
safe parts are validated first.** For a tool whose feasibility and value live
almost entirely in those uncertain parts, that ordering is backwards.

## How to read this

Findings are tagged by severity:

- **Critical** — wrong/broken; will not work as written or will cause real harm.
- **High** — significant correctness, scope, or risk problem.
- **Medium** — should be fixed before relying on the doc.
- **Low / Nit** — polish, hygiene, or documentation accuracy.

Where an existing doc has already been corrected as part of this audit, the
finding is marked **(corrected)**.

---

## 1. Platform reality — Manifest V2 vs V3, tooling versions

### C-1. The MV2 decision is defensible, but its stated justification is wrong (corrected)

The plan (`2026-05-29-foundation-and-fixtures.md`, Task 2) chooses Manifest V2
with a persistent background page, justified as "Firefox supports persistent
background scripts cleanly," and the best-practices doc claims "Firefox does not
support `background.service_worker`."

Verified current facts:

- **MV2 is not deprecated on Firefox.** Mozilla has "no current plans to
  deprecate MV2" and has committed to ≥12 months' notice if that changes.
  ([Mozilla MV3/MV2 update, 2024-03](https://blog.mozilla.org/addons/2024/03/13/manifest-v3-manifest-v2-march-2024-update/))
- **But the reasoning is the deprecated direction.** MV3 *removes* persistent
  background pages. Firefox MV3 uses **non-persistent event pages**
  (`background.scripts` + `persistent: false`), *not* service workers. So the
  factual claim "no service_worker" is true but stale: the modern Firefox model
  is the event page, and choosing MV2 *specifically to keep a persistent
  background* opts into the pattern being phased out.
  ([MV3 migration guide](https://extensionworkshop.com/documentation/develop/manifest-v3-migration-guide/))
- **This extension has no `webRequest`/ad-blocking need** — the one area where
  MV2 retains a real Firefox advantage — so MV2 buys nothing functional here.
- **Chrome has fully removed MV2** (Chrome 139+). Any future cross-browser
  ambition requires MV3.
  ([Chromium MV2 phase-out](https://blog.chromium.org/2024/05/manifest-v2-phase-out-begins.html))
- The current code (static HTML/CSS/JS modules, `textContent`, no `innerHTML` /
  `eval`) **already satisfies the strict MV3 CSP**, so migration cost is near
  zero now and grows with the codebase.

**Recommendation:** Either (a) move to **MV3 + event page + `action`** now
(preferred for a greenfield 2026 extension), or (b) keep MV2 as a conscious,
time-boxed tradeoff for speed — but rewrite the justification. The build tool
(see §3, WXT) can emit a Firefox MV2 build and a Chrome MV3 build from one
source, which removes the need to choose by hand. Capture the decision in a
dedicated ADR.

### M-2. Tooling versions are stale (corrected)

- `web-ext` is pinned `^8.8.0`; current is **10.x** (bundles `addons-linter`
  10.x, defaults to Node 22). ([web-ext releases](https://github.com/mozilla/web-ext/releases))
- The manifest has **no `browser_specific_settings.gecko.id`**, which triggers
  `MISSING_ADDON_ID` in `web-ext lint` and is required for `storage.sync` and
  for unsigned dev installs.

### Confirmed (no change needed)

- Optional runtime host permissions for Redgifs work as ADR 0004 assumes:
  `browser.permissions.request()` must be called from a **user-gesture handler**.
  Note the MV2/MV3 key split: optional hosts go in `optional_permissions` (MV2)
  vs `optional_host_permissions` (MV3, Firefox 128+).
  ([MDN permissions.request](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/permissions/request))
- CSP shape: MV2 string vs MV3 object (`{ "extension_pages": "..." }`). MV3
  `script-src` allows only `'none'`/`'self'`/`'wasm-unsafe-eval'`. The project's
  "no remote code / no eval" stance is correct either way.
  ([MDN content_security_policy](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/content_security_policy))
- **MV3 caveat for later:** host permissions are user-revocable; content
  scripts won't auto-inject without a granted host permission (check
  `permissions.contains` / `request`). Not an issue under MV2.

---

## 2. Data-access reality — Reddit and Redgifs

### C-3. The v.redd.it video model is wrong: `fallback_url` is silent (corrected in spec)

The spec says to point a `<video>` at a "playable video URL" and let `ended`
fire. But v.redd.it uses **MPEG-DASH with fully separated tracks**:
`secure_media.reddit_video.fallback_url` is the **video-only** stream — a plain
`<video>` pointed at it plays with **no audio**, directly contradicting the
spec's mute/unmute setting. Audio lives only in the DASH manifest (`dash_url`)
or HLS playlist (`hls_url`), historically as a separate `DASH_audio.mp4` (name
not fixed — read the manifest).
([DASH/HLS decode writeup](https://dev.to/yqqwe/engineering-a-high-performance-reddit-video-downloader-decoding-dash-hls-and-client-side-11ke),
[separate audio muxing](https://github.com/RipMeApp/ripme/issues/1819))

**Recommendation:** pick one and state it: (a) **muted-only video in v1**
(simplest, honest — set `audioAvailable: false`), or (b) bundle an HLS player
(e.g. hls.js — must be **bundled**, not remote-loaded, to satisfy AMO) and feed
it `hls_url`. Do not promise audio on the naive `fallback_url` path.

### H-4. The Reddit-access posture works but is undocumented and carries ToS/AMO risk (corrected in ADR 0003)

The approach — no OAuth app credentials, fetch `old.reddit.com/.../.json` using
the **user's logged-in session cookies**, conservatively — is technically
viable in 2026 and has precedent (RES). The "403 on `.json`" failures widely
reported are **datacenter-IP, unauthenticated, bot-UA** scrapers; Reddit's own
help text carves out "logged in" access. The plan correctly routes fetches
through the background script (needed to carry session cookies reliably).
([Reddit access help](https://support.reddithelp.com/hc/en-us/articles/14945211791892-Developer-Platform-Accessing-Reddit-Data))

However:

- The **rate-limit number in the research is stale**: free-tier OAuth is now
  **100 queries/min** (≈10-min averaging window), not 60; unauthenticated *API*
  requests are rejected. `X-Ratelimit-*` headers may be **absent** on the
  cookie-session website path, so 429/403 must also drive backoff (the plan
  already does this). ([rate limits](https://data365.co/blog/reddit-api-limits))
- There is **genuine, if modest, ToS/AMO risk**: an AMO reviewer can reject or
  later remove an add-on whose core function reads another service against its
  terms. Reddit has pursued enforcement (vs SerpApi, 2025), though against bulk
  scrapers, not user-agent-side extensions. The plan has **no documented ToS
  posture**, which is exactly what an AMO reviewer needs to see.
  ([AMO policies](https://extensionworkshop.com/documentation/publish/add-on-policies/))

**Recommendation:** add an explicit ToS posture (acts only for the logged-in
user, on data already visible to that user, human-scale rates, no server-side
storage, no bulk collection/redistribution, degrade on 403/429). Keep the
transport swappable (ADR 0002 resolver layer) so optional per-user OAuth is an
escape hatch if the cookie path is ever blocked. **Do not** ship app OAuth
credentials in the extension.

### H-5. Redgifs IS reliably embeddable inline — via the iframe, like RES (corrected; supersedes the earlier "fallback is common" framing)

**Correction.** An earlier draft of this finding concluded Redgifs inline
playback was "brittle / mostly-fallback" because the resolved CDN `.mp4` URLs are
hotlink/Referer-protected (HTTP 403). That is true for the **direct-`.mp4`**
path, but it is **not how RES works**, and RES demonstrably plays Redgifs inline.

How RES actually does it (verified against `lib/modules/hosts/redgifs.js` on
`master`): it embeds the **Redgifs first-party iframe** `https://redgifs.com/ifr/<id>`.
The iframe is served by Redgifs, so the `<video>` inside is a *same-origin*
request from `redgifs.com` to its own CDN, carrying the Origin/Referer Redgifs
whitelists — it never trips the cross-origin hotlink 403. RES never embeds the
protected CDN URL. The temporary-token / v2-`.mp4` approach that hits 403 was an
**unmerged PR (#5481)**, not shipping code. RES's only API call is a best-effort
metadata fetch for aspect-ratio sizing; playback works even when it fails.
([RES redgifs.js](https://github.com/honestbleeps/Reddit-Enhancement-Suite/blob/master/lib/modules/hosts/redgifs.js),
[Redgifs API hotlink note](https://redgifs.readthedocs.io/en/stable/api.html),
[unmerged PR #5481](https://github.com/honestbleeps/Reddit-Enhancement-Suite/pull/5481))

Implications for this extension:

- **Adopt the iframe `/ifr/<id>` embed.** It needs **no `redgifs.com` host
  permission** (it's a page element, not an extension fetch), and it sidesteps
  the 403 entirely. Redgifs stays genuinely first-class.
- **Auto-advance tradeoff:** an iframe fires no native `<video>` `ended` event,
  so Redgifs slides auto-advance on a **duration timer** (clip duration from
  best-effort metadata, else a fixed dwell), not media-completion. Mute/scrub is
  limited to what the iframe player exposes.
- Only reach for the direct v2-API `.mp4` `<video>` path if precise native
  `ended`/mute/scrub control becomes a hard requirement — and accept it then
  fights the hotlink protection RES deliberately avoids.
- ADR 0004's optional-permission staging still applies *only* if the optional
  metadata API is used; the iframe itself needs nothing.

### M-6. Listing-field handling has real gaps (crosspost, gallery order, sole reliance on `url_overridden_by_dest`)

All assumed fields still exist, but:

- **Don't key resolution solely off `url_overridden_by_dest`** — it points at
  `/gallery/<id>` for galleries and is absent on some shapes. Derive image URLs
  from `preview.images[].source` / `i.redd.it` too. `post_hint` is best-effort
  (often absent on crossposts).
- **Crossposts:** `gallery_data`, `media_metadata`, and `secure_media` are
  **absent on the base post and present only in `crosspost_parent_list[0]`**.
  gallery-dl had to special-case this. The current plan drops crossposted media.
  ([gallery-dl crosspost PR](https://github.com/mikf/gallery-dl/pull/3976))
- **Gallery order:** iterate `gallery_data.items` (display order) and look up
  each `media_id` in `media_metadata`; never trust `media_metadata` key order.
- **`raw_json=1` is a hard invariant**: without it, `preview` and
  `media_metadata` URLs are HTML-entity-encoded (`&amp;`). The converter adds
  it — document it as load-bearing.

---

## 3. Tooling — the "no bundler" plan cannot run in Firefox

### C-7. Unbundled ES modules will not load as a Firefox content script (corrected in plan + best-practices)

The plan loads unbundled `extension/` source directly, with
`content/content-script.js` importing `shared/slides.js`,
`shared/reddit-url.js`, `shared/settings.js`. **Firefox has never supported ESM
`import` in content scripts** — it throws `SyntaxError`, and the platform bug
([1451545](https://bugzilla.mozilla.org/show_bug.cgi?id=1451545)) has been open
8 years. **This design will not run as written.** A bundler is mandatory, not
optional.

**Recommendation (stack):**

| Tool | Purpose | Why |
| --- | --- | --- |
| **WXT** (`wxt.dev`) | Build framework: bundling, per-browser MV2/MV3 manifest generation, dev/HMR | Solves the mandatory bundling; emits Firefox-MV2 + Chrome-MV3 from one source; framework-agnostic (plain DOM, no React) |
| **Vitest** + `WxtVitest()` + happy-dom | Unit/integration tests | Already chosen (good); WXT's plugin auto-mocks `browser.*` in-memory (`@webext-core/fake-browser`) |
| **JSDoc + `checkJs` + `tsc --noEmit`** | Types without a `.ts` rewrite | The ~18-field slide type and message contracts are exactly what "typed by convention" fails to protect; JSDoc gives type-checking at near-zero cost |
| **`@types/webextension-polyfill`** | `browser.*` typings | Better-typed than `@types/firefox-webext-browser`; use for types even without shipping the polyfill |
| ESLint flat + **`eslint-plugin-no-unsanitized`** + Prettier | Lint/format | `no-unsanitized` directly enforces the doc's `innerHTML` ban |
| `web-ext lint` (10.x) on the **built** output | AMO policy lint | Lint what AMO actually receives, not raw source |

Notes:

- **Skip `webextension-polyfill` (runtime) for v1** — in 2026 it's effectively a
  no-op; both Chrome MV3 and Firefox support promise-based APIs. Adopt only if a
  dependency forces it. Use its *types* though.
- **Honest limitation:** automated **E2E for Firefox extensions is weak.**
  Playwright has no first-party Firefox-extension loading (only community shims
  like `playwright-webextext`); the supported path is `web-ext run` for manual
  smoke testing. Push logic into pure, DOM-free modules and unit-test those
  against fixtures — that's where ~90% of bugs live.

**Minimal viable v1 tooling:** WXT + Vitest(+fake-browser, happy-dom) + JSDoc
checkJs + ESLint(no-unsanitized) + Prettier + `web-ext lint` on the build + a
small CI (tsc, eslint, prettier, vitest, `wxt build -b firefox`, `web-ext lint`,
upload artifact). Everything else (Chrome target, automated E2E, full TS
migration) is nice-to-have later.

---

## 4. Engineering correctness — the plan's code

All items below were verified by extracting and running the snippets, not by
trusting the plan's "Expected: PASS."

### C-8. `normalizeSettings` is built but never used; defaults are duplicated and divergent (corrected in plan)

`options.js` (Task 2) re-declares its own `DEFAULT_SETTINGS` (omitting
`autoplay`) and reads/writes `storage.local` **without ever calling
`normalizeSettings` or importing `shared/settings.js`**. The entire Task-3
validation module — a full TDD task — has **zero runtime consumers**, defaults
have two sources of truth that will drift, stored settings are never validated
before use (violating the best-practices "validate stored settings before use"
rule), and `autoplay` can never round-trip through the options UI.

**Fix:** delete the inline object; import and run loads through
`normalizeSettings`; add a `getSettings()` helper in `settings.js` that wraps
`storage.local.get` + `normalizeSettings` so all consumers share one path.

### C-9. browserAction click throws on every non-`old.reddit.com` tab

The toolbar button is global; `tabs.sendMessage` to a tab with no content script
rejects ("Could not establish connection"). The `async` listener has no
`try/catch` → unhandled rejection, no user feedback. (Also fires on
`www.reddit.com`, which has the host permission but no content script — see
H-10.)

**Fix:** wrap in `try/catch`; surface "open an old.reddit.com listing first"
(or open one); consider gating the action by tab host.

### H-10. `www.reddit.com` host permission with no content script — internal inconsistency

`www.reddit.com/*` is granted as a host permission and accepted by
`SUPPORTED_HOSTS`, but no content script matches it (and bare `reddit.com` is in
neither manifest list). Either the permission is unused (AMO reviewers will ask)
or the content-script match is missing.

**Fix:** decide scope. Old-Reddit-only for v1 → drop `www.reddit.com` from
permissions and `SUPPORTED_HOSTS` (per ADR 0004). Otherwise add it to
`content_scripts.matches`. Align `SUPPORTED_HOSTS` with the manifest.

### H-11. `filenameHint` throws on posts with no `title` (corrected in plan)

`post.title.toLowerCase()` throws `TypeError` when `title` is absent, and
`slidesFromPost` has no guard, so **one untitled post kills the entire listing
parse** → zero slides. **Fix:** `(post.title ?? "")`, with a `${post.name}.${ext}`
fallback.

### H-12. Unicode titles produce empty, collision-prone slugs

`replace(/[^a-z0-9]+/g, "-")` turns any non-ASCII title (common on Reddit) into
`t3_<id>-.ext`. **Fix:** unicode-aware regex (`/[^\p{L}\p{N}]+/gu`) or normalize
NFKD; fall back to post id when the slug is empty.

### H-13. Silent post-dropping with no telemetry breaks the pagination trigger

Non-image posts vanish via `flatMap(() => [])` with no count/log. If a page of
25 posts yields 2 slides, a "trigger pagination before the queue empties" rule
fires constantly — back-to-back page fetches, contradicting "one request at a
time / feel like a human." **Fix:** track *posts consumed* (and the listing
cursor) independently of *slides emitted*; rate-limit pagination on posts
scanned; add a debug log for skipped posts. (This also overlaps the product
"filtering is core" finding, P-2.)

### M-14. `quality: "original"` while dimensions come from the preview source

For the i.redd.it case, `mediaUrl` is the original asset but `mediaWidth/Height`
come from `preview.images[0].source` — preview-pipeline dims, which don't always
equal the original. Labeling the slide `original` while reporting preview dims is
incoherent metadata. **Fix:** make provenance explicit (e.g. `sourceWidth` vs
`previewWidth`) or document the dims as "best-known preview-source dimensions."

### M-15. Preview-vs-original keyed on `hostname === "i.redd.it"` is too narrow, and the preview case is untested

`external-preview.redd.it`, query-bearing i.redd.it, and `.gifv` aren't handled
coherently, and the gamma ("preview only") test asserts via `toMatchObject`
**without asserting `mediaUrl`** — so the plan never verifies the preview URL is
what's emitted. **Fix:** add `mediaUrl`/`sourceUrl` assertions; decide explicit
handling for each host shape with fixtures.

### L-16. Dead code: `replace("/.json", "/.json")` (corrected in plan)

Replaces a substring with itself — a guaranteed no-op in 100% of inputs. The
whole `.json` block is convoluted (append `/`, conditionally append `.json`,
regex-strip the slash). **Fix:** delete the no-op; simplify to "strip trailing
slash, append `.json` if absent."

### L-17. URL converter accepts permalinks that yield the wrong JSON shape

`toListingJsonUrl` happily appends `.json` to `/comments/<id>/...` permalinks,
which return a comment-thread shape (`[Listing, Listing]`), not a listing — and
`slidesFromListing` expects `data.children`. **Fix:** reject (or explicitly
support) `/comments/` permalinks; document that the converter assumes a listing
context. Add table-driven tests (already-`.json`, no-trailing-slash, permalink,
www host, bare host).

### Verified correct (not assumed)

- All three `toListingJsonUrl` happy-path tests pass, **including query-param
  order** (`?raw_json=1&after=...` and `?t=week&raw_json=1` — `URLSearchParams`
  preserves insertion order).
- The Firefox `runtime.onMessage` return convention (return `undefined` = not
  handled; return a `Promise` = async response) is implemented correctly. Keep
  it; add a one-line comment, and reconcile the message vocabulary
  (`slideshow.*` in the plan vs `queue.*` in the best-practices doc — pick one).

### N-18. State-model gap: DOM-seed vs JSON first page will double-show posts

The architecture says "seed queue from DOM" *and* "durable source of truth is
listing JSON," but nothing describes **dedup** — the first JSON page *is* the
visible DOM page (the fixtures even share `t3_alpha`/`t3_beta`). **Fix:** dedup
by `postId`; treat DOM-seed as *context detection only*, JSON as the
authoritative ordered source.

---

## 5. Product

### P-1. Sequence validates the safe parts first; spike the risks first

The first slice is npm scaffold + URL converter + direct-image normalization
against **hand-authored offline fixtures** — zero live network, zero Redgifs,
zero UI. You can finish it green and still know nothing about whether the
product is feasible or pleasant. **Recommendation:** before more foundation
work, run time-boxed spikes against **live** Firefox + real Reddit with a go/no-go
each:

1. **Reddit listing access** without OAuth via the existing session, paginated,
   at realistic volume — does it survive rate limits / ToS? (highest risk)
2. **Redgifs native playback** on a 50-post sample, with the pass bar defined up
   front.
3. **v.redd.it video** (incl. the separate audio track) inside an overlay.
4. **RES keyboard/DOM conflict** with the prototype overlay on a real page.
5. **Field-shape reality check** against *captured* fixtures, not invented ones.

The fixtures remain valuable for unit tests — but *after* the spikes.

### P-2. Filtering is core, not an "open question"

A linear auto-advancing slideshow that lands on a text post, an outbound link, a
stickied announcement, or a promoted/ad post breaks the lean-back illusion —
worse than no slideshow. "Skip anything that isn't renderable media" is not a
preference; it's the **definition of the queue**. **Recommendation:** promote
"queue contains only renderable media; everything else is dropped (not shown as
a placeholder); stickied + promoted excluded by default" to non-negotiable v1
behavior. Placeholder slides become the rare fallback for a *resolution failure*,
not the routine outcome for half the feed.

### P-3. NSFW needs a deliberate default now

For a Reddit *media* slideshow, NSFW is a defining content axis, not an edge
case, and it interacts with autoplay. **Recommendation:** default to **respect
the signed-in account's existing visibility** (least surprising; avoids the
extension becoming an NSFW-unlocking tool), with a single toggle "Include NSFW:
follow Reddit / always hide." `over_18` is already captured — this is a product
decision, not a technical one.

### P-4. Orientation/loading/end-of-queue UX is unspecified

In a paginating, effectively-infinite queue there's no spec for a position
indicator, a loading state during page fetch, or a distinct end-of-queue screen
— the user can't tell "end" from "stalled fetch." There's also real tension
between "use full-res 4K" and "don't prefetch indefinitely." **Recommendation:**
bounded preload window (1–2 ahead) + a per-slide loading indicator so
not-yet-ready images read as loading, not stutter; add a progress affordance and
an intentional end-of-queue state.

### P-5. Acceptance criteria are a feature checklist, not outcome measures

"Galleries expand," "arrow nav works," "settings persist" don't say whether the
thing is *good*. For a lean-back tool, quality is the point and is measurable.
**Recommendation:** add outcome criteria with numbers — time-to-first-slide,
fraction of feed posts that render vs fall back, smoothness between slides,
whether a 4K image is ready before its slide appears.

### P-6. Build-vs-reuse (RedditP) is under-argued

The "build standalone, don't fork" conclusion is reached by elimination without
the one step that would settle it: reading RedditP's (MIT) source to gauge how
portable its queue/keyboard/timer/resolver core is — and that review is listed
as *follow-up*, so the decision precedes its evidence. The proposed
differentiator ("overlay on the current page, using the session") is a real
ergonomic but a thinner moat than claimed; the genuinely hard work (reliable
resolver for galleries/video/Redgifs + a smooth engine) is exactly what RedditP
already attempted. **Recommendation:** spend half a day reading RedditP's source
first. Building from scratch is the right call only if (a) RedditP's resolver is
weak on modern galleries/video/Redgifs *and* isn't cleanly portable, or (b) the
spikes show session/current-page access reaches content RedditP can't (NSFW /
private / quarantined). For a personal/open-source tool the from-scratch build
is *defensible as a learning/control exercise* — but the docs should say that
out loud rather than frame the overlay as a strategic moat.

---

## Suggested MVP cut (tighter than current v1)

**In:** launch overlay from current old-Reddit listing; queue of **Reddit images
+ galleries** only (highest volume, lowest risk); **media-only queue** (drop
non-media/stickied/promoted); keyboard nav + autoplay timer (3/5/10s) surviving
manual nav; **one** page of live pagination end-to-end; settings persistence;
NSFW = follow session; loading + progress + end-of-queue states; RES coexistence.

**Out (defer):** Redgifs (gated on spike); v.redd.it video (DASH+audio is
non-trivial); custom timers + audio-persistence (no video → no audio surface);
special pages/multireddits; downloads, pan/zoom, hi-res inspection; cross-browser;
settings sync.

---

## Prioritized action list

1. **C-7 / C-8 / C-3** — fix the foundation blockers: add a bundler (WXT), wire
   `options.js` to the shared settings module, correct the v.redd.it audio model.
2. **C-1 / M-2** — resolve the MV2-vs-MV3 decision (with corrected reasoning) and
   bump tooling versions; capture in an ADR.
3. **H-4 / H-5** — add a documented Reddit ToS posture; reframe Redgifs as
   spike-gated.
4. **P-1 / P-2 / P-3** — run live spikes before more foundation; make filtering
   core; set the NSFW default.
5. **H-11 / H-12 / H-13 / H-10** — fix the code bugs (title NPE, unicode slug,
   silent drop telemetry, www host inconsistency).
6. **M-6 / M-14 / M-15 / L-16 / L-17 / N-18** — field-handling gaps, metadata
   coherence, dead code, permalink guard, dedup.
7. **P-4 / P-5 / P-6** — orientation UX, outcome-based acceptance criteria,
   RedditP source review before committing to the from-scratch build.

## What was corrected in the existing docs as part of this audit

See the companion commits / edits to: `product/reddit-slideshow-product-spec.md`,
`research/extension-development-best-practices.md`, `research/initial-research.md`,
`adr/0003-paginate-current-reddit-listing.md`, and
`superpowers/plans/2026-05-29-foundation-and-fixtures.md`. Each correction points
back to the finding here for the full reasoning and citations.
