# Store Listing Copy & Metadata

Copy-paste-ready submission text for the Firefox Add-ons site (AMO) and the
Chrome Web Store. Every claim here is grounded in the extension's actual
behaviour (see `README.md`, `PRIVACY.md`, `wxt.config.ts`, `lib/`, and
`docs/product/`). Keep it accurate - do not add features that aren't shipped.

The detailed description and the per-permission justifications are written as
**plain text** because the stores don't render Markdown the same way. Paste them
as-is.

---

## 1. Name

**Name (both stores):** Reddit Slideshow Spectacular!

There is no separate store/display name; the manifest `name` is
"Reddit Slideshow Spectacular!" and the same name works on both stores.

Leading with "Reddit" is deliberate: it's the de-facto Chrome-store convention
(Reddit Enhancement Suite and dozens of others lead with it), it matches the
companion subreddit r/redditslideshowspectacular, and it surfaces for the "reddit
slideshow" searches people actually type. The affiliation risk is low and the
same one those extensions carry; if a reviewer ever pushes back, "(unofficial)"
or a "… for Reddit" rename is a cheap fallback. The "!" is part of the name -
keep it (Yahoo!-style mid-sentence).

---

## 2. Summary / short description

**Chrome Web Store - short description (must be ≤ 132 chars):**

> Turn any Reddit feed into a full-screen, keyboard-driven media slideshow -
> images, galleries, video, Redgifs, Imgur, and more.

(126 characters.)

**AMO - short "summary" field:**

> Turn the Reddit feed you're already viewing into a full-screen,
> keyboard-driven media slideshow. Works on old and new Reddit, reuses your
> logged-in session (no API keys), and plays images, galleries, video, and clips
> from Redgifs, Imgur, Streamable, Giphy, and Catbox. No analytics, no tracking,
> settings stored locally.

---

## 3. Detailed description (plain text - paste as-is)

Reddit Slideshow Spectacular! turns the Reddit feed you're already viewing
into a full-screen, keyboard-driven media slideshow. Open a feed, subreddit,
multireddit, or search results on old.reddit.com or www.reddit.com, click the
toolbar icon (or press Alt+Shift+S), and lean back.

It reuses your existing logged-in Reddit session - no API keys, no sign-in, no
extra account. It walks media posts in the order Reddit returns them and pages
through the feed automatically, so the slideshow keeps going past the first
page.

WHAT IT PLAYS

- Direct Reddit images (full-resolution i.redd.it where available)
- Reddit galleries, expanded into one slide per image
- Reddit-hosted video (v.redd.it), with its sound (the separate audio track)
- Redgifs, Imgur (.gifv), Streamable, and Giphy clips, played as native video
- Imgur albums, expanded into one slide per image
- Catbox video and image files
- Crossposts, resolved to the original post's media

The queue is media-only: text/self posts, outbound article links, stickied
announcements, and promoted/ad posts are skipped, and media that fails to load
is skipped too - so the slideshow never lands on a dead slide.

CONTROLS

- Keyboard: Left/Right to move, Up/Down to upvote/downvote the post, Space to
  play/pause, M to mute, F for fullscreen, Esc to close
- An on-screen control rail: previous, play/pause, next, mute, fullscreen, open
  in a window, and settings
- Under each slide: a byline (who posted it, to which subreddit, the source and
  resolution), with buttons to open the original post or download the media
- Click the position counter to jump straight to any post in the loaded queue
- Click the dark backdrop to close
- Images advance on a timer you set; the timer keeps running even after you
  arrow through manually, and videos advance when the clip ends

NICE TOUCHES

- Slide transitions: fade, slide, push, zoom, flip, or none
- Optional top countdown timer bar (on video slides, every slide, or never)
- Optional slow pan & zoom for images too big to see at once
- A pinned position counter and post title so you always know where you are
- "Open in a window" reopens the slideshow in a minimal popup window, ready to
  AirPlay or Chromecast to a TV or second screen for a lean-back, big-screen feed
- Duplicate skipping: reposts, crossposts, and repeated galleries are skipped,
  and a perceptual hash (on by default) also catches the same image re-uploaded
  under a new link - solo vs. in a gallery
- "Open original" jumps to the source post

SETTINGS (apply live, no reload)

- Time per image (1 second to 5 minutes, on a fine-at-the-low-end scale)
- Slide transition
- Timer bar visibility
- How long to wait for slow media before moving on
- Autoplay videos on/off, start muted on/off
- Include NSFW - by default follows your Reddit session, showing over-18 content
  only insofar as your account already does
- Skip duplicate media, including re-uploaded images (on by default)
- Pan & zoom large images (or all images), with full control over the sequence

