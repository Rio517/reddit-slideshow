# Keyboard Shortcuts (Download / Block / Friend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three slideshow keyboard shortcuts — **D** (download current media), **I** (block author then skip their post), **A** (friend/follow author) — reusing the existing vote pipeline.

**Architecture:** All three are session-authenticated `old.reddit.com` POSTs (cookie + modhash), the exact shape voting already uses. They thread through the same four layers: `reddit-vote.js` (the privileged write) → `background-router.js` (sender + payload validation) → `entrypoints/{background,content}.js` (glue) → `session.js` (action + key handler). Confirmation uses a generalized version of the existing vote-flash toast. No new overlay buttons (keys-only, like voting). `F` stays Fullscreen.

**Tech Stack:** WXT (MV3), framework-free JS with JSDoc types, Vitest (happy-dom), WebExtension `_locales` i18n.

**Conventions for every commit in this plan:**
- Commit **locally only — never `git push`** (the maintainer rations CI credits and pushes manually).
- Work stays on `main` (no branches/worktrees).
- End each commit message with the trailer shown in the commit steps.
- Before each commit, read `git diff --staged` and scrutinize every hunk.

---

## Verification dependency (read before Task 1)

Two Reddit write endpoints are used from best-known docs and are **confirmed against a real logged-in Firefox session in Task 10** (a green offline gate does not prove a Reddit write works):

- **`/api/block_user`** — params `name` (vs an account fullname `t2_…`).
- **`/api/friend`** with `type=friend` — used for *both* frontends. Reddit folded "follow" into the friends relationship; old.reddit labels it "friend", new reddit "follow". The write is the same; only the flash wording differs (Task 6). Task 10 confirms whether new reddit needs a distinct follow endpoint; if it does, that is a localized change to `friendUser` + its unit test.

The unit tests assert the request *we send* (URL + body), so they are valid regardless; Task 10 may produce a one-line endpoint/param correction.

---

## Task 1: `reddit-vote.js` — add `blockUser` and `friendUser`

Extract the shared "POST a form with modhash, refresh-and-retry once on 403" into a private `postForm` helper, then add the two new writes alongside `vote`.

**Files:**
- Modify: `lib/reddit-vote.js`
- Test: `tests/unit/reddit-vote.test.js`

- [ ] **Step 1: Write the failing tests**

Append these tests inside the `describe("createVoter", …)` block in `tests/unit/reddit-vote.test.js` (the `jsonResponse` helper already exists at the top of the file):

```js
  it("blocks a user: POSTs name + uh to /api/block_user", async () => {
    /** @type {Array<{ url: string, opts: any }>} */
    const calls = [];
    const fetchImpl = vi.fn(async (/** @type {any} */ url, /** @type {any} */ opts) => {
      calls.push({ url: String(url), opts });
      return String(url).includes("/api/me.json")
        ? jsonResponse({ data: { modhash: "MH" } })
        : jsonResponse({});
    });
    const { blockUser } = createVoter({ fetchImpl: /** @type {any} */ (fetchImpl) });
    expect(await blockUser("spez")).toBe(true);
    const req = calls.find((c) => c.url.includes("/api/block_user"));
    expect(req?.opts?.method).toBe("POST");
    expect(req?.opts?.credentials).toBe("include");
    const params = new URLSearchParams(req?.opts?.body);
    expect(params.get("name")).toBe("spez");
    expect(params.get("uh")).toBe("MH");
  });

  it("friends a user: POSTs type=friend + name + uh to /api/friend", async () => {
    /** @type {Array<{ url: string, opts: any }>} */
    const calls = [];
    const fetchImpl = vi.fn(async (/** @type {any} */ url, /** @type {any} */ opts) => {
      calls.push({ url: String(url), opts });
      return String(url).includes("/api/me.json")
        ? jsonResponse({ data: { modhash: "MH" } })
        : jsonResponse({});
    });
    const { friendUser } = createVoter({ fetchImpl: /** @type {any} */ (fetchImpl) });
    expect(await friendUser("spez", "old")).toBe(true);
    const req = calls.find((c) => c.url.includes("/api/friend"));
    const params = new URLSearchParams(req?.opts?.body);
    expect(params.get("type")).toBe("friend");
    expect(params.get("name")).toBe("spez");
    expect(params.get("uh")).toBe("MH");
  });

  it("refreshes the modhash once on a 403 and retries a block", async () => {
    let writeCalls = 0;
    const fetchImpl = vi.fn(async (/** @type {any} */ url) => {
      if (String(url).includes("/api/me.json"))
        return jsonResponse({ data: { modhash: "MH" } });
      writeCalls += 1;
      return writeCalls === 1 ? jsonResponse({}, { status: 403 }) : jsonResponse({});
    });
    const { blockUser } = createVoter({ fetchImpl: /** @type {any} */ (fetchImpl) });
    expect(await blockUser("spez")).toBe(true);
    expect(writeCalls).toBe(2);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/unit/reddit-vote.test.js`
Expected: FAIL — `blockUser is not a function` / `friendUser is not a function`.

- [ ] **Step 3: Refactor `vote` onto a shared `postForm` and add the two writes**

In `lib/reddit-vote.js`, replace the `vote` function (lines ~36–60, the JSDoc block plus `async function vote(...) { … }`) with:

