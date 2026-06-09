import { afterEach, describe, expect, it } from "vitest";
import ar from "../../locales/ar.json";
import fr from "../../locales/fr.json";
import {
  t,
  tn,
  localeDirection,
  setMessageGetter,
  setLocale,
  currentLocale,
  resolveLocale,
  SUPPORTED_LOCALES,
} from "../../lib/i18n.js";

afterEach(() => {
  setMessageGetter(null); // restore the built-in English getter
  setLocale("en");
});

describe("t", () => {
  it("returns the English message by default", () => {
    expect(t("actionTitle")).toBe("Start Reddit Slideshow Spectacular!");
  });

  it("substitutes named placeholders positionally", () => {
    expect(t("uiAnnouncePosition", ["5", "10"])).toBe("5 of 10");
  });

  it("coerces non-string substitutions", () => {
    expect(t("skipped_other", [3])).toBe("3 skipped");
  });

  it("falls back to English then the key when the getter is empty", () => {
    setMessageGetter(() => "");
    expect(t("actionTitle")).toBe("Start Reddit Slideshow Spectacular!");
    expect(t("nope")).toBe("nope");
  });

  it("uses an injected getter when it returns a value", () => {
    setMessageGetter((key) => (key === "actionTitle" ? "OVERRIDE" : ""));
    expect(t("actionTitle")).toBe("OVERRIDE");
  });

  it("inserts a substitution value containing $$ verbatim (single pass)", () => {
    expect(t("uiAnnouncePosition", ["a$$b", "10"])).toBe("a$$b of 10");
  });

  it("does not re-substitute $name$ that appears inside a value", () => {
    // uiAnnouncePosition has $index$ then $total$; a value containing $total$
    // must be inserted verbatim, not re-expanded.
    expect(t("uiAnnouncePosition", ["$total$", "10"])).toBe("$total$ of 10");
  });
});

describe("tn", () => {
  it("selects the English plural category via Intl.PluralRules", () => {
    setLocale("en");
    expect(tn("skipped", 1, [1])).toBe("1 skipped");
    expect(tn("skipped", 3, [3])).toBe("3 skipped");
  });

  it("falls back to _other when a category key is missing", () => {
    setLocale("ar"); // ar count 10 -> "few" (no skipped_few key) -> _other
    expect(tn("skipped", 10, [10])).toBe(t("skipped_other", [10]));
  });
});

describe("localeDirection", () => {
  it("maps Arabic to rtl and English to ltr", () => {
    expect(localeDirection("ar")).toBe("rtl");
    expect(localeDirection("ar-EG")).toBe("rtl");
    expect(localeDirection("en-US")).toBe("ltr");
  });
});

describe("setLocale/currentLocale", () => {
  it("tracks the active locale, defaulting to en", () => {
    expect(currentLocale()).toBe("en");
    setLocale("fr");
    expect(currentLocale()).toBe("fr");
  });
});

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
