import { describe, it, expect } from "vitest";
import {
  createAccessibleChallenge,
  isChallengePassed,
  normaliseAnswer,
} from "@/lib/accessibleChallenge";

describe("accessible support challenge", () => {
  it("always produces a question, a hint and at least one accepted answer", () => {
    for (let i = 0; i < 200; i += 1) {
      const c = createAccessibleChallenge();
      expect(c.question.length).toBeGreaterThan(5);
      expect(c.hint.length).toBeGreaterThan(5);
      expect(c.accepted.length).toBeGreaterThan(0);
      c.accepted.forEach((a) => expect(a).toBe(normaliseAnswer(a)));
    }
  });

  it("accepts every generated answer, in any case and with stray spaces", () => {
    for (let i = 0; i < 200; i += 1) {
      const c = createAccessibleChallenge();
      c.accepted.forEach((a) => {
        expect(isChallengePassed(c, a)).toBe(true);
        expect(isChallengePassed(c, `  ${a.toUpperCase()}  `)).toBe(true);
      });
    }
  });

  it("rejects empty and wrong answers", () => {
    const c = createAccessibleChallenge();
    expect(isChallengePassed(c, "")).toBe(false);
    expect(isChallengePassed(c, "definitely-not-the-answer")).toBe(false);
  });

  it("is text only, with no image or audio requirement", () => {
    for (let i = 0; i < 50; i += 1) {
      const c = createAccessibleChallenge();
      expect(c.question).not.toMatch(/<img|image|listen|audio/i);
    }
  });
});
