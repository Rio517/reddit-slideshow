# Initial Research Notes

Date: 2026-05-29
Status: Draft

## Firefox WebExtension Model

Firefox WebExtensions support content scripts that run in web pages and can read/modify page content with standard Web APIs. Content scripts have limited direct extension API access, but they can message background scripts. MDN also notes that registered content scripts run only when host permissions are granted for the page origin.

Sources:

- MDN content scripts: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Content_scripts
- MDN permissions: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/permissions

## Firefox Development And Distribution

`web-ext` is Mozilla's standard command-line tool for running, linting, building, and signing WebExtensions. Temporary development installs are supported, but normal Firefox distribution requires signing through addons.mozilla.org, including self-distributed unlisted extensions.

Sources:

- Getting started with `web-ext`: https://extensionworkshop.com/documentation/develop/getting-started-with-web-ext/
- Signing and distribution overview: https://extensionworkshop.com/documentation/publish/signing-and-distribution-overview/

## Reddit Listing Pagination

Reddit listing endpoints use common `after`, `before`, `limit`, `count`, and `show` parameters. Reddit's documentation says listing responses contain `after` and `before` fields equivalent to old site's next/previous controls. This is the likely mechanism for keeping the slideshow queue going past the current page.

Rate limits: free-tier OAuth is **100 queries/min** (≈10-minute averaging window); unauthenticated _API_ requests are rejected. The session-cookie `.json` website path used here is a different surface that works while logged in, and `X-Ratelimit-*` headers (`remaining`/`used`/`reset`) are present on it, so `403`/`429` backoff can read them. Always request with `raw_json=1` — without it, `preview` and `media_metadata` URLs come back HTML-entity-encoded (`&amp;`).

Source:

- Reddit API listings documentation: https://www.reddit.com/dev/api/

## Old Reddit And JSON

Old Reddit listing pages can generally be represented as JSON by requesting the corresponding listing URL as JSON. For this extension, the current page context should be converted into a listing JSON request while preserving subreddit, sort, and query parameters.

Risk: Reddit has changed API and legacy surface behavior over time. The extension should avoid requiring OAuth app credentials for v1 and should be conservative with request volume.

Listing URLs are normalized to `.json?raw_json=1` with sort/query parameters
preserved; comment permalinks are rejected because they return a different JSON
shape; pagination appends `after=<fullname>`. This is covered by unit tests
against `lib/reddit-url.js`.

The extension fetches listings with `credentials: "include"` and
`accept: application/json` (`lib/reddit-listing.js`), reusing the browser's
existing Reddit login with no OAuth app credentials. The browser action asks the
content script for the current page URL; the background page fetches the
normalized JSON URL and renders a diagnostic summary.

Session-cookie access is validated against live Reddit. A logged-in Firefox
session reaches `old.reddit.com/.../.json?raw_json=1` and returns HTTP 200
`application/json`, including NSFW (`over_18`) posts that Reddit serves only to a
logged-in, NSFW-enabled account. Listings return 50 children per page with an
`after` cursor, and `X-Ratelimit-*` headers (`remaining`/`used`/`reset`) are
present on the cookie `.json` path, so 403/429 backoff can read them. What still
needs a manual check is the toolbar-triggered diagnostic in a real Firefox UI;
the validated request path was driven directly, not through the toolbar.

## Listing Media Shapes

These shapes are confirmed against real `raw_json=1` listings captured from a
logged-in session (front page plus several default subreddits). A census of
~450 sampled posts found direct images, galleries, Reddit-hosted video, and
Redgifs all common; crossposts were absent from the sample, so they are rare in
practice but still handled defensively.

- **Direct image** — `domain: i.redd.it`, `post_hint: "image"`, media in
  `url_overridden_by_dest` (or `url`); `preview.images[0].source` carries the
  original `width`/`height`. Normalized with `quality: "original"` for
  `i.redd.it` and `quality: "preview"` for `preview.redd.it` fallbacks.
  `sourceWidth`/`sourceHeight` come from `preview.images[0].source` — the
  best-known source metadata, not proof of the original file dimensions.
- **Gallery** — `is_gallery: true` (no `post_hint`); `gallery_data.items[]` gives
  ordered `{ media_id }`, and `media_metadata[media_id]` carries `m` (mime),
  `s.u` (full-resolution source URL, on `preview.redd.it`, signed with `s=`), and
  `p[]` (smaller previews). Each item becomes its own slide.
