# ADR 0011: Imgur `.gifv` As Native Video

Date: 2026-05-31
Status: Accepted

## Context

Imgur links arrive in Reddit listings as `https://i.imgur.com/<id>.gifv` (a
silent, looping clip). A `.gifv` is not directly renderable as an `<img>`, but
Imgur serves the same clip as an `.mp4` at the same id (`/<id>.mp4`). Direct
`i.imgur.com` images already play via the generic image path (ADR 0002); only
`.gifv` needs handling.

## Decision

Detect `*.imgur.com/<id>.gifv` posts in the `lib/slides.js` provider dispatch and
emit a single **looping native-video** slide whose `mediaUrl` is the transformed
`https://i.imgur.com/<id>.mp4`. The transform is a pure URL rewrite - no network
resolve, so no provider resolver module is needed (unlike Redgifs, ADR 0016).

The slide is `kind: "video"`, `isGif: true` (silent loop), and
`durationMode: "media"` - so it advances on the controller's media safety-net
timer (`imageTimerSeconds + 2s`) while looping, matching reddit-hosted GIFs.

It plays **directly**: the mp4 is set as a `<video src>` on the Reddit page
(`i.imgur.com` is a `DIRECT_VIDEO_HOST`), which serves it to a reddit referer. On
a page whose CSP blocks cross-origin media (`www.reddit`), the direct load fails
and the slide falls back to `proxied` - the background fetches the bytes (no
`Referer`) and the content script plays them as a `blob:` URL the CSP allows
(the direct-with-CSP-fallback pattern shared with Redgifs/Streamable/Giphy).

Add `https://i.imgur.com/*` to install-time `host_permissions` (the proxy-
fallback fetch needs it; direct `<video>` playback is a page subresource and does
not) and to `PROXY_MEDIA_HOSTS` in the background router, so that fallback fetch
is host-gated to Imgur independent of granted permissions.

## Consequences

Benefits:

- Imgur `.gifv` clips play inline as correctly-timed, looping video.
- Reuses the shared direct-with-CSP-fallback playback path; no new message types.

Costs:

- One more install-time host (`i.imgur.com`). Justify it in the store listing's
  permission rationale alongside the Redgifs hosts (ADR 0004 follow-up).
- Imgur **albums/galleries** (`imgur.com/a/…`, `/gallery/…`) are a separate,
  1→N async resolve and are not covered here.

## Implementation Guidance

- Keep the `.gifv` → `.mp4` transform a pure function of the URL (`imgurGifvId`).
- Fail closed: a `.gifv` URL with no extractable id yields no slide (the post is
  skipped), never a broken video.
