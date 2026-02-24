import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, Navigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { useTenant } from "@/hooks/useTenant";
import { Menu, HelpCircle } from "lucide-react";
import DashboardSidebar, { DashboardView } from "@/components/dashboard/DashboardSidebar";
import DashboardOverview from "@/components/dashboard/DashboardOverview";
import CalendarView from "@/components/dashboard/CalendarView";
import ReservationList from "@/components/dashboard/ReservationList";
import ResourceManagement from "@/components/dashboard/ResourceManagement";
import SettingsPanel from "@/components/dashboard/SettingsPanel";
import ReportsPanel from "@/components/dashboard/ReportsPanel";
import AdminPanel from "@/components/dashboard/AdminPanel";
import DashboardSupportPanel from "@/components/dashboard/DashboardSupportPanel";
import Logo from "@/components/Logo";
import SupportChatWidget from "@/components/SupportChatWidget";
import GuidedTour, { TourStep } from "@/components/dashboard/GuidedTour";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const TOUR_STORAGE_KEY = "minnowbook-tour-completed";

const tourSteps: TourStep[] = [
  {
    target: "[data-tour='stats-grid']",
    title: "Dashboard Overview",
    content: "Here you can see today's key metrics at a glance — reservations, pending bookings, confirmed count, and active resources.",
    placement: "bottom",
  },
  {
    target: "[data-tour='booking-link']",
    title: "Your Booking Link",
    content: "Share this link with your customers so they can make reservations online. Copy it or open it in a new tab to preview.",
    placement: "top",
  },
  {
    target: "[data-tour='sidebar-nav']",
    title: "Navigation",
    content: "Use the sidebar to switch between Calendar, Reservations, Resources, Reports, Settings, and Admin views.",
    placement: "right",
  },
];

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const { tenantId, tenant, isAdmin, loading } = useTenant();
  const navigate = useNavigate();
  const [currentView, setCurrentView] = useState<DashboardView>("overview");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);

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

  const viewComponents: Record<DashboardView, React.ReactNode> = {
    overview: <DashboardOverview />,
    calendar: <CalendarView />,
    reservations: <ReservationList />,
    resources: <ResourceManagement />,
    reports: <ReportsPanel />,
    settings: <SettingsPanel />,
    admin: <AdminPanel />,
    support: <DashboardSupportPanel />,
  };

  return (
    <div className="flex min-h-screen bg-background">
      <DashboardSidebar
        currentView={currentView}
        onViewChange={setCurrentView}
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
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-x-hidden overflow-y-auto">
          <div className="flex items-center justify-between mb-0">
            <div />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setTourOpen(true)}
                  className="hidden lg:flex gap-1.5 text-muted-foreground hover:text-foreground"
                >
                  <HelpCircle className="h-4 w-4" />
                  Guided Tour
                </Button>
              </TooltipTrigger>
              <TooltipContent>Restart the guided tour</TooltipContent>
            </Tooltip>
          </div>
          {viewComponents[currentView]}
        </main>
      </div>

      <SupportChatWidget businessTier={tenant?.tier === "business"} />

      <GuidedTour
        steps={tourSteps}
        isOpen={tourOpen}
        onClose={() => setTourOpen(false)}
        onComplete={handleTourComplete}
      />
    </div>
  );
};

export default Dashboard;
