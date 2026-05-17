import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

export function AdminGuard({ children }: { children?: React.ReactNode }) {
  const { user, role, loading, roleLoading } = useAuth();
  const loc = useLocation();
  if (loading || (user && roleLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!user) return <Navigate to="/admin/login" state={{ from: loc }} replace />;
  if (role !== "admin" && (role as string) !== "super_admin") {
    return <Navigate to="/403" replace />;
  }
  return <>{children ?? <Outlet />}</>;
}
