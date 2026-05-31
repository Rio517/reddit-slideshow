# Privacy Policy - Reddit Slideshow

_Last updated: 2026-05-31_

**Short version: Reddit Slideshow collects nothing, sends nothing to the
developer, and has no analytics, tracking, ads, or accounts. Everything it does
happens locally in your browser.** The extension turns a Reddit listing you are
already viewing into a full-screen media slideshow.

## What the extension stores

Only your own settings - the per-image timer, autoplay, start-muted,
Include-NSFW, the two de-duplication toggles, and the max-load-wait. These are
saved with the browser's local extension storage (`storage.local`) **on your
device**. They are not synced, uploaded, or shared, and contain no personal
information. Removing the extension removes them.

## Network requests the extension makes

Requests go only to Reddit, Reddit's own media servers, and (for Redgifs posts)
Redgifs. Never to any server operated by the developer (there is none):

- **Listing data.** To build the slideshow, the extension fetches the JSON for
  the listing you are on (`old.reddit.com` / `www.reddit.com`). This request
  includes your existing Reddit session cookies (`credentials: "include"`) so it
  returns exactly what you can already see while logged in - including over-18
  content only if your own Reddit account/session allows it. The request is made
  from the extension's background context; your cookies are sent **to Reddit
  only** and are never read, stored, or transmitted elsewhere by the extension.
- **Media.** Images and videos are loaded directly from Reddit's media hosts
  (`i.redd.it`, `v.redd.it`) by your browser to display each slide, the same way
  they would load on Reddit itself.
- **Redgifs clips.** When a post links to Redgifs, the extension's background
  contacts Redgifs to play the clip as a normal video: it requests the clip's
  metadata and direct video URL from `api.redgifs.com`, then downloads the video
  from `media.redgifs.com`. Both requests are made **without cookies**
  (`credentials: "omit"`) and with no referrer; Redgifs receives only what any
  request to load that clip would (e.g. your IP address and standard request
  data), subject to [Redgifs' own privacy policy](https://www.redgifs.com/privacy).
  The extension sends Redgifs no account information or tracking of its own. (If
  Redgifs can't be reached, the clip falls back to Redgifs' standard `<iframe>`
  embed, loaded by your browser the same way Reddit embeds it.)
- **Optional re-upload detection (off by default).** If you turn on "Also detect
  re-uploaded images," the extension fetches preview images from
  `preview.redd.it` / `external-preview.redd.it` to compute a local perceptual
  hash so repeats can be skipped. These image fetches are made **without cookies**
  (`credentials: "omit"`), the hashing happens entirely in your browser, and no
  image or hash leaves your device. This feature requests its host permission
  only when you enable it.

## Permissions and why they are needed

- **`storage`** - to save your settings locally (above).
- **Host access to `old.reddit.com`, `www.reddit.com`, `i.redd.it`,
  `v.redd.it`** - to read the listing JSON and load slide media.
- **Host access to `api.redgifs.com`, `media.redgifs.com`** - to resolve and
  play Redgifs clips as native video.
- **Optional host access to `preview.redd.it`, `external-preview.redd.it`** -
  requested only if you enable re-upload detection.

The extension requests no other permissions: no browsing history, no bookmarks,
no access to other sites, and no remote code.

## What the extension does NOT do

- No analytics, telemetry, crash reporting, or usage tracking.
- No advertising and no selling or sharing of data.
- No developer-operated servers; nothing is ever sent to the author.
- No accounts, sign-in, or collection of personal information.

## Contact

Questions about this policy: **mario@knyflores.com**, or open an issue at
<https://github.com/Rio517/reddit-slideshow-spectacular/issues>.

## Changes

If this policy changes, the "Last updated" date above will change and the new
version will be committed to this repository.
