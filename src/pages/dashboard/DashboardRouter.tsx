import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";
import StartupDashboard from "./StartupDashboard";
import BuilderDashboard from "./BuilderDashboard";
import AdminDashboard from "./AdminDashboard";

export default function DashboardRouter() {
  const { role, loading, roleLoading, user } = useAuth();
  if (loading || (user && roleLoading)) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!role) return <Navigate to="/register" replace />;
  if (role === "startup") return <Navigate to="/agent" replace />;
  if (role === "builder") return <BuilderDashboard />;
  if (role === "admin" || role === "super_admin") return <Navigate to="/admin" replace />;
  return <AdminDashboard />;
}
