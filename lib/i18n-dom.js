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

/**
 * Build a fragment from a template containing {name} markers, replacing each
 * marker with the provided node and the rest with text nodes. Lets translators
 * reorder the sentence. Uses {name} (not $name$) so the store linter does not
 * mistake markers for undeclared i18n placeholders.
 * @param {Document} doc
 * @param {string} template
 * @param {Record<string, Node>} nodes
 * @returns {DocumentFragment}
 */
export function fillTemplate(doc, template, nodes) {
  const frag = doc.createDocumentFragment();
  for (const part of template.split(/(\{[A-Za-z0-9_]+\})/)) {
    const m = part.match(/^\{([A-Za-z0-9_]+)\}$/);
    if (m && nodes[m[1]]) frag.append(nodes[m[1]]);
    else if (part) frag.append(doc.createTextNode(part));
  }
  return frag;
}
