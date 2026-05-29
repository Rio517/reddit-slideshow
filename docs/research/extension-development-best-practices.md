# Extension Development Best Practices

Date: 2026-05-29
Status: Draft

## Purpose

This document captures development practices for a Firefox-first WebExtension that turns old Reddit listings into a media slideshow. It focuses on choices that affect maintainability, security, reviewability, user trust, and compatibility with Reddit Enhancement Suite.

## Source Summary

Primary sources used:

- MDN WebExtensions overview: https://developer.mozilla.org/en-US/Add-ons/WebExtensions
- MDN content scripts: https://developer.mozilla.org/Add-ons/WebExtensions/Content_scripts
- MDN background scripts: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Background_scripts
- MDN manifest background key: https://developer.mozilla.org/en-US/Add-ons/WebExtensions/manifest.json/background
- MDN permissions manifest key: https://developer.mozilla.org/en-US/Add-ons/WebExtensions/manifest.json/permissions
- MDN permissions API: https://developer.mozilla.org/en-US/Add-ons/WebExtensions/API/permissions
- MDN storage API: https://developer.mozilla.org/en-US/Add-ons/WebExtensions/API/storage
- MDN storage.sync: https://developer.mozilla.org/en-US/Add-ons/WebExtensions/API/storage/sync
- MDN runtime messaging: https://developer.mozilla.org/en-US/Add-ons/WebExtensions/API/runtime/sendMessage
- MDN Content Security Policy for extensions: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Content_Security_Policy
- MDN content_security_policy manifest key: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/content_security_policy
- Mozilla Extension Workshop `web-ext`: https://extensionworkshop.com/documentation/develop/getting-started-with-web-ext/
- Mozilla Extension Workshop permission testing: https://extensionworkshop.com/documentation/develop/test-permission-requests/
- Mozilla signing and distribution overview: https://extensionworkshop.com/documentation/publish/signing-and-distribution-overview/
- Reddit API listing docs: https://www.reddit.com/dev/api/
- Reddit Data API Terms: https://redditinc.com/policies/data-api-terms
- Reddit Developer Terms: https://redditinc.com/policies/developer-terms
- Reddit Data API Wiki: https://support.reddithelp.com/hc/en-us/articles/16160319875092-Reddit-Data-API-Wiki

## Key Development Principles

### Keep the extension local-first

The extension should run entirely in the user's browser. It should not send browsing activity, Reddit post data, media URLs, settings, or usage events to any service controlled by us.

This matters because Reddit browsing can reveal sensitive interests and communities. It also makes Firefox add-on review simpler: fewer privacy claims, fewer data handling obligations, and fewer failure points.

Practical rule:

- No analytics by default.
- No remote config by default.
- No backend service for v1.
- No persistence of browsed post history unless the user explicitly asks for a history feature later.

### Prefer narrow permissions

Host permissions are user trust decisions. Broad permissions such as all websites would be easier for a media extension, but they would be disproportionate for a Reddit slideshow.

Practical rule:

- Install-time access should cover old Reddit and Reddit media needed for the core flow.
- External providers should be explicitly listed.
- New external providers should be added one by one.
- Optional host permissions should be considered for providers like Redgifs if the UX remains understandable.

Initial permission direction:

- Required or strongly expected: `old.reddit.com`, `www.reddit.com`, `i.redd.it`, `v.redd.it`.
- Optional or staged: `redgifs.com`, `www.redgifs.com`, future providers.

### Separate page integration from extension logic

Content scripts can read and modify the old Reddit page, but they only get limited extension API access. Background scripts have broader WebExtension API access but cannot directly inspect page DOM. This boundary is useful and should shape the architecture.

Recommended split:

- Content script: detect old Reddit context, inject overlay, handle keyboard/UI events, render current slide.
- Background script/page: fetch Reddit listing JSON, resolve external providers, manage permissions, coordinate queue pagination.
- Shared modules: normalize Reddit posts into candidate media items, provider resolver contracts, settings schema.
- Options page: durable settings UI.

The content script should be deliberately thin. It is the most exposed to Reddit/RES DOM changes and should not contain the entire media resolution pipeline.

### Use explicit message contracts

Runtime messaging is the right bridge between content scripts and the background context. Message payloads should be typed and versioned by convention, even if the project starts in plain JavaScript.

