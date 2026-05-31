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

Mirror the Redgifs native-video flow (ADR 0010):

- `lib/slides.js` detects `*.streamable.com/<id>` posts and emits a renderable
  iframe-embed slide (`streamable.com/e/<id>`) as a fallback.
- A background resolver (`lib/streamable.js`) resolves the mp4 from the API and
  upgrades the embed to a **proxied native-video** slide (the background fetches
  the bytes - no reddit `Referer` - and plays them as a `blob:`). Resolution
  failures keep the iframe embed.
- The resolver validates the API-returned mp4 host (`*.streamable.com`) before
  trusting it; the background fetch allowlist enforces it again.

**Host matching by suffix.** Because the CDN subdomain varies, the background
proxy-fetch allowlist gains a domain-**suffix** rule (`.streamable.com`) in
addition to the exact-host set. The leading dot is required so a look-alike host
(`evilstreamable.com`) cannot match. Install-time `host_permissions` gain a
single `https://*.streamable.com/*` entry covering both the API and the CDN
subdomains, scoped to the `streamable.com` domain (no all-URLs - ADR 0004).

`streamable.com` is added to the iframe-embed host allowlist
(`EMBED_HOSTS`) for the fallback.

## Consequences

Benefits:

- Streamable clips play inline as correctly-timed native video, with an iframe
  fallback when the API is unavailable.
- The suffix-matching primitive generalizes to other CDN-subdomain providers.

Costs:

- A wildcard-subdomain host permission is broader than an exact host, though
  still scoped to one domain. Justify it in the store listing's permission
  rationale (ADR 0004 follow-up).
- The iframe fallback, like Redgifs, only loads where the page CSP permits
  (CSP-less old.reddit; blocked by www.reddit's `frame-src`). The primary
  native-video path is unaffected.

## Implementation Guidance

- Keep suffix entries dot-prefixed; never allow a bare brand suffix.
- The resolver is concurrency-limited and timed out (shared `lib/async-pool.js`),
  so one slow lookup can't hold up a page.
