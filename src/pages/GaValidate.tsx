/**
 * GA4 event validation panel (superadmin-only).
 *
 * What this does
 * --------------
 * GA4's DebugView API is not exposed to the client, so we cannot query
 * Google directly. Instead we observe what the browser is actually
 * dispatching: every `dataLayer.push` and every `gtag("event", ...)`
 * call is intercepted and compared against the expected event catalog
 * (page_view, sign_up, login, reservation_created). The panel shows:
 *
 *   - Expected events and whether each one has been observed in the
 *     current session, on the dataLayer (GTM path) and via gtag (direct
 *     GA4 path). Either path landing in GA4 is sufficient.
 *   - Unexpected event names that fired, so typos or stray events
 *     surface immediately.
 *   - Required parameter checks per event (e.g. `method` on sign_up,
 *     `reservation_type` on reservation_created). Missing params are
 *     flagged so they can be fixed before they corrupt GA4 reports.
 *
 * Pair this with GA4 Admin, DebugView in another tab to confirm the
 * same events are reaching Google. If an event shows here but not in
 * DebugView, the issue is consent or the GA4 tag in GTM, not the app.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { gtm } from "@/lib/gtm";

type ExpectedEvent = {
  name: string;
  requiredParams: string[];
  /** Optional helper to fire a synthetic version from the panel. */
  fire?: () => void;
};

const EXPECTED: ExpectedEvent[] = [
  {
    name: "page_view",
    requiredParams: ["page_location", "page_path", "page_title"],
    fire: () => gtm.pageView("route_change"),
  },
  {
    name: "sign_up",
    requiredParams: ["method"],
    fire: () => gtm.signUp("email"),
  },
  {
    name: "login",
    requiredParams: ["method"],
    fire: () => gtm.login("email"),
  },
  {
    name: "reservation_created",
    requiredParams: ["reservation_type"],
    fire: () => gtm.reservationCreated("debug"),
  },
];

type Observation = {
  source: "dataLayer" | "gtag";
  name: string;
  params: Record<string, unknown>;
  ts: number;
};

function extractEvent(entry: unknown): Observation | null {
  if (!entry) return null;
  // gtag("event", name, params) is stored as an Arguments-like object.
  if (typeof entry === "object") {
    const anyEntry = entry as Record<string, unknown> & { [k: number]: unknown };
    // Arguments object from gtag.
    if (anyEntry["0"] === "event" && typeof anyEntry["1"] === "string") {
      return {
        source: "gtag",
        name: anyEntry["1"] as string,
        params: (anyEntry["2"] as Record<string, unknown>) ?? {},
        ts: Date.now(),
      };
    }
    if (typeof anyEntry.event === "string") {
      const { event, ...rest } = anyEntry as { event: string } & Record<string, unknown>;
      return { source: "dataLayer", name: event, params: rest, ts: Date.now() };
    }
  }
  return null;
}

