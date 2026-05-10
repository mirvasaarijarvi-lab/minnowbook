import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/**
 * Visible session-status indicator.
 *
 * A small, non-intrusive pill anchored to the bottom-right of the viewport
 * that lets you (and any tester) confirm at a glance whether the current
 * session is still alive. Click it to see token age and time-to-refresh.
 *
 * Authenticated state derives from `useAuth().session`. Token age is
 * derived from `session.expires_at` (unix seconds, when the JWT expires)
 * and `session.expires_in` (seconds the token was valid for at issue
 * time). Both fields are part of the standard Supabase Session payload,
 * so we reconstruct the issued-at without storing anything extra.
 */
const formatDuration = (totalSeconds: number): string => {
  if (totalSeconds < 0) totalSeconds = 0;
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
};

const SessionStatusIndicator = () => {
  const { session, user, loading } = useAuth();
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    // 1s ticker so age and refresh-in counters stay accurate.
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  // Hide entirely while the provider is still booting; otherwise the badge
  // would briefly flash "Logged out" on every refresh before localStorage
  // hydration completes.
  if (loading) return null;

  const isAuthed = !!session && !!user;

  const expiresAt = session?.expires_at ?? null; // unix seconds
  const expiresIn = session?.expires_in ?? null; // seconds the token lives total
  const issuedAt = expiresAt && expiresIn ? expiresAt - expiresIn : null;
  const ageSeconds = issuedAt ? Math.max(0, now - issuedAt) : null;
  const refreshInSeconds = expiresAt ? expiresAt - now : null;
  const isStale = refreshInSeconds !== null && refreshInSeconds <= 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={
            isAuthed
              ? "Session status: logged in. Click for token details."
              : "Session status: logged out."
          }
          className={cn(
            "fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium shadow-md backdrop-blur transition-colors",
            "bg-background/90 hover:bg-background",
            isAuthed
              ? "border-emerald-500/40 text-foreground"
              : "border-border text-muted-foreground",
          )}
        >
          <span
            className={cn(
              "inline-block h-2 w-2 rounded-full",
              isAuthed
                ? isStale
                  ? "bg-amber-500 animate-pulse"
                  : "bg-emerald-500"
                : "bg-muted-foreground/60",
            )}
            aria-hidden="true"
          />
          <span>{isAuthed ? "Logged in" : "Logged out"}</span>
          {isAuthed && ageSeconds !== null && (
            <span className="text-muted-foreground tabular-nums">
              {formatDuration(ageSeconds)}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="end"
        className="w-72 text-sm"
      >
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "inline-block h-2.5 w-2.5 rounded-full",
                isAuthed
                  ? isStale
                    ? "bg-amber-500"
                    : "bg-emerald-500"
                  : "bg-muted-foreground/60",
              )}
            />
            <span className="font-semibold">
              {isAuthed ? "Authenticated" : "Not signed in"}
            </span>
          </div>

          {isAuthed ? (
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
              <dt className="text-muted-foreground">User</dt>
              <dd className="truncate font-medium">{user?.email ?? user?.id}</dd>

              {ageSeconds !== null && (
                <>
                  <dt className="text-muted-foreground">Token age</dt>
                  <dd className="tabular-nums">{formatDuration(ageSeconds)}</dd>
                </>
              )}

              {refreshInSeconds !== null && (
                <>
                  <dt className="text-muted-foreground">
                    {isStale ? "Refresh due" : "Refreshes in"}
                  </dt>
                  <dd
                    className={cn(
                      "tabular-nums",
                      isStale && "text-amber-600 dark:text-amber-500",
                    )}
                  >
                    {isStale
                      ? `${formatDuration(-refreshInSeconds)} ago`
                      : formatDuration(refreshInSeconds)}
                  </dd>
                </>
              )}

              {expiresAt && (
                <>
                  <dt className="text-muted-foreground">Expires at</dt>
                  <dd className="tabular-nums">
                    {new Date(expiresAt * 1000).toLocaleTimeString()}
                  </dd>
                </>
              )}
            </dl>
          ) : (
            <p className="text-xs text-muted-foreground">
              You are not signed in. Sign in to start a session.
            </p>
          )}

          <p className="border-t pt-2 text-[11px] leading-relaxed text-muted-foreground">
            Sessions persist across page refreshes and browser restarts. They
            only end when you click Logout.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default SessionStatusIndicator;
