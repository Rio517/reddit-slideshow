# Foundation And Offline Fixtures Implementation Plan

> **🛑 SUPERSEDED (2026-05-29).** This MV2/unbundled plan has been replaced by [`2026-05-29-foundation-wxt-mv3.md`](2026-05-29-foundation-wxt-mv3.md), which adopts WXT + Manifest V3 ([ADR 0005](../../adr/0005-manifest-v3-event-page-and-wxt-build.md)) and folds in the audit corrections below. Kept for history; do not implement this version.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **⚠️ Audit corrections (2026-05-29) — read before implementing.** The [engineering & product audit](../../research/2026-05-29-engineering-product-audit.md) found foundation-level issues in this plan. The most important:
> - **A bundler is required.** Firefox does not support ES-module `import` in content scripts (bug 1451545, open since 2018), so `content-script.js` cannot `import` from `shared/*.js` and the raw `extension/` tree will not load. Adopt **WXT** (or an equivalent bundler) before/while implementing; the file layout below should map onto WXT's `entrypoints/` convention. (Audit C-7, §3.)
> - **Settle MV2 vs MV3 first** with corrected reasoning (Firefox MV3 = event pages, not service workers). Capture it in an ADR. (Audit C-1, §1.)
> - **`options.js` must consume `shared/settings.js`** (`normalizeSettings`), not duplicate defaults — otherwise the Task-3 module is dead code. (Audit C-8.)
> - **Consider validating risk first.** This slice proves nothing about live Reddit access, Redgifs, or the actual experience. Consider running the live spikes in the audit (§5, P-1) before investing further in offline foundation.
>
> The inline fixes below (web-ext version, dead code, `filenameHint` null-guard, settings wiring note) have been applied to the snippets; the structural items above are flagged but left for a deliberate re-plan.

**Goal:** Create the first runnable Firefox WebExtension scaffold plus offline fixtures and tests for old Reddit page/listing parsing.

**Architecture:** Start with a Firefox-first, local-only extension and a small testable shared core. The first implementation slice avoids live Reddit dependency by using committed HTML/JSON fixtures that model old Reddit listings and Reddit API responses.

**Tech Stack:** JavaScript modules, Firefox WebExtensions, `browser` Promise API, Vitest for unit tests, `web-ext` for extension lint/run/build.

---

## Scope

This plan intentionally does not build the full slideshow UI. It creates the project foundation and proves we can parse representative offline Reddit data into normalized slide candidates.

Included:

- npm project scaffold.
- Firefox WebExtension manifest skeleton.
- Minimal background/content/options entrypoints.
- Shared settings and slide types.
- Offline fixture strategy.
- First old Reddit URL/listing URL converter.
- First Reddit listing fixture parser for direct images.
- Test commands and documentation.

Deferred:

- Full overlay UI.
- Keyboard navigation.
- Timers.
- Pagination fetch service.
- Reddit galleries.
- Reddit videos.
- Redgifs resolver.
- Downloads.
- Pan/zoom.

## File Structure

```text
package.json
README.md
extension/
  manifest.json
  background/background.js
  content/content-script.js
  content/overlay.css
  options/options.html
  options/options.js
  shared/reddit-url.js
  shared/settings.js
  shared/slides.js
tests/
  fixtures/
    old-reddit/
      subreddit-page.html
    reddit-json/
      subreddit-direct-images.json
  unit/
    reddit-url.test.js
    slides.test.js
docs/
  development/
    offline-fixtures.md
```

Responsibilities:

