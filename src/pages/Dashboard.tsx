import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, Navigate } from "react-router-dom";
import { useState } from "react";
import { useTenant } from "@/hooks/useTenant";
import { Menu } from "lucide-react";
import DashboardSidebar, { DashboardView } from "@/components/dashboard/DashboardSidebar";
import DashboardOverview from "@/components/dashboard/DashboardOverview";
import CalendarView from "@/components/dashboard/CalendarView";
import ReservationList from "@/components/dashboard/ReservationList";
import ResourceManagement from "@/components/dashboard/ResourceManagement";
import Logo from "@/components/Logo";

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const { tenantId, loading } = useTenant();
  const navigate = useNavigate();
  const [currentView, setCurrentView] = useState<DashboardView>("overview");
  const [mobileOpen, setMobileOpen] = useState(false);

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
      />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <header className="lg:hidden flex items-center justify-between border-b border-border px-4 py-3 bg-card">
          <button onClick={() => setMobileOpen(true)} aria-label="Open menu">
            <Menu className="h-6 w-6 text-foreground" />
          </button>
          <Logo variant="color" size="sm" showText={false} />
          <div className="w-6" />
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-auto">
          {viewComponents[currentView]}
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
