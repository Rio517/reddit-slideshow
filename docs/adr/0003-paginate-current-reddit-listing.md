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

## Follow-Up

Implementation should include saved JSON fixtures for front page, subreddit, gallery, video, and Redgifs examples. Pagination behavior should be tested with `after` tokens and with end-of-list/error responses.
