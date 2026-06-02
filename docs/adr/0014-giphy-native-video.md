# ADR 0014: Giphy Watch Pages As Native Video

Date: 2026-05-31
Status: Accepted

## Context

Giphy links arrive in two shapes:

1. **Direct media** - `media.giphy.com/media/<id>/giphy.gif`, `i.giphy.com/<id>.gif`.
   These already render as animated images via the generic image path (ADR 0002).
2. **Watch pages** - `giphy.com/gifs/<slug>-<id>` (also `/clips/`, `/embed/`,
   `/stickers/`). These carry no direct media URL, so the generic image path
   skips them and the post yields no slide without explicit handling.

Giphy exposes a canonical silent-looping mp4 for any id at
`media.giphy.com/media/<id>/giphy.mp4` - no API needed, just the id. The id is
the trailing alphanumeric token of the watch-page slug (Giphy ids contain no
hyphens). Giphy's media is served from rotating CDN subdomains
(`media.`, `media2.`, …).

## Decision

Detect **only** `giphy.com` watch-page posts (not the `media.`/`i.` CDN
subdomains, to avoid converting already-working gif images) with an extractable
id, and emit a single **looping native-video** slide whose `mediaUrl` is the
transformed `media.giphy.com/media/<id>/giphy.mp4`. A pure URL rewrite - no
resolver - mirroring the Imgur `.gifv` path (ADR 0011): `kind: "video"`,
`isGif: true`, `durationMode: "media"`.

Play it **directly** from Giphy's media CDN (a `DIRECT_VIDEO_HOST` suffix). On a
CSP-blocked page (`www.reddit`) the direct load falls back to a background-fetched
`blob:`, reusing the proxy allowlist's domain-**suffix** rule with `.giphy.com`
(ADR 0013) since the media subdomain varies. Add a single `https://*.giphy.com/*`
install-time host permission (needed for that CSP-fallback fetch; direct playback
is a page subresource and needs none).

## Consequences

Benefits:

- Giphy reaction/clip posts play as efficient, correctly-timed looping video.
- Reuses the shared direct-with-CSP-fallback path and suffix-matching primitive;
  no new resolver, message type, or queue change.

Costs:

- One more wildcard-subdomain host (`*.giphy.com`), scoped to one domain. Justify
  it in the store listing's permission rationale (ADR 0004 follow-up).
- Giphy `/clips/` can carry audio; v1 plays muted like all video, so this is no
  regression, but a future audio pass should revisit clips.

## Implementation Guidance

- Restrict detection to the exact `giphy.com` host so direct CDN gifs keep using
  the image path.
- Skip posts with no extractable id (fail closed - no slide rather than a bad
  mp4 URL).
