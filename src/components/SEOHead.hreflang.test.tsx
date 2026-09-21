import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import SEOHead from "./SEOHead";
import { localizedUrl } from "@/lib/seo-urls";
import { I18nProvider } from "@/contexts/I18nContext";

const renderHead = (lang: "en" | "fi" | "sv") => {
  localStorage.setItem("mimmobook-lang", lang);
  return render(
    <I18nProvider>
      <SEOHead title="T" description="D" path="/use-cases" />
    </I18nProvider>,
  );
};

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("localizedUrl", () => {
  it("keeps English on the bare path and adds ?lang= for others", () => {
    expect(localizedUrl("/use-cases", "en")).toBe(
      "https://mimmobook.com/use-cases",
    );
    expect(localizedUrl("/use-cases", "fi")).toBe(
      "https://mimmobook.com/use-cases?lang=fi",
    );
    expect(localizedUrl("/use-cases", "sv")).toBe(
      "https://mimmobook.com/use-cases?lang=sv",
    );
  });
});

describe("SEOHead hreflang and canonical", () => {
  it("emits one alternate per language plus x-default", () => {
    renderHead("en");
    const alternates = Array.from(
      document.querySelectorAll('link[rel="alternate"][data-seo-hreflang]'),
    ).map((el) => [el.getAttribute("hreflang"), el.getAttribute("href")]);
    expect(alternates).toEqual([
      ["en", "https://mimmobook.com/use-cases"],
      ["fi", "https://mimmobook.com/use-cases?lang=fi"],
      ["sv", "https://mimmobook.com/use-cases?lang=sv"],
      ["x-default", "https://mimmobook.com/use-cases"],
    ]);
  });

  it("self-references the canonical of the active language", () => {
    renderHead("fi");
    expect(
      document.querySelector('link[rel="canonical"]')?.getAttribute("href"),
    ).toBe("https://mimmobook.com/use-cases?lang=fi");
    expect(document.documentElement.getAttribute("lang")).toBe("fi");
    expect(
      document
        .querySelector('meta[property="og:locale"]')
        ?.getAttribute("content"),
    ).toBe("fi_FI");
  });

  it("does not duplicate alternates across renders", () => {
    renderHead("sv");
    cleanup();
    renderHead("sv");
    expect(
      document.querySelectorAll('link[rel="alternate"][data-seo-hreflang]')
        .length,
    ).toBe(4);
  });
});
