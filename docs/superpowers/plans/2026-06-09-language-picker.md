# In-App Language Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user override the auto-detected UI language (and direction) from
the full options page, defaulting to "Automatic" (follow the browser).

**Architecture:** Move UI-string resolution off `browser.i18n` (browser-locale-
locked) onto bundled catalogs: `lib/i18n.js` imports all six `locales/*.json`,
and `setLocale(resolved)` switches strings + direction + plurals together. A new
`locale` setting ("auto" + the six) is resolved via `resolveLocale(setting,
uiLang)`. The options page gets a Language `<select>` that re-localizes live; the
overlay applies the choice on its next start. Manifest `__MSG_*__` localization
is untouched (browser-locale, unavoidable).

**Tech Stack:** WXT 0.20 MV3, Vitest + happy-dom + `fakeBrowser`, plain JS +
JSDoc, `Intl.PluralRules`. No new runtime dependencies.

**Catalog parity:** `tests/unit/i18n-catalog.test.js` enforces that all six
`locales/*.json` share the same keys + placeholders, and that `public/_locales`
is in sync. Any new key must be added to all six and `npm run locales` re-run.

**Commit discipline:** small commits; messages end with the `Co-Authored-By`
trailer; no `git push`.

---

### Task 1: Add the `locale` setting

**Files:**

- Modify: `lib/settings.js`
- Modify: `tests/unit/settings.test.js`

- [ ] **Step 1: Write the failing tests** — append to `tests/unit/settings.test.js`:

```js
import { describe, it, expect } from "vitest";
import {
  normalizeSettings,
  DEFAULT_SETTINGS,
  UI_LOCALES,
} from "../../lib/settings.js";

describe("locale setting", () => {
  it("defaults to auto", () => {
    expect(DEFAULT_SETTINGS.locale).toBe("auto");
    expect(normalizeSettings({}).locale).toBe("auto");
  });
  it("keeps a supported explicit locale", () => {
    expect(normalizeSettings({ locale: "ar" }).locale).toBe("ar");
    expect(normalizeSettings({ locale: "de" }).locale).toBe("de");
  });
  it("rejects an unsupported or junk locale", () => {
    expect(normalizeSettings({ locale: "pl" }).locale).toBe("auto");
    expect(normalizeSettings({ locale: 5 }).locale).toBe("auto");
  });
  it("exposes the supported set including auto", () => {
    expect(UI_LOCALES).toEqual(["auto", "en", "es", "fr", "de", "it", "ar"]);
  });
});
```

(If `settings.test.js` already imports `normalizeSettings`/`DEFAULT_SETTINGS`,
reuse the existing import rather than redeclaring — add only `UI_LOCALES` and the
new `describe`.)

- [ ] **Step 2: Run it — expect FAIL** (`UI_LOCALES` undefined, `locale` missing).

Run: `npx vitest run tests/unit/settings.test.js`

- [ ] **Step 3: Implement in `lib/settings.js`**

Add to the `Settings` typedef (after `panZoomMinOversize`):

```js
 * @property {string} locale UI language: "auto" (follow the browser) or a
 *   supported locale code.
```

Add the supported-set constant near the other exported consts (e.g. after
`TIMER_BAR_MODES`):

```js
// UI language options: "auto" follows the browser; the rest are the shipped
// locales. Mirrors the catalogs in locales/.
export const UI_LOCALES = ["auto", "en", "es", "fr", "de", "it", "ar"];
```

Add to `DEFAULT_SETTINGS` (e.g. after `timerBar`):

```js
  // UI language; "auto" follows the browser's language.
  locale: "auto",
```

Add to the object `normalizeSettings` returns:

```js
    locale:
      typeof input.locale === "string" && UI_LOCALES.includes(input.locale)
        ? input.locale
        : DEFAULT_SETTINGS.locale,
```

- [ ] **Step 4: Run it — expect PASS.**

Run: `npx vitest run tests/unit/settings.test.js`

- [ ] **Step 5: Commit**

```bash
git add lib/settings.js tests/unit/settings.test.js
git commit -m "feat(i18n): add locale setting (auto + six languages)"
```

---

### Task 2: Bundle catalogs + locale resolution in `lib/i18n.js`

Make the default getter read the active locale's bundled catalog (per-key
English fallback), and add `resolveLocale` + `SUPPORTED_LOCALES`.

**Files:**

- Modify: `lib/i18n.js`
- Modify: `tests/unit/i18n.test.js`

- [ ] **Step 1: Write/adjust the failing tests** in `tests/unit/i18n.test.js`.

Add catalog imports at the top:

```js
import ar from "../../locales/ar.json";
import fr from "../../locales/fr.json";
```

