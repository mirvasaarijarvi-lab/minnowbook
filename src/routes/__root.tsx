/// <reference types="vite/client" />
/* eslint-disable react-refresh/only-export-components --
 * TanStack Start requires the root route object (`export const Route`) to live
 * in this file alongside its shell, root, not-found and error components, so a
 * non-component export next to components is unavoidable here. Fast Refresh
 * falls back to a full reload for the root file only. See
 * docs/linting-policy.md.
 */
import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
  Scripts,
  useRouter,
} from "@tanstack/react-router";
import type { ErrorComponentProps } from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import { I18nProvider } from "@/contexts/I18nContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { ImpersonationProvider } from "@/contexts/ImpersonationContext";
import AnalyticsPageView from "@/components/AnalyticsPageView";
import CookieConsent from "@/components/CookieConsent";
import AccessibilityWidget from "@/components/AccessibilityWidget";
import SessionStatusIndicator from "@/components/SessionStatusIndicator";
import NotFound from "@/pages/NotFound";
import { reportLovableError } from "@/lib/lovable-error-reporting";

// ported from main.tsx
import { installStorageRejectionTelemetry } from "@/lib/storage-rejection-telemetry";
if (typeof window !== "undefined") {
  installStorageRejectionTelemetry();
}

const CONSENT_MODE_BOOTSTRAP = `
window.dataLayer = window.dataLayer || [];
function gtag(){window.dataLayer.push(arguments);}
window.gtag = window.gtag || gtag;
var analyticsConsent = 'denied';
try {
  analyticsConsent = localStorage.getItem('cookie-consent') === 'accepted' ? 'granted' : 'denied';
} catch (e) {}
gtag('consent', 'default', {
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
  analytics_storage: analyticsConsent,
  functionality_storage: 'granted',
  security_storage: 'granted',
  wait_for_update: 500
});
gtag('set', 'url_passthrough', true);
gtag('set', 'ads_data_redaction', true);
`;

const GTM_BOOTSTRAP = `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-P75VPD5G');`;

const GA4_BOOTSTRAP = `
window.dataLayer = window.dataLayer || [];
function gtag(){window.dataLayer.push(arguments);}
window.gtag = window.gtag || gtag;
gtag('js', new Date());
gtag('config', 'G-C7CJERJ7BR', { send_page_view: true });
`;

const WEBSITE_JSON_LD = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "MimmoBook",
  url: "https://mimmobook.com",
  description:
    "Cloud-based reservation management for restaurants, venues, hotels, guesthouses, wellness and service industry businesses.",
  potentialAction: {
    "@type": "SearchAction",
    target: "https://mimmobook.com/support?q={search_term_string}",
    "query-input": "required name=search_term_string",
  },
});

const ORGANIZATION_JSON_LD = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "MimmoBook",
  url: "https://mimmobook.com",
  logo: "https://mimmobook.com/logos/logo-color-large.png",
  description:
    "MimmoBook is a SaaS reservation management platform for restaurants, venues, hotels, and guesthouses.",
  address: { "@type": "PostalAddress", addressCountry: "FI" },
  contactPoint: [
    {
      "@type": "ContactPoint",
      contactType: "customer support",
      url: "https://mimmobook.com/support",
      email: "support@mimmobook.com",
      availableLanguage: ["English", "Finnish", "Swedish"],
    },
    {
      "@type": "ContactPoint",
      contactType: "sales",
      url: "https://mimmobook.com/pricing",
      email: "sales@mimmobook.com",
      availableLanguage: ["English", "Finnish", "Swedish"],
    },
  ],
});

const SITE_TITLE = "MimmoBook, Booking Software for Hospitality & Service Pros";
const SITE_DESCRIPTION =
  "Online booking for barbers, hairdressers, massage therapists, bakers, personal trainers, restaurants, venues and hotels. Branded booking pages, fewer no-shows.";
const SITE_KEYWORDS =
  "reservation management, booking software, appointment booking, barber booking software, hairdresser booking system, salon appointment software, massage therapist booking, bakery order booking, personal trainer booking app, hospitality, wellness, hyvinvointi, service industry, palveluala, parturi ajanvaraus, kampaaja ajanvaraus, hieroja ajanvaraus, leipomo tilaukset, personal trainer ajanvaraus, frisör bokning, massör bokning, restaurants, venues, hotels, guesthouses, spa booking, ajanvaraus";
const SOCIAL_TITLE = "MimmoBook, Reservations for Hospitality & Wellness";
const SOCIAL_DESCRIPTION =
  "Cloud reservations for restaurants, venues, hotels, guesthouses, wellness and service businesses. Multi-site with branded booking pages.";
