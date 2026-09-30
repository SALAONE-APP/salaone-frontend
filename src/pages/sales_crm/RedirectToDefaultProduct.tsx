import { Navigate } from "react-router-dom";

export function RedirectToDefaultProduct() {
  return <Navigate to="/crm-comercial/salaone" replace />;
}