Add a new describe block:

```js
import { resolveLocale, SUPPORTED_LOCALES } from "../../lib/i18n.js";

describe("resolveLocale", () => {
  it("maps auto to the browser primary subtag when supported", () => {
    expect(resolveLocale("auto", "en-US")).toBe("en");
    expect(resolveLocale("auto", "ar")).toBe("ar");
    expect(resolveLocale("auto", "fr-CA")).toBe("fr");
  });
  it("falls back to en for an unsupported browser language", () => {
    expect(resolveLocale("auto", "pl")).toBe("en");
    expect(resolveLocale("auto", "")).toBe("en");
  });
  it("returns a valid explicit choice, else en", () => {
    expect(resolveLocale("de", "en-US")).toBe("de");
    expect(resolveLocale("zz", "en-US")).toBe("en");
  });
  it("lists the six shipped locales", () => {
    expect(SUPPORTED_LOCALES).toEqual(["en", "es", "fr", "de", "it", "ar"]);
  });
});

describe("setLocale switches the catalog", () => {
  it("returns the active locale's message", () => {
    setLocale("ar");
    expect(t("uiClose")).toBe(ar.uiClose.message);
    setLocale("fr");
    expect(t("uiClose")).toBe(fr.uiClose.message);
  });
  it("falls back to the key for an unknown message", () => {
    setLocale("fr");
    expect(t("definitely_not_a_key")).toBe("definitely_not_a_key");
  });
});
```

Change the existing `tn` "falls back to \_other" test so it no longer asserts an
English literal (Arabic is now bundled). Replace its body with:

```js
it("falls back to _other when a category key is missing", () => {
  setLocale("ar"); // ar count 10 -> "few" (no skipped_few key) -> _other
  expect(tn("skipped", 10, [10])).toBe(t("skipped_other", [10]));
});
```

- [ ] **Step 2: Run — expect FAIL** (`resolveLocale`/`SUPPORTED_LOCALES` missing;
      `setLocale("ar")` still yields English from the en-only getter).

Run: `npx vitest run tests/unit/i18n.test.js`

- [ ] **Step 3: Implement in `lib/i18n.js`.**

Replace the single English import (line 1) with all six:

```js
import enCatalog from "@/locales/en.json";
import esCatalog from "@/locales/es.json";
import frCatalog from "@/locales/fr.json";
import deCatalog from "@/locales/de.json";
import itCatalog from "@/locales/it.json";
import arCatalog from "@/locales/ar.json";

/** @type {Record<string, Record<string, CatalogEntry>>} */
const CATALOGS = {
  en: enCatalog,
  es: esCatalog,
  fr: frCatalog,
  de: deCatalog,
  it: itCatalog,
  ar: arCatalog,
};

/** The shipped UI locales, in catalog order. */
export const SUPPORTED_LOCALES = ["en", "es", "fr", "de", "it", "ar"];
```

Make `defaultGetMessage` read the active locale's catalog with a per-key English
fallback:

```js
/** Resolve a key from the active locale's catalog, falling back to English. */
function defaultGetMessage(
  /** @type {string} */ key,
  /** @type {string[]=} */ subs,
) {
  const catalog = CATALOGS[activeLocale] ?? enCatalog;
  const entry = catalog[key] ?? enCatalog[key];
  return entry ? expand(entry, subs) : "";
}
```

(`hasEnKey` stays as-is — plural-category keys are identical across locales, so
English is the right source for "does this category exist".)

Add `resolveLocale` (e.g. after `localeDirection`):

```js
/**
 * Resolve a stored locale setting to a shipped locale code.
 * "auto" (or unsupported) → the browser language's primary subtag if shipped,
 * else "en"; an explicit shipped choice → itself.
 * @param {string} setting "auto" or a locale code
 * @param {string} uiLang browser.i18n.getUILanguage() value
 * @returns {string}
 */
export function resolveLocale(setting, uiLang) {
  if (setting && setting !== "auto" && SUPPORTED_LOCALES.includes(setting)) {
    return setting;
  }
  const lang = String(uiLang || "")
    .toLowerCase()
    .split(/[-_]/)[0];
  return SUPPORTED_LOCALES.includes(lang) ? lang : "en";
}
```

Update the module-state comment (lines 10-12) to reflect that the default getter
is now locale-aware and `setLocale` switches the catalog. Leave `setMessageGetter`
exported (tests still inject through it).

- [ ] **Step 4: Run — expect PASS** (all i18n tests, including the updated `tn`
      and the new blocks).

Run: `npx vitest run tests/unit/i18n.test.js`

