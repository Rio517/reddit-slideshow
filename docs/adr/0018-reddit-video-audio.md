# ADR 0018: v.redd.it audio via a synced companion element

Date: 2026-06-02
Status: Accepted (resolution + sync implemented; playback sync needs a real-browser pass)

## Context

Reddit-hosted video (`v.redd.it`) serves its video and audio as **separate DASH
streams**. The `reddit_video.fallback_url` mp4 we play directly is the
**video-only** track, so unmuting a Reddit clip produces no sound even though the
post has audio (`has_audio: true`). Real audio means recovering the separate
audio track and playing it in time with the silent video.

The slide already carries `dashUrl` (the `DASHPlaylist.mpd`) and `hlsUrl`. The
audio track is a sibling file (e.g. `DASH_AUDIO_128.mp4`) listed in the DASH
manifest. The manifest and the audio file are on `v.redd.it`.

## Decision

Play the audio from a **companion `<audio>` element synced to the silent
`<video>`**, rather than muxing or bundling a full DASH/MSE player.

- **Resolve (`lib/reddit-audio.js`).** `audioUrlFromDash(mpdXml, manifestUrl)`
  reads the audio `<BaseURL>` from the manifest (regex, not DOMParser - the
  background is a service worker on Chrome) and resolves it against the manifest
  URL. The background fetches the manifest (byte-capped, no cookies) and returns
  the audio URL; `slideshow.resolveRedditAudio` is HTTPS + `v.redd.it` gated.
- **Resolve lazily, like Redgifs (`lib/session.js`).** The session resolves audio
  for `v.redd.it` videos in its preload window and attaches `slide.audioUrl`. An
  upcoming video gets it at render time; the on-screen one is attached live (no
  restart) via `overlay.addCurrentAudio`.
- **Play synced (`lib/overlay-ui.js`).** `attachSyncedAudio` creates an `<audio>`
  that purely **follows** the video's events - `play`/`pause`/`seeking`/
  `ratechange`/`volumechange`, plus a small drift correction on `timeupdate`. The
  silent video already carries the slideshow's mute state, so the existing play &
  mute controls drive the audio unchanged. The audio src is gated to a `.redd.it`
  HTTPS host, and the element is retired with its frame.

This adds the install-time **`v.redd.it`** host permission (manifest fetch only;
the video and audio play as page subresources, which `www.reddit`'s
`media-src *.redd.it` CSP already allows).

## Consequences

Benefits:

- Reddit clips play with sound when unmuted, with no bundled player and no change
  to the video element's own play/mute logic.
- A clip whose audio hasn't resolved (or has none) behaves exactly as before -
  silent - so the change is additive and can't break video playback.

Costs / risks:

- One new host permission (`v.redd.it`).
- The regex manifest read targets reddit's current `DASH_AUDIO_*` naming; a
  manifest with a differently-named audio BaseURL falls back to silent.
- Two media elements kept in sync is inherently approximate; the drift
  correction is conservative. **Audio/video sync, the autoplay-unmute path, and
  the live-attach all need a real logged-in Firefox + Chrome check** - the
  offline gate exercises the resolution and wiring but not playback timing.

## Implementation Guidance

- Keep the audio a pure follower of the video; don't add a second mute owner.
- Gate the audio src to a `.redd.it` HTTPS host at the sink.
- If sync proves unreliable in a real browser, the fallback is a bundled
  DASH/HLS/MSE player (larger, deferred) - not muting back to silent.