Recommended message pattern:

```text
{ type: "queue.start", payload: { pageUrl } }
{ type: "queue.nextPage", payload: { cursor } }
{ type: "provider.resolve", payload: { post } }
{ type: "settings.get" }
{ type: "settings.update", payload: { patch } }
```

Every message should have:

- One clearly named `type`.
- Structured `payload`.
- A success response shape.
- A failure response shape with a stable error code.

Avoid sending raw DOM nodes, functions, or page-specific objects across the boundary.

### Treat old Reddit, RES, and provider markup as unstable

Old Reddit is stable in a human sense, but it is not a formal extension API. RES also mutates old Reddit pages. External provider pages can change without notice.

Practical rule:

- Prefer Reddit listing JSON for data over scraping old Reddit DOM.
- Use DOM scraping only to identify current context, launch point, or visible page state.
- Namespace all injected DOM IDs/classes with a project prefix.
- Avoid patching Reddit or RES globals.
- Do not rely on RES internal APIs for v1.
- Keep provider-specific parsing behind adapters and fixtures.

### Normalize media early

The slideshow should not render raw Reddit posts directly. Provider resolvers should return normalized slide items.

Suggested normalized slide fields:

- `id`: stable slide ID, ideally post ID plus media index.
- `postId`: Reddit post fullname or ID.
- `provider`: `reddit-image`, `reddit-gallery`, `reddit-video`, `redgifs`, etc.
- `kind`: `image`, `video`, `animated`, or `fallback`.
- `mediaUrl`: playable/displayable URL when available.
- `posterUrl`: thumbnail/poster image when available.
- `sourceUrl`: original Reddit or external URL.
- `permalink`: Reddit comments URL.
- `title`: post title.
- `over18`: Reddit NSFW flag when present.
- `durationMode`: `timer`, `media-ended`, or `manual`.
- `audioAvailable`: boolean or unknown.
- `error`: resolver failure details for fallback slides.

This keeps the renderer simple and makes fixtures/test cases easier.

### Keep slideshow state explicit

Timer behavior is part of the product's personality and should be modeled intentionally.

Recommended state model:

- `queue`: ordered slide items plus pagination cursor.
- `currentIndex`: active slide index.
- `playback`: `playing` or `paused`.
- `timer`: configured image delay plus current deadline.
- `mediaPlayback`: current video state.
- `settings`: persisted user preferences.
- `pagination`: idle, loading, exhausted, or failed.

Manual next/previous should not implicitly pause playback. It should reset the current slide's timer deadline and continue the slideshow if playback is active.

### Prefer browser-native media behavior

Use `<img>` for images and `<video>` for Reddit videos/Redgifs clips when a playable URL is available. Avoid custom decoders, canvas rendering, or downloading blobs unless a specific provider forces it.

Practical rule:

- Use direct media URLs where allowed.
- Let `<video>` fire `ended` for automatic advancement.
- Handle `play()` promise rejection for autoplay-blocked cases.
- Default muted playback should be the safer setting because browsers are stricter about autoplay with sound.
- Do not bypass provider restrictions through brittle private endpoints.

### Be conservative with fetching

The extension should feel like a human browsing aid, not a scraper.

Practical rule:

- Fetch only the current listing and near-future pages.
- Use one pagination request at a time.
- Do not prefetch indefinitely.
- Respect `after` pagination and stop at exhaustion.
- Watch `X-Ratelimit-*` response headers when present.
- Back off on `429`, `403`, or repeated provider failures.
- Avoid storing Reddit content beyond what is needed for the active queue.

Reddit's current policy surface is broader than the old unauthenticated `.json` habit. We should keep this extension scoped as a user-agent-side convenience for the current user, not a data collection tool.

## Firefox-Specific Practices

### Decide Manifest V2 vs Manifest V3 deliberately

Firefox supports WebExtensions broadly, but its Manifest V3 background support differs from Chromium. MDN currently notes that Firefox does not support `background.service_worker`; Firefox can use background scripts/pages where Chrome MV3 expects service workers.

Recommendation:

- Start Firefox-first and choose the manifest/background model that works best in Firefox.
- If cross-browser support becomes a goal, generate browser-specific manifests rather than distorting the Firefox architecture too early.
- Document the chosen manifest model in an ADR before implementation.

