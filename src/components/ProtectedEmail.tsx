import { useState } from "react";

/**
 * Renders a contact address without ever putting the complete string into the
 * markup or the JS bundle, so address-harvesting crawlers cannot scrape it.
 * The address is assembled at runtime only when the visitor asks for it.
 *
 * A no-script fallback shows a human-readable form ("privacy [at] ..."), so the
 * address stays reachable for people without JavaScript. That keeps the legally
 * required contact point published while removing the machine-readable target.
 */
interface ProtectedEmailProps {
  /** Local part of the address, for example "privacy" or "security". */
  user: string;
  /** Domain without the TLD, defaults to the MimmoBook domain. */
  domain?: string;
  /** Top level domain, defaults to "com". */
  tld?: string;
  /** Optional subject line pre-filled when the visitor opens their mail app. */
  subject?: string;
  className?: string;
  /** Label for the reveal button. */
  revealLabel?: string;
}

const ProtectedEmail = ({
  user,
  domain = "mimmobook",
  tld = "com",
  subject,
  className,
  revealLabel = "Show the address",
}: ProtectedEmailProps) => {
  const [address, setAddress] = useState<string | null>(null);

  const assemble = () => `${user}@${domain}.${tld}`;
  const href = () => {
    const base = `mailto:${assemble()}`;
    return subject ? `${base}?subject=${encodeURIComponent(subject)}` : base;
  };

  if (address) {
    return (
      <a href={href()} className={className ?? "text-accent hover:underline font-medium"}>
        {address}
      </a>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAddress(assemble())}
        className={className ?? "text-accent hover:underline font-medium"}
        aria-label={`${revealLabel} (${user} at ${domain} dot ${tld})`}
      >
        {revealLabel}
      </button>
      <noscript>
        {" "}
        ({user} [at] {domain} [dot] {tld})
      </noscript>
    </>
  );
};

export default ProtectedEmail;
