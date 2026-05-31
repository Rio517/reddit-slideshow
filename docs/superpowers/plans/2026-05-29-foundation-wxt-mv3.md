# Foundation And Offline Fixtures (WXT / MV3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a runnable Firefox **MV3** WebExtension scaffold built with **WXT**, plus offline fixtures and unit tests for old Reddit URL/listing parsing - with no live Reddit dependency.

**Architecture:** A WXT (Vite) project. Entrypoints (`background`, `content`, `options`) live under `entrypoints/`; shared, bundled logic lives under `lib/`. The background is a non-persistent **event page**; the content script injects an overlay root. The first slice proves we can parse committed HTML/JSON fixtures into normalized slide candidates. Settings flow through one validated path (`lib/settings.js`), consumed by the options page.

**Tech Stack:** WXT, Vite, Vitest (+ `WxtVitest()` fake-browser, happy-dom), JavaScript ES modules with JSDoc + `checkJs` type-checking, ESLint flat config + `eslint-plugin-no-unsanitized`, Prettier, `web-ext lint` on the built output.

**Decisions baked in (see [ADR 0005](../../adr/0005-manifest-v3-event-page-and-wxt-build.md)):**

- MV3 + event page + `action`; use WXT so shared modules are bundled instead of relying on browser-specific content-script module loading.
- Host scope is **`old.reddit.com` only** for v1 - `www.reddit.com` is not in permissions or `SUPPORTED_HOSTS`.
- `options` consumes `lib/settings.js` via a single `getSettings()`/`saveSettings()` path - no duplicated defaults.
- `browser_specific_settings.gecko.id` is set.
- `filenameHint` guards missing/non-ASCII titles; the preview-image case asserts `mediaUrl`; the URL converter rejects comment permalinks.

---

## Scope

Included: WXT project scaffold; MV3 manifest via `wxt.config.ts`; background/content/options entrypoints; shared settings (validated, wired to options); offline fixture strategy; old-Reddit→listing-JSON URL converter; direct-image slide normalization; lint/type/test/build commands and docs.

Deferred (later plans): full overlay UI, keyboard nav, timers, pagination fetch service, galleries, Reddit video, Redgifs iframe provider, downloads, pan/zoom.

## File Structure

```text
package.json
wxt.config.ts
tsconfig.json
vitest.config.js
eslint.config.js
.prettierrc.json
.gitignore                (modified)
entrypoints/
  background.js           event page: install log + action click → message active tab
  content.js              old.reddit.com content script: inject hidden overlay root
  options/
    index.html            options shell
    main.js               loads/saves settings via lib/settings.js
assets/
  overlay.css             namespaced overlay root styles
lib/
  reddit-url.js           old Reddit page URL → listing JSON URL
  settings.js             defaults, normalizeSettings, getSettings/saveSettings
  slides.js               Reddit listing JSON → normalized slide candidates
tests/
  fixtures/
    old-reddit/subreddit-page.html
    reddit-json/subreddit-direct-images.json
  unit/
    settings.test.js
    reddit-url.test.js
    slides.test.js
docs/development/offline-fixtures.md
```

Responsibilities:

- `wxt.config.ts`: MV3 manifest config (name/version come from `package.json`), permissions, host permissions, `action`, gecko id.
- `entrypoints/background.js`: event-page install log; on `action` click, message the active tab (gracefully no-op off old Reddit).
- `entrypoints/content.js`: detect old Reddit, inject a hidden namespaced overlay root, respond to the start message.
- `entrypoints/options/*`: minimal settings UI that round-trips through `lib/settings.js`.
- `assets/overlay.css`: hidden root + namespaced styles.
- `lib/reddit-url.js`: convert an old Reddit listing URL to its `.json?raw_json=1` form with optional `after`.
- `lib/settings.js`: one source of truth for defaults + validation + storage access.
- `lib/slides.js`: normalize listing children into slide candidates (direct images this slice).
- `tests/**`: fixtures + unit tests.
- `docs/development/offline-fixtures.md`: fixture rules and coverage.

---

## Task 1: WXT Project And Tooling Baseline

**Files:**