PRIVACY
No analytics, no tracking, no ads, no accounts, and no developer servers (there
are none). The extension only fetches the media you're viewing: the feed and
its media from Reddit, and provider clips from Imgur, Redgifs, Streamable, Giphy,
and Catbox. The one thing that writes to your Reddit account is voting, and only
when you press the up/down keys. Your settings are stored locally on your device,
and it ships no remote code. Full policy: see the privacy policy link.

Built as a Manifest V3 WebExtension for Firefox and Chromium browsers (Chrome,
Edge, Brave). Open source, MIT licensed.

---

## 4. Category suggestions

**AMO (Firefox):**

- Primary: **Photos, Music & Videos**
- Alternate if a more browsing-oriented fit is preferred: **Other**

**Chrome Web Store:**

- Primary: **Entertainment**
- Alternate: **Photos** (or **Fun**)

(Chrome lets you pick one category; Entertainment best fits a media-viewing
tool.)

---

## 5. Permission justifications (reviewer-facing, one line each)

These mirror `wxt.config.ts` and `PRIVACY.md`. AMO in particular asks for a
justification per host; Chrome asks per-host too (see section 8).

API permissions:

- **storage** - Save the user's settings (timer, transitions, mute/autoplay,
  NSFW and dedup toggles, etc.) locally on the device. Nothing is synced or
  uploaded.
- **downloads** - Save the media the user is currently viewing to their device,
  with a sensible filename, when they use the in-overlay download control.

Host permissions (install-time):

- **https://old.reddit.com/\*** - Fetch the listing JSON for the old-Reddit page
  the user is viewing, so the slideshow knows which media to show; also, when the
  user presses the up/down keys, cast their vote on the current post (`/api/vote`
  with the session cookie + modhash).
- **https://www.reddit.com/\*** - Same listing fetch, for new Reddit; the
  slideshow can be launched from either frontend.
- **https://api.redgifs.com/\* , https://media.redgifs.com/\*** - Resolve a
  Redgifs link to its direct video URL and fetch the bytes in the background (the
  CDN hotlink-protects against a Reddit referrer), so the clip plays as native,
  correctly-timed video. Requested without cookies.
- **https://i.imgur.com/\*** - Fetch the .mp4 for an Imgur `.gifv` in the
  background and play it as a looping video (Imgur hotlink-protects against a
  Reddit referrer). Requested without cookies.
- **https://imgur.com/\*** - Fetch the keyless `imgur.com/ajaxalbums`
  album-member list (without cookies) to expand an Imgur album into one slide per
  image. Origin-scoped because MV3 host grants are origin-level.
- **https://\*.streamable.com/\*** - Resolve a Streamable clip's mp4 via its
  public API and fetch the bytes from the per-video CDN subdomain. Without
  cookies.
- **https://\*.giphy.com/\*** - Fetch a Giphy clip's mp4 from its media CDN and
  play it as a looping video. Without cookies.
- **https://v.redd.it/\*** - Fetch a Reddit video's DASH manifest (without
  cookies) to find its separate audio track, played alongside the silent video.
  The video and audio themselves load directly in the page.

Catbox files (`files.catbox.moe`) load directly in the page as `<video>` and
need no host permission.

Host permissions for the on-by-default re-upload detection (fetch Reddit images
to compute a local perceptual hash; the hash never leaves the device):

- **https://i.redd.it/\*** - Fetch the displayed Reddit-hosted image to hash.
  (Display itself needs no permission; this access is only for hashing.)
- **https://preview.redd.it/\* , https://external-preview.redd.it/\*** - Fetch
  Reddit preview images (incl. externally-hosted post previews) to hash.

No other permissions are requested: no browsing history, no bookmarks, no
all-URLs / broad host access, and no remote code.

---

## 6. Privacy / data-use questionnaire answers

Both stores ask a data-collection questionnaire. The honest answer is that this
extension collects nothing. Mirror `PRIVACY.md`.

**Does the extension collect or transmit user data?** No.

Use these answers:

- Personally identifiable information - **Not collected**
- Health information - **Not collected**
- Financial / payment information - **Not collected**
- Authentication information - **Not collected** (it reuses the browser's
  existing Reddit session cookies to fetch the feed you can already see; it
  never reads, stores, or transmits those cookies itself)
- Personal communications - **Not collected**
- Location - **Not collected**
- Web history - **Not collected**
- User activity (clicks, keystrokes, etc.) - **Not collected**
- Website content - **Not collected/transmitted by us**; the extension fetches
  the listing JSON and media for the page the user is viewing, directly from
  Reddit and the content providers a post links to (Imgur, Redgifs, Streamable,
  Giphy, Catbox), to render the slideshow - none of it is sent anywhere else

Plain-language summary to paste where a free-text box is offered:

> Reddit Slideshow Spectacular! collects nothing and sends nothing to the developer - there
> is no developer server, no analytics, no telemetry, no tracking, no ads, and
> no accounts. It makes network requests only to Reddit, Reddit's media hosts,
> and the content providers a post links to (Imgur, Redgifs, Streamable, Giphy,
> Catbox), to fetch the media you're viewing; those provider requests are made
> without cookies. The only thing it stores is your own
> settings, kept locally via the browser's extension storage; removing the
> extension removes them. The extension contains no remote code.

