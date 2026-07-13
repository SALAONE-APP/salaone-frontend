import { Navigate } from "react-router-dom";

import { getDefaultRouteForRole } from "../config/profileConfig";
import { useAuth } from "../hooks/useAuth";

interface PublicRouteProps {
  children: React.ReactNode;
}

export function PublicRoute({ children }: PublicRouteProps) {
  const { signed, loading, user } = useAuth();

  if (loading) {
    return null;
  }

  if (signed) {
    return <Navigate to={getDefaultRouteForRole(user?.role)} replace />;
  }

  return children;
}
