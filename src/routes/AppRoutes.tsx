import type { ComponentType } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { ShieldOff } from "lucide-react";

import { AppHeader } from "../components/shared/AppHeader";
import { SuperAdminSalonAccessBanner } from "../components/SuperAdminSalonAccessBanner";
import { PlatformTrialBanner } from "../components/PlatformTrialBanner";
import { getProfileConfig, normalizeRole } from "../config/profileConfig";
import type { UserRole } from "../config/profileConfig";
import { useAuth } from "../hooks/useAuth";
import { usePermissions } from "../hooks/usePermissions";
import { AdminLayout } from "../layouts/AdminLayout";
import { ProfessionalLayout } from "../layouts/ProfessionalLayout";
import { ClientLayout } from "../layouts/ClientLayout";
import { ReceptionistLayout } from "../layouts/ReceptionistLayout";
import { SuperAdminLayout } from "../layouts/SuperAdminLayout";
import { SalesRepLayout } from "../layouts/SalesRepLayout";
import { adminRoutes } from "./admin.routes";
import { professionalRoutes } from "./professional.routes";
import { clientRoutes } from "./client.routes";
import { LogoutRoute } from "./LogoutRoute";
import { PrivateRoute } from "./PrivateRoute";
import { ProtectedRoute } from "./ProtectedRoute";
import { receptionistRoutes } from "./receptionist.routes";
import { superAdminRoutes } from "./superadmin.routes";
import { salesRepRoutes } from "./salesrep.routes";
import type { AppRoute } from "./types";

interface RouteGroup {
  Layout: ComponentType;
  routes: AppRoute[];
  headerActionLabel: string;
  headerActionHref: string;
}

const routeGroups: Record<UserRole, RouteGroup> = {
  client: {
    Layout: ClientLayout,
    routes: clientRoutes,
    headerActionLabel: "Marcar horario",
    headerActionHref: "/bookings",
  },
  professional: {
    Layout: ProfessionalLayout,
    routes: professionalRoutes,
    headerActionLabel: "Abrir agenda",
    headerActionHref: "/schedules",
  },
  admin: {
    Layout: AdminLayout,
    routes: adminRoutes,
    headerActionLabel: "Resumo",
    headerActionHref: "/overview",
  },
  super_admin: {
    Layout: SuperAdminLayout,
    routes: superAdminRoutes,
    headerActionLabel: "Metricas",
    headerActionHref: "/overview",
  },
  receptionist: {
    Layout: ReceptionistLayout,
    routes: receptionistRoutes,
    headerActionLabel: "Novo agendamento",
    headerActionHref: "/bookings",
  },
  sales_rep: {
    Layout: SalesRepLayout,
    routes: salesRepRoutes,
    headerActionLabel: "Novo Lead",
    headerActionHref: "/crm-comercial",
  },
};

function AccessDenied({ permission }: { permission: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-border bg-card py-20 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
        <ShieldOff size={28} className="text-destructive" />
      </div>
      <div>
        <h3 className="text-lg font-semibold text-foreground">Acesso negado</h3>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Voce nao tem permissao para acessar esta area.
          Solicite ao administrador a permissao{" "}
          <span className="font-medium text-foreground">{permission}</span>.
        </p>
      </div>
    </div>
  );
}

function PageShell({
  route,
  actionLabel,
  actionHref,
}: {
  route: AppRoute;
  actionLabel: string;
  actionHref: string;
}) {
  const { can, isAdmin } = usePermissions();
  const { user, salonAccess } = useAuth();
  const Page = route.Component;
  const blocked =
    route.requiredPermission && !isAdmin && !can(route.requiredPermission);
  const isAdminHome = route.path === "/home" && (user?.role === "admin" || Boolean(salonAccess));

  return (
    <>
      <AppHeader
        title={route.title}
        breadcrumbs={route.breadcrumbs}
        actionLabel={actionLabel}
        actionHref={actionHref}
      />
      <SuperAdminSalonAccessBanner />
      <div className="p-6">
        {isAdminHome && <PlatformTrialBanner />}
        {blocked ? (
          <AccessDenied permission={route.requiredPermission!} />
        ) : (
          <Page />
        )}
      </div>
    </>
  );
}

function toChildPath(path: string) {
  return path.replace(/^\//, "");
}

export function AppRoutes() {
  const { user, salonAccess } = useAuth();
  const role = normalizeRole(user?.role);
  const effectiveRole: UserRole = role === "super_admin" && salonAccess ? "admin" : role;
  const profileConfig = getProfileConfig(effectiveRole);
  const { Layout, routes, headerActionLabel, headerActionHref } = routeGroups[effectiveRole];

  return (
    <PrivateRoute>
      <Routes>
        <Route path="/logout" element={<LogoutRoute />} />
        <Route
          element={
            <ProtectedRoute allowedRoles={[role]}>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<Navigate to={profileConfig.defaultRoute} replace />} />

          {routes.map((route) => (
            <Route
              key={route.path}
              path={toChildPath(route.path)}
              element={
                <PageShell
                  route={route}
                  actionLabel={headerActionLabel}
                  actionHref={headerActionHref}
                />
              }
            />
          ))}
        </Route>

        <Route path="*" element={<Navigate to={profileConfig.defaultRoute} replace />} />
      </Routes>
    </PrivateRoute>
  );
}
