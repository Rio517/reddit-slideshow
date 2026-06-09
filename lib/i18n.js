import enCatalog from "@/locales/en.json";
import esCatalog from "@/locales/es.json";
import frCatalog from "@/locales/fr.json";
import deCatalog from "@/locales/de.json";
import itCatalog from "@/locales/it.json";
import arCatalog from "@/locales/ar.json";

/**
 * @typedef {{ message: string, description?: string,
 *   placeholders?: Record<string, { content: string }> }} CatalogEntry
 */

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

const RTL_LANGS = new Set(["ar", "he", "fa", "ur"]);

// Module-level state: entrypoints install these via setMessageGetter/setLocale.
// Tests share one realm (vitest isolate:false) and MUST reset both in afterEach
// (setMessageGetter(null) restores the built-in English getter).
// defaultGetMessage reads CATALOGS[activeLocale]; setLocale switches the language.
/** @type {(key: string, subs?: string[]) => string} */
let getMessageImpl = defaultGetMessage;
let activeLocale = "en";

/** Resolve a key from the active locale's catalog, falling back to English. */
function defaultGetMessage(
  /** @type {string} */ key,
  /** @type {string[]=} */ subs,
) {
  const catalog = CATALOGS[activeLocale] ?? enCatalog;
  const en = /** @type {Record<string, CatalogEntry>} */ (enCatalog);
  const entry = catalog[key] ?? en[key];
  return entry ? expand(entry, subs) : "";
}

/** Apply named placeholders ($name$ -> content "$N" -> subs[N-1]) and $$ -> $. */
function expand(
  /** @type {CatalogEntry} */ entry,
  /** @type {string[]=} */ subs,
) {
  const placeholders = entry.placeholders ?? {};
  // Single left-to-right pass: $$ -> literal $, $name$ -> the matching
  // substitution, any other text (incl. a lone $) left untouched. Because
  // String.replace does not re-scan inserted text, substitution values that
  // contain $ or $name$-like tokens are inserted verbatim.
  return entry.message.replace(/\$\$|\$([A-Za-z0-9_@]+)\$/g, (match, name) => {
    if (match === "$$") return "$";
    const def = placeholders[name];
    if (!def) return match; // unknown placeholder name: leave the token literal
    const index = Number(def.content.replace("$", "")) - 1;
    return subs?.[index] ?? "";
  });
}

/** Whether the bundled English catalog defines a key. */
function hasEnKey(/** @type {string} */ key) {
  return Object.prototype.hasOwnProperty.call(enCatalog, key);
}

/**
 * Translate a key. Substitutions are coerced to strings. Falls back from the
 * active getter to the bundled English catalog, then to the key itself.
 * @param {string} key
 * @param {Array<string | number>} [subs]
 * @returns {string}
 */
export function t(key, subs) {
  const strings = subs?.map(String);
  const fromGetter = getMessageImpl(key, strings);
  if (fromGetter) return fromGetter;
  const fromEnglish = defaultGetMessage(key, strings);
  return fromEnglish || key;
}

/**
 * Plural-aware translate: picks `<key>_<category>` for `count` in the active
 * locale, falling back to `<key>_other`.
 * @param {string} key
 * @param {number} count
 * @param {Array<string | number>} [subs]
 * @returns {string}
 */
export function tn(key, count, subs) {
  let category;
  try {
    category = new Intl.PluralRules(activeLocale).select(count);
  } catch {
    category = "other";
  }
  const candidate = `${key}_${category}`;
  const chosen = hasEnKey(candidate) ? candidate : `${key}_other`;
  return t(chosen, subs);
}

/**
 * @param {string} locale BCP-47 tag (e.g. "ar", "en-US").
 * @returns {"ltr" | "rtl"}
 */
export function localeDirection(locale) {
  const lang = String(locale || "")
    .toLowerCase()
    .split(/[-_]/)[0];
  return RTL_LANGS.has(lang) ? "rtl" : "ltr";
}

/**
 * Resolve a stored locale setting to a shipped locale code. "auto" (or an
 * unsupported value) -> the browser language's primary subtag if shipped, else
 * "en"; an explicit shipped choice -> itself.
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

/**
 * Install the platform message getter (e.g. browser.i18n.getMessage). Passing a
 * falsy value restores the built-in English getter (used by tests).
 * @param {((key: string, subs?: string[]) => string) | null | undefined} fn
 */
export function setMessageGetter(fn) {
  getMessageImpl = fn || defaultGetMessage;
}

/** @param {string} locale */
export function setLocale(locale) {
  activeLocale = locale || "en";
}

/** @returns {string} */
export function currentLocale() {
  return activeLocale;
}
