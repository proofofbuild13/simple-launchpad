import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";
import StartupDashboard from "./StartupDashboard";

export default function DashboardRouter() {
  const { role, loading, roleLoading, user } = useAuth();
  if (loading || (user && roleLoading)) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (!role) return <Navigate to="/register" replace />;
  if (role === "startup") return <StartupDashboard />;
  if (role === "builder") return <Navigate to="/browse" replace />;
  if (role === "admin" || role === "super_admin") return <Navigate to="/admin" replace />;
  return <Navigate to="/register" replace />;
}
