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

type ChallengeLang = "en" | "fi" | "sv";

const NUMBER_WORDS: Record<ChallengeLang, readonly string[]> = {
  en: ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"],
  fi: ["nolla", "yksi", "kaksi", "kolme", "neljä", "viisi", "kuusi", "seitsemän", "kahdeksan", "yhdeksän", "kymmenen", "yksitoista", "kaksitoista"],
  sv: ["noll", "ett", "två", "tre", "fyra", "fem", "sex", "sju", "åtta", "nio", "tio", "elva", "tolv"],
};

const COLOURS: Record<ChallengeLang, readonly string[]> = {
  en: ["red", "green", "blue", "yellow", "purple", "orange"],
  fi: ["punainen", "vihreä", "sininen", "keltainen", "violetti", "oranssi"],
  sv: ["röd", "grön", "blå", "gul", "lila", "orange"],
};

const ORDINALS: Record<ChallengeLang, readonly string[]> = {
  en: ["first", "second", "third"],
  fi: ["ensimmäinen", "toinen", "kolmas"],
  sv: ["första", "andra", "tredje"],
};

const TEXT: Record<
  ChallengeLang,
  {
    plus: (a: string, b: string) => string;
    nth: (ordinal: string, list: string) => string;
    count: (word: string, list: string) => string;
    numberHint: (n: number, word: string) => string;
    wordHint: string;
  }
> = {
  en: {
    plus: (a, b) => `What is ${a} plus ${b}?`,
    nth: (o, l) => `Which word is ${o} in this list: ${l}?`,
    count: (w, l) => `How many times does the word "${w}" appear here: ${l}?`,
    numberHint: (n, w) => `Answer with a number or the word for it, for example ${n} or ${w}.`,
    wordHint: "Answer with one word from the list.",
  },
  fi: {
    plus: (a, b) => `Paljonko on ${a} plus ${b}?`,
    nth: (o, l) => `Mikä sana on ${o} tässä luettelossa: ${l}?`,
    count: (w, l) => `Montako kertaa sana "${w}" esiintyy tässä: ${l}?`,
    numberHint: (n, w) => `Vastaa numerolla tai sanalla, esimerkiksi ${n} tai ${w}.`,
    wordHint: "Vastaa yhdellä luettelon sanalla.",
  },
  sv: {
    plus: (a, b) => `Vad är ${a} plus ${b}?`,
    nth: (o, l) => `Vilket ord är ${o} i den här listan: ${l}?`,
    count: (w, l) => `Hur många gånger förekommer ordet "${w}" här: ${l}?`,
    numberHint: (n, w) => `Svara med en siffra eller ett ord, till exempel ${n} eller ${w}.`,
    wordHint: "Svara med ett ord från listan.",
  },
};

export const normaliseAnswer = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[.!?]+$/, "")
    .replace(/\s+/g, " ");

const pick = <T>(items: readonly T[]) =>
  items[Math.floor(Math.random() * items.length)];

/** Digits, the word in the visitor's language, and the English word. */
const numberAnswers = (n: number, lang: ChallengeLang) =>
  Array.from(
    new Set([
      String(n),
      NUMBER_WORDS[lang][n] ?? String(n),
      NUMBER_WORDS.en[n] ?? String(n),
    ]),
  );

/** Builds a fresh challenge. Called again after every wrong answer. */
export const createAccessibleChallenge = (
  language: string = "en",
): AccessibleChallenge => {
  const lang: ChallengeLang =
    language === "fi" || language === "sv" ? language : "en";
  const text = TEXT[lang];
  const words = NUMBER_WORDS[lang];
  const kind = Math.floor(Math.random() * 3);

  if (kind === 0) {
    const a = 1 + Math.floor(Math.random() * 5);
    const b = 1 + Math.floor(Math.random() * 5);
    return {
      question: text.plus(words[a], words[b]),
      accepted: numberAnswers(a + b, lang),
      hint: text.numberHint(7, words[7]),
    };
  }

  if (kind === 1) {
    const list = [pick(COLOURS[lang]), pick(COLOURS[lang]), pick(COLOURS[lang])];
    const index = Math.floor(Math.random() * 3);
    return {
      question: text.nth(ORDINALS[lang][index], list.join(", ")),
      accepted: [list[index]],
      hint: text.wordHint,
    };
  }

  const count = 2 + Math.floor(Math.random() * 3);
  const word = pick(COLOURS[lang]);
  return {
    question: text.count(
      word,
      Array.from({ length: count }, () => word).join(", "),
    ),
    accepted: numberAnswers(count, lang),
    hint: text.numberHint(2, words[2]),
  };
};

export const isChallengePassed = (
  challenge: AccessibleChallenge,
  answer: string,
) => challenge.accepted.includes(normaliseAnswer(answer));
