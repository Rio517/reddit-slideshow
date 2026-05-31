# Reddit Slideshow Spectacular! — Product Spec Draft

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
- Downloading/saving media from the slideshow.
- Advanced image inspection controls such as pan and zoom.
- Syncing settings across browsers unless it comes nearly free through WebExtension storage.

## Core Experience

The extension adds a browser action and/or lightweight old Reddit page control to start the slideshow from the current feed. When launched, it opens a full-window overlay on top of old Reddit.

The overlay shows one media item at a time. Left and right arrow keys move backward and forward through the queue. The image timer remains active even when the user manually advances, so pressing right does not pause the slideshow. For videos and animated clips, completion advances to the next item when reliable playback events are available.

The overlay should expose minimal controls: close, previous, next, play/pause slideshow, timer choice, mute/unmute, and source/open-original. Settings should avoid covering the media.

## Queue Behavior

The queue begins from the current old Reddit context: front page, subreddit, multireddit, search, or other listing-like page where feasible. The first queue can be seeded from the DOM, but the durable source of truth should be Reddit listing JSON for pagination.

When the queue nears the end, the extension fetches the next listing page using Reddit listing pagination and appends supported media in the same order Reddit returns it.

If a post has multiple media items, such as a Reddit gallery, each media item becomes its own slide while preserving the post-level context.

The queue is **media-only by definition.** Text/self posts, outbound article links, stickied/announcement posts, and promoted/ad posts are dropped from the queue, not shown as placeholder slides — a linear auto-advancing slideshow that lands on non-media breaks the lean-back experience. Placeholder slides are reserved for the rare case of a _resolution failure on something that should have rendered_ (e.g. a blocked Redgifs clip). This "skip anything not renderable" behavior is core to v1, not a configurable filter. Because most of a listing page can be non-media, pagination must be triggered on _posts scanned_, not _slides produced_, so a sparse page does not cause back-to-back fetches.

## Media Support

### Reddit-hosted images

Direct image posts should resolve to full-size `i.redd.it` URLs when available. Preview URLs should be fallback only. The resolver should preserve the original image dimensions so the renderer can make good decisions for 4K and other high-resolution displays.

### Reddit galleries

Gallery posts should resolve through Reddit listing data, using gallery item order and media metadata to derive full-resolution image URLs.

### Reddit-hosted videos and GIF-like media

Reddit-hosted videos should use playable video URLs from listing media metadata when available. Playback completion should advance the slideshow.

v.redd.it is DASH/HLS with separated tracks. The listing's `secure_media.reddit_video` carries `fallback_url` (a plain `.mp4`), `dash_url`, `hls_url`, `duration`, dimensions, `is_gif`, and `has_audio`. The resolver reports `audioAvailable` from `has_audio` (false for `is_gif` clips), so the slide knows whether audio exists. v1 still plays the `fallback_url` in a plain `<video>`, which is silent; actually hearing the audio requires a DASH/HLS player (`dash_url`/`hls_url`). The mute/unmute setting is therefore meaningful only once that audio-capable path exists.

### Redgifs

Redgifs is a first-class provider — the single most common media domain on real
NSFW feeds. It plays as **native `<video>`** (ADR 0010):

- Parse the id from `redgifs.com/watch/<id>` (or `/ifr/<id>`). The background
  resolves the clip's direct mp4 plus `duration` and `hasAudio` from the Redgifs
  API (`api.redgifs.com`, token cached, concurrency-limited and timed out).
- The CDN (`media.redgifs.com`) hotlink-protects against a reddit `Referer`, so
  the background fetches the bytes (no Referer, no cookies, with a byte cap) and
  the content script plays them as a `blob:` URL — which also satisfies the
  www-Reddit CSP. This gives correct timing (advances on the real clip end),
  global mute/unmute, and no per-clip unmute.
- If resolution fails (API down, timeout), the slide falls back to the Redgifs
  first-party iframe embed (`<iframe src="…/ifr/<id>">`), which carries the
  Origin/Referer Redgifs whitelists and needs no host permission.

Unresolvable or removed Redgifs items degrade gracefully to a placeholder slide
with title/source context and an action to open the original Redgifs page.

### Other hosts

Other external hosts are out of v1 unless they are simple direct media links. The provider system should make later additions straightforward.

## Settings

- Image timer: any value from 1 to 60 seconds via a slider (default 5).
- Start muted: on/off (inert until an audio-capable playback path exists).
- Autoplay slideshow: on/off (off starts the slideshow paused).
- Include NSFW: follow Reddit / always hide. **Default: follow Reddit** — show over-18 content only insofar as the signed-in session already exposes it. This is the least-surprising default and avoids the extension becoming an NSFW-unlocking tool.
- Provider permissions: Redgifs should be requested only if needed or clearly disclosed.

## Permissions