- `extension/manifest.json`: extension metadata, permissions, content script registration, options page.
- `extension/background/background.js`: minimal installed/running logging hook for now.
- `extension/content/content-script.js`: minimal old Reddit content script entrypoint.
- `extension/content/overlay.css`: reserved namespace and basic hidden root styles.
- `extension/options/options.html`: minimal options page shell.
- `extension/options/options.js`: loads/saves settings later; placeholder-safe minimal module now.
- `extension/shared/reddit-url.js`: converts old Reddit page URLs into listing JSON URLs.
- `extension/shared/settings.js`: default settings and validation.
- `extension/shared/slides.js`: normalizes Reddit JSON listing children into slide candidates.
- `tests/fixtures/old-reddit/subreddit-page.html`: sanitized old Reddit-like HTML fixture.
- `tests/fixtures/reddit-json/subreddit-direct-images.json`: sanitized Reddit listing JSON fixture.
- `tests/unit/reddit-url.test.js`: URL conversion tests.
- `tests/unit/slides.test.js`: direct-image slide normalization tests.
- `docs/development/offline-fixtures.md`: explains fixture purpose, how to refresh safely, and what not to commit.

## Task 1: npm And Tooling Baseline

**Files:**

- Create: `package.json`
- Create: `README.md`
- Modify: `.gitignore`

- [ ] **Step 1: Create `package.json`**

Create `package.json` with:

```json
{
  "name": "reddit-slideshow",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "description": "Firefox-first old Reddit media slideshow extension.",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "webext:lint": "web-ext lint --source-dir extension",
    "webext:run": "web-ext run --source-dir extension --firefox-profile ./tmp/firefox-profile",
    "webext:build": "web-ext build --source-dir extension --artifacts-dir dist"
  },
  "devDependencies": {
    "vitest": "^3.2.0",
    "web-ext": "^10.0.0"
  }
}
```

- [ ] **Step 2: Create project `README.md`**

Create `README.md` with:

```markdown
# Reddit Slideshow

Firefox-first browser extension for turning the current old Reddit listing into a media slideshow.

## Development

Install dependencies:

```sh
npm install
```

Run unit tests:

```sh
npm test
```

Lint the extension package:

```sh
npm run webext:lint
```

Run the extension in Firefox:

```sh
npm run webext:run
```

Planning docs live in `docs/`.
```

- [ ] **Step 3: Update `.gitignore`**

Append:

```gitignore
node_modules/
dist/
tmp/
coverage/
```

Keep the existing `.superpowers/` entry.

- [ ] **Step 4: Install dependencies**

Run:

```sh
npm install
```

Expected: `package-lock.json` is created and dependencies install successfully.

- [ ] **Step 5: Commit tooling baseline**

Run:

```sh
git add .gitignore README.md package.json package-lock.json
git commit -m "chore: add extension tooling baseline"
```

Expected: commit succeeds.

## Task 2: Extension Skeleton

**Files:**

- Create: `extension/manifest.json`
- Create: `extension/background/background.js`
- Create: `extension/content/content-script.js`
- Create: `extension/content/overlay.css`
- Create: `extension/options/options.html`
- Create: `extension/options/options.js`

- [ ] **Step 1: Create `extension/manifest.json`**

Create:

```json
{
  "manifest_version": 2,
  "name": "Reddit Slideshow",
  "version": "0.1.0",
  "description": "Turn old Reddit listings into a media slideshow.",
  "permissions": [
    "storage",
    "https://old.reddit.com/*",
    "https://www.reddit.com/*",
    "https://i.redd.it/*",
    "https://v.redd.it/*"
  ],
  "background": {
    "scripts": ["background/background.js"]
  },
  "content_scripts": [
    {
      "matches": ["https://old.reddit.com/*"],
      "js": ["content/content-script.js"],
      "css": ["content/overlay.css"],
      "run_at": "document_idle"
    }
  ],
  "options_ui": {
    "page": "options/options.html",
    "browser_style": true
  },
  "browser_action": {
    "default_title": "Start Reddit Slideshow"
  }
}
```

Note (corrected per audit C-1): this scaffold uses Manifest V2. MV2 still works on Firefox indefinitely, but "Firefox supports persistent background scripts cleanly" is the wrong reason — MV3 on Firefox uses **event pages**, not service workers, and persistent backgrounds are the deprecated direction. Treat MV2 as a conscious, time-boxed choice and prefer MV3 + event page + `action` for a new extension; a build tool (WXT) can emit both. Also add `browser_specific_settings.gecko.id` (required for `storage.sync` and unsigned dev installs; otherwise `web-ext lint` warns `MISSING_ADDON_ID`). Settle this in an ADR before implementation.

