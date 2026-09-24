import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { portalHomeFor } from "@/lib/portalHome";

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles: string[];
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!role) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // Force password change for admin-created accounts (check both app_metadata and user_metadata for compatibility)
  if (user.app_metadata?.must_change_password || user.user_metadata?.must_change_password) {
    return <Navigate to="/change-password" replace />;
  }

  if (!allowedRoles.includes(role)) {
    const redirect = portalHomeFor(role);
    return <Navigate to={redirect} replace />;
  }

  return <>{children}</>;
}
