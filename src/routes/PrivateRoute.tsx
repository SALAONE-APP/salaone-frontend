import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

interface PrivateRouteProps {
  children: React.ReactNode;
}

export function PrivateRoute({ children }: PrivateRouteProps) {
  const { signed, loading } = useAuth();

  if (loading) {
    return null;
  }

  if (!signed) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