- Create: `package.json`, `wxt.config.ts`, `tsconfig.json`, `vitest.config.js`, `eslint.config.js`, `.prettierrc.json`
- Modify: `.gitignore`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "reddit-slideshow",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "description": "Firefox-first old Reddit media slideshow extension.",
  "scripts": {
    "postinstall": "wxt prepare",
    "dev": "wxt -b firefox --mv3",
    "build": "wxt build -b firefox --mv3",
    "zip": "wxt zip -b firefox --mv3",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
    "format": "prettier --check .",
    "webext:lint": "web-ext lint --source-dir .output/firefox-mv3"
  },
  "devDependencies": {
    "@eslint/js": "^9.0.0",
    "eslint": "^9.0.0",
    "eslint-plugin-no-unsanitized": "^4.1.0",
    "happy-dom": "^15.0.0",
    "prettier": "^3.3.0",
    "typescript": "^5.5.0",
    "vitest": "^3.2.0",
    "web-ext": "^10.0.0",
    "wxt": "^0.20.0"
  }
}
```

Note: `wxt --mv3` forces Manifest V3 for the Firefox build (WXT defaults Firefox to MV2). `wxt prepare` (run by `postinstall`) generates `.wxt/` types so `tsc`/ESLint see WXT globals.

- [ ] **Step 2: Create `wxt.config.ts`**

```ts
import { defineConfig } from "wxt";

export default defineConfig({
  manifestVersion: 3,
  manifest: {
    name: "Reddit Slideshow",
    description: "Turn old Reddit listings into a media slideshow.",
    permissions: ["storage"],
    host_permissions: [
      "https://old.reddit.com/*",
      "https://i.redd.it/*",
      "https://v.redd.it/*",
    ],
    action: { default_title: "Start Reddit Slideshow" },
    browser_specific_settings: {
      gecko: { id: "reddit-slideshow@knyflores.com" },
    },
  },
});
```

Note: content-script registration is generated from `defineContentScript` in `entrypoints/content.js` (Task 2), so it is not listed here. `www.reddit.com` is intentionally absent (v1 is old Reddit only).

- [ ] **Step 3: Create `tsconfig.json`**

```json
{
  "extends": "./.wxt/tsconfig.json",
  "compilerOptions": {
    "checkJs": true,
    "allowJs": true,
    "noEmit": true,
    "strict": true
  },
  "include": ["entrypoints", "lib", "tests", "wxt.config.ts"]
}
```

- [ ] **Step 4: Create `vitest.config.js`**

```js
import { defineConfig } from "vitest/config";
import { WxtVitest } from "wxt/testing";

export default defineConfig({
  plugins: [WxtVitest()],
  test: {
    environment: "happy-dom",
    include: ["tests/unit/**/*.test.js"],
  },
});
```

`WxtVitest()` provides an in-memory `browser.*` (via `@webext-core/fake-browser`) and resolves WXT's `@/` alias and auto-imports inside tests.

- [ ] **Step 5: Create `eslint.config.js`**

```js
import js from "@eslint/js";
import noUnsanitized from "eslint-plugin-no-unsanitized";

export default [
  { ignores: [".wxt/**", ".output/**", "node_modules/**", "dist/**"] },
  js.configs.recommended,
  {
    files: ["**/*.{js,ts}"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: {
        // Browser + WXT auto-imported globals used in entrypoints.
        browser: "readonly",
        document: "readonly",
        console: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        defineBackground: "readonly",
        defineContentScript: "readonly",
      },
    },
    plugins: { "no-unsanitized": noUnsanitized },
    rules: {
      "no-unsanitized/method": "error",
      "no-unsanitized/property": "error",
    },
  },
];
```

Note: if `wxt prepare` emits a generated globals file (e.g. `.wxt/eslint-auto-imports.mjs`), prefer importing its globals instead of the hand-listed `defineBackground`/`defineContentScript` above; both work.

- [ ] **Step 6: Create `.prettierrc.json`**

```json
{}
```

- [ ] **Step 7: Update `.gitignore`**

Append:

```gitignore
node_modules/
.output/
.wxt/
dist/
stats.html
coverage/
web-ext-artifacts/
```

Keep the existing `.superpowers/` entry.

- [ ] **Step 8: Install dependencies**

Run:

```sh
npm install
```

Expected: dependencies install; `postinstall` runs `wxt prepare`, creating `.wxt/`; `package-lock.json` is created.

- [ ] **Step 9: Smoke-check the WXT build**

Run:

```sh
npm run build
```

Expected: WXT builds to `.output/firefox-mv3/` with a generated `manifest.json` whose `manifest_version` is `3`. (There are no entrypoints yet; an empty build is fine. If WXT errors on zero entrypoints, proceed to Task 2 and re-run.)

- [ ] **Step 10: Commit tooling baseline**

```sh
git add .gitignore package.json package-lock.json wxt.config.ts tsconfig.json vitest.config.js eslint.config.js .prettierrc.json
git commit -m "chore: scaffold WXT MV3 project and tooling"
```

Expected: commit succeeds.

---

## Task 2: Shared Settings Module

**Files:**

- Create: `lib/settings.js`, `tests/unit/settings.test.js`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/settings.test.js`:

