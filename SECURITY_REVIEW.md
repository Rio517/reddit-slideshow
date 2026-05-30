# Security Review

Date: 2026-05-30

## Scope

Reviewed manifest permissions, runtime messaging, DOM injection, iframe/media
rendering, settings storage, network fetches, and dependency audit results.

## Findings

### S2 — Dev dependency audit has critical/high findings

References: `package.json`, `package-lock.json`

`npm audit --omit=dev --json` reports no production dependency
vulnerabilities, which is good for the shipped extension runtime. A full
`npm audit --json` reports 6 dev-tooling vulnerabilities:

- `happy-dom` critical/high advisories, fix available at `20.9.0`.
- `wxt`/`web-ext-run`/`tmp` high-severity tooling chain findings.
- `uuid`/`node-notifier` moderate transitive findings.

Why it matters: these are not packaged into the extension runtime, but they do
affect local/CI test and build tooling. The `happy-dom` advisory class is
especially relevant because tests execute fixture-shaped DOM inputs.

Recommendation: upgrade `happy-dom` first, then investigate whether a newer WXT
or transitive override can clear `web-ext-run`/`tmp` without downgrading WXT.
Keep `npm audit --omit=dev` as the runtime-packaging gate and full `npm audit`
as the developer-tooling gate.

### S3 — Background sender validation is present but untested

Reference: `entrypoints/background.js:8`

The background listener rejects messages whose `sender.id` is not the extension
ID, and the requested page URL is later constrained by `toListingJsonUrl()`.
That is the right shape for a sensitive fetch boundary.

Why it matters: this is a security boundary and was recently changed. There is
no test that exercises accepted/rejected sender shapes around
`slideshow.requestPage`.

Recommendation: extract the message handler into a small exported function or
add an entrypoint-level test that proves messages with missing/foreign
`sender.id` are ignored and own-extension messages are handled.

### S3 — Redgifs iframe capability can likely be narrower

Reference: `lib/overlay-render.js:78`

Provider iframes are sandboxed without popups, forms, or top-navigation, which
is a strong default. The iframe currently grants:

```text
allow="autoplay; fullscreen; encrypted-media"
```

Why it matters: `encrypted-media` is probably unnecessary for Redgifs playback
and widens provider capability without a current product requirement.

Recommendation: remove `encrypted-media` unless live validation proves it is
required. Keep the sandbox as-is unless Redgifs playback breaks.

## Positive Notes

- No `innerHTML`, `eval`, dynamic scripts, remote extension code, analytics, or
  broad host permissions were found.
- Manifest permissions are narrow: `storage`, `old.reddit.com`, `i.redd.it`,
  and `v.redd.it`.
- `browser_specific_settings.gecko.data_collection_permissions.required` is
  `["none"]`.
- Original/source opening is guarded to `http:`/`https:` URLs in
  `entrypoints/content.js:112`.
- Redgifs embed URLs are constructed from a parsed ID and a fixed
  `https://www.redgifs.com` origin in `lib/slides.js:181`.

## Residual Risk

The extension intentionally renders cross-origin media and a third-party
Redgifs iframe inside old Reddit. That is a product requirement; keep future
provider additions behind explicit adapters, narrow permissions, and sandboxed
renderers.
