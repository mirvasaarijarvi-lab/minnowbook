/** Guest review links for offers. Only the SHA-256 hash is stored. */

export function newOfferAcceptToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function hashOfferAcceptToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function offerAcceptUrl(origin: string, token: string): string {
  return `${origin.replace(/\/$/, "")}/offer/${encodeURIComponent(token)}`;
}

const LINE: Record<string, string> = {
  en: "Review and accept your offer here:",
  fi: "Tarkista ja hyväksy tarjous täällä:",
  sv: "Granska och godkänn offerten här:",
};

/** Adds the review link to the email text, replacing an older link. */
export function withAcceptLink(
  body: string,
  url: string,
  lang: string,
): string {
  const cleaned = body
    .replace(/\n*\S*\/offer\/[A-Za-z0-9_-]+\S*/g, "")
    .trimEnd();
  const line = LINE[lang] ?? LINE.en;
  const withoutOldLine = Object.values(LINE).reduce(
    (acc, l) => acc.split(`\n\n${l}`).join(""),
    cleaned,
  );
  return `${withoutOldLine}\n\n${line}\n${url}`;
}
