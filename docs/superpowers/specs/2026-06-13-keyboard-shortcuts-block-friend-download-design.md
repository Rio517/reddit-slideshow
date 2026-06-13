# Keyboard shortcuts: download, block author, friend/follow

## Overview

Add three slideshow keyboard shortcuts, reusing the existing vote pipeline (a
cookie + modhash POST through the logged-in session):

- **D** — download the current media (binds a key to the existing download action).
- **I** — block the current post's author, then skip past their post.
- **A** — friend the author (on `old.reddit.com`) or follow them (on
  `www.reddit.com`).

`F` stays **Fullscreen** (shipped, documented, localized). Friend takes `A`
because no mnemonic letter is free (F, D, I all taken).

Block and friend/follow are **new writes to the user's Reddit account**, joining
voting. The privacy copy must change accordingly.

Mobile/remote control is explicitly **out of scope** here — it is a separate,
larger design (cross-device control needs either a server, which breaks the
no-servers promise, or fragile P2P).

## Key map

| Key                                               | Action                               | Status                   |
| ------------------------------------------------- | ------------------------------------ | ------------------------ |
| ←/→, Shift+→, ↑/↓, Space, M, F, ?, Esc, PgUp/PgDn | existing                             | unchanged                |
| **D**                                             | Download current media               | new key, existing action |
| **I**                                             | Block author, then skip to next post | new                      |
| **A**                                             | Friend / follow author               | new                      |

## Behaviors

### D — Download

The action already exists: `session.js` `onDownload` (currently inline in the
overlay deps, ~`session.js:177`) saves `slide.mediaUrl` via the background
downloads API, and is a no-op for non-image/video slides (unresolved embeds).
Extract it to a `downloadCurrent()` function called by both the overlay button
and the `D` key. Show a "Saved" confirmation flash.

### I — Block + next

1. Read `slide.author` (Reddit username, no `u/` prefix; `slides.js:22`).
2. No-op if absent or `[deleted]`.
3. `POST /api/block_user` through the session (modhash, `credentials: include`),
   mirroring the vote write. Exact params (`name` vs an account fullname `t2_…`)
   are confirmed in the live step below.
4. On success, `controller.skipPostGroup()` to advance past that author's post
   (same call `skipGallery()` uses at `session.js:256`).
5. Flash "Blocked u/{name}". Optimistic flash; revert/flash error on failure
   (mirror `castVote`).