- **Reddit-hosted video** — `domain: v.redd.it`, `post_hint: "hosted:video"`,
  `is_video: true`; `secure_media.reddit_video` (mirrored in `media.reddit_video`)
  carries `fallback_url` (a `CMAF_*.mp4`), `dash_url`, `hls_url`, `duration`,
  `width`, `height`, `is_gif`, and `has_audio`. Audio availability is therefore
  known from the data; `fallback_url` is the plain-`<video>` (muted) path, while
  audio needs DASH/HLS.
- **Redgifs** — `domain: redgifs.com` (also `v3.redgifs.com`),
  `post_hint: "rich:video"`, `url`/`url_overridden_by_dest` is
  `https://www.redgifs.com/watch/<id>`. `secure_media.oembed` carries `width`,
  `height`, and `thumbnail_url`, so aspect ratio is available from the listing
  without calling `api.redgifs.com`.
- **Crosspost** — the outer post carries no own media; the original lives in
  `crosspost_parent_list[0]`, which is a full post object resolved with the same
  rules. Display context (permalink/title) comes from the outer post.

Direct-image normalization checks `url_overridden_by_dest` first and falls back
to `url`. Queue-page helpers count posts scanned separately from slides produced,
preserving the pagination rule needed for sparse media listings.

## Reddit Enhancement Suite

Reddit Enhancement Suite is open source and GPL-3.0 licensed. It supports Firefox and old Reddit, so it is relevant prior art and a possible future integration target. However, starting as a standalone extension is lower-risk because it avoids coupling the first prototype to RES architecture, review expectations, and release cadence.

Source:

- RES GitHub repository: https://github.com/honestbleeps/Reddit-Enhancement-Suite

## Redgifs

Redgifs is a first-class provider, and a large share of real feeds: it was the single most common media domain on the sampled NSFW front page. The approach is to embed it inline via the Redgifs first-party iframe (`https://www.redgifs.com/ifr/<id>`), parsing `<id>` from the `redgifs.com/watch/<id>` post URL. The iframe is served by Redgifs, so its inner video behaves as Redgifs' own player rather than as a hotlinked direct `.mp4`. Aspect ratio comes free from `secure_media.oembed.width`/`height` in the listing, so no `api.redgifs.com` call is needed. Because an iframe does not expose a native `<video>` `ended` event to the extension, Redgifs slides advance on a duration timer. Iframe playback inside the extension overlay in Firefox (and that it needs no `redgifs.com` host permission) still needs a live validation spike. Unresolvable or removed posts fall back to a slide with title/source context and an open-original action.

## Overlay Rendering

`old.reddit.com` sends **no Content-Security-Policy** (no response header and no
`<meta>` CSP). A content-script overlay can therefore load cross-origin media
directly in injected elements — `<img>` from `i.redd.it`/`preview.redd.it`,
`<video>` from `v.redd.it`, and the Redgifs `<iframe>` — with no host
permission and no CSP relaxation. This matches old Reddit/RES expandos, which
already embed these hosts inline. Actual playback (v.redd.it muted, Redgifs
iframe) still wants a live Firefox confirmation.

## Current Research Conclusions

- Build a standalone Firefox-first WebExtension first.
- Use content script overlay plus background-script fetching/provider resolution.
- Use Reddit listing JSON pagination to keep the queue going.
- Use provider adapters for Reddit-hosted images, Reddit galleries, Reddit-hosted videos, and Redgifs.
- Keep RES compatibility as a product constraint rather than making RES integration a v1 dependency.

## Open Research Tasks

- Capture a real crosspost fixture (`crosspost_parent_list[0]`); they were absent from ~450 sampled posts, so the current crosspost fixture is hand-authored from the known shape.
- Validate the in-extension listing diagnostic from the Firefox toolbar in the
  user's real Firefox profile. The cookie-backed `.json` request itself has now
  been validated; this remaining check is browser-action/UI integration.
- Confirm Redgifs iframe playback in Firefox without `redgifs.com` host permission.
- Verify autoplay behavior for muted and unmuted video clips.
- Confirm Firefox MV3 host permission behavior for `old.reddit.com` in a real
  profile, including what happens when the user revokes host access.