```js
import { describe, expect, it, beforeEach } from "vitest";
import { fakeBrowser } from "wxt/testing";
import {
  DEFAULT_SETTINGS,
  normalizeSettings,
  getSettings,
  saveSettings,
} from "../../lib/settings.js";

describe("normalizeSettings", () => {
  it("returns defaults for empty input", () => {
    expect(normalizeSettings({})).toEqual(DEFAULT_SETTINGS);
  });

  it("accepts supported timer values", () => {
    expect(normalizeSettings({ imageTimerSeconds: 10 }).imageTimerSeconds).toBe(
      10,
    );
  });

  it("falls back when timer value is unsupported", () => {
    expect(
      normalizeSettings({ imageTimerSeconds: 999 }).imageTimerSeconds,
    ).toBe(5);
  });

  it("normalizes startMuted to a boolean", () => {
    expect(normalizeSettings({ startMuted: false }).startMuted).toBe(false);
    expect(normalizeSettings({ startMuted: "no" }).startMuted).toBe(true);
  });
});

describe("getSettings / saveSettings", () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it("returns normalized defaults when storage is empty", async () => {
    expect(await getSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it("round-trips saved settings through normalization", async () => {
    await saveSettings({
      imageTimerSeconds: 10,
      autoplay: false,
      startMuted: false,
    });
    expect(await getSettings()).toEqual({
      imageTimerSeconds: 10,
      startMuted: false,
      autoplay: false,
    });
  });

  it("repairs out-of-range stored values on read", async () => {
    await browser.storage.local.set({ imageTimerSeconds: 999 });
    expect((await getSettings()).imageTimerSeconds).toBe(5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```sh
npm test -- tests/unit/settings.test.js
```

Expected: FAIL because `lib/settings.js` does not exist.

- [ ] **Step 3: Create the implementation**

Create `lib/settings.js`:

```js
import { browser } from "wxt/browser";

export const DEFAULT_SETTINGS = Object.freeze({
  imageTimerSeconds: 5,
  startMuted: true,
  autoplay: true,
});

const SUPPORTED_TIMERS = new Set([3, 5, 10]);

/**
 * @param {Partial<typeof DEFAULT_SETTINGS>} [input]
 * @returns {typeof DEFAULT_SETTINGS}
 */
export function normalizeSettings(input = {}) {
  return {
    imageTimerSeconds: SUPPORTED_TIMERS.has(input.imageTimerSeconds)
      ? input.imageTimerSeconds
      : DEFAULT_SETTINGS.imageTimerSeconds,
    startMuted:
      typeof input.startMuted === "boolean"
        ? input.startMuted
        : DEFAULT_SETTINGS.startMuted,
    autoplay:
      typeof input.autoplay === "boolean"
        ? input.autoplay
        : DEFAULT_SETTINGS.autoplay,
  };
}

/** Single read path: storage → validation. */
export async function getSettings() {
  const stored = await browser.storage.local.get(DEFAULT_SETTINGS);
  return normalizeSettings(stored);
}