One keypress, no confirm dialog (matches the requested "block the author and
next"). Block is reversible only via Reddit settings, so the flash names the
user clearly. Revisit an undo only if it proves too easy to mis-fire.

### A — Friend / follow

Frontend-aware, keyed off the launching tab's host:

- `old.reddit.com` → `POST /api/friend` with `type=friend`, `name`, `uh=modhash`.
- `www.reddit.com` → the follow endpoint.

The content script already knows its host (`window.location` in
`entrypoints/content.js`); it passes a `frontend` discriminator (`"old"` |
`"new"`) with the action. Flash "Friended u/{name}" or "Following u/{name}".
No-op when the author is unknown.

**Verification dependency:** the exact new-Reddit _follow_ endpoint must be
confirmed against a real logged-in session before shipping (per the
"provider/account changes need a real browser" rule). If it cannot be
confirmed, `A` falls back to add-friend on both frontends.

## Architecture

All three are the vote shape (session-authenticated modhash POST), so they slot
into the existing layers.

### 1. `lib/reddit-vote.js` — broaden

The module already owns the modhash cache and 403-refresh-retry
(`getModhash`). Add two methods to the `createVoter` factory's return, sharing
`getModhash` and the same `post`-then-retry-on-403 helper:

- `blockUser(name)` → `POST /api/block_user` body `{ name, uh }`.
- `friendUser(name, frontend)` → `/api/friend` (`type=friend`) for `"old"`; the
  follow endpoint for `"new"`.

Keep the file name and `createVoter` export to minimize churn (an optional
`createRedditWriter` rename is deferred — restraint over a behavior-preserving
rename of healthy, tested code).

### 2. `lib/background-router.js` — new message types

Add `slideshow.block` and `slideshow.friend`, **content-script-only** (the
`fromContentScript` gate), with payload validation mirroring `handleVote`:

- `name` matches `^[A-Za-z0-9_-]{1,20}$` (Reddit username charset).
- `frontend` ∈ `{"old","new"}` (friend only).
- Fail closed (`{ ok: false }`) on any mismatch; `log.warn` on thrown errors.

Wire `blockUser` / `friendUser` into the router deps.

### 3. `entrypoints/background.js` / `entrypoints/content.js`

- `background.js`: pass `block: (name) => voter.blockUser(name)` and
  `friend: (name, frontend) => voter.friendUser(name, frontend)` into
  `createMessageRouter`.
- `content.js`: add `block` / `friend` session deps that `sendMessage` the new
  types (mirroring the existing `vote` dep at `content.js:132`); derive
  `frontend` from `window.location.hostname`.

### 4. `lib/session.js`

- `downloadCurrent()` (extracted from `onDownload`).
- `blockAuthor()` and `friendAuthor()` (optimistic flash, error revert like
  `castVote`).
- Add `i`, `I`, `d`, `D`, `a`, `A` to `HANDLED_KEYS` (`session.js:711`) and
  cases to the `switch` (`session.js:753`).
- Guards: author-less slides → no-op (no flash, or a brief "No author").

### 5. `lib/overlay-ui.js` — generalize the flash

Generalize the vote-flash toast (`flashVote`, `overlay-ui.js:417`; `rs-vote-flash`)
into a reusable `flashAction(text, variant)` that also calls `announce()` for
screen readers. Block/friend/download are keys-only with a flash — exactly how
vote works today (no new buttons). Expose via the overlay API so `session.js`
can call it. Keep `flashVote` as a thin wrapper (or fold its callers over).

### 6. `lib/overlay-help.js`

Add three rows to the shortcuts panel: `D` Download, `I` Block author, `A`
Friend / follow.

## i18n

WebExtension `_locales` format (`{ message, description }`), added across
**en + ar, de, es, fr, it** (Arabic is RTL). No jargon in user-facing copy.

New keys:

- `helpShortcutDownload`, `helpShortcutBlock`, `helpShortcutFriend` — help-panel rows.
- Flash text: `uiBlocked` ("Blocked u/{name}"), `uiFriended`, `uiFollowing`,
  `uiSaved` (download), and reuse/extend an error variant.

(Confirm placeholder substitution for `{name}` matches the existing i18n helper's
interpolation; otherwise compose the flash text in code.)

## Docs / privacy

- **README** key list (~`README.md:122`): add D, I, A.
- **PRIVACY.md** + README privacy section: the write actions are now voting,
  blocking, and friending/following — not voting alone. Authoritative tense, no
  changelog framing.
- **Store listings** (`docs/store-listing/*`): reflect the new account-write
  actions where they describe what the extension does to your account.
- All Reddit hosts involved (`old.reddit.com`) are already granted for voting;
  confirm no new `host_permissions` are needed (and if the follow endpoint
  targets a different host, add it).

## Testing

- **Unit** (`npm test`):
  - `reddit-vote`: `blockUser` / `friendUser` POST bodies, modhash reuse, 403
    refresh-and-retry (mirror existing vote tests).
  - `background-router`: new types — sender gating, username/frontend validation,
    fail-closed.
  - `session`: block calls dep then `skipPostGroup`; friend passes `frontend`;
    `D` calls download; author-less guards.
- **e2e** (`npm run test:prod`): keypress → flash + dep call over the mocked
  listing. **No real account in CI.**
- **Live (local, FF session):** confirm block / friend / follow actually take.
  Gate the _follow_ endpoint on this; fall back to add-friend if unconfirmed.

## Out of scope

- Mobile / remote control (separate design cycle).
- Overlay buttons for block/friend (keys-only, matching vote).
- An undo for block (revisit only if mis-fires prove common).