```js
  /**
   * POST a form to an `/api` endpoint with the session cookie + modhash,
   * refreshing the modhash once on a 403 and retrying. Throws on a non-OK
   * response.
   * @param {string} path e.g. `/api/vote`
   * @param {Record<string, string>} fields
   * @returns {Promise<boolean>}
   */
  async function postForm(path, fields) {
    /** @param {string} uh */
    const post = (uh) =>
      fetchImpl(`${origin}${path}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ ...fields, uh }).toString(),
      });

    let res = await post(await getModhash());
    // A stale modhash 403s; refresh it once and retry.
    if (res.status === 403) res = await post(await getModhash(true));
    if (!res.ok) throw new Error(`${path} HTTP ${res.status}`);
    return true;
  }

  /**
   * @param {string} fullname Post fullname, e.g. `t3_abc`.
   * @param {1 | 0 | -1} dir Up (1), clear (0), or down (-1).
   * @returns {Promise<boolean>}
   */
  async function vote(fullname, dir) {
    return postForm("/api/vote", { id: fullname, dir: String(dir) });
  }

  /**
   * Block a user account (hides all their content). Reversible in Reddit
   * settings.
   * @param {string} name Reddit username (no `u/` prefix).
   * @returns {Promise<boolean>}
   */
  async function blockUser(name) {
    return postForm("/api/block_user", { name });
  }

  /**
   * Add the author to your friends list. Both frontends use the classic friends
   * API — old.reddit calls it "friend", new reddit "follow"; the write is the
   * same. `frontend` is accepted so a future new-reddit-specific follow endpoint
   * can branch here without a signature change.
   * @param {string} name Reddit username (no `u/` prefix).
   * @param {"old" | "new"} frontend
   * @returns {Promise<boolean>}
   */
  // eslint-disable-next-line no-unused-vars
  async function friendUser(name, frontend) {
    return postForm("/api/friend", { type: "friend", name });
  }
```

Then change the final `return { vote };` to:

```js
  return { vote, blockUser, friendUser };
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/reddit-vote.test.js`
Expected: PASS — all tests (the three new ones plus the four existing `vote` tests, which still pass because `vote` produces the same `id`/`dir`/`uh` body).

- [ ] **Step 5: Commit**

```bash
git add lib/reddit-vote.js tests/unit/reddit-vote.test.js
git commit -m "feat(reddit): add blockUser and friendUser session writes" \
  -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: `background-router.js` — `slideshow.block` and `slideshow.friend`

Add two content-script-only message types with payload validation mirroring `handleVote`.

**Files:**
- Modify: `lib/background-router.js`
- Test: `tests/unit/background-router.test.js`

- [ ] **Step 1: Write the failing tests**

Append to `tests/unit/background-router.test.js` (the `makeRouter`/`OWN`/`RUNTIME_ID` helpers are at the top of the file):

```js
describe("createMessageRouter - block", () => {
  const blockMsg = (/** @type {any} */ name) => ({
    type: "slideshow.block",
    payload: { name },
  });

  it("blocks a user for a content-script request", async () => {
    /** @type {string[]} */
    const blocked = [];
    const router = makeRouter({
      block: async (/** @type {string} */ name) => {
        blocked.push(name);
        return true;
      },
    });
    expect(await router(blockMsg("spez"), OWN)).toEqual({ ok: true });
    expect(blocked).toEqual(["spez"]);
  });

  it("rejects a block from a non-content-script sender (no tab)", async () => {
    const router = makeRouter({ block: async () => true });
    expect(await router(blockMsg("spez"), { id: RUNTIME_ID })).toEqual({ ok: false });
  });

  it("rejects an invalid username", async () => {
    const router = makeRouter({ block: async () => true });
    expect(await router(blockMsg("bad name!"), OWN)).toEqual({ ok: false });
    expect(await router(blockMsg(""), OWN)).toEqual({ ok: false });
  });

  it("fails closed when the block throws", async () => {
    const router = makeRouter({
      block: async () => {
        throw new Error("nope");
      },
    });
    expect(await router(blockMsg("spez"), OWN)).toEqual({ ok: false });
  });
});

describe("createMessageRouter - friend", () => {
  const friendMsg = (/** @type {any} */ name, /** @type {any} */ frontend) => ({
    type: "slideshow.friend",
    payload: { name, frontend },
  });

  it("friends a user for a content-script request", async () => {
    /** @type {Array<[string, string]>} */
    const friended = [];
    const router = makeRouter({
      friend: async (/** @type {string} */ name, /** @type {string} */ frontend) => {
        friended.push([name, frontend]);
        return true;
      },
    });
    expect(await router(friendMsg("spez", "new"), OWN)).toEqual({ ok: true });
    expect(friended).toEqual([["spez", "new"]]);
  });

  it("rejects a friend from a non-content-script sender (no tab)", async () => {
    const router = makeRouter({ friend: async () => true });
    expect(await router(friendMsg("spez", "old"), { id: RUNTIME_ID })).toEqual({ ok: false });
  });

  it("rejects an invalid username or frontend", async () => {
    const router = makeRouter({ friend: async () => true });
    expect(await router(friendMsg("bad name!", "old"), OWN)).toEqual({ ok: false });
    expect(await router(friendMsg("spez", "mobile"), OWN)).toEqual({ ok: false });
  });

  it("fails closed when the friend throws", async () => {
    const router = makeRouter({
      friend: async () => {
        throw new Error("nope");
      },
    });
    expect(await router(friendMsg("spez", "old"), OWN)).toEqual({ ok: false });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/unit/background-router.test.js`
