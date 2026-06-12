/**
 * Cookie consent state, persisted to localStorage as JSON.
 *
 * Backward compatible with the previous string values:
 *   "accepted" -> all categories on
 *   "rejected" -> only necessary on
 *
 * Consent Mode v2 mapping:
 *   analytics -> analytics_storage
 *   marketing -> ad_storage / ad_user_data / ad_personalization
 *   necessary -> functionality_storage + security_storage (always granted)
 */

export type ConsentCategories = {
  necessary: true; // always true
  analytics: boolean;
  marketing: boolean;
};

export type ConsentRecord = {
  version: 1;
  categories: ConsentCategories;
  updatedAt: string; // ISO timestamp
};

const STORAGE_KEY = "cookie-consent";
// 12 month re-consent window per EDPB guidance.
const REPROMPT_AFTER_MS = 365 * 24 * 60 * 60 * 1000;

export const DEFAULT_CATEGORIES: ConsentCategories = {
  necessary: true,
  analytics: false,
  marketing: false,
};

export function readConsent(): ConsentRecord | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    // Legacy plain-string values.
    if (raw === "accepted") {
      return {
        version: 1,
        categories: { necessary: true, analytics: true, marketing: true },
        updatedAt: new Date(0).toISOString(),
      };
    }
    if (raw === "rejected") {
      return {
        version: 1,
        categories: { ...DEFAULT_CATEGORIES },
        updatedAt: new Date(0).toISOString(),
      };
    }

    const parsed = JSON.parse(raw) as Partial<ConsentRecord>;
    if (!parsed || typeof parsed !== "object") return null;
    const cats = parsed.categories ?? {};
    return {
      version: 1,
      categories: {
        necessary: true,
        analytics: cats.analytics === true,
        marketing: cats.marketing === true,
      },
      updatedAt: parsed.updatedAt ?? new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function writeConsent(categories: Omit<ConsentCategories, "necessary">): ConsentRecord {
  const record: ConsentRecord = {
    version: 1,
    categories: {
      necessary: true,
      analytics: categories.analytics === true,
      marketing: categories.marketing === true,
    },
    updatedAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch {
    /* storage unavailable */
  }
  return record;
}

export function shouldRepromptConsent(record: ConsentRecord | null): boolean {
  if (!record) return true;
  const updated = Date.parse(record.updatedAt);
  if (!Number.isFinite(updated)) return true;
  return Date.now() - updated > REPROMPT_AFTER_MS;
}

export function hasAnalyticsConsent(): boolean {
  return readConsent()?.categories.analytics === true;
}

export function hasMarketingConsent(): boolean {
  return readConsent()?.categories.marketing === true;
}
