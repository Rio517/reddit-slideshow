# ADR 0004: Minimize And Stage Host Permissions

Date: 2026-05-29
Status: Proposed

## Context

The extension needs access to old Reddit pages, Reddit listing JSON, Reddit-hosted media, and selected external media providers such as Redgifs. Browser extension permissions are visible to users and directly affect trust. Firefox also supports runtime permission requests for optional permissions, which can let an extension ask for external-provider access only when a user needs it.

The tempting shortcut is to request broad host access, such as all websites, so any external media host can be resolved. That would make development easier but would be disproportionate to the product.

## Decision

Use the narrowest practical install-time host permissions and stage external provider permissions.

Core Reddit permissions should be required for v1. External providers such as Redgifs should either be declared narrowly at install time or requested as optional host permissions when the user enables or encounters that provider.

Note (updated per the [2026-05-29 audit](../research/2026-05-29-engineering-product-audit.md), §2): Redgifs is embedded via its first-party iframe (`/ifr/<id>`, the RES approach), which is a page element and therefore needs **no `redgifs.com` host permission at all**. A `redgifs` host permission is only required if the optional aspect-ratio metadata API (`api.redgifs.com`) is used — and playback does not depend on it. So Redgifs is the strongest case for the optional/staged pattern: install-time permissions can stay Reddit-only, and the metadata permission (if ever added) is requested from a user gesture. The MV2/MV3 key for that optional host differs (`optional_permissions` in MV2 vs `optional_host_permissions` in MV3, Firefox 128+).

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

Create real Firefox prototypes for Redgifs permission flows before accepting this ADR as final.
