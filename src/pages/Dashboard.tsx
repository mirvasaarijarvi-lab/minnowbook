import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { useNavigate, Navigate } from "react-router-dom";
import { useState } from "react";
import { useTenant } from "@/hooks/useTenant";
import Logo from "@/components/Logo";
import DashboardSidebar, { DashboardView } from "@/components/dashboard/DashboardSidebar";
import DashboardOverview from "@/components/dashboard/DashboardOverview";
import CalendarView from "@/components/dashboard/CalendarView";
import ReservationList from "@/components/dashboard/ReservationList";
import ResourceManagement from "@/components/dashboard/ResourceManagement";

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const { tenantId, loading } = useTenant();
  const navigate = useNavigate();
  const [currentView, setCurrentView] = useState<DashboardView>("overview");

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

  // Redirect to onboarding if user has no tenant
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
      />
      <main className="flex-1 p-6 lg:p-8 overflow-auto">
        {viewComponents[currentView]}
      </main>
    </div>
  );
};

export default Dashboard;