/** Single write path: validate before persisting. */
export async function saveSettings(patch) {
  const current = await getSettings();
  const next = normalizeSettings({ ...current, ...patch });
  await browser.storage.local.set(next);
  return next;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```sh
npm test -- tests/unit/settings.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit settings module**

```sh
git add lib/settings.js tests/unit/settings.test.js
git commit -m "feat: add validated settings module"
```

Expected: commit succeeds.

---

## Task 3: Extension Entrypoints Skeleton

**Files:**

- Create: `entrypoints/background.js`, `entrypoints/content.js`, `entrypoints/options/index.html`, `entrypoints/options/main.js`, `assets/overlay.css`

- [ ] **Step 1: Create `entrypoints/background.js`**

```js
export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(() => {
    console.info("Reddit Slideshow installed");
  });

  browser.action.onClicked.addListener(async (tab) => {
    if (!tab.id) return;
    try {
      await browser.tabs.sendMessage(tab.id, {
        type: "slideshow.startRequested",
        payload: { source: "action" },
      });
    } catch {
      // No content script on this tab (not an old.reddit.com listing).
      // Swallow the "no receiving end" rejection instead of throwing an
      // unhandled rejection, and point the user at old Reddit.
      console.info("Reddit Slideshow: open an old.reddit.com listing first");
    }
  });
});
```

- [ ] **Step 2: Create `entrypoints/content.js`**

```js
import "@/assets/overlay.css";

export default defineContentScript({
  matches: ["https://old.reddit.com/*"],
  cssInjectionMode: "manifest",
  main() {
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

    // Firefox onMessage contract: return a Promise to respond async, or
    // return undefined to signal "not handled". Do NOT return true (Chrome-only).
    browser.runtime.onMessage.addListener((message) => {
      if (message?.type !== "slideshow.startRequested") return undefined;
      const root = ensureRoot();
      root.hidden = false;
      return Promise.resolve({ ok: true });
    });
  },
});
```

- [ ] **Step 3: Create `assets/overlay.css`**

```css
#reddit-slideshow-root {
  position: fixed;
  inset: 0;
  z-index: 2147483647;
  display: grid;
  place-items: center;
  color: #f8fafc;
  background: rgba(7, 10, 15, 0.96);
  font:
    16px/1.4 system-ui,
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    sans-serif;
}

#reddit-slideshow-root[hidden] {
  display: none;
}
```

- [ ] **Step 4: Create `entrypoints/options/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
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
        <input id="startMuted" type="checkbox" />
        Start videos muted
      </label>
      <label>
        <input id="autoplay" type="checkbox" />
        Autoplay slideshow
      </label>
    </main>
    <script type="module" src="./main.js"></script>
  </body>
</html>
```

- [ ] **Step 5: Create `entrypoints/options/main.js`**

This imports the shared settings module so defaults and validation live in one place. `lib/settings.js` already exists from Task 2.

```js
import { getSettings, saveSettings } from "@/lib/settings.js";

const timerSelect = document.querySelector("#imageTimerSeconds");
const mutedCheckbox = document.querySelector("#startMuted");
const autoplayCheckbox = document.querySelector("#autoplay");

async function load() {
  const settings = await getSettings();
  timerSelect.value = String(settings.imageTimerSeconds);
  mutedCheckbox.checked = settings.startMuted;
  autoplayCheckbox.checked = settings.autoplay;
}

async function persist() {
  await saveSettings({
    imageTimerSeconds: Number(timerSelect.value),
    startMuted: mutedCheckbox.checked,
    autoplay: autoplayCheckbox.checked,
  });
}

timerSelect.addEventListener("change", persist);
mutedCheckbox.addEventListener("change", persist);
autoplayCheckbox.addEventListener("change", persist);

