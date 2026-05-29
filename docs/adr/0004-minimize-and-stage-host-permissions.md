# ADR 0004: Minimize And Stage Host Permissions

Date: 2026-05-29
Status: Proposed

## Context

The extension needs access to old Reddit pages, Reddit listing JSON, Reddit-hosted media, and selected external media providers such as Redgifs. Browser extension permissions are visible to users and directly affect trust. Firefox also supports runtime permission requests for optional permissions, which can let an extension ask for external-provider access only when a user needs it.

The tempting shortcut is to request broad host access, such as all websites, so any external media host can be resolved. That would make development easier but would be disproportionate to the product.

## Decision

Use the narrowest practical install-time host permissions and stage external provider permissions.

Core Reddit permissions should be required for v1. External providers such as Redgifs should either be declared narrowly at install time or requested as optional host permissions when the user enables or encounters that provider.

Redgifs is expected to be embedded via its first-party iframe (`/ifr/<id>`). Because the iframe is a page element rather than an extension-initiated fetch, playback should not require a `redgifs.com` host permission. That needs to be validated in Firefox on a real old Reddit page before this ADR is accepted. A Redgifs host permission should only be added if we fetch optional metadata from a Redgifs API endpoint, and that permission should be requested from a user gesture via `optional_host_permissions`.

## Consequences

Benefits:

- Higher user trust.
- Cleaner Firefox add-on review story.
- Less privacy risk if the extension has a bug.
- Better alignment with the product's local-first design.

Costs:

- Provider support requires more explicit permission handling.
- Some media may fall back until the user grants a provider permission.
- Testing must cover granted, denied, and revoked permission states.

## Implementation Guidance

- Do not request all-URL host access for v1.
- Keep Reddit host permissions separate from provider host permissions.
- Show a short in-product explanation before requesting optional provider permissions.
- Gracefully handle permission denial by showing an open-original fallback slide.
- Listen for permission removal if optional permissions are used.

## Follow-Up

Create real Firefox prototypes for Redgifs iframe playback and any metadata permission flow before accepting this ADR as final.
