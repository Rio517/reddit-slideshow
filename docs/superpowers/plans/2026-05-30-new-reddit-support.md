# New Reddit Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the slideshow work on `www.reddit.com` (new Reddit) as a self-contained path that never calls old Reddit, while keeping old Reddit support.

**Architecture:** Per ADR 0008. The content script runs on both `old.reddit.com` and `www.reddit.com`; each fetches its own `.json` (the data layer already preserves the page host). The overlay renders directly under new Reddit's permissive logged-in CSP. The start-from-viewport cursor already degrades to "start from the top" when it finds no old-Reddit `div.thing` posts, so the core works on www with no DOM work; a shreddit-aware cursor is an optional follow-up (Task 4).

**Tech Stack:** WXT, MV3, plain JS + JSDoc, Vitest + happy-dom.

---

## Task 1: Allow www.reddit.com as a listing host

**Files:**

- Modify: `lib/reddit-url.js:1`
- Test: `tests/unit/reddit-url.test.js`

- [ ] **Step 1: Write the failing tests**

Add inside the existing `describe("toListingJsonUrl", ...)` block in `tests/unit/reddit-url.test.js`:

```js
it("converts a www.reddit.com listing URL to JSON on the same host", () => {
  expect(toListingJsonUrl("https://www.reddit.com/r/pics/")).toBe(
    "https://www.reddit.com/r/pics/.json?raw_json=1",
  );
});

it("preserves the host (no old/new cross-mapping)", () => {
  expect(toListingJsonUrl("https://www.reddit.com/r/pics/top/?t=week")).toBe(
    "https://www.reddit.com/r/pics/top/.json?t=week&raw_json=1",
  );
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/unit/reddit-url.test.js`
Expected: FAIL — the new www cases throw "Unsupported Reddit listing URL".

- [ ] **Step 3: Add www.reddit.com to the supported hosts**

In `lib/reddit-url.js`, change line 1:

```js
const SUPPORTED_HOSTS = new Set(["old.reddit.com", "www.reddit.com"]);
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/reddit-url.test.js`
Expected: PASS (all reddit-url tests).

- [ ] **Step 5: Commit**

```bash
git add lib/reddit-url.js tests/unit/reddit-url.test.js
git commit -m "feat: accept www.reddit.com as a listing host (each host self-contained)"
```

---

## Task 2: Inject the overlay and fetch on www.reddit.com

**Files:**

- Modify: `entrypoints/content.js:7` (the `matches` array)
- Modify: `wxt.config.ts:9-13` (`host_permissions`)

- [ ] **Step 1: Add www.reddit.com to the content-script matches**

In `entrypoints/content.js`, change the `matches` line:

```js
  matches: ["https://old.reddit.com/*", "https://www.reddit.com/*"],
```

- [ ] **Step 2: Add www.reddit.com to host_permissions**

