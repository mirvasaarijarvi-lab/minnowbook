/**
 * Accessible, text-only anti-spam challenge.
 *
 * No images, no audio, no third party script: every challenge is a short
 * question in plain text that a screen reader can read out and a keyboard user
 * can answer in a normal text field. Answers accept digits or words and ignore
 * case and surrounding spaces, so the challenge never blocks a real person.
 */
export interface AccessibleChallenge {
  /** The question shown and read out to the visitor. */
  question: string;
  /** Accepted answers, already normalised. */
  accepted: string[];
  /** Short hint describing the expected answer format. */
  hint: string;
}

const NUMBER_WORDS = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
] as const;

const COLOURS = ["red", "green", "blue", "yellow", "purple", "orange"] as const;
const ORDINALS = ["first", "second", "third"] as const;

export const normaliseAnswer = (value: string) =>
  value.trim().toLowerCase().replace(/[.!?]+$/, "").replace(/\s+/g, " ");

const pick = <T,>(items: readonly T[]) => items[Math.floor(Math.random() * items.length)];

const numberAnswers = (n: number) => [String(n), NUMBER_WORDS[n] ?? String(n)];

/** Builds a fresh challenge. Called again after every wrong answer. */
export const createAccessibleChallenge = (): AccessibleChallenge => {
  const kind = Math.floor(Math.random() * 3);

  if (kind === 0) {
    const a = 1 + Math.floor(Math.random() * 5);
    const b = 1 + Math.floor(Math.random() * 5);
    return {
      question: `What is ${NUMBER_WORDS[a]} plus ${NUMBER_WORDS[b]}?`,
      accepted: numberAnswers(a + b),
      hint: "Answer with a number or the word for it, for example 7 or seven.",
    };
  }

  if (kind === 1) {
    const words = [pick(COLOURS), pick(COLOURS), pick(COLOURS)];
    const index = Math.floor(Math.random() * 3);
    return {
      question: `Which word is ${ORDINALS[index]} in this list: ${words.join(", ")}?`,
      accepted: [words[index]],
      hint: "Answer with one word from the list.",
    };
  }

  const count = 2 + Math.floor(Math.random() * 3);
  const word = pick(COLOURS);
  return {
    question: `How many times does the word "${word}" appear here: ${Array.from(
      { length: count },
      () => word,
    ).join(", ")}?`,
    accepted: numberAnswers(count),
    hint: "Answer with a number or the word for it, for example 2 or two.",
  };
};

export const isChallengePassed = (challenge: AccessibleChallenge, answer: string) =>
  challenge.accepted.includes(normaliseAnswer(answer));
