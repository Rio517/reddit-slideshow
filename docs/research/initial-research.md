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

Rate limits: free-tier OAuth is **100 queries/min** (≈10-minute averaging window); unauthenticated *API* requests are rejected. The session-cookie `.json` website path used here is a different surface that works while logged in, but `X-Ratelimit-*` headers are often absent on it, so `403`/`429` must also drive backoff. Always request with `raw_json=1` — without it, `preview` and `media_metadata` URLs come back HTML-entity-encoded (`&amp;`).

Source:

- Reddit API listings documentation: https://www.reddit.com/dev/api/

## Old Reddit And JSON

Old Reddit listing pages can generally be represented as JSON by requesting the corresponding listing URL as JSON. For this extension, the current page context should be converted into a listing JSON request while preserving subreddit, sort, and query parameters.

Risk: Reddit has changed API and legacy surface behavior over time. The extension should avoid requiring OAuth app credentials for v1 and should be conservative with request volume.

## Media Fields To Investigate In Real Fixtures

Likely useful Reddit listing fields:

- `url_overridden_by_dest` for direct outbound/media URLs.
- `preview` for fallback thumbnails/previews.
- `gallery_data` for Reddit gallery item order.
- `media_metadata` for gallery asset metadata.
- `secure_media.reddit_video.fallback_url` for Reddit-hosted video playback.
- `is_video`, `post_hint`, `domain`, `permalink`, `title`, and `over_18` for classification and display context.

These field names need to be confirmed against saved real-world JSON fixtures during implementation.

## Reddit Enhancement Suite

Reddit Enhancement Suite is open source and GPL-3.0 licensed. It supports Firefox and old Reddit, so it is relevant prior art and a possible future integration target. However, starting as a standalone extension is lower-risk because it avoids coupling the first prototype to RES architecture, review expectations, and release cadence.

Source:

- RES GitHub repository: https://github.com/honestbleeps/Reddit-Enhancement-Suite

## Redgifs

Redgifs is a first-class provider, embedded inline via the Redgifs first-party iframe (`https://www.redgifs.com/ifr/<id>`). The iframe is served by Redgifs, so its inner video is a same-origin request that carries the Origin/Referer Redgifs whitelists and avoids the cross-origin hotlink 403 that direct `.mp4` embedding hits. It needs no `redgifs.com` host permission. Because an iframe has no native `ended` event, Redgifs slides advance on a duration timer. Unresolvable or removed posts fall back to a slide with title/source context and an open-original action.

## Current Research Conclusions

- Build a standalone Firefox-first WebExtension first.
- Use content script overlay plus background-script fetching/provider resolution.
- Use Reddit listing JSON pagination to keep the queue going.
- Use provider adapters for Reddit-hosted images, Reddit galleries, Reddit-hosted videos, and Redgifs.
- Keep RES compatibility as a product constraint rather than making RES integration a v1 dependency.

## Open Research Tasks

- Capture real old Reddit listing JSON fixtures for direct images, Reddit galleries, Reddit videos, and Redgifs.
- Verify autoplay behavior for muted and unmuted video clips.
