import { Check, Minus } from "lucide-react";

type Cell = boolean | string;

interface Row {
  label: string;
  mimmobook: Cell;
  mindbody: Cell;
  vagaro: Cell;
  fresha: Cell;
  acuity: Cell;
}

const featureRows: Row[] = [
  { label: "Starting monthly price (EUR, VAT incl.)", mimmobook: "19", mindbody: "~139", vagaro: "~28", fresha: "0 + fees", acuity: "~18" },
  { label: "Free trial", mimmobook: "30 days", mindbody: "Demo only", vagaro: "30 days", fresha: "Free plan", acuity: "7 days" },
  { label: "Transaction fees on card payments", mimmobook: false, mindbody: false, vagaro: false, fresha: true, acuity: false },
  { label: "Branded booking pages", mimmobook: true, mindbody: true, vagaro: true, fresha: "Limited", acuity: true },
  { label: "Multi-site management", mimmobook: true, mindbody: true, vagaro: true, fresha: true, acuity: "Add-on" },
  { label: "Custom domain support", mimmobook: true, mindbody: false, vagaro: false, fresha: false, acuity: false },
  { label: "Multi-language (EN, FI, SV)", mimmobook: true, mindbody: "EN only", vagaro: "EN only", fresha: "Multi", acuity: "EN only" },
  { label: "Team and role management", mimmobook: true, mindbody: true, vagaro: true, fresha: true, acuity: true },
  { label: "Automated email confirmations", mimmobook: true, mindbody: true, vagaro: true, fresha: true, acuity: true },
  { label: "Reports and insights", mimmobook: true, mindbody: true, vagaro: true, fresha: "Basic", acuity: "Basic" },
  { label: "GDPR-focused EU hosting", mimmobook: true, mindbody: false, vagaro: false, fresha: "Partial", acuity: false },
  { label: "No marketplace listing required", mimmobook: true, mindbody: true, vagaro: true, fresha: false, acuity: true },
];

const columns = [
  { key: "mimmobook", label: "MimmoBook", highlight: true },
  { key: "mindbody", label: "Mindbody" },
  { key: "vagaro", label: "Vagaro" },
  { key: "fresha", label: "Fresha" },
  { key: "acuity", label: "Acuity" },
] as const;

function renderCell(value: Cell) {
  if (value === true) return <Check className="h-4 w-4 text-primary inline" aria-label="Included" />;
  if (value === false) return <Minus className="h-4 w-4 text-muted-foreground inline" aria-label="Not included" />;
  return <span className="text-foreground">{value}</span>;
}

const WellnessComparisonTable = () => {
  return (
    <section aria-labelledby="wellness-comparison-heading" className="mb-10 not-prose">
      <h2 id="wellness-comparison-heading" className="font-serif text-2xl font-bold text-foreground mb-4">
        Features and pricing at a glance
      </h2>
      <p className="text-sm text-muted-foreground mb-4">
        Snapshot of typical entry plans across common wellness booking platforms. Pricing is indicative and may vary by region and add-ons.
      </p>
      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-card">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50">
            <tr>
              <th scope="col" className="text-left font-semibold text-foreground px-4 py-3">Feature</th>
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className={`text-left font-semibold px-4 py-3 ${c.highlight ? "text-primary" : "text-foreground"}`}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {featureRows.map((row, i) => (
              <tr key={row.label} className={i % 2 === 0 ? "bg-background" : "bg-secondary/20"}>
                <th scope="row" className="text-left font-medium text-foreground px-4 py-3 align-top">
                  {row.label}
                </th>
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={`px-4 py-3 align-top ${c.highlight ? "bg-primary/5" : ""}`}
                  >
                    {renderCell(row[c.key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground mt-3">
        Sources: public pricing pages of each provider, checked at time of writing. Always confirm current pricing on the vendor site.
      </p>
    </section>
  );
};

export default WellnessComparisonTable;