Expected: FAIL — block/friend routes return `undefined` (unknown type), so `.toEqual({ ok: true })` fails.

- [ ] **Step 3: Add the deps, routes, and handlers**

In `lib/background-router.js`, add to the `deps` typedef (after the `vote?: …` line, ~line 24):

```js
 *   block?: (name: string) => Promise<unknown>,
 *   friend?: (name: string, frontend: "old" | "new") => Promise<unknown>,
```

Add these routes right after the existing `slideshow.vote` block (after ~line 76):

```js
    if (message?.type === "slideshow.block") {
      // A user-initiated account block through the logged-in session;
      // content-script-only so a page script can't block as the user.
      if (!fromContentScript) return Promise.resolve({ ok: false });
      return handleBlock(message, deps.block);
    }
    if (message?.type === "slideshow.friend") {
      // A user-initiated friend/follow through the logged-in session;
      // content-script-only so a page script can't friend as the user.
      if (!fromContentScript) return Promise.resolve({ ok: false });
      return handleFriend(message, deps.friend);
    }
```

Add the handlers and the shared username pattern near `handleVote` (after the `handleVote` function, ~line 277):

```js
// Reddit username charset: 3–20 of letters/digits/underscore/hyphen. We accept
// 1–20 to stay permissive; the write itself rejects a non-existent name.
const USERNAME_RE = /^[A-Za-z0-9_-]{1,20}$/;

/**
 * Block a user account through the session. Validates the username before the
 * privileged write.
 * @param {any} message
 * @param {((name: string) => Promise<unknown>) | undefined} block
 */
function handleBlock(message, block) {
  const name = message.payload?.name;
  if (typeof block !== "function" || typeof name !== "string" || !USERNAME_RE.test(name)) {
    return Promise.resolve({ ok: false });
  }
  return Promise.resolve(block(name))
    .then(() => ({ ok: true }))
    .catch((err) => {
      log.warn("block failed", name, err);
      return { ok: false };
    });
}

/**
 * Friend/follow a user through the session. Validates the username and the
 * frontend discriminator before the privileged write.
 * @param {any} message
 * @param {((name: string, frontend: "old" | "new") => Promise<unknown>) | undefined} friend
 */
function handleFriend(message, friend) {
  const name = message.payload?.name;
  const frontend = message.payload?.frontend;
  if (
    typeof friend !== "function" ||
    typeof name !== "string" ||
    !USERNAME_RE.test(name) ||
    (frontend !== "old" && frontend !== "new")
  ) {
    return Promise.resolve({ ok: false });
  }
  return Promise.resolve(friend(name, frontend))
    .then(() => ({ ok: true }))
    .catch((err) => {
      log.warn("friend failed", name, err);
      return { ok: false };
    });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/background-router.test.js`
Expected: PASS — all block/friend cases plus the existing suite.

- [ ] **Step 5: Commit**

```bash
git add lib/background-router.js tests/unit/background-router.test.js
git commit -m "feat(router): route slideshow.block and slideshow.friend" \
  -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: `entrypoints/background.js` — wire the writer deps

Thin glue (WXT entrypoint, no unit test); covered by typecheck + build.

**Files:**
- Modify: `entrypoints/background.js`

- [ ] **Step 1: Wire `blockUser` / `friendUser` into the router**

In `entrypoints/background.js`, in the `createMessageRouter({ … })` call, add directly after the `vote: (id, dir) => voter.vote(id, dir),` line:

```js
    block: (name) => voter.blockUser(name),
    friend: (name, frontend) => voter.friendUser(name, frontend),
```

- [ ] **Step 2: Verify it typechecks**

Run: `npm run typecheck`
Expected: PASS (no errors).

- [ ] **Step 3: Commit**

```bash
git add entrypoints/background.js
git commit -m "feat(background): expose block/friend writes to the router" \
  -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: `entrypoints/content.js` — add block/friend session deps + frontend

Thin glue; covered by typecheck + build, and exercised end-to-end in Task 10.

**Files:**
- Modify: `entrypoints/content.js`

- [ ] **Step 1: Add the `frontend`, `block`, and `friend` deps**

In `entrypoints/content.js`, inside `createSlideshowSession({ … })`, add directly after the `downloadMedia: (url, filename) => { … },` block (~line 152):

```js
      // Which Reddit frontend launched the show: drives the friend/follow
      // wording and (via the background) the write endpoint.
      frontend: window.location.hostname === "old.reddit.com" ? "old" : "new",
      // Block the current author through the session (the background holds the
      // modhash and POSTs with the session cookie).
      block: async (name) => {
        try {
          return await browser.runtime.sendMessage({
            type: "slideshow.block",
            payload: { name },
          });
        } catch (err) {
          log.warn("block message failed", err);
          return { ok: false };
        }
      },
      // Friend (old.reddit) / follow (new reddit) the current author.
      friend: async (name, frontend) => {
        try {
          return await browser.runtime.sendMessage({
            type: "slideshow.friend",
            payload: { name, frontend },
          });
        } catch (err) {
          log.warn("friend message failed", err);
          return { ok: false };
        }
      },
```

