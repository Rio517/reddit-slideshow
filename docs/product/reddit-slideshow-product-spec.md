# Reddit Slideshow Product Spec Draft

Date: 2026-05-29
Status: Draft

## Problem

Old Reddit is efficient for browsing, but media-heavy feeds still require opening posts, galleries, image URLs, and external media sites one at a time. The desired extension should turn the current old Reddit feed into a full-screen slideshow that uses the signed-in Reddit session already present in Firefox.

## Primary User

A Firefox user who browses `old.reddit.com`, uses Reddit Enhancement Suite, and wants a lightweight slideshow over the current feed or subreddit without leaving old Reddit.

## Goals

- Start a slideshow from the current old Reddit listing page.
- Walk through media posts in Reddit order.
- Support direct Reddit images, Reddit galleries, Reddit-hosted videos/GIF-like media, and Redgifs as a first-class external provider.
- Fetch additional listing pages automatically so the slideshow can continue beyond the currently visible page.
- Use full-resolution media where practical, preferring `i.redd.it` assets over lower-resolution preview URLs.
- Provide keyboard navigation with left/right arrows.
- Advance images on a configurable timer such as 3, 5, or 10 seconds.
- Continue automatic advancement after manual arrow-key navigation.
- Let video/GIF-like media advance when playback completes.
- Provide a persisted muted/audio behavior setting for video providers.
- Coexist with Reddit Enhancement Suite.

## Non-Goals For Version 1

- Replacing or modifying RES itself.
- Supporting every external media host.
- Requiring Reddit API app credentials.
- Rebuilding Reddit browsing, voting, commenting, or moderation workflows.
- Syncing settings across browsers unless it comes nearly free through WebExtension storage.

## Core Experience

The extension adds a browser action and/or lightweight old Reddit page control to start the slideshow from the current feed. When launched, it opens a full-window overlay on top of old Reddit.

The overlay shows one media item at a time. Left and right arrow keys move backward and forward through the queue. The image timer remains active even when the user manually advances, so pressing right does not pause the slideshow. For videos and animated clips, completion advances to the next item when reliable playback events are available.

The overlay should expose minimal controls: close, previous, next, play/pause slideshow, timer choice, mute/unmute, and source/open-original. Settings should avoid covering the media.

## Queue Behavior

The queue begins from the current old Reddit context: front page, subreddit, multireddit, search, or other listing-like page where feasible. The first queue can be seeded from the DOM, but the durable source of truth should be Reddit listing JSON for pagination.

When the queue nears the end, the extension fetches the next listing page using Reddit listing pagination and appends supported media in the same order Reddit returns it.

If a post has multiple media items, such as a Reddit gallery, each media item becomes its own slide while preserving the post-level context.

## Media Support

### Reddit-hosted images

Direct image posts should resolve to full-size `i.redd.it` URLs when available. Preview URLs should be fallback only.

### Reddit galleries

Gallery posts should resolve through Reddit listing data, using gallery item order and media metadata to derive full-resolution image URLs.

### Reddit-hosted videos and GIF-like media

Reddit-hosted videos should use playable video URLs from listing media metadata when available. Playback completion should advance the slideshow.

### Redgifs

Redgifs is a first-class provider. The extension should attempt native playback when a direct playable media URL can be resolved. Because Redgifs access may be restricted or unstable, unsupported or blocked Redgifs items should degrade gracefully to a placeholder slide with title/source context and an action to open the original Redgifs page.

### Other hosts

Other external hosts are out of v1 unless they are simple direct media links. The provider system should make later additions straightforward.

## Settings

- Image timer: 3 seconds, 5 seconds, 10 seconds, and custom.
- Start muted: on/off.
- Autoplay slideshow: on/off.
- Provider permissions: Redgifs should be requested only if needed or clearly disclosed.

## Permissions

The extension needs access to old Reddit pages, Reddit JSON/media hosts, and selected external providers. Preferred first pass:

- `old.reddit.com`
- `www.reddit.com`
- `i.redd.it`
- `v.redd.it`
- `redgifs.com`
- `www.redgifs.com`

External provider permissions may be optional if the implementation can keep install-time permissions narrower.

## Error Handling

- Unsupported media: show a placeholder slide with source/open-original action.
- Provider blocked or failed: show a recoverable error for that slide, then continue.
- Pagination exhausted: stop at the end and show an end state.
- Reddit request rate-limited or failed: retry conservatively, then pause pagination with a visible message.
- Autoplay blocked: show a play button and keep navigation available.

## Accessibility And Controls

- Left arrow: previous slide.
- Right arrow: next slide.
- Escape: close slideshow.
- Space: pause/resume timer or video playback.
- Controls must be keyboard accessible.
- Overlay should avoid trapping the user without an obvious close path.

## Compatibility

Primary target is Firefox on desktop. The extension should coexist with Reddit Enhancement Suite by using isolated content scripts, avoiding global page mutations where possible, and namespacing injected DOM/classes.

## Open Questions

- Should v1 include all media posts, or allow filters such as images only, videos only, NSFW include/exclude, and external hosts include/exclude?
- Should NSFW behavior follow Reddit visibility exactly, or add an extension-level toggle?
- Should the queue include posts that RES has hidden or filtered on the current page?
- Should the extension start from only the visible sort/filter state, or support special pages like saved, user profiles, and search in v1?
- How much Redgifs native playback is possible in Firefox without relying on brittle private APIs?

## Acceptance Criteria Draft

- From an old Reddit subreddit listing, the user can launch a full-screen slideshow.
- Direct `i.redd.it` image posts display as full-resolution slides.
- Reddit galleries are expanded into sequential slides.
- Right and left arrow navigation works.
- Image slides advance using the selected timer.
- Manual navigation does not disable the running slideshow timer.
- Reddit-hosted video/GIF-like media advances when playback ends.
- The queue fetches at least one additional Reddit listing page when nearing the end.
- Redgifs links either play natively or show a graceful fallback with an open-original action.
- Settings persist between sessions.
