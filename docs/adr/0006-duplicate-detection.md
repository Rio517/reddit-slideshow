# ADR 0006: Detect and skip duplicate media in the slideshow queue

Date: 2026-05-30
Status: Accepted (both layers implemented; Layer 2 is opt-in)

## Context

Real Reddit feeds repeat the same media often: the same image reposted to many
subreddits, crossposts (which already resolve to the same parent media), the
same gallery surfaced again on a later page, and re-uploads of a popular image
at different sizes or re-encodings. In a lean-back auto-advancing slideshow,
landing on the same picture repeatedly is jarring, so the queue should skip
media it has already shown.

Prior art: **Reddit Deduplicator** (`nickgaya/rededup`) hides duplicate posts on
old Reddit by grouping posts that share a URL **or** a similar thumbnail. For
thumbnails it computes a 64-bit perceptual hash (it ships difference-, DCT-, and
wavelet-hash variants) and groups hashes within a small Hamming distance using a
BK-tree. That extension operates on the rendered feed; this extension dedups its
own slideshow queue, which spans multiple fetched listing pages and crosspost
parents the feed extension may never have grouped. The two are complementary.

Two platform constraints shape the design:

1. **Firefox MV3 content scripts are subject to the host page's CORS** (since
   Firefox 101), not the extension's `host_permissions`. Privileged cross-origin
   requests must be made from the background script.
2. **Cross-origin `<canvas>` reads taint the canvas.** Reading pixels from a
   displayed `i.redd.it`/`preview.redd.it` image requires either CORS-enabled
   images (uncertain for Reddit CDNs) or fetching the bytes ourselves and
   decoding via `createImageBitmap`, which is not origin-tainted.

## Decision

Add duplicate detection in two layers, gated by a single "Hide duplicates"
setting (default on). Detection state is **session-scoped** - it resets each
time a slideshow starts and is never persisted (no new storage, no tracking).

### Layer 1 - identity key (always available, no permissions)

Derive a stable key per slide and drop slides whose key was already enqueued:

- `i.redd.it` / `preview.redd.it` images → the media id (path basename without
  extension), so the same upload dedups across hosts and preview sizes.
- `v.redd.it` video → the `v.redd.it` id.
- Redgifs → the id parsed from the watch/`ifr` URL.
- otherwise → the URL pathname.

This is synchronous, runs in the queue alongside the NSFW filter, and catches
exact reposts, crossposts, repeated galleries, and preview-vs-original of the
same post. It covers the large majority of real duplicates at zero cost.

### Layer 2 - perceptual hash for images (optional, staged)

To also catch re-uploads and resizes (different ids, visually identical),
compute a **64-bit difference hash (dHash)**: downscale to 9×8 grayscale,
compare horizontally adjacent pixels, emit one bit per comparison. Treat a new
image as a duplicate when its Hamming distance to any seen hash is within a
small threshold (default 5 bits). A linear scan over the session's hashes is
fine at slideshow scale (hundreds of images); a BK-tree is a later optimization,
not a v1 need.

dHash is chosen over a cryptographic hash (e.g. SHA-256): a byte hash only
matches identical files, so it misses the resized/re-encoded reposts that are
the whole point. dHash is also cheaper and simpler than DCT/wavelet hashing and
is sufficient here.

Because of the CORS/canvas constraints above, Layer 2 obtains pixels by having
the **background** script fetch the image bytes (privileged) and returning an
`ArrayBuffer`; the content script decodes it with `createImageBitmap` and draws
to a 9×8 `OffscreenCanvas` to read luminance. That requires host permissions for
the image hosts (`i.redd.it`, `preview.redd.it`). To keep install-time
permissions minimal (ADR 0004), Layer 2 is **opt-in** and requests
`preview.redd.it` (and uses the existing `i.redd.it`) via
`optional_host_permissions` only when the user enables aggressive de-duplication.
Videos are deduped by Layer 1 only; hashing video frames is out of scope.

## Consequences

Benefits:

- Layer 1 ships immediately, removes most repeats, and needs no new permissions
  or async work.
- The pure hashing core (`differenceHash`, `hammingDistance`, key derivation,
  the tracker) is unit-testable without a browser.
- Session-only state keeps the feature private and storage-free.

Costs / risks:

- Layer 2's pixel access depends on background-routed fetching and an added
  (optional) `preview.redd.it` permission; it is staged behind a user opt-in and
  needs Firefox verification before being treated as settled.
- dHash yields occasional false positives (distinct images within the threshold)
  and false negatives (crops, heavy edits). The threshold is conservative and
  the cost of a rare wrongly-skipped slide is low for a lean-back tool.
- Linear-scan matching is O(n) per image; acceptable for a session, revisit with
  a BK-tree only if sessions grow very large.

## Alternatives Considered

- **SHA-256 of image bytes (as first sketched):** trivial but only catches
  byte-identical files, missing resized/re-encoded reposts. Rejected as the
  primary mechanism; Layer 1 already covers identical re-serving by id.
- **URL-only dedup (Layer 1 alone):** simplest and permission-free, but misses
  re-uploads with new ids. Kept as the always-on base; Layer 2 extends it.
- **BK-tree from the start (as rededup uses):** worth it for large feed-wide
  hashing, unnecessary for a single session's queue. Deferred.
- **Hashing the displayed `<img>` via canvas with `crossOrigin="anonymous"`:**
  would break image display whenever the CDN omits CORS. Rejected in favor of
  background-fetched bytes.

## Follow-Up

- Confirm `preview.redd.it`/`i.redd.it` allow background fetches and that
  `createImageBitmap` → `OffscreenCanvas` reads succeed under Firefox MV3.
- Tune the default Hamming threshold against real reposts.
- Consider hashing during preload so a duplicate is skipped before it is shown.
