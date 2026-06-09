import { afterEach, describe, expect, it } from "vitest";
import {
  t,
  tn,
  localeDirection,
  setMessageGetter,
  setLocale,
  currentLocale,
} from "../../lib/i18n.js";

afterEach(() => {
  setMessageGetter(null); // restore the built-in English getter
  setLocale("en");
});

describe("t", () => {
  it("returns the English message by default", () => {
    expect(t("extName")).toBe("Reddit Slideshow Spectacular!");
  });

  it("substitutes named placeholders positionally", () => {
    expect(t("byline", ["u/alice", "r/pics"])).toBe("u/alice to r/pics");
  });

  it("coerces non-string substitutions", () => {
    expect(t("skipped_other", [3])).toBe("3 skipped");
  });

  it("falls back to English then the key when the getter is empty", () => {
    setMessageGetter(() => "");
    expect(t("extName")).toBe("Reddit Slideshow Spectacular!");
    expect(t("nope")).toBe("nope");
  });

  it("uses an injected getter when it returns a value", () => {
    setMessageGetter((key) => (key === "extName" ? "OVERRIDE" : ""));
    expect(t("extName")).toBe("OVERRIDE");
  });
});

describe("tn", () => {
  it("selects the English plural category via Intl.PluralRules", () => {
    setLocale("en");
    expect(tn("skipped", 1, [1])).toBe("1 skipped");
    expect(tn("skipped", 3, [3])).toBe("3 skipped");
  });

  it("falls back to _other when a category key is missing", () => {
    setLocale("ar"); // Arabic 'two'/'few' categories not seeded -> _other
    expect(tn("skipped", 10, [10])).toBe("10 skipped");
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
