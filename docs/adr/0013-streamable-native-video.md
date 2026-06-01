# ADR 0013: Streamable As Native Video

Date: 2026-05-31
Status: Accepted

## Context

Streamable links arrive in Reddit listings as a watch URL
(`https://streamable.com/<id>`). The listing JSON carries an oEmbed iframe and a
thumbnail but **not** the direct mp4. The mp4 must be resolved from Streamable's
public API (`https://api.streamable.com/videos/<id>`, no key), which returns
`files.mp4.url` plus width/height/duration. That mp4 is served from a per-video
CDN **subdomain** that varies (`cdn-cf-east.streamable.com`, `cdn-b-east…`, …),
so a fixed exact-host allowlist can't cover it.

## Decision

Resolve the mp4 from the API, then play it as a **direct** native `<video>` -
_not_ a background blob proxy (the one place Streamable diverges from Redgifs):

- `lib/slides.js` detects `*.streamable.com/<id>` posts and emits a renderable
  iframe-embed slide (`streamable.com/e/<id>`) as a fallback.
- A background resolver (`lib/streamable.js`) resolves the mp4 (plus duration and
  dimensions) from the API and upgrades the embed to a native-video slide whose
  `mediaUrl` is the CDN mp4. The `<video>` loads that URL **directly** from the
  page. Resolution failures keep the iframe embed.
- The resolver validates the API-returned mp4 host (`*.streamable.com`) before
  trusting it; the render sink host-gates it again.

**Why direct, not proxied (Redgifs is proxied).** Redgifs' CDN 403s a reddit
`Referer`, so its bytes must be background-fetched and played as a `blob:`. The
Streamable CDN does **not** Referer-protect, so a direct `<video src>` plays
fine - and direct playback is strictly better here: it streams instead of fully
buffering to a blob, and it sidesteps **Chrome's Opaque Response Blocking**. The
Streamable CDN (CloudFront/S3) returns the mp4 with no CORS and no CORP headers;
in a Chrome MV3 service worker, ORB blocks reading that cross-origin `video/mp4`
body even with `host_permissions`, so the old proxied path failed on Chrome
(worked on Firefox, which has no ORB). Loading it in a media element avoids ORB
entirely.

**Host matching by suffix.** Because the CDN subdomain varies, the **direct-video
render allowlist** (`lib/overlay-render.js`) matches the mp4 host by domain
**suffix** (`.streamable.com`) in addition to its exact-host set. The leading dot
is required so a look-alike host (`evilstreamable.com`) cannot match. Install-time
`host_permissions` keep a single `https://*.streamable.com/*` entry - now only
needed for the background **API** resolve (`api.streamable.com`), scoped to the
`streamable.com` domain (no all-URLs - ADR 0004).

`streamable.com` is in the iframe-embed host allowlist (`EMBED_HOSTS`) for the
fallback.

## Consequences

Benefits:

- Streamable clips play inline as correctly-timed native video in **both**
  Firefox and Chrome (the proxied path was Chrome-broken by ORB), with an iframe
  fallback when the API is unavailable.
- Direct playback streams the mp4 instead of buffering it whole to a blob, and
  needs no background media-byte fetch for Streamable at all.
- The suffix-matching primitive generalizes to other CDN-subdomain providers.

Costs:

- A wildcard-subdomain host permission is broader than an exact host, though
  still scoped to one domain. Justify it in the store listing's permission
  rationale (ADR 0004 follow-up).
- A direct cross-origin `<video>` is subject to the **page** CSP: fine on
  CSP-less old.reddit, but www.reddit's `media-src` may block it (the proxied
  blob shared the same class of limitation). The iframe fallback, likewise, only
  loads where the page CSP permits.

## Implementation Guidance

- Keep suffix entries dot-prefixed; never allow a bare brand suffix.
- The resolver is concurrency-limited and timed out (shared `lib/async-pool.js`),
  so one slow lookup can't hold up a page.
