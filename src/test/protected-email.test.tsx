/**
 * Guards the anti-harvesting contact pattern used on the legal and security
 * pages (<ProtectedEmail>):
 *
 * 1. The complete address never appears before the visitor asks for it.
 * 2. Revealing it produces a working mailto link with the expected subject.
 * 3. A no-script fallback keeps the address readable ("user [at] domain [dot] tld"),
 *    so the legally required contact point stays published.
 * 4. Accessibility: the reveal control is a real button with a spoken-out
 *    accessible name, reachable by keyboard.
 * 5. The page sources never hardcode a literal address, which is what a
 *    harvesting crawler would scrape out of the served markup.
 */
import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import ProtectedEmail from "@/components/ProtectedEmail";

const PAGES = [
  "src/pages/Security.tsx",
  "src/pages/legal/DPA.tsx",
  "src/pages/legal/Retention.tsx",
  "src/pages/legal/Subprocessors.tsx",
];

describe("ProtectedEmail: address protection", () => {
  it("does not render the full address before the visitor reveals it", () => {
    const { container } = render(<ProtectedEmail user="privacy" />);
    expect(container.innerHTML).not.toContain("privacy@mimmobook.com");
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("reveals the assembled address on click", () => {
    render(<ProtectedEmail user="security" />);
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByText("security@mimmobook.com")).toBeInTheDocument();
  });

  it("supports a custom domain and tld", () => {
    render(<ProtectedEmail user="privacy" domain="example" tld="fi" />);
    fireEvent.click(screen.getByRole("button"));
    const link = screen.getByRole("link");
    expect(link).toHaveTextContent("privacy@example.fi");
    expect(link.getAttribute("href")).toBe("mailto:privacy@example.fi");
  });
});

describe("ProtectedEmail: mailto subjects", () => {
  it("pre-fills and url-encodes the subject", () => {
    render(<ProtectedEmail user="security" subject="Vulnerability report" />);
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByRole("link").getAttribute("href")).toBe(
      "mailto:security@mimmobook.com?subject=Vulnerability%20report",
    );
  });

  it("omits the query string when no subject is given", () => {
    render(<ProtectedEmail user="privacy" />);
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByRole("link").getAttribute("href")).toBe(
      "mailto:privacy@mimmobook.com",
    );
    expect(screen.getByRole("link").getAttribute("href")).not.toContain("?");
  });
});

describe("ProtectedEmail: no-script fallback", () => {
  // React only serialises <noscript> children in server-rendered markup, so the
  // fallback is asserted against renderToStaticMarkup (the form a crawler or a
  // script-less reader would see).
  it("keeps a readable obfuscated form in the noscript block", () => {
    const markup = renderToStaticMarkup(
      <ProtectedEmail user="privacy" />,
    ).replace(/\s+/g, " ");
    expect(markup).toMatch(/<noscript>.*privacy \[at\] mimmobook \[dot\] com/);
    expect(markup).not.toContain("privacy@mimmobook.com");
  });

  it("renders a noscript element on the client too", () => {
    const { container } = render(<ProtectedEmail user="privacy" />);
    expect(container.querySelector("noscript")).not.toBeNull();
  });

  it("drops the fallback once the address is revealed", () => {
    const { container } = render(<ProtectedEmail user="security" />);
    fireEvent.click(screen.getByRole("button"));
    expect(container.querySelector("noscript")).toBeNull();
  });
});

describe("ProtectedEmail: accessibility", () => {
  it("uses a real button with type=button and a spoken accessible name", () => {
    render(<ProtectedEmail user="security" />);
    const button = screen.getByRole("button");
    expect(button.tagName).toBe("BUTTON");
    expect(button).toHaveAttribute("type", "button");
    expect(button).toHaveAccessibleName(
      "Show the address (security at mimmobook dot com)",
    );
  });

  it("honours a custom reveal label in both the text and the accessible name", () => {
    render(<ProtectedEmail user="privacy" revealLabel="Email instead" />);
    const button = screen.getByRole("button");
    expect(button).toHaveTextContent("Email instead");
    expect(button).toHaveAccessibleName(
      "Email instead (privacy at mimmobook dot com)",
    );
  });

  it("can be revealed with the keyboard", () => {
    render(<ProtectedEmail user="privacy" />);
    const button = screen.getByRole("button");
    button.focus();
    expect(button).toHaveFocus();
    fireEvent.keyDown(button, { key: "Enter" });
    fireEvent.click(button); // jsdom does not synthesise click from keyDown
    expect(screen.getByRole("link")).toHaveTextContent("privacy@mimmobook.com");
  });
});

describe("legal and security pages", () => {
  it.each(PAGES)("%s contains no literal contact address", (page) => {
    const source = readFileSync(page, "utf8");
    expect(source).not.toMatch(/[a-z0-9._%-]+@mimmobook\.com/i);
  });

  it.each(PAGES)("%s exposes its contact through ProtectedEmail", (page) => {
    const source = readFileSync(page, "utf8");
    expect(source).toContain('from "@/components/ProtectedEmail"');
    expect(source).toMatch(/<ProtectedEmail\s/);
  });

  it.each(PAGES)("%s gives every contact a subject line", (page) => {
    const source = readFileSync(page, "utf8");
    const uses = source.match(/<ProtectedEmail[\s\S]*?\/>/g) ?? [];
    expect(uses.length).toBeGreaterThan(0);
    for (const use of uses) {
      expect(use).toMatch(/user="(privacy|security)"/);
      expect(use).toMatch(/subject="[^"]+"/);
    }
  });
});
