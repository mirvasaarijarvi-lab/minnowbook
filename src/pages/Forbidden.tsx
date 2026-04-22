import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ShieldAlert, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ForbiddenProps {
  /** Short label describing the area the user tried to reach. */
  attemptedArea?: string;
  /** Optional override for the body copy. */
  message?: string;
}

/**
 * 403 page shown when an authenticated user lacks the role required for the
 * route they tried to access (e.g. a non-system-admin opening /superadmin).
 *
 * Rendered in-place by the route guard so the URL the user typed stays in the
 * address bar — they see a clear "you don't have access" message rather than
 * being silently bounced elsewhere.
 */
const Forbidden = ({
  attemptedArea = "this area",
  message,
}: ForbiddenProps) => {
  const body =
    message ??
    `You're signed in, but your account doesn't have permission to access ${attemptedArea}. ` +
      `If you believe this is a mistake, contact your administrator.`;

  // Set title + noindex meta inline — this is an authenticated error page
  // and shouldn't be crawled or appear in search results.
  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Access denied — 403";
    let robots = document.querySelector(
      'meta[name="robots"]',
    ) as HTMLMetaElement | null;
    const created = !robots;
    if (!robots) {
      robots = document.createElement("meta");
      robots.name = "robots";
      document.head.appendChild(robots);
    }
    const previousContent = robots.getAttribute("content");
    robots.setAttribute("content", "noindex, nofollow");
    return () => {
      document.title = previousTitle;
      if (created) {
        robots?.remove();
      } else if (previousContent != null) {
        robots?.setAttribute("content", previousContent);
      }
    };
  }, []);

  return (
    <>
      <main
        className="min-h-screen bg-background flex items-center justify-center px-4"
        role="main"
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
