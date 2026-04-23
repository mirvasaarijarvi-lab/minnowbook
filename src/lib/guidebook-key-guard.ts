import { translations, type Language } from "@/i18n/translations";

/**
 * Runtime guard for guidebook (`help.*`) translation keys.
 *
 * In development and test environments this throws a readable error so that
 * a missing key is caught immediately instead of silently rendering as the
 * raw key string in the UI. In production it logs a warning and returns the
 * key unchanged so we never crash a live dashboard over a copy gap.
 *
 * Use `assertGuidebookKey` for explicit assertions and `safeGuidebookT` as
 * a drop-in wrapper around the i18n `t` function for guidebook lookups.
 */

type Dict = Record<string, string>;

export class MissingGuidebookKeyError extends Error {
  readonly key: string;
  readonly language: string;
  constructor(key: string, language: string) {
    super(
      `Missing guidebook translation key "${key}" for language "${language}". ` +
        `Add it to src/i18n/translations.ts (and the English fallback) so the ` +
        `dashboard guidebook does not render the raw key.`
    );
    this.name = "MissingGuidebookKeyError";
    this.key = key;
    this.language = language;
  }
}

const isGuidebookKey = (key: string) => key.startsWith("help.");

const isDevLikeEnv = (): boolean => {
  // Vitest sets MODE=test; Vite sets DEV=true in dev.
  // In production builds DEV=false and MODE=production.
  // We treat anything that is not explicitly production as dev-like.
  try {
    const env = (import.meta as unknown as { env?: { DEV?: boolean; MODE?: string } }).env;
    if (!env) return true;
    if (env.DEV === true) return true;
    if (env.MODE && env.MODE !== "production") return true;
    return false;
  } catch {
    return true;
  }
};

/**
 * Throws (in dev/test) or warns (in prod) when a guidebook key is missing
 * from BOTH the requested language and the English fallback.
 */
export function assertGuidebookKey(
  key: string,
  language: Language = "en",
  dicts: Record<Language, Dict> = translations as unknown as Record<Language, Dict>
): void {
  if (!isGuidebookKey(key)) return;
  const langMap = dicts[language] ?? {};
  const enMap = dicts.en ?? {};
  const present = Boolean(langMap[key]) || Boolean(enMap[key]);
  if (present) return;

  if (isDevLikeEnv()) {
    throw new MissingGuidebookKeyError(key, language);
  }
  // Production: don't crash, but make it loud in the console.
  // eslint-disable-next-line no-console
  console.error(`[guidebook] Missing translation key "${key}" (lang=${language}).`);
}

/**
 * Wrap a `t`-style lookup so missing guidebook keys surface as readable
 * errors in dev and as warnings in prod. Returns the resolved string,
 * falling back to the key itself in production.
 */
export function safeGuidebookT(
  key: string,
  resolver: (k: string) => string,
  language: Language = "en"
): string {
  assertGuidebookKey(key, language);
  return resolver(key);
}
