import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, Navigate } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import { useTenant } from "@/hooks/useTenant";
import { usePermissions } from "@/hooks/usePermissions";
import { SiteContext } from "@/hooks/useSiteContext";
import {
  PERM_CALENDAR_VIEW,
  PERM_RESERVATIONS_VIEW,
  PERM_RESOURCES_VIEW,
  PERM_REPORTS_VIEW,
  PERM_SETTINGS_VIEW,
  PERM_ADMIN_VIEW,
  PERM_SUPPORT_VIEW,
  PERM_SITES_VIEW,
} from "@/lib/permissions";
import { useTierGate } from "@/hooks/useTierGate";
import { Menu, HelpCircle, ShieldAlert, X, Eye, BookOpen } from "lucide-react";
import NotificationBell from "@/components/dashboard/NotificationBell";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import DashboardSidebar, { DashboardView } from "@/components/dashboard/DashboardSidebar";
import useKeyboardShortcuts from "@/components/dashboard/useKeyboardShortcuts";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import DashboardOverview from "@/components/dashboard/DashboardOverview";
import CalendarView from "@/components/dashboard/CalendarView";
import ReservationList from "@/components/dashboard/ReservationList";
import ResourceManagement from "@/components/dashboard/ResourceManagement";
import SettingsPanel from "@/components/dashboard/SettingsPanel";
import ReportsPanel from "@/components/dashboard/ReportsPanel";
import AdminPanel from "@/components/dashboard/AdminPanel";
import DashboardSupportPanel from "@/components/dashboard/DashboardSupportPanel";
import SitesManagementPanel from "@/components/dashboard/SitesManagementPanel";
import Logo from "@/components/Logo";
import SupportChatWidget from "@/components/SupportChatWidget";
import ProfileSettings from "@/components/dashboard/ProfileSettings";
import GuidedTour, { TourStep } from "@/components/dashboard/GuidedTour";
import SamplePeriodBanner from "@/components/dashboard/SamplePeriodBanner";
import { useSamplePeriod } from "@/hooks/useSamplePeriod";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const TOUR_STORAGE_KEY = "minnowbook-tour-completed";