**AMO data-collection declaration:** the Firefox manifest already declares
`data_collection_permissions: { required: ["none"] }` (see `wxt.config.ts`), so
select "No" / "does not collect data" to match.

**Chrome Web Store certifications:** you can truthfully check all three -
(1) we do not sell or transfer user data to third parties outside the approved
use cases, (2) we do not use or transfer user data for purposes unrelated to the
item's single purpose, and (3) we do not use or transfer user data to determine
creditworthiness or for lending.

**Privacy policy URL:** the `PRIVACY.md` in this repository
(https://github.com/Rio517/reddit-slideshow-spectacular/blob/main/PRIVACY.md), or a hosted
copy of it.

---

## 7. Screenshots

Two screenshots ship in the repo. Both stores accept PNGs; upload these (or
regenerate the options shots with `npm run screenshots`).

**docs/slideshow-demo.png** - the slideshow running full-screen over r/aww: a
sleeping cat fills the stage, with the position counter and "Open original" at
the bottom-left and the vertical control rail (prev / play / next, mute,
fullscreen, open-in-window, settings, and the close X) down the right edge.

> Suggested caption: "Full-screen slideshow over your current feed -
> keyboard-driven, with a position counter and a minimal control rail."

**docs/screenshots/options-light.png** - the options page (light mode) showing
every setting: image timer, transition between slides, top timer bar, skip-slow
media, autoplay, start muted, include NSFW, hide duplicate media, always show
count & title, detect re-uploaded images, and the pan & zoom sequence.

> Suggested caption: "Every setting in one place - changes apply live to a
> running slideshow."

(There's also a dark-mode variant at `docs/screenshots/options-dark.png` if you
want a third tile.)

---

## 8. Single-purpose statement & per-host justification (Chrome)

**Single purpose (paste into the Chrome "single purpose" field):**

> Reddit Slideshow Spectacular! has one purpose: to turn the Reddit feed the user is
> currently viewing into a full-screen, keyboard-driven media slideshow of that
> feed's images and videos.

**Why each host permission is needed (Chrome requires per-host justification):**

- **old.reddit.com / www.reddit.com** - Read the listing JSON for the page the
  user launched the slideshow from (either Reddit frontend) to build and
  paginate the slide queue; and, on the up/down keys, cast the user's vote on the
  current post via `/api/vote`.
- **api.redgifs.com / media.redgifs.com / i.imgur.com / imgur.com /
  \*.streamable.com / \*.giphy.com** - Resolve and fetch provider clips (Redgifs,
  Imgur `.gifv`, Streamable, Giphy) in the background so they play as native,
  correctly-timed video instead of an opaque embed, and fetch the keyless
  `imgur.com/ajaxalbums` list to expand an Imgur album into its images (all
  requested without cookies). Catbox files load directly in the page and need no
  permission.
- **v.redd.it** - Fetch a Reddit video's DASH manifest (without cookies) to find
  its separate audio track, so the clip can play with sound; the video itself
  loads directly in the page.
- **i.redd.it / preview.redd.it / external-preview.redd.it** - Fetch
  Reddit-hosted images and previews (without cookies) to compute an on-device
  perceptual hash, so the same image re-uploaded under a new link is skipped.
  This duplicate detection is on by default; the hash never leaves the device.
- **downloads** - Save the displayed media to the user's device, on request, via
  the in-overlay download control.

---

## 9. Review notes (paste into "Notes for reviewers")

> This is a plain-JavaScript Manifest V3 WebExtension built with WXT; the same
> source builds the Firefox and Chrome packages. There is NO minified, obscured,
> remote, or eval'd code - all logic ships in readable JS, and no script is
> loaded from a remote server. No developer backend exists; the extension talks
> only to Reddit, Reddit's media hosts, and the content providers a post links to
> (Imgur, Redgifs, Streamable, Giphy, Catbox), to fetch the media being viewed.
> Settings are stored locally via storage.local.
>
> How to test: sign in to Reddit, open any media-heavy feed on
> old.reddit.com or www.reddit.com (e.g. https://old.reddit.com/r/aww/), and
> click the "Reddit Slideshow Spectacular!" toolbar icon (or press Alt+Shift+S). A
> full-screen slideshow opens over the page. Use Left/Right to navigate, Space
> to play/pause, M to mute, F for fullscreen, and Esc to close. The gear icon
> opens settings, which apply live. Re-upload detection (the perceptual hash that
> fetches i.redd.it / preview.redd.it images) is on by default and can be turned
> off with the "Also skip re-uploaded images" setting.
>
> Source: https://github.com/Rio517/reddit-slideshow-spectacular
