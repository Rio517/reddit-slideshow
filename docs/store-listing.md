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

> Turn any Reddit listing into a full-screen, keyboard-driven media slideshow:
> images, galleries, Reddit video, and Redgifs.

(122 characters.)

**AMO - short "summary" field:**

> Turn the Reddit listing you're already viewing into a full-screen,
> keyboard-driven media slideshow. Works on old and new Reddit, reuses your
> logged-in session (no API keys), and plays images, galleries, Reddit-hosted
> video, and Redgifs. No analytics, no tracking, settings stored locally.

---

## 3. Detailed description (plain text - paste as-is)

Reddit Slideshow Spectacular! turns the Reddit listing you're already viewing
into a full-screen, keyboard-driven media slideshow. Open a feed, subreddit,
multireddit, or search results on old.reddit.com or www.reddit.com, click the
toolbar icon (or press Alt+Shift+S), and lean back.

It reuses your existing logged-in Reddit session - no API keys, no sign-in, no
extra account. It walks media posts in the order Reddit returns them and fetches
further listing pages automatically, so the slideshow keeps going past the first
page.

WHAT IT PLAYS

- Direct Reddit images (full-resolution i.redd.it where available)
- Reddit galleries, expanded into one slide per image
- Reddit-hosted video (v.redd.it)
- Redgifs clips, played as native video
- Crossposts, resolved to the original post's media

The queue is media-only: text/self posts, outbound article links, stickied
announcements, and promoted/ad posts are skipped, and media that fails to load
is skipped too - so the slideshow never lands on a dead slide.

CONTROLS

- Keyboard: Left/Right to move, Space to play/pause, M to mute, F for
  fullscreen, Esc to close
- An on-screen control rail: previous, play/pause, next, mute, fullscreen, open
  in a window, and settings
- Click the position counter to jump straight to any post in the loaded queue
- Click the dark backdrop to close
- Images advance on a timer you set; the timer keeps running even after you
  arrow through manually, and videos advance when the clip ends

NICE TOUCHES

- Slide transitions: fade, slide, push, zoom, flip, or none
- Optional top countdown timer bar (on video slides, every slide, or never)
- Optional slow pan & zoom for images too big to see at once
- A pinned position counter and post title so you always know where you are
- "Open in a window" reopens the slideshow in a minimal popup window - handy for
  AirPlay / casting to a second screen
- Duplicate skipping: reposts, crossposts, and repeated galleries are skipped;
  an optional perceptual-hash mode can also skip re-uploaded images
- "Open original" jumps to the source post

SETTINGS (apply live, no reload)

- Image timer (1-60s)
- Slide transition
- Timer bar visibility
- How long to wait for slow media before moving on
- Autoplay on/off, start muted on/off
- Include NSFW - by default follows your Reddit session, showing over-18 content
  only insofar as your account already does
- Skip duplicate media; optionally also detect re-uploaded images
- Pan & zoom, with full control over the pan/zoom sequence

PRIVACY
No analytics, no tracking, no ads, no accounts, and no developer servers (there
are none). The extension only fetches the media you're viewing - from Reddit,
and from Redgifs for Redgifs links - and stores your settings locally on your
device. It ships no remote code. Full policy: see the privacy policy link.

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

API permission:

- **storage** - Save the user's settings (timer, transitions, mute/autoplay,
  NSFW and dedup toggles, etc.) locally on the device. Nothing is synced or
  uploaded.

Host permissions (install-time):

- **https://old.reddit.com/\*** - Fetch the listing JSON for the old-Reddit page
  the user is viewing, so the slideshow knows which media to show.
- **https://www.reddit.com/\*** - Same, for new Reddit; the slideshow can be
  launched from either frontend.
- **https://i.redd.it/\*** - Load Reddit-hosted images to display as slides.
- **https://v.redd.it/\*** - Load Reddit-hosted video to play as slides.
- **https://api.redgifs.com/\*** - Resolve a Redgifs link to its direct video
  URL (and duration/audio info) so the clip can play as native, correctly-timed
  video. Requested without cookies.
- **https://media.redgifs.com/\*** - Fetch the Redgifs video bytes in the
  background (the CDN hotlink-protects against a Reddit referrer), so the clip
  plays inline. Requested without cookies.

Optional host permissions (requested at runtime only when the user enables the
"Also detect re-uploaded images" setting):

- **https://preview.redd.it/\*** - Fetch Reddit preview images to compute a
  local perceptual hash so re-uploaded images can be skipped. Requested without
  cookies; the hash never leaves the device.
- **https://external-preview.redd.it/\*** - Same, for externally-hosted post
  previews.

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
  existing Reddit session cookies to fetch the listing you can already see; it
  never reads, stores, or transmits those cookies itself)
- Personal communications - **Not collected**
- Location - **Not collected**
- Web history - **Not collected**
- User activity (clicks, keystrokes, etc.) - **Not collected**
- Website content - **Not collected/transmitted by us**; the extension fetches
  the listing JSON and media for the page the user is viewing, directly from
  Reddit (and Redgifs for Redgifs links), to render the slideshow - none of it
  is sent anywhere else

Plain-language summary to paste where a free-text box is offered:

> Reddit Slideshow Spectacular! collects nothing and sends nothing to the developer - there
> is no developer server, no analytics, no telemetry, no tracking, no ads, and
> no accounts. It makes network requests only to Reddit, Reddit's media hosts,
> and (for Redgifs posts) Redgifs, to fetch the media you're viewing. Redgifs
> requests are made without cookies. The only thing it stores is your own
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

> Reddit Slideshow Spectacular! has one purpose: to turn the Reddit listing the user is
> currently viewing into a full-screen, keyboard-driven media slideshow of that
> listing's images and videos.

**Why each host permission is needed (Chrome requires per-host justification):**

- **old.reddit.com / www.reddit.com** - Read the listing JSON for the page the
  user launched the slideshow from (either Reddit frontend) to build and
  paginate the slide queue.
- **i.redd.it / v.redd.it** - Load Reddit-hosted images and video to display as
  slides.
- **api.redgifs.com / media.redgifs.com** - Resolve and fetch Redgifs clips so
  they play as native, correctly-timed video instead of an opaque embed (both
  requested without cookies).
- **preview.redd.it / external-preview.redd.it (optional)** - Requested only at
  runtime, and only if the user turns on "Also detect re-uploaded images," to
  fetch preview images for an on-device perceptual hash so duplicate re-uploads
  can be skipped.

---

## 9. Review notes (paste into "Notes for reviewers")

> This is a plain-JavaScript Manifest V3 WebExtension built with WXT; the same
> source builds the Firefox and Chrome packages. There is NO minified, obscured,
> remote, or eval'd code - all logic ships in readable JS, and no script is
> loaded from a remote server. No developer backend exists; the extension talks
> only to Reddit, Reddit's media hosts, and (for Redgifs links) Redgifs, to
> fetch the media being viewed. Settings are stored locally via storage.local.
>
> How to test: sign in to Reddit, open any media-heavy listing on
> old.reddit.com or www.reddit.com (e.g. https://old.reddit.com/r/aww/), and
> click the "Reddit Slideshow Spectacular!" toolbar icon (or press Alt+Shift+S). A
> full-screen slideshow opens over the page. Use Left/Right to navigate, Space
> to play/pause, M to mute, F for fullscreen, and Esc to close. The gear icon
> opens settings, which apply live. The optional "Also detect re-uploaded
> images" setting is what triggers the runtime request for the optional
> preview.redd.it / external-preview.redd.it host permissions.
>
> Source: https://github.com/Rio517/reddit-slideshow-spectacular