### Use the `browser` Promise API

Firefox exposes WebExtension APIs through the Promise-friendly `browser` namespace. Use `async`/`await` and Promise rejection handling throughout extension code.

If Chrome support is added later, Mozilla's `webextension-polyfill` can bridge much of the `browser` API style to Chromium.

### Use `storage.local` first

Settings should use `browser.storage.local` unless sync becomes an explicit feature. MDN notes that `storage.local` persists correctly for extension data, while `storage.sync` has additional requirements such as a stable add-on ID in Firefox.

Recommended settings for v1:

- Image timer.
- Custom timer value.
- Start muted.
- Autoplay enabled.
- Last chosen provider permission choices if useful.

Avoid storing:

- Viewed post history.
- Usernames.
- Full listing snapshots.
- NSFW browsing history.

### Build a real options page

The options page should be the durable home for settings. It should avoid inline scripts and event-handler attributes. Extension CSP disallows or discourages unsafe patterns such as `eval()` and remote scripts, and AMO policies can reject extensions with remote executable code.

Practical rule:

- Static HTML.
- Local CSS.
- Local JS modules.
- No remote scripts.
- No inline event handlers.
- No `eval`, `new Function`, or dynamic code loading.

## Security Practices

### Preserve the extension/page trust boundary

Content scripts run near untrusted page content. Reddit posts, comments, titles, and external provider metadata are untrusted input.

Practical rule:

- Use `textContent` for titles and labels.
- Avoid `innerHTML` for Reddit/provider content.
- If rich content is ever needed, sanitize explicitly and test it.
- Do not expose privileged functions on `window`.
- Do not accept privileged commands from page scripts.

### Avoid remote executable code

Remote scripts and unsafe CSP relaxations are bad for user safety and add-on review. All executable code should ship in the extension package.

Allowed:

- Loading remote images/videos as media.
- Fetching JSON/media metadata from permitted hosts.

Not allowed for this project:

- Remote JavaScript.
- Remote CSS that can change UI behavior.
- Provider-supplied script execution.
- Dynamic code generation.

### Keep dependencies boring

Every dependency in an extension is also part of the user's browser trust surface.

Practical rule:

- Prefer no framework for the content overlay until complexity proves otherwise.
- If a build tool is used, keep runtime dependencies minimal.
- Avoid minified third-party code unless source/build provenance is clear.
- Pin dependency versions.
- Prefer small, inspectable libraries for tests/build only.

## Privacy Practices

### Data minimization

The extension should only process data needed to render the active slideshow.

Do:

- Read the current listing.
- Resolve media URLs.
- Store settings.

Do not:

- Record what subreddits were viewed.
- Record which posts were shown.
- Upload post data.
- Build analytics.

### Clear user-facing permission rationale

If the extension asks for Redgifs access at runtime, the prompt should be preceded by a plain explanation in the extension UI:

```text
Redgifs support needs permission to read Redgifs pages and media so the slideshow can play clips directly. If you decline, Redgifs posts will show an open-original fallback.
```

This should be short, honest, and specific.

### Private browsing

Firefox extensions do not necessarily run in private windows by default. Decide later whether private browsing support is desirable. If supported, the extension should avoid persistent history-like data and should make settings behavior predictable.

## Testing Strategy

### Unit tests

High-value unit tests:

- Current old Reddit URL to JSON listing URL conversion.
- Reddit post classification.
- Direct image resolver.
- Gallery resolver.
- Reddit video resolver.
- Redgifs URL detection and fallback behavior.
- Queue pagination state machine.
- Timer state machine.
- Settings validation/migration.

### Fixture tests

Save sanitized JSON fixtures for representative post types:

- Direct `i.redd.it` image.
- Reddit gallery with multiple images.
- Reddit-hosted video.
- Reddit-hosted GIF-like post.
- Redgifs link.
- Unsupported external link.
- NSFW post.
- Empty listing.
- Rate-limited/error response shape.

Fixtures should be small and scrub anything account-specific.

### Integration tests

Use local HTML fixtures that resemble old Reddit listing pages. These can test the content script without depending on live Reddit.

Test cases:

