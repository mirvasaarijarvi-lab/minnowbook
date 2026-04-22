import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ShieldAlert, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface ForbiddenProps {
  /**
   * Human-readable label describing the area the user tried to reach.
   * Used in the visible body copy (e.g. "the Superadmin area").
   */
  attemptedArea?: string;
  /**
   * Stable, machine-friendly slug for the attempted area (e.g. "superadmin",
   * "superadmin/audit-log"). Used as the `?area=` query param on the
   * forbidden-status beacon and as the `attemptedArea` field on the
   * audit-log beacon, so synthetic monitors and audit queries can group
   * denials by route without depending on UI copy.
   *
   * Defaults to a slugified form of `attemptedArea` so existing call sites
   * keep working, but route guards should pass an explicit slug to keep
   * it stable across copy changes.
   */
  areaSlug?: string;
  /** Optional override for the body copy. */
  message?: string;
}

/** Slugify a human label as a fallback when no explicit `areaSlug` is passed. */
const toSlug = (label: string): string =>
  label
    .toLowerCase()
    .replace(/^the\s+/, "")
    .replace(/\s+area$/, "")
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "unknown";

/**
 * 403 page shown when an authenticated user lacks the role required for the
 * route they tried to access (e.g. a non-system-admin opening /superadmin).
 *
 * Rendered in-place by the route guard so the URL the user typed stays in the
 * address bar.
 *
 * ## Real HTTP 403 status
 *
 * This is a Vite SPA: the static host always serves `index.html` with HTTP
 * 200, so the document itself cannot natively carry a 403. To still produce
 * a real, observable 403 — for synthetic monitoring, the browser DevTools
 * network panel, security scanners, and audit trails — we:
 *
 *   1. Issue a beacon request to the dedicated `forbidden-status` edge
 *      function, which always returns HTTP 403. This puts a real 403 entry
 *      in the network log keyed to the attempted area.
 *   2. Emit a `<meta http-equiv="Status" content="403">` tag so any
 *      crawler / proxy / SSR layer that respects status meta hints treats
 *      the page as 403.
 *   3. Set `noindex, nofollow` so the page never enters search results.
 *
 * The visible 403 messaging is unchanged — this just makes the response
 * shape match its real semantic meaning.
 */