- [ ] **Step 5: Run the full suite** (the catalog test + any consumer must stay
      green; nothing else changed behavior because default `activeLocale` is "en").

Run: `npm test`

- [ ] **Step 6: Commit**

```bash
git add lib/i18n.js tests/unit/i18n.test.js
git commit -m "feat(i18n): bundle all catalogs; setLocale switches language + resolveLocale"
```

---

### Task 3: Resolve the locale from settings in the content script

**Files:**

- Modify: `entrypoints/content.js`

- [ ] **Step 1: Update imports.** `content.js` currently imports
      `{ setMessageGetter, setLocale }` from `@/lib/i18n.js`. Change that import to:

```js
import { setLocale, resolveLocale } from "@/lib/i18n.js";
```

(`getSettings` is already imported from `@/lib/settings.js`.)

- [ ] **Step 2: Replace the init wiring.** At the very top of `main()`, the two
      lines that currently call `setMessageGetter((key, subs) => browser.i18n.getMessage(...))`
      and `setLocale(browser.i18n.getUILanguage())` become:

```js
// UI language: an immediate best-guess from the browser, then the stored
// override once settings load (and on change, applied to the next show start).
const uiLang = browser.i18n.getUILanguage();
setLocale(resolveLocale("auto", uiLang));
getSettings()
  .then((s) => setLocale(resolveLocale(s.locale, uiLang)))
  .catch(() => {});
```

- [ ] **Step 3: Re-resolve on settings change.** In the existing
      `browser.storage.onChanged` listener, update the `.then` so a locale change
      takes effect on the next start:

```js
browser.storage.onChanged.addListener((_changes, area) => {
  if (area !== "local") return;
  getSettings()
    .then((next) => {
      setLocale(resolveLocale(next.locale, uiLang));
      session.applyLiveSettings(next);
    })
    .catch((err) => log.warn("applyLiveSettings failed", err));
});
```

- [ ] **Step 4: Verify** the content script no longer references
      `setMessageGetter` or `browser.i18n.getMessage`, and typechecks.

Run: `grep -n "setMessageGetter\|getMessage" entrypoints/content.js` → expect no matches.
Run: `npm run typecheck`
Run: `npm test` (full suite stays green)

- [ ] **Step 5: Commit**

```bash
git add entrypoints/content.js
git commit -m "feat(i18n): drive overlay locale from the saved setting"
```

---

### Task 4: Language picker on the options page

Add the new catalog keys, the `<select>` row, and the live re-localize binding.

**Files:**

- Modify: `locales/en.json` (+ all five other locales) and regenerate `public/_locales`
- Modify: `entrypoints/options/index.html`
- Modify: `entrypoints/options/main.js`
- Modify: `tests/unit/options-page.test.js`

- [ ] **Step 1: Add two catalog keys to every locale.** Add `optLanguage` and
      `optLanguageAuto` to each `locales/*.json` with these values (keep the
      existing keys; place them near the other `opt*` keys):

