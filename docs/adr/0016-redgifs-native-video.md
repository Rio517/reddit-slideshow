# ADR 0016: Redgifs As Native Video

Date: 2026-06-02
Status: Accepted

## Context

Redgifs is the single most common media domain on real NSFW feeds, so it is a
first-class provider. Reddit surfaces a Redgifs post as a watch/iframe link
(`redgifs.com/watch/<id>`, `redgifs.com/ifr/<id>`) with no directly-playable
media URL. An iframe embed plays, but it can't be timed (no `duration`, no
`ended` event) or unmuted (cross-origin), so it doesn't integrate with the
slideshow's dwell, mute, or dedup.

Redgifs publishes the direct mp4 (plus `duration` and `hasAudio`) from a keyless
public API (`api.redgifs.com`, anonymous temporary token). The mp4 is served from
`media.redgifs.com`, whose CDN **403s a request carrying a reddit `Referer`**
(hotlink protection).

This was the first native-video provider; Imgur `.gifv` (ADR 0011), Catbox
(ADR 0012), Streamable (ADR 0013), and Giphy (ADR 0014) all followed the pattern
established here.

## Decision

Resolve every Redgifs embed to a native `<video>` slide in the background before
the content script sees the queue.

- **Resolve (`lib/redgifs.js`).** A background resolver parses the id, fetches an
  anonymous token from `api.redgifs.com` (cached, refreshed once on a 401), and
  reads the direct mp4 URL + `duration` + `hasAudio`. The returned host is
  re-validated to be exactly `media.redgifs.com` before it is trusted.
  Concurrency-limited and timed out via `lib/async-pool.js`.
- **Play directly.** The clip plays as a native `<video>` whose `src` is the
  `media.redgifs.com` mp4. Because that CDN 403s a reddit `Referer`, the element
  carries `referrerpolicy="no-referrer"` (set as an attribute - browsers honor it
  on media elements). This is the **only** host that needs the no-referrer treatment.
- **Blob proxy as the CSP fallback.** On a page whose CSP blocks cross-origin
  media (`www.reddit`, `media-src 'self' blob: *.redd.it`), the direct load fails;
  the slide then falls back to `proxied` - the background fetches the bytes (no
  `Referer`, no cookies, byte-capped) and the content script plays them as a
  `blob:` URL the CSP allows. `media.redgifs.com` is on `PROXY_MEDIA_HOSTS` for
  that host-gated fetch.
- **Iframe embed as the resolution-failure fallback.** If the API resolve fails
  entirely (down, timeout, malformed), the slide keeps the original Redgifs
  `/ifr/<id>` iframe embed, sandboxed (`allow-scripts allow-presentation`, no
  `allow-same-origin`).

Host permissions (ADR 0004): `api.redgifs.com` for the resolve and
`media.redgifs.com` for the proxy-fallback byte fetch. Direct `<video>` playback
of `media.redgifs.com` is a page subresource and needs no permission.

## Consequences

Benefits:

- Redgifs clips play as correctly-timed, native video that participates in dwell,
  mute, and the dedup pipeline - not an opaque iframe.
- Direct playback streams the mp4 (no whole-file blob) on `old.reddit`; the proxy
  is reserved for the `www.reddit` CSP case.

Costs / limits:

- Two Redgifs host permissions (`api.` + `media.`). Justified in the store
  listing's permission rationale.
- The `referrerpolicy="no-referrer"` is load-bearing for Redgifs specifically; it
  is scoped to that host so it can't silently change other providers' behavior.
- True audio is deferred: v1 plays the clip muted like all video.

## Implementation Guidance

- Re-validate the API-returned mp4 host (`media.redgifs.com`) before trusting it;
  fall back to the iframe embed on any resolve failure rather than a broken slide.
- Keep the no-referrer scoped to the Redgifs media host at the playback sink.
- Cache the anonymous token and refresh it once on a 401; the background holds no
  other Redgifs state (so a suspended Chrome service worker just re-fetches it).
