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

## Status

These are living planning docs. They capture current research and decisions, but they are not yet an implementation plan.