| key               | en                                  | es                                | fr                                 | de                                 | it                              | ar                    |
| ----------------- | ----------------------------------- | --------------------------------- | ---------------------------------- | ---------------------------------- | ------------------------------- | --------------------- |
| `optLanguage`     | Language                            | Idioma                            | Langue                             | Sprache                            | Lingua                          | اللغة                 |
| `optLanguageAuto` | Automatic (your browser's language) | Automático (idioma del navegador) | Automatique (langue du navigateur) | Automatisch (Sprache des Browsers) | Automatica (lingua del browser) | تلقائي (لغة المتصفّح) |

Each entry has a `message` and a short English `description`, no `placeholders`.
Example for en:

```json
"optLanguage": { "message": "Language", "description": "Language picker label on the options page." },
"optLanguageAuto": { "message": "Automatic (your browser's language)", "description": "Default language option that follows the browser." }
```

Then regenerate:

```bash
npm run locales
```

- [ ] **Step 2: Add the Language row** to `entrypoints/options/index.html` as the
      first `.field`, immediately after the `<p class="sub" ...>` subtitle and
      before the "Time per image" field:

```html
<label class="field">
  <span class="field__label">
    <span data-i18n="optLanguage">Language</span>
  </span>
  <select id="locale">
    <option value="auto" data-i18n="optLanguageAuto">
      Automatic (your browser's language)
    </option>
    <option value="en">English</option>
    <option value="es">Español</option>
    <option value="fr">Français</option>
    <option value="de">Deutsch</option>
    <option value="it">Italiano</option>
    <option value="ar">العربية</option>
  </select>
</label>
```

(The six language options carry no `data-i18n` — they stay in their own script.)

- [ ] **Step 3: Rewire `entrypoints/options/main.js`.**

Change the i18n import (line 9) from `{ setMessageGetter, t }` to:

```js
import { t, resolveLocale } from "@/lib/i18n.js";
```

Replace the top localization block (the `setMessageGetter(...)` call,
`localizeDocument(...)`, and the footer-assembly that follows) with a reusable
`relocalize` function and an initial call. Put this where that block was:

```js
const uiLang = browser.i18n.getUILanguage();

/** Apply a resolved locale to the page: strings, direction, and the footer. */
function relocalize(locale) {
  localizeDocument(document, locale);
  const footerText = document.querySelector("#footerText");
  if (footerText) {
    const brand = document.createElement("em");
    brand.textContent = "Reddit Slideshow Spectacular!";
    footerText.replaceChildren(
      fillTemplate(document, t("optFooter"), { brand }),
    );
  }
}

// Immediate best-guess; load() re-applies the stored choice.
relocalize(resolveLocale("auto", uiLang));
```

Add the select element with the other `requiredElement` declarations:

```js
const locale = requiredElement("#locale", HTMLSelectElement);
```

In `load()`, after `const settings = await getSettings();`, set the value and
apply the stored locale:

```js
locale.value = settings.locale;
relocalize(resolveLocale(settings.locale, uiLang));
```

Add a change listener (near the other listeners) that saves the locale and
re-localizes live:

```js
locale.addEventListener("change", async () => {
  try {
    await saveSettings({ locale: locale.value });
  } catch {
    // change listener; a failed write isn't actionable here
  }
  relocalize(resolveLocale(locale.value, uiLang));
});
```

Leave `locale` OUT of `persist()` (it has its own handler).

- [ ] **Step 4: Add a static options-page test** to `tests/unit/options-page.test.js`
      (this suite parses `index.html`). Match its existing parsing style; assert:

```js
it("has a language select with auto + the six locales", () => {
  const sel = doc.querySelector("#locale"); // `doc` per the file's existing setup
  expect(sel).not.toBeNull();
  const opts = [...sel.querySelectorAll("option")].map((o) => o.value);
  expect(opts).toEqual(["auto", "en", "es", "fr", "de", "it", "ar"]);
  expect(
    sel.querySelector('option[value="auto"]')?.getAttribute("data-i18n"),
  ).toBe("optLanguageAuto");
});
```

(Adapt `doc`/parsing to however `options-page.test.js` already loads the HTML.)

- [ ] **Step 5: Verify**

Run: `npx vitest run tests/unit/options-page.test.js tests/unit/i18n-catalog.test.js`
Run: `npm test`
Run: `npm run typecheck`
Run: `npm run lint`
Run: `npm run format`

- [ ] **Step 6: Commit**

```bash
git add locales public/_locales entrypoints/options/index.html entrypoints/options/main.js tests/unit/options-page.test.js
git commit -m "feat(i18n): Language picker on the options page (live apply)"
```

---

### Task 5: Docs + full gate + real-browser flag

**Files:**

- Modify: `NEXT_STEP.md`
- Modify: `README.md` (Languages note)

- [ ] **Step 1: Update the README Languages note** to mention the picker. In the
      `### Languages` subsection, change the auto-selection sentence to:

```md
The interface is available in English, Spanish, French, German, Italian, and
Arabic. It follows your browser's language by default, or pick one explicitly
under **Language** on the options page. Arabic renders right-to-left.
```

- [ ] **Step 2: Update the NEXT_STEP real-browser flag.** Under "Needs a
      real-browser confirm", replace the localization bullet's verification note
      to use the picker (it removes the browser-language juggling):

```md
- **Localization + RTL** — on the options page, switch **Language** to each of
  Spanish/French/German/Italian/Arabic and confirm the page re-localizes and (for
  Arabic) flips to RTL live; then start a slideshow and confirm the overlay
  renders in that language with correct mirroring and an unscrambled byline. Unit
  tests cover catalog integrity, the per-locale getter, `resolveLocale`, and the
  `dir`/`<bdi>` structure — not rendered glyphs/layout.
```

- [ ] **Step 3: Full gate** (run via the verify-gate skill or directly):

Run: `npm run typecheck`
Run: `npm run lint`
Run: `npm run format`
Run: `npm test`
Run: `npm run build`
Run: `npm run webext:lint` (expect 0/0/0 — manifest `__MSG__` unchanged)

- [ ] **Step 4: Commit**

```bash
git add NEXT_STEP.md README.md
git commit -m "docs: language picker — note in README, real-browser flag [skip ci]"
```

- [ ] **Step 5: Stop.** Do not push. Report results; the in-app picker now makes
      the Arabic real-browser confirm a one-click check.
