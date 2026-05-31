# ADR 0004: Minimize And Stage Host Permissions

Date: 2026-05-29
Status: Accepted

## Context

The extension needs access to old Reddit pages, Reddit listing JSON, Reddit-hosted media, and selected external media providers such as Redgifs. Browser extension permissions are visible to users and directly affect trust. Firefox also supports runtime permission requests for optional permissions, which can let an extension ask for external-provider access only when a user needs it.

The tempting shortcut is to request broad host access, such as all websites, so any external media host can be resolved. That would make development easier but would be disproportionate to the product.

## Decision

Use the narrowest practical install-time host permissions and stage the rest.

**Install-time `host_permissions`** are the hosts the extension must fetch from
to function:

- `old.reddit.com`, `www.reddit.com` - listing JSON for both frontends (ADR 0008).
- `i.redd.it`, `v.redd.it` - Reddit-hosted images and video.
- `api.redgifs.com`, `media.redgifs.com` - Redgifs is played as native video
  (ADR 0010): the background resolves the clip's direct mp4 from the API and
  fetches the bytes, because the CDN hotlink-protects against a reddit `Referer`.
  That is an extension-initiated fetch, so it needs the host permission. (The
  iframe fallback, used only when resolution fails, is a page element and needs
  no host permission - just the page's `frame-src`.)

**Optional `optional_host_permissions`**, requested from a user gesture only when
the feature is enabled and removed when it is disabled:

- `preview.redd.it`, `external-preview.redd.it` - read pixels for the opt-in
  content-based duplicate detection (ADR 0006 Layer 2).

No all-URLs or broad host access is requested.

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

When submitting to the stores, justify each install-time host in the listing's
permission rationale (see the privacy policy for the same list).
