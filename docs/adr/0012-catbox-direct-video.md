# ADR 0012: Catbox Direct Video

Date: 2026-05-31
Status: Accepted

## Context

Catbox (`files.catbox.moe`) is a plain file host: it serves uploaded files
directly with no hotlink protection and no API. Reddit posts link straight to the
file, e.g. `https://files.catbox.moe/<id>.mp4`. Catbox **images** already render
via the generic image path (ADR 0002); only **video** files (`.mp4`, `.webm`,
`.mov`) needed handling, since the image path ignores non-image extensions.

## Decision

Detect `files.catbox.moe/<id>.{mp4,webm,mov}` posts in the `lib/slides.js`
dispatch and emit a single **direct** (non-proxied) native-video slide — the file
is loaded straight into a `<video>` on the page, like reddit-hosted `v.redd.it`
video. No background proxy and no `host_permission` are needed, because nothing is
extension-fetched: the bytes load as a page resource.

Add `files.catbox.moe` to the direct-video host allowlist (`VIDEO_HOSTS` in
`lib/overlay-render.js`), so the `<video src>` sink stays host/HTTPS-gated and
untrusted listing data can't point it at an arbitrary host.

The slide is `kind: "video"`, `durationMode: "media"`, `audioAvailable: true`
(catbox clips may have sound), and not looping.

## Consequences

Benefits:

- Catbox-hosted clips play inline with no new install-time permission.
- Simplest possible provider: detection + an allowlist entry, no resolver.

Costs:

- Direct cross-origin video is subject to the page CSP. It loads on CSP-less
  old.reddit; on www.reddit (whose logged-in CSP is `media-src *.redd.it`) it may
  be blocked — the same constraint that makes Redgifs/Imgur use the proxied path.
- The allowlist trusts `files.catbox.moe` as a video sink; this is exact-host,
  HTTPS-only, so the scope is narrow.

## Implementation Guidance

- Keep the sink gated to the exact host (`VIDEO_HOSTS`); never relax the direct-
  video allowlist to a suffix or wildcard.
- Treat only known video extensions as video; everything else falls through to
  the image path.
