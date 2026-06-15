import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, ExternalLink } from "lucide-react";

/**
 * Reads the GitHub repo slug ("owner/name") from VITE_GITHUB_REPO.
 * Set it in your project's environment to enable live shields.io badges.
 */
const REPO = "mirvasaarijarvi-lab/minnowbook";

const WORKFLOWS: Array<{ file: string; label: string }> = [
  { file: "ci.yml", label: "CI" },
  { file: "e2e.yml", label: "E2E" },
  { file: "security-tests.yml", label: "Security" },
];

export function CIStatusBadges() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-xl font-serif flex items-center gap-2">
          <Activity className="h-5 w-5 text-accent" />
          CI Status
        </CardTitle>
        {REPO && (
          <a
            href={`https://github.com/${REPO}/actions`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          >
            View all runs
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </CardHeader>
      <CardContent>
        {!REPO ? (
          <p className="text-sm text-muted-foreground">
            Set the <code className="px-1 py-0.5 rounded bg-muted">VITE_GITHUB_REPO</code> environment
            variable to <code className="px-1 py-0.5 rounded bg-muted">owner/repo</code> to display
            live build, e2e, and security badges. You can find the slug by opening the GitHub
            integration menu in Lovable (Plus icon, then GitHub), or by checking the repository URL
            once it's connected.
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            {WORKFLOWS.map((w) => {
              const badge = `https://img.shields.io/github/actions/workflow/status/${REPO}/${w.file}?branch=main&label=${encodeURIComponent(
                w.label,
              )}&style=flat-square`;
              const href = `https://github.com/${REPO}/actions/workflows/${w.file}`;
              return (
                <a
                  key={w.file}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${w.label} workflow status`}
                  className="inline-flex"
                >
                  <img src={badge} alt={`${w.label} workflow status`} height={20} loading="lazy" />
                </a>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default CIStatusBadges;
