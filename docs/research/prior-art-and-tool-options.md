# Prior Art And Tool Options

Date: 2026-05-29
Status: Draft

## Purpose

This document surveys existing tools that overlap with a Firefox-first old Reddit media slideshow extension. It focuses on whether we can reuse, fork, contribute to, or learn from existing open-source projects.

## Desired Fit Criteria

An ideal existing tool would:

- Work in Firefox.
- Work from the current `old.reddit.com` page/feed.
- Use the user's existing Reddit session where needed.
- Coexist with Reddit Enhancement Suite.
- Show media as a full-screen slideshow rather than only a grid.
- Preserve Reddit listing order.
- Paginate into next listing pages.
- Expand Reddit galleries into sequential slides.
- Prefer full-resolution `i.redd.it` media over preview URLs.
- Preserve a path toward downloads and high-resolution image inspection.
- Support Reddit-hosted videos/GIF-like media.
- Support Redgifs or degrade gracefully.
- Offer arrow-key navigation.
- Offer image timers such as 3, 5, 10 seconds, plus custom.
- Continue automatic playback after manual navigation.
- Be open source with a usable license and active enough maintenance.

No tool found so far satisfies this whole set.

## Summary Table

| Tool                                  | Type                       | Open Source                         | Firefox                  | Old Reddit Current Page                          | Slideshow                     | Pagination                  | Redgifs                  | Fit                                             |
| ------------------------------------- | -------------------------- | ----------------------------------- | ------------------------ | ------------------------------------------------ | ----------------------------- | --------------------------- | ------------------------ | ----------------------------------------------- |
| RedditP                               | Hosted web app             | Yes, MIT                            | Browser-agnostic website | Not an extension overlay                         | Yes                           | Yes-ish via Reddit listings | Unknown/currently risky  | Strong prior art, weak direct fit               |
| redditpx                              | Hosted web app             | Reported open source                | Browser-agnostic website | Not an extension overlay                         | Yes                           | Unknown                     | Unknown                  | Possible inspiration; needs source verification |
| Rexplorer                             | Browser extension          | Not found as OSS                    | Chrome Web Store focus   | Reddit page overlay                              | Lightbox/slideshow/cycle      | Yes/free cap                | Unknown                  | Strong product reference, not reuse candidate   |
| Reddit Slideshow Chrome extension     | Browser extension          | Source view claimed, repo not found | Chrome focus             | Reddit web, likely not old-Reddit-first          | Yes                           | Unknown                     | Unknown                  | Product reference, not reliable OSS base        |
| Reddit Gallery Keys                   | Browser extension          | Yes, MIT                            | Firefox add-on exists    | New Reddit gallery lightbox, not old Reddit feed | No                            | No                          | No                       | Useful tiny extension reference only            |
| Reddit Enhancement Suite              | Browser extension          | Yes, GPL-3.0                        | Yes                      | Yes                                              | Not this feature              | N/A                         | Historically constrained | Compatibility target/future upstream path       |
| RedditEnhancer                        | Browser extension          | Yes                                 | Browser extension        | Some old Reddit UI tweaks                        | No                            | No                          | No                       | Adjacent UI tweak reference                     |
| Slide for Reddit                      | Android app                | Yes                                 | No                       | N/A                                              | Media browsing, not extension | App-specific                | Unknown                  | Product inspiration only                        |
| Reddit gallery saver/downloader tools | Browser extensions/scripts | Some OSS                            | Mostly Chrome            | Varies                                           | No                            | Varies                      | Usually no               | Resolver/download inspiration only              |

## Candidate Notes

### RedditP

Links:

- Website: https://www.redditp.com/
- GitHub: https://github.com/ubershmekel/redditp
- Repository metadata mirror: https://repos.ecosyste.ms/hosts/GitHub/repositories/ubershmekel%2Fredditp
- Open Hub: https://openhub.net/p/redditp

What it is:

RedditP is the closest conceptual match: a full-screen Reddit presentation/slideshow web app. Search result metadata describes it as MIT licensed and as converting Reddit pages into a presentation or slideshow. Its documented hotkeys include auto-next, mute, image open, comments open, fullscreen, arrow navigation, page navigation, and mobile swipe gestures.

Useful ideas:

- Slideshow-first rather than gallery-first interaction.
- Keyboard controls map closely to our desired lean-back browsing mode.
- It supports many Reddit URL forms, including subreddits and sort parameters.
- It has old project maturity and a simple JavaScript footprint.

Gaps for our project:

- It is a hosted web app, not a Firefox content-script overlay on the user's current old Reddit page.
- It is not RES-aware.
- It likely cannot use the exact current old Reddit DOM/session context in the same way an extension can.
- It may not handle modern Reddit galleries, Reddit-hosted video, and Redgifs to our desired level without significant work.
- Depending on current code shape, forking it might import old assumptions that are harder to modernize than starting fresh.

Recommendation:

