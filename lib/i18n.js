import enCatalog from "@/locales/en.json";

/**
 * @typedef {{ message: string, description?: string,
 *   placeholders?: Record<string, { content: string }> }} CatalogEntry
 */

const RTL_LANGS = new Set(["ar", "he", "fa", "ur"]);

/** @type {(key: string, subs?: string[]) => string} */
let getMessageImpl = defaultGetMessage;
let activeLocale = "en";

/** Resolve a key from the bundled English catalog (the fallback + test source). */
function defaultGetMessage(
  /** @type {string} */ key,
  /** @type {string[]=} */ subs,
) {
  const entry = /** @type {Record<string, CatalogEntry>} */ (enCatalog)[key];
  return entry ? expand(entry, subs) : "";
}

/** Apply named placeholders ($name$ -> content "$N" -> subs[N-1]) and $$ -> $. */
function expand(
  /** @type {CatalogEntry} */ entry,
  /** @type {string[]=} */ subs,
) {
  let msg = entry.message;
  const placeholders = entry.placeholders ?? {};
  for (const [name, def] of Object.entries(placeholders)) {
    const index = Number(def.content.replace("$", "")) - 1;
    const value = subs?.[index] ?? "";
    msg = msg.replaceAll(`$${name}$`, value);
  }
  return msg.replaceAll("$$", "$");
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
  const category = new Intl.PluralRules(activeLocale).select(count);
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
