# Privacy Policy - Reddit Slideshow Spectacular!

_Last updated: 2026-05-31_

**Short version: Reddit Slideshow Spectacular! collects nothing, sends nothing to
the developer, and has no analytics, tracking, ads, or accounts. Everything it
does happens locally in your browser.** The extension turns a Reddit listing you are
already viewing into a full-screen media slideshow.

## What the extension stores

Only your own settings - the per-image timer, autoplay, start-muted,
Include-NSFW, the two de-duplication toggles, and the max-load-wait. These are
saved with the browser's local extension storage (`storage.local`) **on your
device**. They are not synced, uploaded, or shared, and contain no personal
information. Removing the extension removes them.

## Network requests the extension makes

Requests go only to Reddit, Reddit's own media servers, and the content providers
a post links to (Imgur, Redgifs, Streamable, Giphy, Catbox). Never to any server
operated by the developer (there is none):

- **Listing data.** To build the slideshow, the extension fetches the JSON for
  the listing you are on (`old.reddit.com` / `www.reddit.com`). This request
  includes your existing Reddit session cookies (`credentials: "include"`) so it
  returns exactly what you can already see while logged in - including over-18
  content only if your own Reddit account/session allows it. The request is made
  from the extension's background context; your cookies are sent **to Reddit
  only** and are never read, stored, or transmitted elsewhere by the extension.
- **Media.** Images and videos are loaded directly by your browser from wherever
  the post links - Reddit's own hosts (`i.redd.it`, `v.redd.it`), Catbox
  (`files.catbox.moe`), and other image hosts - the same way they would load on
  Reddit itself.
- **Provider clips.** Some providers don't expose a directly-playable URL, so the
  extension's background plays their clips as native video: it fetches the video
  bytes from the provider's media host (`media.redgifs.com`, `i.imgur.com`,
  `*.streamable.com`, `*.giphy.com`) and, for Redgifs and Streamable, first
  resolves the direct URL from the provider's API (`api.redgifs.com`,
  `api.streamable.com`). These requests are made **without cookies**
  (`credentials: "omit"`) and with no referrer; each provider receives only what
  any request to load that clip would (e.g. your IP address and standard request
  data), subject to that provider's own privacy policy (e.g.
  [Redgifs'](https://www.redgifs.com/privacy)). The extension sends no account
  information or tracking of its own. (If Redgifs or Streamable can't be reached,
  the clip falls back to the provider's standard `<iframe>` embed, loaded by your
  browser the same way Reddit embeds it.)
- **Optional re-upload detection (off by default).** If you turn on "Also detect
  re-uploaded images," the extension fetches preview images from
  `preview.redd.it` / `external-preview.redd.it` to compute a local perceptual
  hash so repeats can be skipped. These image fetches are made **without cookies**
  (`credentials: "omit"`), the hashing happens entirely in your browser, and no
  image or hash leaves your device. This feature requests its host permission
  only when you enable it.

## Permissions and why they are needed

- **`storage`** - to save your settings locally (above).
- **Host access to `old.reddit.com`, `www.reddit.com`** - to read the listing
  JSON for the page you are on. (Reddit media on `i.redd.it` / `v.redd.it` and
  other image hosts loads directly in the page and needs no permission.)
- **Host access to `api.redgifs.com`, `media.redgifs.com`, `i.imgur.com`,
  `*.streamable.com`, `*.giphy.com`** - so the background can resolve and fetch
  provider clips (Redgifs, Imgur, Streamable, Giphy) and play them as native
  video. These fetches are made without cookies.
- **Optional host access to `i.redd.it`, `preview.redd.it`,
  `external-preview.redd.it`** - requested only if you enable re-upload
  detection, to fetch images for local perceptual hashing.

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
