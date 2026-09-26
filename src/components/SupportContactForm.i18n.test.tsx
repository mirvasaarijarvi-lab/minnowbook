/**
 * The contact form's error messages, success notice and spam-check prompt
 * must appear in Finnish and Swedish, not English.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test/fixtures/render";
import { SUPPORT_COPY } from "@/i18n/support-copy";

const toast = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
}));
vi.mock("sonner", () => ({ toast }));

const insert = vi.hoisted(() => vi.fn(async () => ({ error: null })));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => ({ insert }) },
}));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "user-1", email: "mimmi@example.com", user_metadata: {} },
  }),
}));
vi.mock("@/hooks/useTenant", () => ({
  useTenant: () => ({ tenantId: "t-1" }),
}));

import SupportContactForm from "./SupportContactForm";

const LANGS = ["fi", "sv"] as const;
let now = 1_000_000;

const setup = async (lang: "fi" | "sv") => {
  localStorage.setItem("mimmobook-lang", lang);
  renderWithProviders(<SupportContactForm />);
  const f = SUPPORT_COPY[lang].form;
  // Wait until the form shows in the chosen language.
  await screen.findByText(f.title);
  return f;
};

/** Pretend the visitor has spent a while filling in the form. */
const waitAWhile = () => {
  now += 60_000;
};

const fill = (subject: string, message: string) => {
  fireEvent.change(document.getElementById("support-subject")!, {
    target: { value: subject },
  });
  fireEvent.change(document.getElementById("support-message")!, {
    target: { value: message },
  });
};

const submit = () =>
  fireEvent.submit(
    document.getElementById("support-message")!.closest("form")!,
  );

beforeEach(() => {
  localStorage.clear();
  toast.success.mockClear();
  toast.error.mockClear();
  insert.mockClear();
  now = 1_000_000;
  vi.spyOn(Date, "now").mockImplementation(() => now);
});
afterEach(() => vi.restoreAllMocks());

describe.each(LANGS)("contact form in %s", (lang) => {
  it("shows the validation error in the chosen language", async () => {
    const f = await setup(lang);
    waitAWhile();
    fill("ab", "A long enough message for support.");
    submit();
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(f.errSubjectShort),
    );
    expect(SUPPORT_COPY.en.form.errSubjectShort).not.toBe(f.errSubjectShort);

    fill("Varaus puuttuu", "short");
    submit();
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(f.errMessageShort),
    );
    expect(insert).not.toHaveBeenCalled();
  });

  it("shows the success notice in the chosen language", async () => {
    const f = await setup(lang);
    waitAWhile();
    fill("Varaus puuttuu", "Asiakkaan varaus ei näy kalenterissa tänään.");
    submit();
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(f.sentTitle, {
        description: f.sentDesc,
      }),
    );
    expect(insert).toHaveBeenCalledTimes(1);
  });

  it("asks the spam-check question in the chosen language", async () => {
    const f = await setup(lang);
    // Sending straight away looks automated, so the check appears.
    fill("Varaus puuttuu", "Asiakkaan varaus ei näy kalenterissa tänään.");
    submit();
    expect(await screen.findByText(f.tooFast)).toBeInTheDocument();
    const question = document.querySelector('label[for="support-challenge"]')!;
    const hint = document.getElementById("support-challenge-hint")!;
    const words =
      lang === "fi"
        ? /Paljonko|Mikä sana|Montako/
        : /Vad är|Vilket ord|Hur många/;
    expect(question.textContent).toMatch(words);
    expect(question.textContent).not.toMatch(/What is|Which word|How many/);
    expect(hint.textContent).toContain(f.challengeOptOut);
    expect(insert).not.toHaveBeenCalled();
  });
});