In `wxt.config.ts`, update `host_permissions` (the background fetches the page's own `.json`, so it needs the www host too):

```ts
    host_permissions: [
      "https://old.reddit.com/*",
      "https://www.reddit.com/*",
      "https://i.redd.it/*",
      "https://v.redd.it/*",
    ],
```

- [ ] **Step 3: Build and verify the generated manifest**

Run: `npm run build`
Expected: builds; `content_scripts[0].matches` and `host_permissions` both include `https://www.reddit.com/*`. Confirm with:

Run: `grep -o "www.reddit.com[^\"]*" .output/firefox-mv3/manifest.json`
Expected: appears under both `matches` and `host_permissions`.

- [ ] **Step 4: Run the Mozilla linter**

Run: `npm run webext:lint`
Expected: 0 errors, 0 notices, 0 warnings.

- [ ] **Step 5: Commit**

```bash
git add entrypoints/content.js wxt.config.ts
git commit -m "feat: run the slideshow on www.reddit.com"
```

---

## Task 3: Full-gate verification and real-Firefox spike

**Files:** none (verification only).

- [ ] **Step 1: Run the full verification gate**

Run each and confirm green:

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run webext:lint
```

Expected: typecheck/lint clean; all tests pass; build + webext:lint clean.

- [ ] **Step 2: Real-Firefox spike (needs a human; not automatable here)**

Load the temporary add-on (`about:debugging` → Load Temporary Add-on → `.output/firefox-mv3/manifest.json`) in a logged-in Firefox, then on `https://www.reddit.com/r/pics/`:

- Launch via the toolbar icon / Alt+Shift+S.
- Confirm: the overlay opens; the first slide renders; images, a v.redd.it video, and a Redgifs clip all display (CSP allows them when logged in); arrow keys / Space / Esc work; pagination loads more.
- Note anything blocked (a placeholder card instead of media = a CSP/permission gap to record).

- [ ] **Step 3: Record the outcome**

If everything renders, update `docs/research/new-reddit-and-chrome-feasibility.md` (and `NEXT_STEP.md`) to mark new-Reddit rendering confirmed. If media is blocked, capture the failing CSP directive and open a follow-up for the extension-page-iframe overlay (ADR 0008).

- [ ] **Step 4: Commit any doc updates**

```bash
git add docs/ NEXT_STEP.md
git commit -m "docs: record new-Reddit verification result"
```

---

## Task 4 (optional, deferrable): shreddit start-from-viewport cursor

New Reddit uses `shreddit-post` web components, so the "start where you are"
cursor needs new-Reddit selectors. Without this, www starts from the top of the
listing (acceptable). Build this only if start-from-scroll is wanted on www.

**Files:**

- Create: `lib/reddit-dom.js`
- Create: `tests/fixtures/new-reddit/feed.html`
- Modify: `entrypoints/content.js` (use the new reader in `getStartCursor`)
- Test: `tests/unit/reddit-dom.test.js`

- [ ] **Step 1: Spike — capture the real shreddit post shape**

In a logged-in browser on `https://www.reddit.com/r/pics/`, open devtools and run:

```js
const p = document.querySelector("shreddit-post");
console.log(p.outerHTML.slice(0, 400));
console.log("id:", p.id, "permalink:", p.getAttribute("permalink"));
```

Record which attribute carries the `t3_…` fullname (expected: the element `id`,
e.g. `id="t3_abc123"`). Save a small sanitized snippet of two `shreddit-post`
elements (with fake ids/titles, real attribute names) to
`tests/fixtures/new-reddit/feed.html`.

- [ ] **Step 2: Write the failing test**

In `tests/unit/reddit-dom.test.js`:

```js
import { describe, expect, it } from "vitest";
import { listingPostFullnames } from "../../lib/reddit-dom.js";

describe("listingPostFullnames", () => {
  it("reads old Reddit thing fullnames in order", () => {
    document.body.innerHTML = `
      <div class="thing link" data-fullname="t3_a"></div>
      <div class="thing self promoted" data-fullname="t3_ad"></div>
      <div class="thing link" data-fullname="t3_b"></div>`;
    expect(listingPostFullnames(document)).toEqual(["t3_a", "t3_b"]);
  });

  it("reads new Reddit shreddit-post fullnames in order", () => {
    document.body.innerHTML = `
      <shreddit-post id="t3_a"></shreddit-post>
      <shreddit-post id="t3_b"></shreddit-post>`;
    expect(listingPostFullnames(document)).toEqual(["t3_a", "t3_b"]);
  });
});
```

(Adjust the shreddit selector/attribute in Step 3 if the spike found something
other than `id`.)

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run tests/unit/reddit-dom.test.js`
Expected: FAIL — `lib/reddit-dom.js` does not exist.

- [ ] **Step 4: Implement the reader**

Create `lib/reddit-dom.js`:

```js
/**
 * Ordered post fullnames (t3_…) for the current listing, for either Reddit
 * frontend. Old Reddit: `div.thing[data-fullname]` (excluding promoted). New
 * Reddit: `shreddit-post` (the element id is the fullname).
 *
 * @param {Document} doc
 * @returns {string[]}
 */
export function listingPostFullnames(doc) {
  const old = Array.from(
    doc.querySelectorAll('div.thing[data-fullname^="t3_"]'),
  )
    .filter((el) => !el.classList.contains("promoted"))
    .map((el) => el.getAttribute("data-fullname") ?? "");
  if (old.length) return old.filter(Boolean);

  return Array.from(doc.querySelectorAll('shreddit-post[id^="t3_"]'))
    .map((el) => el.id)
    .filter(Boolean);
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/unit/reddit-dom.test.js`
Expected: PASS.

- [ ] **Step 6: Use the reader in the content script**

In `entrypoints/content.js`, import it and rewrite `getStartCursor` to pair each
fullname with its element's viewport `bottom`. Replace the existing
`getStartCursor` body:

```js
import { listingPostFullnames } from "@/lib/reddit-dom.js";
// ...
getStartCursor: () => {
  const posts = listingPostFullnames(document).map((fullname) => {
    const el =
      document.querySelector(`div.thing[data-fullname="${fullname}"]`) ??
      document.getElementById(fullname);
    const bottom = el ? el.getBoundingClientRect().bottom : 0;
    return { fullname, bottom };
  });
  return afterCursorForViewport(posts);
},
```

- [ ] **Step 7: Run the full gate**

Run: `npm run typecheck && npm test && npm run lint && npm run build`
Expected: green.

- [ ] **Step 8: Commit**

```bash
git add lib/reddit-dom.js tests/unit/reddit-dom.test.js tests/fixtures/new-reddit/feed.html entrypoints/content.js
git commit -m "feat: start-from-viewport cursor on new Reddit (shreddit)"
```

---

## Self-Review

- **Spec coverage (ADR 0008):** content script on both hosts (Task 2); fetch from
  the same host / no old dependency (Task 1 + existing host-preserving
  `toListingJsonUrl`); direct overlay render relying on www CSP (verified in
  Task 3, no code change needed); shreddit cursor with top fallback (Task 4 +
  the existing empty-posts → `undefined` → top behavior); www permission/match
  (Task 2). All covered.
- **Placeholder scan:** none — Task 4 Step 1 is a real spike with exact commands,
  and Step 2 notes to adjust the selector if the attribute differs.
- **Type consistency:** `listingPostFullnames(doc)` is defined in Task 4 Step 4
  and used in Step 6; `afterCursorForViewport` already exists and takes
  `{ fullname, bottom }[]`.