Use RedditP as product and interaction prior art. Review its source before implementing queue/timer/keyboard details. Do not start by forking it unless source review reveals a small, modern, easily portable queue/media core.

### redditpx

Links:

- Comparison reference: https://champsignal.com/comparisons/redditp.com-vs-redditpx.com

What it is:

Search results describe redditpx as a free, open-source web app and a modern alternative to RedditP. The research so far did not find a canonical source repository with enough confidence.

Useful ideas:

- Modernized RedditP-like experience may reveal useful UX expectations.
- Could be a better current-media reference than RedditP if its source is found and healthy.

Gaps:

- Source repository not yet verified.
- Hosted web app shape still does not match our extension/current-page requirement.
- Unknown Firefox/old Reddit/Redgifs behavior.

Recommendation:

Keep as a follow-up research item. Do not base architecture on it until the source repo, license, and maintenance state are verified.

### Rexplorer Media Gallery For Reddit

Links:

- Product page: https://ansonalexander.com/rexplorer/
- Privacy policy: https://ansonalexander.com/rexplorer/privacy
- Chrome Web Store listing: https://chromewebstore.google.com/detail/rexplorer-media-gallery-f/hjenjhaialjnedkpdgchfcbkldcackpa

What it is:

Rexplorer is a polished Reddit media gallery browser extension. Its product page describes a full-screen grid, lightbox viewer, keyboard shortcuts, infinite scrolling, filters, sorting, slideshow/auto-cycle behavior, local storage for preferences/favorites, and paid Pro features.

Useful ideas:

- Good evidence that users want this shape of product.
- Good product reference for controls, filtering, and local-only privacy posture.
- Its privacy policy names Reddit listing JSON requests and local extension storage patterns similar to our planned architecture.
- It validates that an overlay on Reddit pages can work as a product.

Gaps:

- I did not find a public source repository.
- Chrome-first distribution; Firefox support is unclear.
- Product is gallery-first/lightbox-first, while our target is slideshow-first.
- Free tier has per-feed limits and Pro features, which does not match our local open-source goal.
- Unknown old Reddit and RES behavior.

Recommendation:

Use as UX and competitive reference, not as a code base.

### Reddit Slideshow Chrome Extension

Links:

- Chrome Web Store mirror/source-view page: https://extpose.com/ext/jnjpgagcbhkomjfkfimifpddphbiilkh
- Reddit announcement thread: https://www.reddit.com/r/chrome_extensions/comments/pxej1v

What it is:

A Chrome extension named "Reddit Slideshow" describes itself as bringing the Reddit app slideshow view to the website. The Extpose page claims the source is readable through its viewer and says the extension needs a signed-in Reddit account. A Reddit thread from the author asks whether users want old Reddit support.

Useful ideas:

- Confirms the exact feature desire has existed for years.
- May be worth source-reading through extension-source viewers to learn how it discovers Reddit media.

Gaps:

- I did not find a canonical GitHub/source repo.
- Chrome-first.
- Unclear license.
- Unclear Firefox/old Reddit support.
- Unclear handling of galleries, full-resolution media, pagination, Redgifs, and RES.
- Source-view mirrors are not the same as a maintained open-source project.

Recommendation:

Treat as prior art only. Do not fork unless a legitimate source repository and license are found.

### Reddit Gallery Keys

Links:

- Firefox Add-ons listing: https://addons.mozilla.org/en-CA/firefox/addon/reddit-gallery-keys/
- GitHub: https://github.com/uherman/reddit-gallery-keys

What it is:

A tiny MIT-licensed extension that lets users navigate Reddit's image gallery lightbox with arrow keys. The repository explains it is a single content script using Manifest V3, detects the Reddit lightbox, traverses shadow DOM, and clicks Reddit's own previous/next buttons.

Useful ideas:

- Good small reference for minimal extension packaging.
- Good reference for keyboard handling etiquette: ignore arrow keys while typing.
- Good reference for robust selectors on modern Reddit web components.
- Privacy posture is simple and local-only.

Gaps:

- New Reddit/lightbox only, not old Reddit feed overlay.
- No queue, slideshow, timer, pagination, Redgifs, RES integration, or full-resolution resolver.

Recommendation:

Use as a tiny code-style and permission-minimization reference, not a base.

### Reddit Enhancement Suite

Links:

- GitHub: https://github.com/honestbleeps/Reddit-Enhancement-Suite

What it is:

RES is the mature, open-source browser extension for old Reddit power users. It is directly relevant because the intended user already uses RES.

Useful ideas:

- Large source of old Reddit compatibility knowledge.
- Useful for identifying DOM mutation and keyboard shortcut conflict risks.
- Possible future PR/fork target if our standalone extension proves valuable.

Gaps:

- Building directly inside RES would slow early iteration.
- GPL-3.0 license affects reuse and downstream licensing if code is copied.
- RES has a large architecture and maintenance/review process.
- The desired slideshow is larger than a small tweak to existing RES behavior.

