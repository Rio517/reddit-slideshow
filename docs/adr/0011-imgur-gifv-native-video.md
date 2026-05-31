# ADR 0011: Imgur `.gifv` As Native Video

Date: 2026-05-31
Status: Accepted

## Context

Imgur links arrive in Reddit listings as `https://i.imgur.com/<id>.gifv` (a
silent, looping clip). A `.gifv` is not directly renderable as an `<img>`, but
Imgur serves the same clip as an `.mp4` at the same id (`/<id>.mp4`). Direct
`i.imgur.com` images already play via the generic image path (ADR 0002); only
`.gifv` needs handling.

Two ways to play the `.mp4`:

1. **Direct** - set it as a `<video src>` on the Reddit page. Imgur hotlink-
   protects against a non-Imgur `Referer` (it serves a placeholder for hotlinked
   media), so a clip embedded from a reddit page is unreliable.
2. **Proxied** - the background fetches the bytes (no reddit `Referer`) and the
   content script plays them as a `blob:` URL. This mirrors the Redgifs native-
   video path (ADR 0010) and is robust against the hotlink protection.

## Decision

Detect `*.imgur.com/<id>.gifv` posts in the `lib/slides.js` provider dispatch and
emit a single **proxied, looping video** slide whose `mediaUrl` is the
transformed `https://i.imgur.com/<id>.mp4`. The transform is a pure URL rewrite -
no network resolve, so no provider resolver module is needed (unlike Redgifs).

The slide is `kind: "video"`, `proxied: true`, `isGif: true` (silent loop), and
`durationMode: "media"` - so it advances on the controller's media safety-net
timer (`imageTimerSeconds + 2s`) while looping, matching reddit-hosted GIFs.

Add `https://i.imgur.com/*` to install-time `host_permissions` (the background
fetch needs it) and to `PROXY_MEDIA_HOSTS` in the background router, so the
privileged blob fetch is host-gated to Imgur, independent of granted permissions.

## Consequences

Benefits:

- Imgur `.gifv` clips play inline as correctly-timed, looping video.
- Reuses the existing proxied-blob playback path; no new message types.

Costs:

- One more install-time host (`i.imgur.com`). Justify it in the store listing's
  permission rationale alongside the Redgifs hosts (ADR 0004 follow-up).
- Imgur **albums/galleries** (`imgur.com/a/…`, `/gallery/…`) are a separate,
  1→N async resolve and are not covered here.

## Implementation Guidance

- Keep the `.gifv` → `.mp4` transform a pure function of the URL (`imgurGifvId`).
- Fail closed: a `.gifv` URL with no extractable id yields no slide (the post is
  skipped), never a broken video.
