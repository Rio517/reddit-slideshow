# ADR 0017: Download the current media

Date: 2026-06-02
Status: Accepted

## Context

The overlay shows the current slide's media but offered no way to save it. A
"download this" control is a common request for a media viewer. The media is
cross-origin (CDN images, `v.redd.it`/provider mp4s), and some hosts
hotlink-protect by `Referer` (Redgifs), so a plain `<a download>` from the
content script is unreliable: the `download` attribute is ignored for
cross-origin URLs (the browser navigates instead), and a fetch from the page
carries the reddit `Referer`.

## Decision

Add an in-overlay **download control** (a button on the control rail) that saves
the current slide's media via the **`downloads` API**, driven from the
background:

- The content script sends `slideshow.download { url, filename }`; the background
  router validates it (own content-script sender, HTTPS URL, filename present)
  and calls `browser.downloads.download({ url, filename, saveAs: false })`.
- The background download fetches the file itself, so it carries no reddit
  `Referer` and a hotlink-protected CDN serves it - the same reason the blob
  proxy works for playback.
- The suggested filename is the slide's existing `filenameHint` (post id + title
  slug + extension); the router reduces it to a basename as defense-in-depth so a
  crafted hint can't escape the download directory.
- Only `image`/`video` slides have a concrete file to save; for an unresolved
  provider **embed** (an iframe with no media file) the control is disabled and
  the session no-ops.

This adds the install-time **`downloads`** permission. It is not host-scoped:
the download URL is whatever media the user is currently viewing, gated to HTTPS
(images legitimately come from arbitrary external CDNs).

## Consequences

Benefits:

- One-click save of the displayed media, with a meaningful filename, that works
  cross-origin and past CDN hotlink protection.
- The privileged path stays content-script-only and HTTPS-gated, fails closed,
  and reuses the existing message-router trust boundary.

Costs / risks:

- A new install-time permission (`downloads`) widens the prompt slightly.
- Whether a given hotlink-protected CDN serves a background download with no
  `Referer`, and how Firefox vs Chrome surface the save, needs a real logged-in
  browser to confirm (the offline gate can't exercise the downloads API).

## Implementation Guidance

- Keep the download gated to HTTPS and to `image`/`video` slides; never download
  an embed's iframe URL.
- Keep filename sanitization (basename only) in the background router, not just
  the content script.
- If a provider's direct download ever 403s despite the background `Referer`-less
  fetch, route those bytes through the existing blob proxy and download the blob.