const Forbidden = ({
  attemptedArea = "this area",
  areaSlug,
  message,
}: ForbiddenProps) => {
  const [beaconStatus, setBeaconStatus] = useState<number | "unreachable" | null>(null);
  // Resolve once per render: explicit slug wins, otherwise derive from the
  // human label so legacy call sites keep working.
  const resolvedSlug = areaSlug ?? toSlug(attemptedArea);
  const body =
    message ??
    `You're signed in, but your account doesn't have permission to access ${attemptedArea}. ` +
      `If you believe this is a mistake, contact your administrator.`;

  // Beacon to the always-403 edge function so the network log shows a real
  // HTTP 403 response associated with this view.
  //
  // Hardening notes:
  //   * We bypass `supabase.functions.invoke` because it awaits the full
  //     response body and rethrows on non-2xx, which makes a true 403
  //     indistinguishable from a network failure and forces the caller to
  //     handle a rejected promise. A raw `fetch` lets us read the status
  //     directly and treat any failure mode as best-effort.
  //   * `keepalive: true` so the request survives if the user navigates
  //     away mid-flight (Beacon API semantics without losing the response
  //     status, which navigator.sendBeacon doesn't expose).
  //   * `mode: "cors"` with no custom auth header — the function is
  //     publicly reachable (verify_jwt = false) and we don't need cookies
  //     or credentials. If CORS or DNS fails, the catch swallows it.
  //   * An `AbortController` with a 4s timeout guarantees the effect's
  //     cleanup never leaves a hanging request, and the UI never blocks:
  //     the beacon runs entirely in the background and the page renders
  //     immediately regardless.
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 4000);

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    if (!supabaseUrl) {
      // Misconfigured environment — fail closed but don't block render.
      setBeaconStatus("unreachable");
      window.clearTimeout(timeoutId);
      return () => {
        cancelled = true;
      };
    }

    const url = `${supabaseUrl}/functions/v1/forbidden-status?area=${encodeURIComponent(
      resolvedSlug,
    )}`;

    // Fire-and-forget: deliberately not awaited. The render path returns
    // immediately and the network call resolves in the background.
    fetch(url, {
      method: "GET",
      mode: "cors",
      credentials: "omit",
      keepalive: true,
      signal: controller.signal,
      headers: { accept: "application/json" },
    })
      .then((res) => {
        if (cancelled) return;
        // The function always responds 403; we record whatever the server
        // actually returned so synthetic checks can assert on it.
        setBeaconStatus(res.status);
      })
      .catch(() => {
        // AbortError, network error, DNS failure, opaque CORS rejection —
        // all collapse to "unreachable". Never surface to the user.
        if (!cancelled) setBeaconStatus("unreachable");
      })
      .finally(() => {
        window.clearTimeout(timeoutId);
      });

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [resolvedSlug]);

  // Audit beacon outcome, surfaced as a small dev-only indicator below the
  // 403 copy. Values:
  //   - null: in-flight / not yet attempted
  //   - "skipped": no session, so we deliberately didn't beacon
  //   - "logged": edge function returned { logged: true }
  //   - "not_logged": edge function returned { logged: false } (e.g. no_tenant)
  //   - "error": network/CORS/exception path
  const [auditStatus, setAuditStatus] = useState<
    "logged" | "not_logged" | "skipped" | "error" | null
  >(null);
  const [auditReason, setAuditReason] = useState<string | null>(null);

  // Persist the denial to the audit_log so tenant owners and system admins
  // can review forbidden-access attempts. The edge function resolves the
  // caller's user id from their JWT and writes user_id + timestamp + the
  // attempted area. Fire-and-forget; we don't surface failures to the UI
  // (production), but the dev indicator below reflects the outcome.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Skip silently if there's no session — Forbidden is normally only
        // reached behind <ProtectedRoute>, but defensively guard anyway so
        // we never fire an unauthenticated audit beacon.
        const { data: sessionData } = await supabase.auth.getSession();
        if (cancelled) return;
        if (!sessionData?.session) {
          setAuditStatus("skipped");
          setAuditReason("no_session");
          return;
        }
        const { data, error } = await supabase.functions.invoke(
          "log-forbidden-access",
          {
            method: "POST",
            body: {
              // Send the stable slug as the canonical attemptedArea so audit
              // queries can group by route. Also include the human label for
              // operator readability in the log UI.
              attemptedArea: resolvedSlug,
              attemptedAreaLabel: attemptedArea,
              attemptedPath:
                typeof window !== "undefined"
                  ? window.location.pathname + window.location.search
                  : null,
            },
          },
        );
        if (cancelled) return;
        if (error) {
          setAuditStatus("error");
          setAuditReason(error.message ?? "invoke_error");
          return;
        }
        const logged = (data as { logged?: boolean; reason?: string } | null)?.logged;
        const reason = (data as { logged?: boolean; reason?: string } | null)?.reason ?? null;
        setAuditStatus(logged ? "logged" : "not_logged");
        setAuditReason(reason);
      } catch (err) {
        // Audit logging is best-effort — never block the user experience.
        if (!cancelled) {
          setAuditStatus("error");
          setAuditReason(err instanceof Error ? err.message : "exception");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [resolvedSlug, attemptedArea]);

  // Set title + status + noindex meta. The Status meta is the closest the
  // browser can come to a real status code on a static document.
  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Access denied — 403";

    let robots = document.querySelector(
      'meta[name="robots"]',
    ) as HTMLMetaElement | null;
    const robotsCreated = !robots;
    if (!robots) {
      robots = document.createElement("meta");
      robots.name = "robots";
      document.head.appendChild(robots);
    }
    const previousRobots = robots.getAttribute("content");
    robots.setAttribute("content", "noindex, nofollow");

    let statusMeta = document.querySelector(
      'meta[http-equiv="Status"]',
    ) as HTMLMetaElement | null;
    const statusCreated = !statusMeta;
    if (!statusMeta) {
      statusMeta = document.createElement("meta");
      statusMeta.setAttribute("http-equiv", "Status");
      document.head.appendChild(statusMeta);
    }
    const previousStatus = statusMeta.getAttribute("content");
    statusMeta.setAttribute("content", "403 Forbidden");

    return () => {
      document.title = previousTitle;
      if (robotsCreated) {
        robots?.remove();
      } else if (previousRobots != null) {
        robots?.setAttribute("content", previousRobots);
      }
      if (statusCreated) {
        statusMeta?.remove();
      } else if (previousStatus != null) {
        statusMeta?.setAttribute("content", previousStatus);
      }
    };
  }, []);

  return (
    <>
      <main
        className="min-h-screen bg-background flex items-center justify-center px-4"
        role="main"
        // Expose the response status to assistive tech, automated tests,
        // and synthetic monitors via a stable data attribute.
        data-http-status="403"
        data-status-beacon={beaconStatus ?? "pending"}
        // Stable, route-derived slug so monitors can group denials by area
        // independently of the human-readable copy that appears on screen.
        data-area-slug={resolvedSlug}
      >
        <div className="max-w-md w-full text-center space-y-6">
          <div className="mx-auto h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <ShieldAlert
              className="h-8 w-8 text-destructive"
              aria-hidden="true"
            />
          </div>

          <div className="space-y-2">
            <p
              className="text-sm font-semibold tracking-wider text-muted-foreground uppercase"
              aria-label="Error 403"
            >
              403 · Access denied
            </p>
            <h1 className="text-3xl font-semibold text-foreground">
              You don't have access
            </h1>
            <p className="text-muted-foreground">{body}</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
            <Button asChild variant="default">
              <Link to="/dashboard">
                <ArrowLeft className="h-4 w-4 mr-2" aria-hidden="true" />
                Go to dashboard
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/">Back to home</Link>
            </Button>
          </div>
        </div>
      </main>
    </>
  );
};

export default Forbidden;
