import { t, localeDirection, setLocale } from "./i18n.js";

/**
 * Localize a static document: set <html dir> from the locale and replace the
 * text of every [data-i18n] element with its translated message.
 * @param {Document} doc
 * @param {string} locale
 */
export function localizeDocument(doc, locale) {
  setLocale(locale);
  doc.documentElement.dir = localeDirection(locale);
  for (const el of doc.querySelectorAll("[data-i18n]")) {
    const key = el.getAttribute("data-i18n");
    if (key) el.textContent = t(key);
  }
}