const tourSteps: TourStep[] = [
  {
    target: "[data-tour='stats-grid']",
    title: "Dashboard Overview",
    content: "Here you can see today's key metrics at a glance — reservations, pending bookings, confirmed count, and active resources.",
    placement: "bottom",
    view: "overview",
  },
  {
    target: "[data-tour='booking-link']",
    title: "Your Booking Link",
    content: "Share this link with your customers so they can make reservations online. Copy it or open it in a new tab to preview.",
    placement: "top",
    view: "overview",
  },
  {
    target: "[data-tour='sidebar-nav']",
    title: "Navigation",
    content: "Use the sidebar to switch between Calendar, Reservations, Resources, Reports, Settings, and more.",
    placement: "right",
    view: "overview",
  },
  {
    target: "[data-tour='calendar-grid']",
    title: "Calendar View",
    content: "Browse reservations month-by-month. Dates with bookings are highlighted so you can spot busy days at a glance.",
    placement: "bottom",
    view: "calendar",
  },
  {
    target: "[data-tour='calendar-day-detail']",
    title: "Day Details",
    content: "Click any date to see its reservations listed here — guest names, times, party sizes, and statuses.",
    placement: "left",
    view: "calendar",
  },
  {
    target: "[data-tour='reservations-filters']",
    title: "Filter Reservations",
    content: "Use the status, type, and date filters to quickly narrow down your reservation list. Toggle 'Today' for a quick daily view.",
    placement: "bottom",
    view: "reservations",
  },
  {
    target: "[data-tour='resources-header']",
    title: "Manage Resources",
    content: "Add and manage your bookable spaces — rooms, tables, or venues. Set capacity, pricing, and upload photos for each resource.",
    placement: "bottom",
    view: "resources",
  },
  {
    target: "[data-tour='resources-grid']",
    title: "Your Resources",
    content: "Each card shows a resource with its type, capacity, pricing, and status. Click Edit to update details or toggle active/inactive to control availability.",
    placement: "top",
    view: "resources",
  },
  {
    target: "[data-tour='reports-filters']",
    title: "Reports & Analytics",
    content: "Filter reports by time period — week, month, quarter, or year. Use the compare toggle to see trends against previous periods. Export or print reports as needed.",
    placement: "bottom",
    view: "reports",
  },
  {
    target: "[data-tour='settings-panel']",
    title: "Settings",
    content: "Configure your branding, upload your logo and hero image, set business details, customize colors, and manage email templates.",
    placement: "top",
    view: "settings",
  },
  {
    target: "[data-tour='profile-panel']",
    title: "Profile",
    content: "Update your display name and upload a profile photo so your team can identify you easily.",
    placement: "top",
    view: "profile",
  },
];

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const { tenantId, tenant, isAdmin, loading } = useTenant();
  const { can } = usePermissions();
  const { isMultiSite, effectiveTier } = useTierGate();
  const { impersonating, isImpersonating, stopImpersonation } = useImpersonation();
  const samplePeriod = useSamplePeriod();
  const navigate = useNavigate();
  const [currentView, setCurrentView] = useState<DashboardView>("overview");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null);
  const [reservationStatusFilter, setReservationStatusFilter] = useState<string | undefined>();
  const [reservationInvoicedFilter, setReservationInvoicedFilter] = useState<boolean | undefined>();

  const [reservationCheckoutTodayFilter, setReservationCheckoutTodayFilter] = useState<boolean | undefined>();

  const handleViewChange = useCallback((view: DashboardView) => {
    if (view !== "reservations") {
      setReservationStatusFilter(undefined);
      setReservationInvoicedFilter(undefined);
      setReservationCheckoutTodayFilter(undefined);
    }
    setCurrentView(view);
  }, []);

  useKeyboardShortcuts({ onViewChange: handleViewChange });

  const handleOverviewNavigate = (view: string, filter?: { status?: string; invoiced?: boolean; checkoutToday?: boolean }) => {
    if (view === "reservations") {
      setReservationStatusFilter(filter?.status);
      setReservationInvoicedFilter(filter?.invoiced);
      setReservationCheckoutTodayFilter(filter?.checkoutToday);
      setCurrentView("reservations" as DashboardView);
    }
  };

  // Auto-open tour on first visit
  useEffect(() => {
    if (!loading && tenantId && currentView === "overview") {
      const completed = localStorage.getItem(TOUR_STORAGE_KEY);
      if (!completed) {
        // Small delay to let the DOM render
        const timer = setTimeout(() => setTourOpen(true), 800);
        return () => clearTimeout(timer);
      }
    }
  }, [loading, tenantId, currentView]);

  const handleTourComplete = () => {
    localStorage.setItem(TOUR_STORAGE_KEY, "true");
    setTourOpen(false);
  };

  const handleTourClose = () => {
    localStorage.setItem(TOUR_STORAGE_KEY, "true");
    setTourOpen(false);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-accent border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!tenantId) {
    return <Navigate to="/onboarding" replace />;
  }

  const permissionGate: Partial<Record<DashboardView, string>> = {
    calendar: PERM_CALENDAR_VIEW,
    reservations: PERM_RESERVATIONS_VIEW,
    resources: PERM_RESOURCES_VIEW,
    reports: PERM_REPORTS_VIEW,
    settings: PERM_SETTINGS_VIEW,
    admin: PERM_ADMIN_VIEW,
    support: PERM_SUPPORT_VIEW,
    sites: PERM_SITES_VIEW,
  };

  const AccessDenied = () => (
    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
      <ShieldAlert className="h-12 w-12" />
      <p className="text-lg font-medium">Access denied</p>
      <p className="text-sm">You don't have permission to view this section.</p>
    </div>
  );

  const gatedView = (view: DashboardView, component: React.ReactNode) => {
    const requiredPerm = permissionGate[view];
    if (requiredPerm && !can(requiredPerm)) return <AccessDenied />;
    return component;
  };


  const viewComponents: Record<DashboardView, React.ReactNode> = {
    overview: <DashboardOverview onNavigate={handleOverviewNavigate} />,
    calendar: gatedView("calendar", <CalendarView />),
    reservations: gatedView("reservations", <ReservationList initialStatusFilter={reservationStatusFilter} initialInvoicedFilter={reservationInvoicedFilter} initialCheckoutToday={reservationCheckoutTodayFilter} />),
    resources: gatedView("resources", <ResourceManagement />),
    reports: gatedView("reports", <ReportsPanel />),
    settings: gatedView("settings", <SettingsPanel />),
    admin: gatedView("admin", <AdminPanel />),
    sites: gatedView("sites", <SitesManagementPanel />),
    support: gatedView("support", <DashboardSupportPanel />),
    profile: <ProfileSettings />,
  };

  return (
    <SiteContext.Provider value={{ selectedSiteId, setSelectedSiteId, selectedResourceId, setSelectedResourceId }}>
    <div className="flex min-h-screen bg-background flex-col">
      {isImpersonating && (
        <div className="bg-accent text-accent-foreground px-4 py-2 flex items-center justify-between text-sm font-medium z-50">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Impersonating tenant: <strong>{impersonating.tenantName}</strong>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              stopImpersonation();
              navigate("/superadmin");
            }}
            className="gap-1 text-accent-foreground hover:bg-accent-foreground/10 h-7"
          >
            <X className="h-3.5 w-3.5" />
            Exit
          </Button>
        </div>
      )}
      <div className="flex flex-1 min-h-0">
      <DashboardSidebar
        currentView={currentView}
        onViewChange={handleViewChange}
        userEmail={user?.email}
        onSignOut={handleSignOut}
        mobileOpen={mobileOpen}
        onMobileToggle={() => setMobileOpen(false)}
        isAdmin={isAdmin}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <header className="lg:hidden flex items-center justify-between border-b border-border px-4 py-3 bg-card">
          <button onClick={() => setMobileOpen(true)} aria-label="Open menu">
            <Menu className="h-6 w-6 text-foreground" />
          </button>
          <Logo variant="color" size="sm" showText={false} />
          <div className="flex items-center gap-1">
            <NotificationBell />
            <LanguageSwitcher variant="compact" />
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setTourOpen(true)}
                  className="p-1 rounded-md hover:bg-muted transition-colors text-muted-foreground"
                  aria-label="Start guided tour"
                >
                  <HelpCircle className="h-5 w-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Start guided tour</TooltipContent>
            </Tooltip>
          </div>
        </header>

        <SamplePeriodBanner />

        {samplePeriod.isBlocked ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-4">
            <div className="p-4 rounded-full bg-destructive/10">
              <ShieldAlert className="h-12 w-12 text-destructive" />
            </div>
            <h2 className="text-xl font-serif font-semibold text-foreground">Access Blocked</h2>
            <p className="text-muted-foreground max-w-md">
              Your free trial has expired. Please contact support to reactivate your account or upgrade to a paid plan.
            </p>
          </div>
        ) : (
        <main className={`flex-1 p-4 sm:p-6 lg:p-8 overflow-x-hidden overflow-y-auto ${samplePeriod.isReadOnly ? "pointer-events-none opacity-75" : ""}`}>
          <div className="flex items-center justify-between mb-0">
            <div />
            <div className="hidden lg:flex items-center gap-2">
              <NotificationBell />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/guide")}
                className="gap-1.5 text-muted-foreground hover:text-foreground"
              >
                <BookOpen className="h-4 w-4" />
                Quick Guide
              </Button>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setTourOpen(true)}
                    className="gap-1.5 text-muted-foreground hover:text-foreground"
                  >
                    <HelpCircle className="h-4 w-4" />
                    Guided Tour
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Restart the guided tour</TooltipContent>
              </Tooltip>
            </div>
          </div>
          {viewComponents[currentView]}
        </main>
        )}
      </div>

      {currentView !== "support" && (
        <SupportChatWidget businessTier={effectiveTier === "business"} />
      )}

      <GuidedTour
        steps={tourSteps}
        isOpen={tourOpen}
        onClose={handleTourClose}
        onComplete={handleTourComplete}
        onNavigate={(view) => handleViewChange(view as DashboardView)}
      />
      </div>
    </div>
    </SiteContext.Provider>
  );
};

export default Dashboard;
