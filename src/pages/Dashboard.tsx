import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import DashboardSidebar, { DashboardView } from "@/components/dashboard/DashboardSidebar";
import DashboardOverview from "@/components/dashboard/DashboardOverview";
import CalendarView from "@/components/dashboard/CalendarView";
import ReservationList from "@/components/dashboard/ReservationList";
import ResourceManagement from "@/components/dashboard/ResourceManagement";

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [currentView, setCurrentView] = useState<DashboardView>("overview");

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

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