- [ ] **Step 2: Verify it typechecks**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add entrypoints/content.js
git commit -m "feat(content): send block/friend messages with frontend" \
  -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: `overlay-ui.js` — generalize the flash toast

Add `flashMessage(text, variant)` reusing the vote-flash element, so block/friend/download can show a transient confirmation. Refactor `flashVote` onto a shared `showFlashToast`.

**Files:**
- Modify: `lib/overlay-ui.js`
- Test: `tests/unit/overlay-ui.test.js`

- [ ] **Step 1: Write the failing tests**

Add to `tests/unit/overlay-ui.test.js` inside `describe("createOverlay", …)` (the suite uses `vi.useFakeTimers()` in `beforeEach`):

```js
  it("flashMessage shows a transient toast with the given text", () => {
    const overlay = createOverlay(noopHandlers());
    overlay.flashMessage("Blocked u/spez");
    const flash = /** @type {HTMLElement} */ (
      overlay.root.querySelector(".rs-vote-flash")
    );
    expect(flash.textContent).toBe("Blocked u/spez");
    expect(flash.hidden).toBe(false);
    vi.advanceTimersByTime(1300);
    expect(flash.hidden).toBe(true);
  });

  it("flashMessage error variant uses the error class", () => {
    const overlay = createOverlay(noopHandlers());
    overlay.flashMessage("Couldn't do that", "error");
    const flash = /** @type {HTMLElement} */ (
      overlay.root.querySelector(".rs-vote-flash")
    );
    expect(flash.className).toContain("rs-vote-flash--error");
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/unit/overlay-ui.test.js`
Expected: FAIL — `overlay.flashMessage is not a function`.

- [ ] **Step 3: Refactor `flashVote` onto `showFlashToast` and add `flashMessage`**

In `lib/overlay-ui.js`, replace the `flashVote` function (lines ~416–430) with:

```js
  /** @param {string} text @param {string} cls */
  function showFlashToast(text, cls) {
    voteFlash.textContent = text;
    voteFlash.classList.remove("rs-vote-flash--on");
    void voteFlash.offsetWidth; // restart the animation on a rapid re-press
    voteFlash.className = `rs-vote-flash ${cls} rs-vote-flash--on`;
    voteFlash.hidden = false;
    announce(text);
    if (voteFlashTimer != null) clearTimeout(voteFlashTimer);
    voteFlashTimer = setTimeout(() => {
      voteFlash.classList.remove("rs-vote-flash--on");
      voteFlash.hidden = true;
    }, 1200);
  }
  /** @param {1 | 0 | -1 | "error"} state */
  function flashVote(state) {
    const def = VOTE_FLASH[String(state)] ?? VOTE_FLASH.error;
    showFlashToast(def.text, def.cls);
  }
  /**
   * Transient confirmation toast for keys-only actions (block/friend/download).
   * @param {string} text
   * @param {"info" | "error"} [variant]
   */
  function flashMessage(text, variant = "info") {
    showFlashToast(
      text,
      variant === "error" ? "rs-vote-flash--error" : "rs-vote-flash--none",
    );
  }
```

Then add `flashMessage` to the returned overlay API — change the `flashVote,` line (~1515) to:

```js
    flashVote,
    flashMessage,
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/overlay-ui.test.js`
Expected: PASS (new flash tests plus the existing overlay suite).

- [ ] **Step 5: Commit**

```bash
git add lib/overlay-ui.js tests/unit/overlay-ui.test.js
git commit -m "feat(overlay): generalize the flash toast into flashMessage" \
  -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: `session.js` — actions + key handling

Add `downloadCurrent`, `blockAuthor`, `friendAuthor`; route the new keys; reuse `downloadCurrent` for the existing overlay download button. Uses i18n keys added in Task 8 — they fall back to English in the unit tests.

**Files:**
- Modify: `lib/session.js`
- Test: `tests/unit/session.test.js`

- [ ] **Step 1: Write the failing tests**

In `tests/unit/session.test.js`, first extend the `makeSession` harness so the new deps can be injected. Add `block`, `friend`, `frontend` to the destructured params (after `vote,` at ~line 149):

```js
  block,
  friend,
  frontend,
```

and pass them into `createSlideshowSession({ … })` (after `vote,` at ~line 177):

```js
    block,
    friend,
    frontend,
