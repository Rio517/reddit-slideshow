import { afterEach, describe, expect, it } from "vitest";
import { localizeDocument } from "../../lib/i18n-dom.js";
import { setMessageGetter, setLocale } from "../../lib/i18n.js";

afterEach(() => {
  document.body.innerHTML = "";
  document.documentElement.removeAttribute("dir");
  setMessageGetter(null);
  setLocale("en");
});

describe("localizeDocument", () => {
  it("replaces [data-i18n] text from the catalog", () => {
    document.body.innerHTML = `<span data-i18n="actionTitle"></span>`;
    localizeDocument(document, "en");
    expect(document.querySelector("span")?.textContent).toBe(
      "Start Reddit Slideshow Spectacular!",
    );
  });

  it("sets the document direction from the locale", () => {
    localizeDocument(document, "ar");
    expect(document.documentElement.dir).toBe("rtl");
  });
});
