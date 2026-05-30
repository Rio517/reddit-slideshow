# New Reddit and Chrome Feasibility

Date: 2026-05-30

Findings on (1) supporting the slideshow on new Reddit (`www.reddit.com`, the
shreddit redesign) instead of only `old.reddit.com`, and (2) shipping a Chrome
build. Both are feasible. The recommended new-Reddit approach decouples the UI
surface from the data source.

## New Reddit

### Chosen architecture: each frontend self-contained (ADR 0008)

The frontend the user is on and the data source are independent — cookies are
scoped to `.reddit.com`, so the background can fetch either host's `.json`. An
earlier idea was "render on new, fetch from old," but to avoid depending on old
Reddit surviving, **ADR 0008** instead has each frontend fetch **its own**
`.json` (old → old, www → www). The new-Reddit path never calls old Reddit. This
reuses the data layer (`reddit-url.js`, `reddit-listing.js`, `queue.js`,
`slides.js`), allowing the www host and resolving permalinks against the page
origin.

### Data layer — works

Logged in, both endpoints return identical listing JSON (HTTP 200,
`application/json`, same fields incl. `url_overridden_by_dest`, `preview`,
`secure_media`, `gallery_data`):

- `old.reddit.com/r/<sub>/.json?raw_json=1`
- `www.reddit.com/r/<sub>/.json?raw_json=1`

Logged **out**, `www.reddit.com/.json` returns HTTP 403 with the SPA HTML — but
the extension requires a logged-in session anyway, so this does not matter. A
www page fetches `www.reddit.com/.json`; an old page fetches `old.reddit.com/.json`.

### Rendering / CSP — works when logged in, but Reddit-controlled

Unlike `old.reddit.com` (which sends **no CSP**), `www.reddit.com` enforces a
Content-Security-Policy, and it differs by auth state:

- **Logged out (or bot-walled):** strict — `default-src 'none'; img-src https://www.redditstatic.com; ...`. This would block injected cross-origin media.
- **Logged in (the real app):** permissive for our media —
  - `img-src 'self' data: blob: https:` → i.redd.it / preview.redd.it images load.
  - `media-src 'self' blob: data: *.redd.it ...` → v.redd.it video loads.
  - `frame-src 'self' ... redgifs.com www.redgifs.com ...` → the Redgifs iframe loads.

So a logged-in overlay renders all current media kinds. The content script's own
JS runs in its isolated world regardless of `script-src`.

Risk: the CSP is Reddit's to change without notice, and it is stricter than
old Reddit's (none). If Reddit tightens it, the robust fallback is to render the
overlay inside an **extension-page iframe** (a `web_accessible_resource` on
`moz-extension://` / `chrome-extension://`), which carries the extension's own
CSP and is exempt from the host page's — the standard technique for overlays on
CSP-strict sites. That is more work than today's direct injection.

### DOM — needs new selectors (or skip for v1)

New Reddit renders posts as `shreddit-post` web components inside a
`shreddit-feed`, not `old`'s `div.thing[data-fullname]`, and some content lives
in shadow DOM. Two consequences:

- The "start from the post nearest the viewport" cursor (`lib/page-cursor.js` +
  the content-script DOM read) needs new-Reddit selectors to find post fullnames.
  For a first version this can be skipped — start the queue from the top of the
  current listing and paginate via JSON.
- RES is old-Reddit-only, so the RES keyboard/DOM coexistence concern does not
  apply on new Reddit (other extensions and Reddit's own SPA still do).

### Work to support new Reddit

- Add `www.reddit.com` (and likely `sh.reddit.com`) to content-script `matches`
  and `host_permissions`.
- In the background, convert the current page URL to an `old.reddit.com/.../.json`
  request (host swap + the existing `.json` normalization).
- New-Reddit start-cursor selectors (optional for v1).
- Verify overlay rendering and keyboard capture inside the shreddit SPA in a real
  logged-in Firefox/Chrome session.

## Chrome

Feasible with modest work; the core is already browser-agnostic (uses `browser.*`
via WXT, a fetch-based background, no Firefox-only runtime APIs).

- **Build:** WXT produces a Chrome MV3 build from the same source
  (`wxt build -b chrome`). Chrome uses a `service_worker` background; WXT converts
  the manifest automatically (our Firefox build uses an event page). The
  background is stateless message handlers + `fetch`, which run fine in a service
  worker.
- **Icons:** Chrome does **not** accept an SVG manifest icon (Firefox does), so a
  Chrome build needs rasterized PNG icons (16/32/48/128).
- **Manifest:** `browser_specific_settings.gecko` and
  `data_collection_permissions` are Firefox-only; WXT omits them for Chrome.
  `optional_host_permissions` is supported on both.
- **CORS difference (in our favor):** Chrome MV3 content scripts get privileged
  cross-origin fetch via `host_permissions`; Firefox MV3 does not (it subjects
  them to page CORS, which is why Layer 2 hashing routes through the background).
  The background-routed approach works on both, so no change is required — Chrome
  could later fetch directly if desired.
- **Session fetch:** a Chrome MV3 service worker `fetch(..., { credentials: "include" })`
  with `host_permissions` sends the user's Reddit cookies, same as Firefox.
- **Distribution:** Chrome Web Store (separate listing/review from AMO).

### Work to support Chrome

- Add PNG icons and a `chrome` build target.
- Smoke-test the service-worker background (message round-trips, the listing
  fetch, the Layer 2 image fetch).
- Note: old Reddit works in Chrome too, so a Chrome build can target
  `old.reddit.com` with no new-Reddit work required.

## Verdict

- **New Reddit:** feasible, and implemented per ADR 0008 — the content script
  runs on `www.reddit.com`, fetches its own `.json`, and resolves permalinks
  against the page origin (no old-Reddit dependency). The remaining real work is
  overlay/keyboard validation under the shreddit SPA and the (Reddit-controlled)
  CSP in a real logged-in session, plus the optional shreddit start cursor.
- **Chrome:** feasible with modest work — PNG icons, a `chrome` target, and
  service-worker smoke testing. Nothing in the architecture blocks it.