```

Then add these tests inside `describe("createSlideshowSession", …)`:

```js
  it("downloads the current slide's media with the D key", async () => {
    /** @type {Array<{ url: string, filename: string }>} */
    const calls = [];
    const { session } = makeSession({
      downloadMedia: (url, filename) => calls.push({ url, filename }),
    });
    await session.start();
    session.handleKeydown(key("d"));
    await flush();
    expect(calls).toEqual([
      { url: "https://i.redd.it/a.jpg", filename: "a.jpg" },
    ]);
  });

  it("blocks the author and skips to the next post with the I key", async () => {
    /** @type {string[]} */
    const blocked = [];
    const { session } = makeSession({
      block: async (name) => {
        blocked.push(name);
        return { ok: true };
      },
      pages: [
        {
          slides: [
            imageSlide("p1", { postId: "p1", author: "spez" }),
            imageSlide("p2", { postId: "p2", author: "other" }),
          ],
          after: null,
          exhausted: true,
          postsScanned: 2,
        },
      ],
    });
    await session.start();
    session.handleKeydown(key("i"));
    await flush();
    expect(blocked).toEqual(["spez"]);
    // Advanced past the blocked author's post to the next post.
    expect(mediaSrc()).toBe("https://i.redd.it/p2.jpg");
    // A confirmation flash naming the user appeared.
    expect(text(".rs-vote-flash")).toContain("spez");
  });

  it("does nothing for the I key when the author is unknown", async () => {
    /** @type {string[]} */
    const blocked = [];
    const { session } = makeSession({
      block: async (name) => {
        blocked.push(name);
        return { ok: true };
      },
      pages: [
        {
          slides: [imageSlide("a", { author: undefined })],
          after: null,
          exhausted: true,
          postsScanned: 1,
        },
      ],
    });
    await session.start();
    session.handleKeydown(key("i"));
    await flush();
    expect(blocked).toEqual([]);
  });

  it("friends the author with the A key, passing the frontend", async () => {
    /** @type {Array<[string, string]>} */
    const friended = [];
    const { session } = makeSession({
      frontend: "new",
      friend: async (name, fe) => {
        friended.push([name, fe]);
        return { ok: true };
      },
      pages: [
        {
          slides: [imageSlide("a", { author: "spez" })],
          after: null,
          exhausted: true,
          postsScanned: 1,
        },
      ],
    });
    await session.start();
    session.handleKeydown(key("a"));
    await flush();
    expect(friended).toEqual([["spez", "new"]]);
    expect(text(".rs-vote-flash")).toContain("spez");
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/unit/session.test.js`
Expected: FAIL — keys `d`/`i`/`a` are not in `HANDLED_KEYS`, so the handler returns early and no dep is called.

- [ ] **Step 3: Add the deps typedef entries**

In `lib/session.js`, add to the `deps` typedef (after the `vote?: …` line, ~line 53):

```js
 *   block?: (name: string) => Promise<{ ok?: boolean }>,
 *   friend?: (name: string, frontend: "old" | "new") => Promise<{ ok?: boolean }>,
 *   frontend?: "old" | "new",
```

- [ ] **Step 4: Add `downloadCurrent` and reuse it for the overlay button**

In `lib/session.js`, replace the inline `onDownload` handler (lines ~174–185) with a reference to a named function:

```js
      onDownload: downloadCurrent,
```

Then add these three functions next to `castVote` (after the `castVote` function, ~line 306). `downloadCurrent` carries the same logic and HTTPS guard the old `onDownload` had:

```js
  // Save the displayed media via the background downloads API. Only image/video
  // slides have a concrete file; unresolved embeds have none. Used by both the
  // overlay download button and the D key.
  function downloadCurrent() {
    const slide = controller?.current;
    if (!slide || !(slide.kind === "image" || slide.kind === "video")) return;
    if (slide.mediaUrl && isHttpUrl(slide.mediaUrl)) {
      deps.downloadMedia?.(slide.mediaUrl, slide.filenameHint ?? "");
      overlay?.flashMessage?.(t("uiDownloadStarted"));
    }
  }

  // Block the current author through the session, then skip past their post.
  // Optimistic: flash + advance at once, correcting to an error flash if the
  // write fails. The block itself is reversible in Reddit settings.
  function blockAuthor() {
    const slide = controller?.current;
    const name = slide?.author;
    if (!slide || !name || name === "[deleted]" || !deps.block) return;
    overlay?.flashMessage?.(t("uiBlocked", [name]));
    controller?.skipPostGroup();
    void Promise.resolve(deps.block(name))
      .then((res) => {
        if (res && res.ok === false) throw new Error("block rejected");
      })
      .catch(() => overlay?.flashMessage?.(t("uiActionError"), "error"));
  }

  // Friend (old.reddit) / follow (new reddit) the current author. Optimistic
  // flash; the wording follows the launching frontend.
  function friendAuthor() {
    const slide = controller?.current;
    const name = slide?.author;
    if (!slide || !name || name === "[deleted]" || !deps.friend) return;
    const frontend = deps.frontend === "old" ? "old" : "new";
    overlay?.flashMessage?.(
      t(frontend === "old" ? "uiFriended" : "uiFollowing", [name]),
    );
    void Promise.resolve(deps.friend(name, frontend))
      .then((res) => {
        if (res && res.ok === false) throw new Error("friend rejected");
      })
      .catch(() => overlay?.flashMessage?.(t("uiActionError"), "error"));
  }
```

- [ ] **Step 5: Register the keys**

In `lib/session.js`, add to the `HANDLED_KEYS` set (after `"?",` at ~line 724):

```js
    "d",
    "D",
    "i",
    "I",
    "a",
    "A",
```

And add to the `switch (event.key)` (after the `case "?":` block, before `case "Escape":` at ~line 787):

```js
      case "d":
      case "D":
        downloadCurrent();
        break;
      case "i":
      case "I":
        blockAuthor();
        break;
      case "a":
      case "A":
        friendAuthor();
        break;
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/session.test.js`
Expected: PASS — the four new tests plus the existing session suite (the existing button-download test still passes, now routed through `downloadCurrent`).

- [ ] **Step 7: Commit**

```bash
git add lib/session.js tests/unit/session.test.js
git commit -m "feat(session): bind D/I/A to download, block+skip, friend/follow" \
  -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: `overlay-help.js` — document the new shortcuts

**Files:**
- Modify: `lib/overlay-help.js`
- Test: `tests/unit/overlay-help.test.js`

- [ ] **Step 1: Update the row-count test**

In `tests/unit/overlay-help.test.js`, in the "lists one row per shortcut" test, change `expect(rows.length).toBe(9);` to:

```js
    expect(rows.length).toBe(12);
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/unit/overlay-help.test.js`
Expected: FAIL — still 9 rows.

- [ ] **Step 3: Add the three shortcut rows**

In `lib/overlay-help.js`, in the `SHORTCUTS` array, add after the `helpShortcutFullscreen` line (`{ chords: [["F"]], descKey: "helpShortcutFullscreen" },`):

```js
  { chords: [["D"]], descKey: "helpShortcutDownload" },
  { chords: [["I"]], descKey: "helpShortcutBlock" },
  { chords: [["A"]], descKey: "helpShortcutFriend" },
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run tests/unit/overlay-help.test.js`
Expected: PASS — 12 rows.

(The descriptions resolve to the keys added in Task 8; in this test they fall back to the English catalog, which Task 8 populates. If Task 8 has not run yet, the row still renders with the key badge and a non-empty description from the key fallback — the test only checks the badge exists and the description length is > 0. Run Task 8 before the full gate.)

- [ ] **Step 5: Commit**

```bash
git add lib/overlay-help.js tests/unit/overlay-help.test.js
git commit -m "feat(help): list the download, block, and friend shortcuts" \
  -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: i18n — add the new message keys to all locales

Add 8 keys to **all six** source catalogs (the catalog test requires identical key sets and matching placeholders), then regenerate `public/_locales`.

**Files:**
- Modify: `locales/en.json`, `locales/es.json`, `locales/fr.json`, `locales/de.json`, `locales/it.json`, `locales/ar.json`
- Regenerated: `public/_locales/**` (via `npm run locales`)
- Test: `tests/unit/i18n-catalog.test.js` (already exists)

- [ ] **Step 1: Add the keys to `locales/en.json`**

Add these entries (place the three `helpShortcut*` near the other `helpShortcut*` keys; place the `ui*` near `uiVote*`). Keep JSON valid (commas):

```json
  "helpShortcutDownload": {
    "message": "Download the current image or video",
    "description": "Help-panel shortcut description: download."
  },
  "helpShortcutBlock": {
    "message": "Block the author and skip their post",
    "description": "Help-panel shortcut description: block author."
  },
  "helpShortcutFriend": {
    "message": "Add the author as a friend / follow them",
    "description": "Help-panel shortcut description: friend/follow author."
  },
  "uiBlocked": {
    "message": "Blocked u/$user$",
    "description": "Toast confirming the author was blocked. $user$ is the username.",
    "placeholders": { "user": { "content": "$1" } }
  },
  "uiFriended": {
    "message": "Friended u/$user$",
    "description": "Toast confirming the author was added as a friend (old Reddit). $user$ is the username.",
    "placeholders": { "user": { "content": "$1" } }
  },
  "uiFollowing": {
    "message": "Following u/$user$",
    "description": "Toast confirming the author is now followed (new Reddit). $user$ is the username.",
    "placeholders": { "user": { "content": "$1" } }
  },
  "uiDownloadStarted": {
    "message": "Downloading…",
    "description": "Toast confirming a media download has started."
  },
  "uiActionError": {
    "message": "Couldn't do that",
    "description": "Toast shown when a block/friend/follow action failed."
  }
```

- [ ] **Step 2: Add the same keys to the other five locales**

Add the identical key set (same `placeholders`, English `description`) with translated `message` values:

`locales/es.json`:
```json
  "helpShortcutDownload": { "message": "Descargar la imagen o el vídeo actual", "description": "Help-panel shortcut description: download." },
  "helpShortcutBlock": { "message": "Bloquear al autor y omitir su publicación", "description": "Help-panel shortcut description: block author." },
  "helpShortcutFriend": { "message": "Agregar al autor como amigo o seguirlo", "description": "Help-panel shortcut description: friend/follow author." },
  "uiBlocked": { "message": "Bloqueado u/$user$", "description": "Toast confirming the author was blocked. $user$ is the username.", "placeholders": { "user": { "content": "$1" } } },
  "uiFriended": { "message": "Agregado u/$user$", "description": "Toast confirming the author was added as a friend (old Reddit). $user$ is the username.", "placeholders": { "user": { "content": "$1" } } },
  "uiFollowing": { "message": "Siguiendo a u/$user$", "description": "Toast confirming the author is now followed (new Reddit). $user$ is the username.", "placeholders": { "user": { "content": "$1" } } },
  "uiDownloadStarted": { "message": "Descargando…", "description": "Toast confirming a media download has started." },
  "uiActionError": { "message": "No se pudo completar", "description": "Toast shown when a block/friend/follow action failed." }
```

`locales/fr.json`:
```json
  "helpShortcutDownload": { "message": "Télécharger l'image ou la vidéo actuelle", "description": "Help-panel shortcut description: download." },
  "helpShortcutBlock": { "message": "Bloquer l'auteur et passer sa publication", "description": "Help-panel shortcut description: block author." },
  "helpShortcutFriend": { "message": "Ajouter l'auteur en ami ou le suivre", "description": "Help-panel shortcut description: friend/follow author." },
  "uiBlocked": { "message": "Bloqué u/$user$", "description": "Toast confirming the author was blocked. $user$ is the username.", "placeholders": { "user": { "content": "$1" } } },
  "uiFriended": { "message": "Ajouté u/$user$", "description": "Toast confirming the author was added as a friend (old Reddit). $user$ is the username.", "placeholders": { "user": { "content": "$1" } } },
  "uiFollowing": { "message": "Vous suivez u/$user$", "description": "Toast confirming the author is now followed (new Reddit). $user$ is the username.", "placeholders": { "user": { "content": "$1" } } },
  "uiDownloadStarted": { "message": "Téléchargement…", "description": "Toast confirming a media download has started." },
  "uiActionError": { "message": "Action impossible", "description": "Toast shown when a block/friend/follow action failed." }
```

`locales/de.json`:
```json
  "helpShortcutDownload": { "message": "Aktuelles Bild oder Video herunterladen", "description": "Help-panel shortcut description: download." },
  "helpShortcutBlock": { "message": "Autor blockieren und seinen Beitrag überspringen", "description": "Help-panel shortcut description: block author." },
  "helpShortcutFriend": { "message": "Autor als Freund hinzufügen oder folgen", "description": "Help-panel shortcut description: friend/follow author." },
  "uiBlocked": { "message": "u/$user$ blockiert", "description": "Toast confirming the author was blocked. $user$ is the username.", "placeholders": { "user": { "content": "$1" } } },
  "uiFriended": { "message": "u/$user$ hinzugefügt", "description": "Toast confirming the author was added as a friend (old Reddit). $user$ is the username.", "placeholders": { "user": { "content": "$1" } } },
  "uiFollowing": { "message": "Du folgst u/$user$", "description": "Toast confirming the author is now followed (new Reddit). $user$ is the username.", "placeholders": { "user": { "content": "$1" } } },
  "uiDownloadStarted": { "message": "Wird heruntergeladen…", "description": "Toast confirming a media download has started." },
  "uiActionError": { "message": "Hat nicht geklappt", "description": "Toast shown when a block/friend/follow action failed." }
```

`locales/it.json`:
```json
  "helpShortcutDownload": { "message": "Scarica l'immagine o il video corrente", "description": "Help-panel shortcut description: download." },
  "helpShortcutBlock": { "message": "Blocca l'autore e salta il suo post", "description": "Help-panel shortcut description: block author." },
  "helpShortcutFriend": { "message": "Aggiungi l'autore agli amici o seguilo", "description": "Help-panel shortcut description: friend/follow author." },
  "uiBlocked": { "message": "Bloccato u/$user$", "description": "Toast confirming the author was blocked. $user$ is the username.", "placeholders": { "user": { "content": "$1" } } },
  "uiFriended": { "message": "Aggiunto u/$user$", "description": "Toast confirming the author was added as a friend (old Reddit). $user$ is the username.", "placeholders": { "user": { "content": "$1" } } },
  "uiFollowing": { "message": "Stai seguendo u/$user$", "description": "Toast confirming the author is now followed (new Reddit). $user$ is the username.", "placeholders": { "user": { "content": "$1" } } },
  "uiDownloadStarted": { "message": "Download in corso…", "description": "Toast confirming a media download has started." },
  "uiActionError": { "message": "Operazione non riuscita", "description": "Toast shown when a block/friend/follow action failed." }
```

`locales/ar.json`:
```json
  "helpShortcutDownload": { "message": "تنزيل الصورة أو الفيديو الحالي", "description": "Help-panel shortcut description: download." },
  "helpShortcutBlock": { "message": "حظر صاحب المنشور وتخطّي منشوره", "description": "Help-panel shortcut description: block author." },
  "helpShortcutFriend": { "message": "إضافة صاحب المنشور كصديق أو متابعته", "description": "Help-panel shortcut description: friend/follow author." },
  "uiBlocked": { "message": "تم حظر u/$user$", "description": "Toast confirming the author was blocked. $user$ is the username.", "placeholders": { "user": { "content": "$1" } } },
  "uiFriended": { "message": "تمت إضافة u/$user$", "description": "Toast confirming the author was added as a friend (old Reddit). $user$ is the username.", "placeholders": { "user": { "content": "$1" } } },
  "uiFollowing": { "message": "تتابع u/$user$", "description": "Toast confirming the author is now followed (new Reddit). $user$ is the username.", "placeholders": { "user": { "content": "$1" } } },
  "uiDownloadStarted": { "message": "جارٍ التنزيل…", "description": "Toast confirming a media download has started." },
  "uiActionError": { "message": "تعذّر تنفيذ ذلك", "description": "Toast shown when a block/friend/follow action failed." }
```

- [ ] **Step 3: Regenerate the built locale catalogs**

Run: `npm run locales`
Expected: rewrites `public/_locales/*/messages.json` from the sources.

- [ ] **Step 4: Run the catalog tests to verify they pass**

Run: `npx vitest run tests/unit/i18n-catalog.test.js`
Expected: PASS — every locale has the English key set, placeholders match, and `public/_locales` is in sync.

- [ ] **Step 5: Commit**

```bash
git add locales public/_locales
git commit -m "i18n: add download/block/friend shortcut and toast strings" \
  -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Docs & privacy — reflect the new account writes

Blocking and friending/following are new writes to the user's Reddit account; the privacy copy currently names voting as the only one.

**Files:**
- Modify: `README.md`, `PRIVACY.md`, and the store-listing source(s) under `docs/` that describe account actions

- [ ] **Step 1: Update the README keys line**

In `README.md`, the keys bullet (~line 122) currently reads:

```
- Keys: **←/→** previous/next, **↑/↓** upvote/downvote, **Space** play/pause,
  **M** mute, **F** fullscreen, **Esc** close. You can also click the dark
  backdrop to close.
```

Change to include the new keys:

```
- Keys: **←/→** previous/next, **↑/↓** upvote/downvote, **Space** play/pause,
  **M** mute, **F** fullscreen, **D** download, **I** block the author (and skip
  their post), **A** friend/follow the author, **Esc** close. You can also click
  the dark backdrop to close.
```

- [ ] **Step 2: Update the README privacy paragraph**

In `README.md`, the Privacy section sentence "The one action that writes to your Reddit account is voting, and only when you press **↑/↓**." → replace with:

```
The actions that write to your Reddit account are voting (**↑/↓**), blocking an
author (**I**), and friending/following an author (**A**) — each only when you
press the key.
```

- [ ] **Step 3: Update `PRIVACY.md`**

Find the line in `PRIVACY.md` that states voting is the only account write (search for "vote"/"writes to your"), and update it to name voting, blocking, and friending/following as the account-writing actions — same authoritative, present-tense phrasing as the surrounding copy. No jargon.

- [ ] **Step 4: Update the store listing(s)**

Locate the store-listing source under `docs/` (e.g. `docs/store-listing/`) and update any sentence describing what the extension does to your account to include block and friend/follow alongside voting. Keep the existing tone; no acronyms in user-facing text.

- [ ] **Step 5: Verify the gate is still green for docs (no code touched)**

Run: `npm run format`
Expected: PASS (Prettier checks Markdown too; fix wrapping if it complains).

- [ ] **Step 6: Commit**

```bash
git add README.md PRIVACY.md docs
git commit -m "docs: document the block/friend writes and new shortcuts" \
  -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: Live verification + full gate

The offline gate proves the code sends what we think; it does **not** prove Reddit accepts it. Confirm the writes against a real logged-in session, then run the whole green gate.

**Files:** none (verification), unless a one-line endpoint/param fix is needed in `lib/reddit-vote.js`.

- [ ] **Step 1: Run the full offline gate**

Run, in order, and confirm each passes:
```bash
npm run typecheck
npm run lint
npm run format
npm test
npm run build
npm run webext:lint
```
Expected: all PASS. (This mirrors the verify-gate skill.)

- [ ] **Step 2: Build the e2e and smoke the key handling over the mocked listing**

Run: `npm run test:prod`
Expected: PASS — the loaded extension drives the slideshow; the new keys dispatch without errors. (CI uses a mocked listing and **no real account**.)

- [ ] **Step 3: Live-verify the writes (local, logged-in Firefox)**

Load the built Firefox add-on into a logged-in profile (README "Build from source → Firefox"). On a test post, confirm in turn:
- **D** downloads the media.
- **A** on `old.reddit.com` adds the author to your friends list (check `https://old.reddit.com/prefs/friends/`); **A** on `www.reddit.com` follows them.
- **I** blocks the author (check blocked users in Reddit settings) and the show skips to the next post.

If `/api/block_user` needs an account fullname instead of `name`, or new reddit needs a distinct follow endpoint, make the localized fix in `lib/reddit-vote.js` (`blockUser` / `friendUser`), update the corresponding unit test in `tests/unit/reddit-vote.test.js`, and re-run `npx vitest run tests/unit/reddit-vote.test.js`.

- [ ] **Step 4: Final commit (only if Step 3 required a fix)**

```bash
git add lib/reddit-vote.js tests/unit/reddit-vote.test.js
git commit -m "fix(reddit): correct block/friend endpoint per live session" \
  -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-review notes (for the implementer)

- **Spec coverage:** D (Task 6), I=block+skip (Tasks 1/2/6), A=friend/follow with frontend wording (Tasks 1/2/4/6), validation (Task 2), flash feedback (Task 5), help panel (Task 7), i18n ×6 (Task 8), privacy/docs (Task 9), live verification of the two flagged endpoints (Task 10). F stays Fullscreen (unchanged).
- **No new host permissions:** all writes hit `old.reddit.com`, already granted for voting. Confirm in Task 10; if new reddit follow targets another host, add it to `wxt.config.ts` host permissions and re-verify in a real browser (host-permission changes don't show up offline).
- **Optimistic UX:** block advances the slide before the write resolves; a failed write shows `uiActionError`. The post is skipped for the session regardless — acceptable, matches the "block + next" intent.