export default function GaValidate() {
  const [observations, setObservations] = useState<Observation[]>([]);
  const lastLenRef = useRef(0);

  useEffect(() => {
    const w = window as unknown as { dataLayer?: unknown[] };
    w.dataLayer = w.dataLayer || [];
    const tick = () => {
      const dl = w.dataLayer ?? [];
      if (dl.length !== lastLenRef.current) {
        const newOnes: Observation[] = [];
        for (let i = lastLenRef.current; i < dl.length; i++) {
          const obs = extractEvent(dl[i]);
          if (obs) newOnes.push(obs);
        }
        lastLenRef.current = dl.length;
        if (newOnes.length) {
          setObservations((prev) => [...prev, ...newOnes].slice(-200));
        }
      }
    };
    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, []);

  const summary = useMemo(() => {
    const expectedNames = new Set(EXPECTED.map((e) => e.name));
    return EXPECTED.map((spec) => {
      const matches = observations.filter((o) => o.name === spec.name);
      const sources = new Set(matches.map((m) => m.source));
      const latest = matches[matches.length - 1];
      const missingParams = latest
        ? spec.requiredParams.filter((p) => {
            const v = (latest.params as Record<string, unknown>)[p];
            return v === undefined || v === null || v === "";
          })
        : spec.requiredParams;
      return {
        spec,
        count: matches.length,
        dataLayer: sources.has("dataLayer"),
        gtag: sources.has("gtag"),
        missingParams,
        latest,
      };
    }).concat();
    void expectedNames;
  }, [observations]);

  const unexpected = useMemo(() => {
    const expectedNames = new Set(EXPECTED.map((e) => e.name));
    const ignore = new Set([
      "mimmobook_alive",
      "mimmobook_consent_update",
      "gtm.js",
      "gtm.dom",
      "gtm.load",
      "gtm.init",
      "gtm.init_consent",
    ]);
    const counts = new Map<string, number>();
    for (const o of observations) {
      if (expectedNames.has(o.name)) continue;
      if (ignore.has(o.name)) continue;
      counts.set(o.name, (counts.get(o.name) ?? 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [observations]);

  return (
    <main className="container mx-auto max-w-5xl px-4 py-8">
      <h1 className="font-serif text-3xl mb-2">GA4 event validation</h1>
      <p className="text-muted-foreground mb-6">
        Compares expected events against what is actually dispatched in
        this browser session. Use this together with GA4, Admin,
        DebugView to confirm Google receives the same events.
      </p>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Expected events</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-3">Event</th>
                  <th className="py-2 pr-3">Observed</th>
                  <th className="py-2 pr-3">dataLayer</th>
                  <th className="py-2 pr-3">gtag</th>
                  <th className="py-2 pr-3">Required params</th>
                  <th className="py-2 pr-3 text-right">Fire test</th>
                </tr>
              </thead>
              <tbody>
                {summary.map((row) => {
                  const ok =
                    row.count > 0 &&
                    row.missingParams.length === 0 &&
                    (row.dataLayer || row.gtag);
                  return (
                    <tr key={row.spec.name} className="border-b last:border-0">
                      <td className="py-2 pr-3 font-mono">{row.spec.name}</td>
                      <td className="py-2 pr-3">
                        {row.count > 0 ? (
                          <span className="inline-flex items-center gap-1 text-green-600">
                            <CheckCircle2 className="h-4 w-4" /> {row.count}x
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-destructive">
                            <XCircle className="h-4 w-4" /> none
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-3">
                        <Badge variant={row.dataLayer ? "default" : "secondary"}>
                          {row.dataLayer ? "yes" : "no"}
                        </Badge>
                      </td>
                      <td className="py-2 pr-3">
                        <Badge variant={row.gtag ? "default" : "secondary"}>
                          {row.gtag ? "yes" : "no"}
                        </Badge>
                      </td>
                      <td className="py-2 pr-3">
                        {row.count === 0 ? (
                          <span className="text-muted-foreground">
                            {row.spec.requiredParams.join(", ") || "none"}
                          </span>
                        ) : row.missingParams.length === 0 ? (
                          <span className="inline-flex items-center gap-1 text-green-600">
                            <CheckCircle2 className="h-4 w-4" /> all present
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-amber-600">
                            <AlertTriangle className="h-4 w-4" />
                            missing: {row.missingParams.join(", ")}
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-right">
                        {row.spec.fire && (
                          <Button
                            size="sm"
                            variant={ok ? "outline" : "default"}
                            onClick={row.spec.fire}
                          >
                            Fire
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">
            Unexpected events ({unexpected.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {unexpected.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No stray events. Everything dispatched matches the
              expected catalog.
            </p>
          ) : (
            <ul className="space-y-1 text-sm">
              {unexpected.map(([name, n]) => (
                <li
                  key={name}
                  className="flex items-center justify-between rounded border bg-amber-50 dark:bg-amber-950/20 px-3 py-1.5"
                >
                  <span className="font-mono">{name}</span>
                  <Badge variant="secondary">{n}x</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Recent observations ({observations.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {observations.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing observed yet. Fire a test event above or navigate
              the app in another tab.
            </p>
          ) : (
            <ol className="space-y-2 text-xs">
              {[...observations].slice(-25).reverse().map((o, idx) => (
                <li
                  key={`${o.ts}-${idx}`}
                  className="rounded border bg-muted/30 p-2 font-mono"
                >
                  <div className="mb-1 flex items-center justify-between text-muted-foreground">
                    <span>
                      {o.name}{" "}
                      <Badge variant="outline" className="ml-1">
                        {o.source}
                      </Badge>
                    </span>
                    <span>{new Date(o.ts).toLocaleTimeString()}</span>
                  </div>
                  <pre className="overflow-x-auto whitespace-pre-wrap break-words">
                    {JSON.stringify(o.params, null, 2)}
                  </pre>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
