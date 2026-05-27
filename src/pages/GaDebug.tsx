/**
 * GA4 / GTM diagnostics panel (superadmin-only).
 *
 * Purpose
 * -------
 * Make it trivial to verify that `sign_up`, `begin_checkout`, and
 * `subscription_started` actually leave the browser and land in GA4
 * before waiting 24 to 48 hours for the conversion column to populate.
 *
 * What this page does
 * -------------------
 *   1. Shows the current GTM container id, GA4 Measurement id, consent
 *      state, and whether the GA4 debug bridge would activate on this
 *      host (so you know whether DebugView will receive these probes).
 *   2. Tails the live `window.dataLayer` so you can watch events fire.
 *   3. Provides one-click buttons to push test versions of the three
 *      key events. Each push is tagged with `debug_event: true` and
 *      `debug_mode: true` so they show up in GA4 DebugView immediately
 *      and are easy to exclude from production analyses if needed.
 *
 * After firing test events here, open GA4 → Admin → DebugView. Events
 * should appear within ~10 seconds. The Reports → Events list and the
 * Key events conversion column update on the daily processing cycle
 * (typically 24 to 48 hours).
 */
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const GTM_CONTAINER_ID = "GTM-P75VPD5G";
const GA4_MEASUREMENT_ID = "G-C7CJERJ7BR";

type DataLayerEntry = {
  ts: number;
  index: number;
  payload: unknown;
};

function readConsent(): "accepted" | "declined" | "unset" {
  try {
    const v = localStorage.getItem("cookie-consent");
    if (v === "accepted") return "accepted";
    if (v === "declined") return "declined";
    return "unset";
  } catch {
    return "unset";
  }
}

function isDebugHost(): boolean {
  const h = window.location.hostname;
  return (
    h === "localhost" ||
    h === "127.0.0.1" ||
    h.endsWith(".lovableproject.com") ||
    h.includes("-preview--")
  );
}

function pushDebug(event: string, params: Record<string, unknown>) {
  const w = window as unknown as { dataLayer?: unknown[] };
  w.dataLayer = w.dataLayer || [];
  w.dataLayer.push({
    event,
    debug_event: true,
    debug_mode: true,
    fired_from: "/superadmin/ga-debug",
    fired_at: new Date().toISOString(),
    ...params,
  });
}

export default function GaDebug() {
  const [entries, setEntries] = useState<DataLayerEntry[]>([]);
  const [consent, setConsent] = useState(readConsent());
  const debugBridge = useMemo(() => isDebugHost(), []);

  // Tail window.dataLayer: poll every 750ms and surface any new entries.
  // Polling is simpler than wrapping .push() and survives GTM rewriting
  // the array internally.
  useEffect(() => {
    const w = window as unknown as { dataLayer?: unknown[] };
    w.dataLayer = w.dataLayer || [];
    let lastLen = 0;
    const tick = () => {
      const dl = w.dataLayer ?? [];
      if (dl.length !== lastLen) {
        const newOnes: DataLayerEntry[] = [];
        for (let i = lastLen; i < dl.length; i++) {
          newOnes.push({ ts: Date.now(), index: i, payload: dl[i] });
        }
        lastLen = dl.length;
        setEntries((prev) => [...newOnes.reverse(), ...prev].slice(0, 50));
      }
      setConsent(readConsent());
    };
    tick();
    const id = window.setInterval(tick, 750);
    return () => window.clearInterval(id);
  }, []);

  const fire = (label: string, fn: () => void) => {
    fn();
    toast.success(`Pushed ${label} to dataLayer`, {
      description: "Check GA4 DebugView within 10s",
    });
  };

  return (
    <main className="container mx-auto max-w-5xl px-4 py-8">
      <h1 className="font-serif text-3xl mb-2">GA4 / GTM diagnostics</h1>
      <p className="text-muted-foreground mb-6">
        Fire test events and watch them land in the browser dataLayer.
        Open GA4, Admin, DebugView in another tab to verify they reach
        Google within seconds. The conversion column populates after the
        daily processing cycle (typically 24 to 48 hours).
      </p>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Environment</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <div className="text-muted-foreground">GTM container</div>
            <div className="font-mono">{GTM_CONTAINER_ID}</div>
          </div>
          <div>
            <div className="text-muted-foreground">GA4 Measurement ID</div>
            <div className="font-mono">{GA4_MEASUREMENT_ID}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Analytics consent</div>
            <Badge
              variant={consent === "accepted" ? "default" : "secondary"}
            >
              {consent}
            </Badge>
            {consent !== "accepted" && (
              <p className="mt-1 text-xs text-muted-foreground">
                Events still hit the dataLayer, but GTM tags will not
                forward them to GA4 until consent is accepted.
              </p>
            )}
          </div>
          <div>
            <div className="text-muted-foreground">GA4 debug bridge</div>
            <Badge variant={debugBridge ? "default" : "secondary"}>
              {debugBridge ? "active on this host" : "inactive"}
            </Badge>
            <p className="mt-1 text-xs text-muted-foreground">
              When active, events are also sent with debug_mode=true so
              they appear in GA4 DebugView in near real-time.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Fire test events</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button
            onClick={() =>
              fire("sign_up", () =>
                pushDebug("sign_up", { method: "email" }),
              )
            }
          >
            Push sign_up
          </Button>
          <Button
            onClick={() =>
              fire("begin_checkout", () =>
                pushDebug("begin_checkout", {
                  currency: "EUR",
                  value: 29,
                  tier: "professional",
                  price_id: "price_debug",
                }),
              )
            }
          >
            Push begin_checkout
          </Button>
          <Button
            onClick={() =>
              fire("subscription_started", () =>
                pushDebug("subscription_started", {
                  tier: "professional",
                  product_id: "prod_debug",
                  subscription_end: new Date(
                    Date.now() + 30 * 86_400_000,
                  ).toISOString(),
                }),
              )
            }
          >
            Push subscription_started
          </Button>
          <Button
            variant="outline"
            onClick={() => setEntries([])}
            className="ml-auto"
          >
            Clear log
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Live dataLayer ({entries.length} most recent)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No events yet. Push one above or navigate around the app.
            </p>
          ) : (
            <ol className="space-y-2 text-xs">
              {entries.map((e) => (
                <li
                  key={`${e.index}-${e.ts}`}
                  className="rounded border bg-muted/30 p-2 font-mono"
                >
                  <div className="mb-1 text-muted-foreground">
                    #{e.index} at {new Date(e.ts).toLocaleTimeString()}
                  </div>
                  <pre className="overflow-x-auto whitespace-pre-wrap break-words">
                    {(() => {
                      try {
                        return JSON.stringify(e.payload, null, 2);
                      } catch {
                        return String(e.payload);
                      }
                    })()}
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