load();
```

- [ ] **Step 6: Build to register entrypoints**

Run:

```sh
npm run build
```

Expected: PASS. WXT builds to `.output/firefox-mv3/` and registers the background, content, and options entrypoints.

- [ ] **Step 7: Commit entrypoints skeleton**

```sh
git add entrypoints assets
git commit -m "feat: add MV3 entrypoints skeleton (background, content, options)"
```

Expected: commit succeeds.

---

## Task 4: Offline Fixture Documentation And Samples

**Files:**

- Create: `docs/development/offline-fixtures.md`, `tests/fixtures/old-reddit/subreddit-page.html`, `tests/fixtures/reddit-json/subreddit-direct-images.json`

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
- Keep post IDs fake unless an exact ID is needed to reproduce a bug.
- Capture from real responses when shape fidelity matters (galleries, media_metadata, crossposts); hand-authored fixtures are fine for simple cases.

## Fixture Types

- `tests/fixtures/old-reddit/*.html`: old Reddit-like page structure for content/context tests.
- `tests/fixtures/reddit-json/*.json`: Reddit listing JSON shapes for queue/resolver tests. Always model the `raw_json=1` form (URLs not HTML-entity-encoded).

## Refresh Workflow

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
      <div
        class="thing link"
        data-fullname="t3_alpha"
        data-url="https://i.redd.it/alpha.jpg"
      >
        <p class="title">
          <a class="title may-blank" href="https://i.redd.it/alpha.jpg"
            >Ultra high resolution landscape</a
          >
        </p>
      </div>
      <div
        class="thing link"
        data-fullname="t3_beta"
        data-url="https://old.reddit.com/gallery/beta"
      >
        <p class="title">
          <a class="title may-blank" href="https://old.reddit.com/gallery/beta"
            >Two image gallery</a
          >
        </p>
      </div>
    </div>
    <span class="next-button">
      <a href="https://old.reddit.com/r/example/?count=25&amp;after=t3_beta"
        >next</a
      >
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

- [ ] **Step 4: Commit fixtures**

```sh
git add docs/development/offline-fixtures.md tests/fixtures
git commit -m "test: add offline Reddit fixtures"
```

Expected: commit succeeds.

---

## Task 5: Reddit URL Conversion

**Files:**

- Create: `lib/reddit-url.js`, `tests/unit/reddit-url.test.js`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/reddit-url.test.js`:

```js
import { describe, expect, it } from "vitest";
import { toListingJsonUrl } from "../../lib/reddit-url.js";

describe("toListingJsonUrl", () => {
  it("converts an old Reddit subreddit URL to JSON", () => {
    expect(toListingJsonUrl("https://old.reddit.com/r/pics/")).toBe(
      "https://old.reddit.com/r/pics/.json?raw_json=1",
    );
  });

  it("preserves sort path and query parameters", () => {
    expect(toListingJsonUrl("https://old.reddit.com/r/pics/top/?t=week")).toBe(
      "https://old.reddit.com/r/pics/top/.json?t=week&raw_json=1",
    );
  });

  it("adds after pagination when provided", () => {
    expect(
      toListingJsonUrl("https://old.reddit.com/r/pics/", { after: "t3_alpha" }),
    ).toBe("https://old.reddit.com/r/pics/.json?raw_json=1&after=t3_alpha");
  });

  it("handles a URL with no trailing slash", () => {
    expect(toListingJsonUrl("https://old.reddit.com/r/pics")).toBe(
      "https://old.reddit.com/r/pics/.json?raw_json=1",
    );
  });

  it("is idempotent for an already-.json URL", () => {
    expect(toListingJsonUrl("https://old.reddit.com/r/pics/.json")).toBe(
      "https://old.reddit.com/r/pics/.json?raw_json=1",
    );
  });

  it("rejects comment permalinks (not a listing shape)", () => {
    expect(() =>
      toListingJsonUrl("https://old.reddit.com/r/pics/comments/abc/title/"),
    ).toThrow("Unsupported Reddit listing URL");
  });

  it("rejects non-Reddit URLs", () => {
    expect(() => toListingJsonUrl("https://example.com/r/pics/")).toThrow(
      "Unsupported Reddit listing URL",
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```sh
npm test -- tests/unit/reddit-url.test.js
```

Expected: FAIL because `lib/reddit-url.js` does not exist.

- [ ] **Step 3: Implement URL conversion**

Create `lib/reddit-url.js`:

```js
const SUPPORTED_HOSTS = new Set(["old.reddit.com"]);

/**
 * Convert an old Reddit listing page URL to its JSON listing URL.
 * Assumes a *listing* context (subreddit, front page, multireddit, search) -
 * comment permalinks are rejected because they return a different JSON shape.
 *
 * @param {string} pageUrl
 * @param {{ after?: string }} [options]
 * @returns {string}
 */
