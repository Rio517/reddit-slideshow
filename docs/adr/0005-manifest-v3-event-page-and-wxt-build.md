# ADR 0005: Adopt Manifest V3 (event page) and a WXT-based build

Date: 2026-05-29
Status: Proposed

## Context

Two facts constrain the manifest and build choices for this extension:

1. **Firefox MV3 uses non-persistent event pages, not service workers, and MV3
   removes persistent background pages.** MV2 is not deprecated on Firefox
   (Mozilla promises ≥12 months' notice), but it carries no functional advantage
   here — this extension has no blocking `webRequest` need (the one real Firefox
   MV2 advantage). Chrome has fully removed MV2 (139+), so any future
   cross-browser build requires MV3.

2. **A bundler is mandatory regardless of manifest version.** Firefox has never
   supported ES-module `import` in content scripts (platform bug
   [1451545](https://bugzilla.mozilla.org/show_bug.cgi?id=1451545), open since
   2018). The content script depends on shared modules, so the source must be
   bundled — the raw tree cannot be loaded directly.

The project's code style (static HTML/CSS/JS modules, `textContent`, no
`innerHTML`/`eval`) already satisfies the strict MV3 CSP.

## Decision

1. **Target Manifest V3 with a non-persistent event page.** Use the `action`
   key (not `browser_action`), `host_permissions` for Reddit hosts, and
   `optional_host_permissions` for any later optional provider host (e.g. the
   optional `api.redgifs.com` metadata endpoint — note Redgifs playback itself
   needs no host permission; see ADR 0004). Background is
   `background: { scripts: [...], persistent: false }` (event page); a Chrome
   `service_worker` key may be added later for cross-browser builds.

2. **Adopt WXT (`wxt.dev`) as the build tool.** WXT is a Vite-based,
   framework-agnostic WebExtension framework that bundles content/background/
   options, generates per-browser manifests, and integrates with Vitest
   (auto-mocking `browser.*` in-memory via `@webext-core/fake-browser`). It
   supports plain DOM with no UI framework, matching the "keep dependencies
   boring" principle, and solves the mandatory-bundler requirement. Configure it
   to emit a Firefox MV3 build (and optionally a Chrome MV3 build from the same
   source).

3. **Keep `web-ext lint` / `web-ext run`** in the loop, pointed at WXT's **built**
   output (`.output/firefox-mv3/`), which is what AMO actually receives.

4. **Add `browser_specific_settings.gecko.id`** (required for `storage.sync` and
   unsigned dev installs; otherwise `web-ext lint` warns `MISSING_ADDON_ID`).

## Consequences

Benefits:

- Aligns with the modern, supported Firefox model (event page) and avoids the
  deprecated persistent-background pattern.
- Cross-browser optionality preserved (Chrome requires MV3).
- A correct build pipeline from day one; content-script shared imports actually
  load.
- WXT removes per-browser manifest hand-maintenance and provides a tested
  `browser.*` mock for unit tests.

Costs:

- WXT imposes a file-based `entrypoints/` convention and owns manifest
  generation (configured in `wxt.config.ts`, not a hand-written `manifest.json`).
  The foundation plan must be re-expressed in that layout.
- MV3 host permissions are user-revocable; a content script will not auto-inject
  without a granted host permission, so the extension must check
  `permissions.contains` / `permissions.request` for `old.reddit.com`.
- A new build dependency (WXT/Vite) enters the toolchain.

## Alternatives Considered

- **Stay MV2 (WXT can emit it):** defensible as a short-term speed choice and
  works on Firefox for years, but it carries the deprecated background model and
  blocks Chrome. Rejected for a greenfield build with no `webRequest` need.
- **Raw esbuild/Vite + hand-written manifest:** workable, but re-implements the
  per-browser manifest generation and test mocking WXT already provides, for
  little benefit on a small project.
- **Plasmo:** heavier and React/UI-framework-oriented; against the no-framework,
  local-first goal.

## Follow-Up

- Confirm the `permissions.contains` / `permissions.request` flow for the
  `old.reddit.com` host under MV3 in a real Firefox profile.
- Decide whether to also emit a Chrome MV3 build in CI (cheap with WXT, not
  needed for a Firefox-first v1).