Recommendation:

Keep standalone v1. Read RES source for compatibility concerns. Revisit upstream contribution after prototype success.

### RedditEnhancer

Links:

- GitHub: https://github.com/joelacus/RedditEnhancer

What it is:

An open-source Reddit UI tweak browser extension. Search snippets mention old Reddit image/comment UI tweaks.

Useful ideas:

- Potential reference for cross-browser extension structure and Reddit UI modification patterns.
- May reveal old Reddit-specific selector strategies.

Gaps:

- Not a slideshow/media queue tool.
- Scope is UI enhancement rather than media browsing.

Recommendation:

Optional code reference only.

### Slide For Reddit

Links:

- GitHub: https://github.com/cygnusx-1-org/Slide/

What it is:

An open-source Android Reddit client. It is a full Reddit browsing app rather than a browser extension.

Useful ideas:

- Product inspiration for media-first Reddit browsing.
- Potential reference for provider handling if code is easy to inspect.

Gaps:

- Android app, not Firefox extension.
- Does not operate on old Reddit or coexist with RES.
- Reddit third-party client ecosystem has been disrupted by API policy changes.

Recommendation:

Product inspiration only. Not a technical base.

### Reddit Gallery Saver / Downloader Tools

Links:

- Reddit Gallery Saver announcement: https://www.reddit.com/r/chrome_extensions/comments/1s32vx8/i_got_tired_of_rightclicking_20_times_to_save/
- Mentioned repo: https://github.com/GauravZn/reddit-gallery-saver
- Gallery-dl: https://github.com/mikf/gallery-dl

What they are:

Tools focused on saving/downloading Reddit media rather than viewing it as a slideshow. Some are browser extensions, some are command-line downloaders.

Useful ideas:

- Media URL resolution logic, especially Reddit galleries and direct media.
- Edge cases for video/audio separation.
- Test fixtures for provider behavior if licenses permit reading/learning.

Gaps:

- Downloading is a different product with different privacy, permission, and policy implications.
- Not focused on old Reddit overlay, timers, keyboard slideshow, or RES coexistence.

Recommendation:

Use as resolver and future v2 download research only. Avoid turning v1 into a downloader.

## Broader Observations

### There are two product families

The existing ecosystem splits into:

- Hosted slideshow web apps: RedditP, redditpx, Peekstr, Gopiandcode's Reddit Slideshow.
- Browser extensions that enhance Reddit pages: Rexplorer, Reddit Slideshow Chrome extension, RES, Reddit Gallery Keys, RedditEnhancer.

Our desired product is a hybrid: a browser extension with the lean-back slideshow behavior of hosted slideshow apps, but launched from and integrated with the current old Reddit session.

### Most close matches are not ideal bases

The closest slideshow tools are web apps, not old Reddit extensions. The closest extension tools are gallery/lightbox or UI helpers, not full slideshow queue engines.

### Redgifs remains a differentiator and risk

Most discovered tools do not clearly document robust Redgifs support. This reinforces the provider-adapter/fallback design.

### Downloads and pan/zoom are adjacent but distinct

Downloader tools can help us understand media resolution and filename edge cases, but their product incentives are different. Pan/zoom features are more common in image viewers than Reddit extensions, so v2 should likely borrow interaction patterns from desktop image viewers rather than Reddit-specific tools alone.

### Open source status is uneven

Some projects are clearly open source with licenses. Others expose extension source through store mirrors or marketing pages but do not provide a canonical repo/license. For reuse, "source visible" is not enough.

## Recommendation

Do not adopt or fork an existing project as the main codebase yet.

Instead:

1. Build a standalone Firefox-first WebExtension.
2. Review RedditP source for slideshow interaction and queue ideas.
3. Review Reddit Gallery Keys for minimal extension and keyboard handling patterns.
4. Review RES for old Reddit compatibility and possible keyboard/DOM conflicts.
5. Use Rexplorer as a competitive UX reference, not as code.
6. Keep redditpx and Gopiandcode's slideshow on the research list until source/license are verified.

This keeps us free to build the exact old Reddit/Firefox/RES/Redgifs experience while still learning from the ecosystem.

## Follow-Up Research

- Locate and verify the canonical source repository for redditpx.
- Locate the source repository and license for Gopiandcode's Reddit Slideshow.
- Inspect RedditP's current media resolver for galleries, videos, and Redgifs.
- Inspect media downloader tools for filename, MIME type, and full-resolution URL handling before v2 download work.
- Review image-viewer pan/zoom interaction patterns before v2 high-resolution image inspection work.
- Inspect RES modules related to media expansion and keyboard shortcuts.
- Test Rexplorer manually against old Reddit and Firefox if a Firefox build exists.
- Read the Reddit Slideshow Chrome extension source through a source viewer only if its license/reuse status becomes clear.
