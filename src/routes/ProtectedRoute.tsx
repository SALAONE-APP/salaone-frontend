import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";

import { getDefaultRouteForRole, normalizeRole } from "../config/profileConfig";
import type { UserRole } from "../config/profileConfig";
import { useAuth } from "../hooks/useAuth";

interface ProtectedRouteProps {
  allowedRoles: UserRole[];
  children: ReactNode;
}

export function ProtectedRoute({ allowedRoles, children }: ProtectedRouteProps) {
  const { signed, loading, user } = useAuth();

  if (loading) {
    return null;
  }

  if (!signed) {
    return <Navigate to="/login" replace />;
  }

  const role = normalizeRole(user?.role);

  if (!allowedRoles.includes(role)) {
    return <Navigate to={getDefaultRouteForRole(role)} replace />;
  }

  return children;
}
