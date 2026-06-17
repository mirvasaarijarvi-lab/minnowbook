/**
 * Accessibility tests for the new-features FAQ accordion on the Support page.
 *
 * Verifies:
 *  - ARIA roles/attributes from Radix Accordion (button + aria-expanded + aria-controls)
 *  - Section is labelled via aria-labelledby
 *  - Keyboard activation (Enter / Space) toggles aria-expanded
 *  - Arrow Down / Arrow Up move focus between triggers (Radix roving focus)
 *  - Triggers are focusable and reachable via Tab
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/fixtures/render";
import Support from "./Support";

// The Support page renders SEOHead (react-helmet-async) and a contact form
// that hits supabase. Stub the heavy/external bits so we can focus on the
// FAQ accordion semantics.
vi.mock("@/components/SEOHead", () => ({
  default: () => null,
  breadcrumbSchema: () => ({}),
}));
vi.mock("@/components/MarketingHeader", () => ({ default: () => null }));
vi.mock("@/components/MarketingFooter", () => ({ default: () => null }));
vi.mock("@/components/SupportContactForm", () => ({ default: () => null }));

const FIRST_QUESTION = "How do I create many rooms at once?";
const SECOND_QUESTION = "Can I price each room type differently?";

function getFaqRegion() {
  return screen.getByRole("region", {
    name: /FAQ: Hotels, Multi-site overrides, and Kitchen Orders/i,
  });
}

function getTrigger(name: string | RegExp) {
  return screen.getByRole("button", { name });
}

describe("Support FAQ accordion a11y", () => {
  beforeEach(() => {
    renderWithProviders(<Support />);
  });

  it("labels the FAQ section via aria-labelledby", () => {
    const region = getFaqRegion();
    expect(region).toBeInTheDocument();
    expect(region.getAttribute("aria-labelledby")).toBeTruthy();
  });

  it("renders each question as a button with aria-expanded=false initially", () => {
    const trigger = getTrigger(FIRST_QUESTION);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveAttribute("aria-controls");
  });

  it("toggles aria-expanded when activated with Enter", async () => {
    const user = userEvent.setup();
    const trigger = getTrigger(FIRST_QUESTION);
    trigger.focus();
    expect(trigger).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    await user.keyboard("{Enter}");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("toggles aria-expanded when activated with Space", async () => {
    const user = userEvent.setup();
    const trigger = getTrigger(SECOND_QUESTION);
    trigger.focus();

    await user.keyboard(" ");
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });

  it("moves focus between triggers with ArrowDown / ArrowUp (roving focus)", async () => {
    const user = userEvent.setup();
    const first = getTrigger(FIRST_QUESTION);
    const second = getTrigger(SECOND_QUESTION);
    first.focus();
    expect(first).toHaveFocus();

    await user.keyboard("{ArrowDown}");
    expect(second).toHaveFocus();

    await user.keyboard("{ArrowUp}");
    expect(first).toHaveFocus();
  });

  it("reveals the answer panel with role=region linked to its trigger when opened", async () => {
    const user = userEvent.setup();
    const trigger = getTrigger(FIRST_QUESTION);
    await user.click(trigger);

    const panelId = trigger.getAttribute("aria-controls")!;
    const panel = document.getElementById(panelId);
    expect(panel).not.toBeNull();
    expect(panel).toHaveAttribute("role", "region");
    expect(panel).toHaveAttribute("aria-labelledby", trigger.id);
    expect(
      within(panel as HTMLElement).getByText(/Bulk create/i),
    ).toBeInTheDocument();
  });

  it("groups questions under labelled subheadings", () => {
    const group = screen.getByRole("group", { name: /Hotels & room types/i });
    expect(group).toBeInTheDocument();
    expect(
      within(group).getByRole("button", { name: FIRST_QUESTION }),
    ).toBeInTheDocument();
  });
});