const OG_IMAGE = "https://mimmobook.com/og-image.png";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()(
  {
    head: () => ({
      meta: [
        { charSet: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1.0" },
        { title: SITE_TITLE },
        { name: "title", content: SITE_TITLE },
        { name: "description", content: SITE_DESCRIPTION },
        { name: "keywords", content: SITE_KEYWORDS },
        { name: "author", content: "MimmoBook" },
        {
          name: "robots",
          content:
            "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1",
        },
        {
          httpEquiv: "Content-Security-Policy",
          content:
            "default-src 'self'; script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://*.googletagmanager.com https://www.google-analytics.com https://*.google-analytics.com https://ssl.google-analytics.com https://tagmanager.google.com; script-src-attr 'none'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://tagmanager.google.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob: https:; media-src 'self' https: data: blob:; connect-src 'self' https://*.supabase.co https://*.supabase.in wss://*.supabase.co https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com https://*.googletagmanager.com https://stats.g.doubleclick.net https://*.lovable.app https://api.pwnedpasswords.com https://connector-gateway.lovable.dev; frame-src 'self' https://www.googletagmanager.com https://www.youtube.com https://youtube.com https://www.youtube-nocookie.com https://youtube-nocookie.com; worker-src 'self' blob:; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests",
        },
        {
          httpEquiv: "Permissions-Policy",
          content:
            "camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=(), interest-cohort=(), browsing-topics=()",
        },
        { httpEquiv: "X-Content-Type-Options", content: "nosniff" },
        { name: "referrer", content: "strict-origin-when-cross-origin" },
        { name: "color-scheme", content: "light dark" },
        { name: "msvalidate.01", content: "54FDAA2E4DF27CE697F5FB071066237E" },
        {
          name: "google-site-verification",
          content: "grmftut49V7_pI0Q6QhebcuqGgDXmOjAezfhqdWF8sY",
        },
        { property: "og:type", content: "website" },
        { property: "og:url", content: "https://mimmobook.com/" },
        { property: "og:title", content: SOCIAL_TITLE },
        { property: "og:description", content: SOCIAL_DESCRIPTION },
        { property: "og:image", content: OG_IMAGE },
        { property: "og:image:secure_url", content: OG_IMAGE },
        { property: "og:image:type", content: "image/png" },
        { property: "og:image:width", content: "1200" },
        { property: "og:image:height", content: "630" },
        { property: "og:image:alt", content: SOCIAL_TITLE },
        { property: "og:site_name", content: "MimmoBook" },
        { property: "og:locale", content: "en_US" },
        { property: "og:locale:alternate", content: "fi_FI" },
        { property: "og:locale:alternate", content: "sv_SE" },
        { property: "twitter:card", content: "summary_large_image" },
        { property: "twitter:url", content: "https://mimmobook.com/" },
        { property: "twitter:title", content: SOCIAL_TITLE },
        { property: "twitter:description", content: SOCIAL_DESCRIPTION },
        { property: "twitter:image", content: OG_IMAGE },
      ],
      links: [
        { rel: "stylesheet", href: appCss },
        { rel: "icon", type: "image/png", href: "/favicon.png" },
        { rel: "apple-touch-icon", href: "/favicon.png" },
        { rel: "sitemap", type: "application/xml", href: "/sitemap.xml" },
      ],
      scripts: [
        { children: CONSENT_MODE_BOOTSTRAP },
        { children: GTM_BOOTSTRAP },
        {
          src: "https://www.googletagmanager.com/gtag/js?id=G-C7CJERJ7BR",
          async: true,
        },
        { children: GA4_BOOTSTRAP },
        { type: "application/ld+json", children: WEBSITE_JSON_LD },
        { type: "application/ld+json", children: ORGANIZATION_JSON_LD },
      ],
    }),
    shellComponent: RootShell,
    component: RootComponent,
    notFoundComponent: NotFound,
    errorComponent: RootErrorComponent,
  },
);

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-P75VPD5G"
            height="0"
            width="0"
            style={{ display: "none", visibility: "hidden" }}
            title="Google Tag Manager"
          />
        </noscript>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        enableSystem
        disableTransitionOnChange
      >
        <I18nProvider>
          <AuthProvider>
            <ImpersonationProvider>
              <TooltipProvider>
                <Toaster />
                <Sonner />
                <AnalyticsPageView />
                <Outlet />
                <CookieConsent />
                <AccessibilityWidget />
                <SessionStatusIndicator />
              </TooltipProvider>
            </ImpersonationProvider>
          </AuthProvider>
        </I18nProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

function RootErrorComponent({ error, reset }: ErrorComponentProps) {
  const router = useRouter();

  useEffect(() => {
    console.error(error);
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-4">
        <h1 className="text-xl font-serif">This page didn't load</h1>
        <p className="text-muted-foreground text-sm">
          Something went wrong on our end. You can try again or head back to the
          front page.
        </p>
        <div className="flex gap-2 justify-center flex-wrap">
          <button
            type="button"
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground"
            onClick={() => {
              router.invalidate();
              reset();
            }}
          >
            Try again
          </button>
          <a className="px-4 py-2 rounded-md border border-border" href="/">
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}