export function toListingJsonUrl(pageUrl, options = {}) {
  const url = new URL(pageUrl);
  if (!SUPPORTED_HOSTS.has(url.hostname)) {
    throw new Error("Unsupported Reddit listing URL");
  }
  if (/\/comments\//.test(url.pathname)) {
    throw new Error("Unsupported Reddit listing URL");
  }

  // Normalize the path to end with `.json` (no trailing slash before query).
  let pathname = url.pathname.replace(/\/$/, "");
  if (!pathname.endsWith(".json")) {
    pathname = `${pathname}.json`;
  }

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

Expected: PASS. (Query order: `set` preserves insertion, so existing params come first, then `raw_json`, then `after` - matching the assertions.)

- [ ] **Step 5: Commit URL conversion**

```sh
git add lib/reddit-url.js tests/unit/reddit-url.test.js
git commit -m "feat: add Reddit listing URL conversion"
```

Expected: commit succeeds.

---

## Task 6: Direct Image Slide Normalization

**Files:**

- Create: `lib/slides.js`, `tests/unit/slides.test.js`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/slides.test.js`:

```js
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { slidesFromListing } from "../../lib/slides.js";

const fixtureUrl = new URL(
  "../fixtures/reddit-json/subreddit-direct-images.json",
  import.meta.url,
);
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
      permalink:
        "https://old.reddit.com/r/example/comments/alpha/ultra_high_resolution_landscape/",
      title: "Ultra high resolution landscape",
      over18: false,
      durationMode: "timer",
      sourceWidth: 7680,
      sourceHeight: 4320,
      quality: "original",
    });
  });

  it("keeps preview-only images but marks them preview quality and emits the preview URL", () => {
    const slides = slidesFromListing(fixture);
    expect(slides[1]).toMatchObject({
      id: "t3_gamma:0",
      provider: "reddit-image",
      kind: "image",
      quality: "preview",
      mediaUrl:
        "https://preview.redd.it/gamma.jpg?width=1080&crop=smart&auto=webp&s=fake",
      sourceWidth: 1600,
      sourceHeight: 900,
    });
  });

  it("does not throw on a post with no title", () => {
    const listing = {
      data: {
        children: [
          {
            kind: "t3",
            data: {
              name: "t3_notitle",
              url_overridden_by_dest: "https://i.redd.it/notitle.png",
              post_hint: "image",
            },
          },
        ],
      },
    };
    const slides = slidesFromListing(listing);
    expect(slides[0].filenameHint).toBe("t3_notitle.png");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```sh
npm test -- tests/unit/slides.test.js
```

Expected: FAIL because `lib/slides.js` does not exist.

- [ ] **Step 3: Implement slide normalization**

Create `lib/slides.js`:

```js
const OLD_REDDIT_ORIGIN = "https://old.reddit.com";

/**
 * @param {any} listing Reddit listing JSON (raw_json=1 form).
 * @returns {Array<object>}
 */
export function slidesFromListing(listing) {
  const children = listing?.data?.children ?? [];
  return children.flatMap((child) => slidesFromPost(child.data));
}

function slidesFromPost(post) {
  const url = post?.url_overridden_by_dest;
  if (!url || !isImagePost(post, url)) return [];

  const previewSource = post.preview?.images?.[0]?.source;
  const isOriginal = new URL(url).hostname === "i.redd.it";

  return [
    {
      id: `${post.name}:0`,
      postId: post.name,
      provider: "reddit-image",
      kind: "image",
      mediaUrl: url,
      sourceUrl: url,
      permalink: absoluteOldRedditUrl(post.permalink),
      title: post.title ?? "",
      over18: Boolean(post.over_18),
      durationMode: "timer",
      audioAvailable: false,
      // Dimensions come from the preview pipeline source: the best-known size,
      // not guaranteed identical to the original asset. Name the fields by
      // provenance (sourceWidth/sourceHeight), not as "original".
      sourceWidth: previewSource?.width,
      sourceHeight: previewSource?.height,
      quality: isOriginal ? "original" : "preview",
      mimeType: mimeTypeFromUrl(url),
      filenameHint: filenameHint(post, url),
    },
  ];
}

function isImagePost(post, url) {
  if (post.post_hint === "image") return true;
  return /\.(avif|gif|jpe?g|png|webp)(\?.*)?$/i.test(url);
}

function absoluteOldRedditUrl(permalink) {
  if (!permalink) return undefined;
  return new URL(permalink, OLD_REDDIT_ORIGIN).toString();
}

function mimeTypeFromUrl(url) {
  const pathname = new URL(url).pathname.toLowerCase();
  if (pathname.endsWith(".avif")) return "image/avif";
  if (pathname.endsWith(".gif")) return "image/gif";
  if (pathname.endsWith(".jpg") || pathname.endsWith(".jpeg"))
    return "image/jpeg";
  if (pathname.endsWith(".png")) return "image/png";
  if (pathname.endsWith(".webp")) return "image/webp";
  return undefined;
}

function filenameHint(post, url) {
  const extension = new URL(url).pathname.split(".").pop() || "jpg";
  // Never throw on a missing title (one bad post must not kill the whole
  // listing parse), and never collapse unicode titles to an empty slug.
  // Fall back to the post id when the slug is empty.
  const slug = (post.title ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug
    ? `${post.name}-${slug}.${extension}`
    : `${post.name}.${extension}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```sh
npm test -- tests/unit/slides.test.js
```

Expected: PASS.

- [ ] **Step 5: Run the full test suite**

Run:

```sh
npm test
```

Expected: all unit tests pass.

- [ ] **Step 6: Commit slide normalization**

```sh
git add lib/slides.js tests/unit/slides.test.js
git commit -m "feat: normalize direct image slides"
```

Expected: commit succeeds.

---

## Task 7: Verification And Handoff

**Files:**

- Modify: `docs/development/offline-fixtures.md`

- [ ] **Step 1: Add coverage + commands section**

Append to `docs/development/offline-fixtures.md`:

````markdown
## Current Fixture Coverage

- `subreddit-page.html`: minimal old Reddit listing HTML with direct image and gallery-shaped posts.
- `subreddit-direct-images.json`: Reddit listing JSON with one original `i.redd.it` image and one preview-only image fallback.

## Commands

\```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run webext:lint
\```
````

(Remove the backslashes before the inner code fence when pasting.)

- [ ] **Step 2: Run full verification**

Run each and confirm:

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run webext:lint
```

Expected:

- `typecheck`: no type errors.
- `lint`: no ESLint errors.
- `test`: all unit tests pass.
- `build`: `.output/firefox-mv3/manifest.json` exists with `"manifest_version": 3`, an `action` key, `host_permissions` for `old.reddit.com`/`i.redd.it`/`v.redd.it`, and a `browser_specific_settings.gecko.id`.
- `webext:lint`: passes (no errors; `MISSING_ADDON_ID` must not appear).

- [ ] **Step 3: Commit verification docs**

```sh
git add docs/development/offline-fixtures.md
git commit -m "docs: document fixture verification"
```

Expected: commit succeeds.

---

## Self-Review

Spec coverage:

- Establishes the runnable MV3/WXT foundation and the testable shared core (`reddit-url`, `settings`, `slides`) without live Reddit; fixtures cover the unit tests.
- Decisions applied: MV3 + event page + `action` (ADR 0005); WXT bundler; `old.reddit.com`-only host scope; options wired to validated settings; `gecko.id`; `filenameHint` guards; dimension fields named by provenance with the preview-image `mediaUrl` asserted; comment-permalink guard.
- Defers UI, timers, pagination, galleries, video, and the Redgifs iframe provider to later plans.

Placeholder scan:

- No placeholder steps remain. The settings module is created before the options page imports it, so each committed task can leave the project in a buildable state.

Type consistency:

- `getSettings`/`saveSettings`/`normalizeSettings`/`DEFAULT_SETTINGS` are defined in `lib/settings.js` and consumed by `options/main.js` and the settings tests with matching signatures.
- Slide fields use `sourceWidth`/`sourceHeight` consistently across `slides.js` and `slides.test.js` (renamed from `mediaWidth`/`mediaHeight` to reflect provenance).
- `toListingJsonUrl(pageUrl, { after })` signature matches its tests.

Follow-up for the next plan:

- Reconcile the message vocabulary project-wide (`slideshow.*` is used here; the best-practices doc still lists `queue.*`).
- Add the `permissions.contains`/`permissions.request` check for `old.reddit.com` (MV3 host permissions are user-revocable).
- Add fixtures captured from real responses for galleries (`gallery_data` order + `media_metadata`), Reddit video (DASH/silent `fallback_url`), crossposts (`crosspost_parent_list[0]`), and Redgifs (`/ifr/<id>` iframe).
