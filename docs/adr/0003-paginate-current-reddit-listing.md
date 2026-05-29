# ADR 0003: Paginate The Current Reddit Listing

Date: 2026-05-29
Status: Proposed

## Context

The desired slideshow should continue beyond the currently visible old Reddit page. Reddit listings expose pagination through `after` and `before` fields, matching old Reddit's next and previous listing controls.

## Decision

Build the slideshow queue from the current listing context and continue loading additional listing pages using Reddit listing JSON pagination.

## Consequences

Benefits:

- Slideshow can continue through the feed without manual page navigation.
- Order can match Reddit's listing order.
- The extension can use the user's existing browser session/cookies where allowed.

Costs:

- Requires careful URL normalization from old Reddit HTML pages to JSON listing URLs.
- Needs request throttling and failure handling.
- Listings can shift while browsing because Reddit feeds are dynamic.

## Terms-of-Service Posture

The v1 approach is to fetch `old.reddit.com/.../.json` using the user's existing logged-in browser session (cookies), without OAuth app credentials. This is viable because Reddit's blocking targets datacenter-IP, unauthenticated, bot scrapers; logged-in browser access is accepted, and RES relies on the same mechanism. The fetch runs from the **background script** to carry session cookies reliably.

This carries modest but real ToS/AMO risk, so the extension adopts and documents an explicit posture:

- Acts only on behalf of the logged-in user, on data already visible to that user.
- Human-scale request rates: one pagination request at a time, only for the active queue, no indefinite prefetch.
- Stores nothing server-side; no bulk collection, no redistribution, no analytics.
- Degrades on `403`/`429` (and `X-Ratelimit-*` headers when present — note they are often **absent** on the cookie-session website path, so `403`/`429` must also drive backoff).
- Keeps the listing transport swappable (the ADR 0002 resolver layer) so optional per-user OAuth is an escape hatch if the cookie path is ever blocked. The extension must **not** ship app OAuth client credentials.
- Always sends `raw_json=1` (load-bearing invariant): without it, `preview` and `media_metadata` URLs are HTML-entity-encoded.

This posture both reduces real risk and is what an AMO reviewer needs to see.

## Follow-Up

Implementation should include saved JSON fixtures for front page, subreddit, gallery, video, and Redgifs examples — captured from real responses, not hand-authored, so field shapes (`gallery_data`, `media_metadata`, crosspost media in `crosspost_parent_list[0]`) match reality. Pagination behavior should be tested with `after` tokens and with end-of-list/error responses. Before building further, spike live Reddit access in Firefox to confirm the session-cookie path survives at slideshow-realistic volume.