- Overlay injection.
- Keyboard navigation.
- Close behavior.
- RES-like DOM mutations/classes do not break launch.
- Timer continues after manual navigation.
- Autoplay rejection displays a play affordance.

### Browser tests

Use `web-ext run` for manual Firefox testing. Add Playwright or another browser automation path only when it can reliably load a temporary extension in Firefox for the scenarios we need.

Manual browser checklist for early versions:

- Load extension temporarily in Firefox.
- Open old Reddit subreddit listing.
- Start slideshow from browser action.
- Confirm images render at full available resolution.
- Confirm galleries expand in order.
- Confirm video `ended` advances.
- Confirm Redgifs behavior for playable and blocked cases.
- Confirm next-page pagination.
- Confirm settings persistence.
- Confirm RES installed does not break startup/navigation.

### Lint/build checks

Expected baseline commands once code exists:

```sh
npm test
npm run lint
npm run build
web-ext lint
```

`web-ext run` should be used regularly during development because it catches extension-specific packaging and manifest issues that ordinary JavaScript tooling misses.

## Project Structure Recommendation

This is a likely starting structure, not a final commitment:

```text
extension/
  manifest.json
  background/
    background.js
    queue-service.js
    provider-service.js
  content/
    content-script.js
    overlay.js
    overlay.css
  options/
    options.html
    options.js
    options.css
  shared/
    messages.js
    settings.js
    slide-types.js
    reddit-url.js
    providers/
      reddit-image.js
      reddit-gallery.js
      reddit-video.js
      redgifs.js
tests/
  fixtures/
    reddit/
    old-reddit-pages/
  unit/
  integration/
docs/
```

Keep modules small. The most important boundary is between data resolution and rendering.

## Implementation Guidelines

### Queue builder

- Accept a current page URL and optional DOM hints.
- Convert it to a Reddit JSON listing URL.
- Fetch one page at a time.
- Emit normalized slides.
- Preserve Reddit order.
- Expand multi-item posts into multiple slides.
- Trigger background pagination before the queue is empty.

### Provider resolvers

- Each resolver gets a normalized Reddit post candidate.
- Each resolver returns zero or more slides.
- Resolvers should be pure when possible.
- Network work should be isolated and mockable.
- Failures should return fallback slide data instead of throwing into the UI layer.

### Overlay renderer

- Owns DOM rendering and keyboard events.
- Receives normalized slide data only.
- Does not know Reddit JSON field details.
- Handles media loading states.
- Handles video play/ended/error events.
- Keeps controls accessible and unobtrusive.

### Settings

- Define defaults in one module.
- Validate stored settings before use.
- Version settings if migrations become necessary.
- UI changes should update current session state without requiring reload.

## Release And Review Practices

### Development installs

Use `web-ext run` and Firefox temporary add-ons during development.

### Packaging

Use `web-ext build` once packaging exists. Keep artifacts out of git unless there is a deliberate release process.

### Signing

For normal Firefox use, extensions need signing even when self-distributed. Plan for AMO signing before calling a release installable.

### AMO review posture

Make review easy:

- Keep code readable.
- Avoid obfuscation.
- Avoid remote executable code.
- Document permissions.
- Include a privacy statement.
- Avoid unnecessary dependencies.
- Keep source maps/build instructions if bundling is used.

## Specific Recommendations For This Project

1. Start with a standalone Firefox WebExtension.
2. Use a content-script overlay and background-script services.
3. Use Reddit listing JSON for queue data and pagination.
4. Keep Redgifs behind an explicit provider adapter and permission boundary.
5. Treat unsupported media as a normal fallback slide, not an exception.
6. Default muted video playback on, but persist the user's choice.
7. Keep the image timer running across manual navigation.
8. Avoid all analytics and remote services.
9. Build unit tests around fixtures before relying on live Reddit.
10. Document every significant architecture/security decision as an ADR.

## Open Follow-Up Research

- Verify current Firefox behavior for MV2 vs MV3 in the exact APIs we need.
- Test optional host permissions UX for Redgifs in Firefox.
- Collect representative old Reddit and Reddit JSON fixtures.
- Test Redgifs direct playback behavior in Firefox with real links.
- Confirm whether `old.reddit.com` listing JSON sends useful rate-limit headers in this use case.
- Review RES source for keyboard and DOM interaction conflict risks.