- [ ] **Step 2: Create `extension/background/background.js`**

Create:

```js
browser.runtime.onInstalled.addListener(() => {
  console.info("Reddit Slideshow installed");
});

browser.browserAction.onClicked.addListener(async (tab) => {
  if (!tab.id) return;

  await browser.tabs.sendMessage(tab.id, {
    type: "slideshow.startRequested",
    payload: { source: "browserAction" }
  });
});
```

> **Audit C-9 / H-10:** `tabs.sendMessage` rejects ("Could not establish connection") on any tab without a content script — i.e. every non-`old.reddit.com` tab, including `www.reddit.com` (which has the host permission but no content-script match). This `async` listener has no `try/catch`, so that is an unhandled rejection with no user feedback. Wrap the send in `try/catch` and surface "open an old.reddit.com listing first" (or gate the action by `tab.url` host). Separately, decide the host scope: either drop `www.reddit.com` from `permissions` and `SUPPORTED_HOSTS`, or add it to `content_scripts.matches` — the three lists must agree.

- [ ] **Step 3: Create `extension/content/content-script.js`**

Create:

```js
const ROOT_ID = "reddit-slideshow-root";

function ensureRoot() {
  let root = document.getElementById(ROOT_ID);
  if (root) return root;

  root = document.createElement("div");
  root.id = ROOT_ID;
  root.hidden = true;
  root.textContent = "Reddit Slideshow";
  document.documentElement.append(root);
  return root;
}

browser.runtime.onMessage.addListener((message) => {
  if (message?.type !== "slideshow.startRequested") return undefined;

  const root = ensureRoot();
  root.hidden = false;
  return Promise.resolve({ ok: true });
});
```

- [ ] **Step 4: Create `extension/content/overlay.css`**

Create:

```css
#reddit-slideshow-root {
  position: fixed;
  inset: 0;
  z-index: 2147483647;
  display: grid;
  place-items: center;
  color: #f8fafc;
  background: rgba(7, 10, 15, 0.96);
  font: 16px/1.4 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

#reddit-slideshow-root[hidden] {
  display: none;
}
```

- [ ] **Step 5: Create `extension/options/options.html`**

Create:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Reddit Slideshow Options</title>
  </head>
  <body>
    <main>
      <h1>Reddit Slideshow</h1>
      <label>
        Image timer
        <select id="imageTimerSeconds">
          <option value="3">3 seconds</option>
          <option value="5">5 seconds</option>
          <option value="10">10 seconds</option>
        </select>
      </label>
      <label>
        <input id="startMuted" type="checkbox">
        Start videos muted
      </label>
    </main>
    <script type="module" src="options.js"></script>
  </body>
</html>
```

- [ ] **Step 6: Create `extension/options/options.js`**

Create:

```js
const DEFAULT_SETTINGS = {
  imageTimerSeconds: 5,
  startMuted: true
};

const timerSelect = document.querySelector("#imageTimerSeconds");
const mutedCheckbox = document.querySelector("#startMuted");

async function loadSettings() {
  const stored = await browser.storage.local.get(DEFAULT_SETTINGS);
  timerSelect.value = String(stored.imageTimerSeconds);
  mutedCheckbox.checked = Boolean(stored.startMuted);
}

async function saveSettings() {
  await browser.storage.local.set({
    imageTimerSeconds: Number(timerSelect.value),
    startMuted: mutedCheckbox.checked
  });
}

timerSelect.addEventListener("change", saveSettings);
mutedCheckbox.addEventListener("change", saveSettings);

