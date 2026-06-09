import { afterEach, describe, expect, it } from "vitest";
import { localizeDocument, fillTemplate } from "../../lib/i18n-dom.js";
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

describe("fillTemplate", () => {
  it("honors word order when the marker is not first", () => {
    // Marker at the END proves fillTemplate respects translator word order:
    // the node follows the leading text rather than being pinned to the front.
    const em = document.createElement("em");
    em.textContent = "Reddit Slideshow Spectacular!";
    const frag = fillTemplate(document, "Use {brand}.", { brand: em });
    const host = document.createElement("p");
    host.append(frag);
    expect(host.textContent).toBe("Use Reddit Slideshow Spectacular!.");
    expect(host.firstChild?.nodeName).toBe("#text");
    expect(host.querySelector("em")?.textContent).toBe(
      "Reddit Slideshow Spectacular!",
    );
  });
});
