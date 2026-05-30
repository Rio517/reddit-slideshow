# Reddit Slideshow Documentation

This directory holds planning material for a Firefox-first browser extension that turns the current old Reddit feed into a keyboard-driven media slideshow.

## Documents

- [Product spec draft](product/reddit-slideshow-product-spec.md): product goals, scope, user experience, open questions, and acceptance criteria.
- [Research notes](research/initial-research.md): source-backed notes on Firefox extensions, old Reddit behavior, Reddit listing pagination, RES, and external media providers.
- [Extension development best practices](research/extension-development-best-practices.md): architecture, security, permissions, testing, Reddit access, and release guidance.
- [Prior art and tool options](research/prior-art-and-tool-options.md): existing slideshow/gallery tools, reuse candidates, and gaps.
- [ADR 0001](adr/0001-standalone-firefox-webextension.md): build as a standalone Firefox WebExtension first.
- [ADR 0002](adr/0002-provider-based-media-resolution.md): resolve media through provider adapters.
- [ADR 0003](adr/0003-paginate-current-reddit-listing.md): keep the slideshow queue going through Reddit listing pagination.
- [ADR 0004](adr/0004-minimize-and-stage-host-permissions.md): minimize install-time permissions and stage external-provider permissions.
- [ADR 0005](adr/0005-manifest-v3-event-page-and-wxt-build.md): adopt Manifest V3 (event page) and a WXT-based build.
- [ADR 0006](adr/0006-duplicate-detection.md): detect and skip duplicate media in the slideshow queue.
- [Foundation plan](superpowers/plans/2026-05-29-foundation-wxt-mv3.md): task-by-task plan for the WXT/MV3 scaffold, shared core, and offline fixtures.

## Status

These are living planning docs capturing current research and decisions. v1 of the extension is built and feature-complete.