loadSettings();
```

> **Audit C-8 (must fix in Task 3):** this snippet inlines its own `DEFAULT_SETTINGS` (missing `autoplay`) and never validates stored values. Once `shared/settings.js` exists (Task 3), replace the inline object with `import { DEFAULT_SETTINGS, normalizeSettings } from "../shared/settings.js"` and run `loadSettings` through `normalizeSettings(stored)`. Otherwise the Task-3 validation module has no runtime consumer and the two default sets will drift. Prefer a single `getSettings()` helper in `settings.js` that wraps `storage.local.get` + `normalizeSettings`.

- [ ] **Step 7: Run extension lint**

Run:

```sh
npm run webext:lint
```

Expected: lint passes with no errors.

- [ ] **Step 8: Commit extension skeleton**

Run:

```sh
git add extension
git commit -m "feat: add Firefox extension skeleton"
```

Expected: commit succeeds.

## Task 3: Shared Settings Module

**Files:**

- Create: `extension/shared/settings.js`
- Create: `tests/unit/settings.test.js`

- [ ] **Step 1: Write failing settings tests**

Create `tests/unit/settings.test.js`:

```js
import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, normalizeSettings } from "../../extension/shared/settings.js";

describe("normalizeSettings", () => {
  it("returns defaults for empty input", () => {
    expect(normalizeSettings({})).toEqual(DEFAULT_SETTINGS);
  });

  it("accepts supported timer values", () => {
    expect(normalizeSettings({ imageTimerSeconds: 10 }).imageTimerSeconds).toBe(10);
  });

  it("falls back when timer value is unsupported", () => {
    expect(normalizeSettings({ imageTimerSeconds: 999 }).imageTimerSeconds).toBe(5);
  });

  it("normalizes startMuted to a boolean", () => {
    expect(normalizeSettings({ startMuted: false }).startMuted).toBe(false);
    expect(normalizeSettings({ startMuted: "no" }).startMuted).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```sh
npm test -- tests/unit/settings.test.js
```

Expected: FAIL because `extension/shared/settings.js` does not exist.

- [ ] **Step 3: Create settings implementation**

Create `extension/shared/settings.js`:

```js
export const DEFAULT_SETTINGS = Object.freeze({
  imageTimerSeconds: 5,
  startMuted: true,
  autoplay: true
});

const SUPPORTED_TIMERS = new Set([3, 5, 10]);

export function normalizeSettings(input = {}) {
  const imageTimerSeconds = SUPPORTED_TIMERS.has(input.imageTimerSeconds)
    ? input.imageTimerSeconds
    : DEFAULT_SETTINGS.imageTimerSeconds;

  return {
    ...DEFAULT_SETTINGS,
    imageTimerSeconds,
    startMuted: typeof input.startMuted === "boolean"
      ? input.startMuted
      : DEFAULT_SETTINGS.startMuted,
    autoplay: typeof input.autoplay === "boolean"
      ? input.autoplay
      : DEFAULT_SETTINGS.autoplay
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```sh
npm test -- tests/unit/settings.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit settings module**

Run:

```sh
git add extension/shared/settings.js tests/unit/settings.test.js
git commit -m "feat: add settings normalization"
```

Expected: commit succeeds.

## Task 4: Offline Fixture Documentation And Samples

**Files:**

- Create: `docs/development/offline-fixtures.md`
- Create: `tests/fixtures/old-reddit/subreddit-page.html`
- Create: `tests/fixtures/reddit-json/subreddit-direct-images.json`

- [ ] **Step 1: Create fixture documentation**

Create `docs/development/offline-fixtures.md`:

```markdown
# Offline Fixtures

Offline fixtures let us test Reddit parsing without depending on live Reddit pages, network availability, account state, or rate limits.

## Fixture Rules

- Commit only sanitized fixtures.
- Remove usernames, account-specific data, cookies, tokens, and tracking parameters.
- Keep fixtures small enough to understand in review.
- Prefer one focused fixture per behavior.
- Keep original post IDs fake unless the exact ID is necessary for a bug reproduction.

## Fixture Types

- `tests/fixtures/old-reddit/*.html`: old Reddit-like page structure for content-script/context tests.
- `tests/fixtures/reddit-json/*.json`: Reddit listing JSON shapes for queue and resolver tests.

## Refresh Workflow

When a live Reddit example is needed:

1. Save the smallest useful HTML or JSON sample.
2. Remove personal/account-specific data.
3. Replace real titles with harmless representative titles unless title text matters.
4. Keep media URL shapes realistic.
5. Add or update a focused test that explains why the fixture exists.

Do not use live Reddit as the normal unit-test path.
```

- [ ] **Step 2: Create old Reddit HTML fixture**

Create `tests/fixtures/old-reddit/subreddit-page.html`:

```html
<!doctype html>
<html>
  <head>
    <title>old reddit fixture</title>
  </head>
  <body class="listing-page">
    <div id="siteTable" class="sitetable linklisting">
      <div class="thing link" data-fullname="t3_alpha" data-url="https://i.redd.it/alpha.jpg">
        <p class="title">
          <a class="title may-blank" href="https://i.redd.it/alpha.jpg">Ultra high resolution landscape</a>
        </p>
      </div>
      <div class="thing link" data-fullname="t3_beta" data-url="https://old.reddit.com/gallery/beta">
        <p class="title">
          <a class="title may-blank" href="https://old.reddit.com/gallery/beta">Two image gallery</a>
        </p>
      </div>
    </div>
    <span class="next-button">
      <a href="https://old.reddit.com/r/example/?count=25&amp;after=t3_beta">next</a>
    </span>
  </body>
</html>
```

- [ ] **Step 3: Create Reddit JSON fixture**

Create `tests/fixtures/reddit-json/subreddit-direct-images.json`:

```json
{
  "kind": "Listing",
  "data": {
    "after": "t3_beta",
    "before": null,
    "children": [
      {
        "kind": "t3",
        "data": {
          "id": "alpha",
          "name": "t3_alpha",
          "title": "Ultra high resolution landscape",
          "permalink": "/r/example/comments/alpha/ultra_high_resolution_landscape/",
          "url_overridden_by_dest": "https://i.redd.it/alpha.jpg",
          "domain": "i.redd.it",
          "post_hint": "image",
          "is_video": false,
          "over_18": false,
          "preview": {
            "images": [
              {
                "source": {
                  "url": "https://preview.redd.it/alpha.jpg?auto=webp&s=fake",
                  "width": 7680,
                  "height": 4320
                }
              }
            ]
          }
        }
      },
      {
        "kind": "t3",
        "data": {
          "id": "gamma",
          "name": "t3_gamma",
          "title": "Preview only fallback",
          "permalink": "/r/example/comments/gamma/preview_only_fallback/",
          "url_overridden_by_dest": "https://preview.redd.it/gamma.jpg?width=1080&crop=smart&auto=webp&s=fake",
          "domain": "preview.redd.it",
          "post_hint": "image",
          "is_video": false,
          "over_18": false,
          "preview": {
            "images": [
              {
                "source": {
                  "url": "https://preview.redd.it/gamma.jpg?auto=webp&s=fake",
                  "width": 1600,
                  "height": 900
                }
              }
            ]
          }
        }
      }
    ]
  }
}
```

- [ ] **Step 4: Commit fixture docs and samples**

Run:

```sh
git add docs/development/offline-fixtures.md tests/fixtures
git commit -m "test: add offline Reddit fixtures"
```

Expected: commit succeeds.

## Task 5: Reddit URL Conversion

**Files:**

- Create: `extension/shared/reddit-url.js`
- Create: `tests/unit/reddit-url.test.js`

- [ ] **Step 1: Write failing URL conversion tests**

Create `tests/unit/reddit-url.test.js`:

```js
import { describe, expect, it } from "vitest";
import { toListingJsonUrl } from "../../extension/shared/reddit-url.js";

describe("toListingJsonUrl", () => {
  it("converts an old Reddit subreddit URL to JSON", () => {
    expect(toListingJsonUrl("https://old.reddit.com/r/pics/")).toBe(
      "https://old.reddit.com/r/pics/.json?raw_json=1"
    );
  });

  it("preserves sort path and query parameters", () => {
    expect(toListingJsonUrl("https://old.reddit.com/r/pics/top/?t=week")).toBe(
      "https://old.reddit.com/r/pics/top/.json?t=week&raw_json=1"
    );
  });

  it("adds after pagination when provided", () => {
    expect(toListingJsonUrl("https://old.reddit.com/r/pics/", { after: "t3_alpha" })).toBe(
      "https://old.reddit.com/r/pics/.json?raw_json=1&after=t3_alpha"
    );
  });

  it("rejects non-Reddit URLs", () => {
    expect(() => toListingJsonUrl("https://example.com/r/pics/")).toThrow(
      "Unsupported Reddit listing URL"
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```sh
npm test -- tests/unit/reddit-url.test.js
```

Expected: FAIL because `extension/shared/reddit-url.js` does not exist.

- [ ] **Step 3: Implement URL conversion**

Create `extension/shared/reddit-url.js`:

```js
const SUPPORTED_HOSTS = new Set(["old.reddit.com", "www.reddit.com", "reddit.com"]);

export function toListingJsonUrl(pageUrl, options = {}) {
  const url = new URL(pageUrl);
  if (!SUPPORTED_HOSTS.has(url.hostname)) {
    throw new Error("Unsupported Reddit listing URL");
  }

  let pathname = url.pathname;
  if (!pathname.endsWith("/")) pathname += "/";
  if (!pathname.endsWith(".json/") && !pathname.endsWith(".json")) {
    pathname = `${pathname}.json`;
  }
  // Strip the trailing slash that the endsWith("/") step re-added onto a `.json` path.
  pathname = pathname.replace(/\.json\/$/, ".json");

  const output = new URL(url.href);
  output.pathname = pathname;
  output.searchParams.set("raw_json", "1");

  if (options.after) {
    output.searchParams.set("after", options.after);
  }

  return output.toString();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```sh
npm test -- tests/unit/reddit-url.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit URL conversion**

Run:

```sh
git add extension/shared/reddit-url.js tests/unit/reddit-url.test.js
git commit -m "feat: add Reddit listing URL conversion"
```

Expected: commit succeeds.

## Task 6: Direct Image Slide Normalization

**Files:**

- Create: `extension/shared/slides.js`
- Create: `tests/unit/slides.test.js`

- [ ] **Step 1: Write failing slide normalization tests**

Create `tests/unit/slides.test.js`:

```js
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { slidesFromListing } from "../../extension/shared/slides.js";

const fixtureUrl = new URL("../fixtures/reddit-json/subreddit-direct-images.json", import.meta.url);
const fixture = JSON.parse(readFileSync(fileURLToPath(fixtureUrl), "utf8"));

describe("slidesFromListing", () => {
  it("normalizes direct i.redd.it images as original quality slides", () => {
    const slides = slidesFromListing(fixture);

    expect(slides[0]).toMatchObject({
      id: "t3_alpha:0",
      postId: "t3_alpha",
      provider: "reddit-image",
      kind: "image",
      mediaUrl: "https://i.redd.it/alpha.jpg",
      sourceUrl: "https://i.redd.it/alpha.jpg",
      permalink: "https://old.reddit.com/r/example/comments/alpha/ultra_high_resolution_landscape/",
      title: "Ultra high resolution landscape",
      over18: false,
      durationMode: "timer",
      mediaWidth: 7680,
      mediaHeight: 4320,
      quality: "original"
    });
  });

  it("keeps preview-only images but marks them as preview quality", () => {
    const slides = slidesFromListing(fixture);

    expect(slides[1]).toMatchObject({
      id: "t3_gamma:0",
      provider: "reddit-image",
      kind: "image",
      quality: "preview",
      mediaWidth: 1600,
      mediaHeight: 900
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```sh
npm test -- tests/unit/slides.test.js
```

Expected: FAIL because `extension/shared/slides.js` does not exist.

- [ ] **Step 3: Implement slide normalization**

Create `extension/shared/slides.js`:

```js
const OLD_REDDIT_ORIGIN = "https://old.reddit.com";

export function slidesFromListing(listing) {
  const children = listing?.data?.children ?? [];
  return children.flatMap((child) => slidesFromPost(child.data));
}

function slidesFromPost(post) {
  const url = post.url_overridden_by_dest;
  if (!url || !isImagePost(post, url)) return [];

  const previewSource = post.preview?.images?.[0]?.source;
  const isOriginal = new URL(url).hostname === "i.redd.it";

  return [{
    id: `${post.name}:0`,
    postId: post.name,
    provider: "reddit-image",
    kind: "image",
    mediaUrl: url,
    sourceUrl: url,
    permalink: absoluteOldRedditUrl(post.permalink),
    title: post.title,
    over18: Boolean(post.over_18),
    durationMode: "timer",
    audioAvailable: false,
    mediaWidth: previewSource?.width,
    mediaHeight: previewSource?.height,
    quality: isOriginal ? "original" : "preview",
    mimeType: mimeTypeFromUrl(url),
    filenameHint: filenameHint(post, url)
  }];
}

function isImagePost(post, url) {
  if (post.post_hint === "image") return true;
  return /\.(avif|gif|jpe?g|png|webp)(\?.*)?$/i.test(url);
}

function absoluteOldRedditUrl(permalink) {
  return new URL(permalink, OLD_REDDIT_ORIGIN).toString();
}

function mimeTypeFromUrl(url) {
  const pathname = new URL(url).pathname.toLowerCase();
  if (pathname.endsWith(".avif")) return "image/avif";
  if (pathname.endsWith(".gif")) return "image/gif";
  if (pathname.endsWith(".jpg") || pathname.endsWith(".jpeg")) return "image/jpeg";
  if (pathname.endsWith(".png")) return "image/png";
  if (pathname.endsWith(".webp")) return "image/webp";
  return undefined;
}

function filenameHint(post, url) {
  const extension = new URL(url).pathname.split(".").pop() || "jpg";
  // Guard missing/non-ASCII titles: a missing title must not throw (it would
  // kill the whole listing parse), and unicode titles must not collapse to an
  // empty slug. Unicode-aware match, fall back to the post id when empty.
  const slug = (post.title ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return slug ? `${post.name}-${slug}.${extension}` : `${post.name}.${extension}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```sh
npm test -- tests/unit/slides.test.js
```

Expected: PASS.

- [ ] **Step 5: Run all tests**

Run:

```sh
npm test
```

Expected: PASS.

- [ ] **Step 6: Commit slide normalization**

Run:

```sh
git add extension/shared/slides.js tests/unit/slides.test.js
git commit -m "feat: normalize direct image slides"
```

Expected: commit succeeds.

## Task 7: Verification And Handoff

**Files:**

- Modify: `docs/development/offline-fixtures.md`

- [ ] **Step 1: Add verification section**

Append to `docs/development/offline-fixtures.md`:

```markdown
## Current Fixture Coverage

- `subreddit-page.html`: minimal old Reddit listing HTML with direct image and gallery-shaped posts.
- `subreddit-direct-images.json`: Reddit listing JSON with one original `i.redd.it` image and one preview-only image fallback.

## Commands

```sh
npm test
npm run webext:lint
```
```

- [ ] **Step 2: Run all verification**

Run:

```sh
npm test
npm run webext:lint
```

Expected:

- `npm test`: all unit tests pass.
- `npm run webext:lint`: extension lint passes.

- [ ] **Step 3: Commit verification docs**

Run:

```sh
git add docs/development/offline-fixtures.md
git commit -m "docs: document fixture verification"
```

Expected: commit succeeds.

## Self-Review

Spec coverage:

- Supports the first concrete step toward old Reddit slideshow work.
- Covers offline fixture strategy so development does not rely on live Reddit.
- Covers full-resolution priority by storing image dimensions and quality.
- Does not yet implement slideshow UI, pagination, galleries, videos, Redgifs, downloads, or pan/zoom; those remain later plans.

Placeholder scan:

- No placeholders are intentionally left in implementation steps.
- Follow-up/deferred features are explicitly scoped outside this first slice.

Type consistency:

- `slidesFromListing`, `toListingJsonUrl`, `DEFAULT_SETTINGS`, and `normalizeSettings` are defined before later references.
- Normalized slide fields match the current development best-practices doc.