Install-time host permissions are scoped to the hosts the extension actually
fetches from (see ADR 0004):

- `https://old.reddit.com/*`, `https://www.reddit.com/*` — listing JSON for both
  frontends (ADR 0008).
- `https://i.redd.it/*`, `https://v.redd.it/*` — Reddit image and video media.
- `https://api.redgifs.com/*`, `https://media.redgifs.com/*` — resolve and fetch
  native Redgifs video (ADR 0010).

Plus the `storage` API permission for settings.

`preview.redd.it` / `external-preview.redd.it` are **optional** host permissions,
requested from a user gesture only when content-based duplicate detection is
enabled and removed when it is disabled. No all-URLs or broad host access is
requested.

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

## V2 Backlog

These features are intentionally outside the first implementation but should shape early architecture enough that v2 does not require a rewrite.

### Download media

Add a download action for the current slide. The feature should support direct images first, then galleries and playable video clips where technically and legally reasonable. It should use browser download APIs instead of inventing a custom downloader UI.

Design questions for v2:

- Should downloads use post titles, Reddit IDs, provider names, or timestamps in filenames?
- Should a gallery download action save only the current slide, the current post's gallery, or the whole slideshow queue?
- Should downloads be single-click or require confirmation for external providers and NSFW media?
- How should failed Redgifs or provider-restricted downloads degrade?

### Highest-resolution image viewing

Improve the image pipeline for ultra-high-resolution subreddits and 4K displays. Version 1 should already prefer original media URLs, but v2 should make high-resolution behavior explicit and inspectable.

Desired v2 behavior:

- Prefer original image URLs over Reddit previews whenever possible.
- Preserve and display image dimensions when known.
- Avoid browser downscaling artifacts where possible.
- Provide a visible indicator when only a preview/lower-resolution fallback is available.
- Support image preloading without fetching far ahead indefinitely.

### Pan and zoom

Add image inspection controls for large images that do not fit comfortably on screen.

Possible controls:

- Zoom in/out/reset.
- Fit to screen vs actual size.
- Click-drag or keyboard panning.
- Optional scroll-wheel zoom.
- Preserve slideshow navigation without making arrow-key panning confusing.

Open UX question:

- When zoomed in, should arrow keys pan the image or continue to move between slides? The likely answer is to keep slide navigation on left/right and use drag/WASD/trackpad for panning, but this should be tested.

## Open Questions

- Beyond the core media-only queue, should v1 add optional refinements such as images-only / videos-only?
- Should an auto-advancing NSFW slide behave differently (e.g. require a tap to reveal) than a SFW one?
- Should the queue include posts that RES has hidden or filtered on the current page?
- Should the extension start from only the visible sort/filter state, or support special pages like saved, user profiles, and search in v1?

## Validation Spikes

Run these against live Firefox and real Reddit before committing to the full build; each is a go/no-go:

- **Reddit listing access:** a background fetch of paginated `.json` listings using the existing session, without OAuth, at slideshow-realistic request volume, survives rate limits and returns expected shapes.
- **v.redd.it video:** `secure_media.reddit_video.fallback_url` plays inside the overlay (muted), and the separate-audio-track behavior is understood.
- **Redgifs iframe:** `https://www.redgifs.com/ifr/<id>` embeds and plays from the extension overlay in Firefox without a `redgifs.com` host permission.
- **RES coexistence:** the prototype overlay alongside RES on a real old Reddit page has no arrow-key/keyboard capture or DOM-mutation conflicts.
- **Field-shape capture:** real captured fixtures (not hand-authored) for galleries (`gallery_data` order + `media_metadata`), Reddit video, crossposts (`crosspost_parent_list[0]`), and Redgifs match the resolver's assumptions.

## Acceptance Criteria

Feature criteria:

- From an old Reddit subreddit listing, the user can launch a full-screen slideshow.
- Direct `i.redd.it` image posts display as full-resolution slides.
- Reddit galleries are expanded into sequential slides.
- The queue contains only renderable media; text/link/stickied/promoted posts are dropped.
- Right and left arrow navigation works.
- Image slides advance using the selected timer.
- Manual navigation does not disable the running slideshow timer.
- Reddit-hosted video advances when playback ends; Redgifs slides play inline and advance on a duration timer.
- The queue fetches at least one additional Reddit listing page when nearing the end, with a visible loading state and a distinct end-of-queue state.
- Settings persist between sessions.

Outcome criteria (what "good" means for a lean-back tool):

- Time-to-first-slide after launch is under ~1 second on a typical listing.
- The fraction of feed media posts that render (vs fall back) is high; the fallback rate is visible and explainable.
- Slide-to-slide transitions are smooth — a preloaded next slide (1–2 ahead) is ready before its turn, so advancing does not stutter.
- A position/progress affordance lets the user tell where they are and whether more is loading.
