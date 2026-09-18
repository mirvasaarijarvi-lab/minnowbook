// Extracted from the pre-migration src/App.tsx.
import { useEffect } from "react";
import { useLocation } from "@/lib/router-compat";

const AnalyticsPageView = () => {
  const location = useLocation();

  useEffect(() => {
    // Always fire a virtual page_view on every route change. With
    // Consent Mode v2 defaults set in the root head, GTM/GA4 will send
    // cookieless pings before consent and full hits after acceptance.
    import("@/lib/gtm").then(({ gtm }) => {
      if (localStorage.getItem("cookie-consent") === "accepted") {
        gtm.updateConsent(true);
      }
      gtm.pageView("route_change");
    });
  }, [location.pathname, location.search]);

  return null;
};

export default AnalyticsPageView;
