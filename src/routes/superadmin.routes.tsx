import { SuperAdminDashboardPage } from "../pages/super_admin/SuperAdminDashboardPage";
import { SuperAdminSalonsPage } from "../pages/super_admin/SuperAdminSalonsPage";
import { SuperAdminUsersPage } from "../pages/super_admin/SuperAdminUsersPage";
import { SuperAdminSubscriptionsPage } from "../pages/super_admin/SuperAdminSubscriptionsPage";
import { SuperAdminPlansPage } from "../pages/super_admin/SuperAdminPlansPage";
import { SuperAdminReportsPage } from "../pages/super_admin/SuperAdminReportsPage";
import { SuperAdminAresChatPage } from "../pages/super_admin/SuperAdminAresChatPage";
import { SuperAdminFeatureUpdatesPage } from "../pages/super_admin/SuperAdminFeatureUpdatesPage";
import { SuperAdminLandingLeadsPage } from "../pages/super_admin/SuperAdminLandingLeadsPage";
import { SalesCrmDashboardPage } from "../pages/sales_crm/SalesCrmDashboardPage";
import { SalesCrmKanbanPage } from "../pages/sales_crm/SalesCrmKanbanPage";
import { SalesCrmScriptsPage } from "../pages/sales_crm/SalesCrmScriptsPage";
import type { AppRoute } from "./types";

export const superAdminRoutes: AppRoute[] = [
  {
    path: "/home",
    title: "Dashboard",
    breadcrumbs: ["Super Admin", "Dashboard"],
    Component: SuperAdminDashboardPage,
  },
  {
    path: "/salons",
    title: "Salões",
    breadcrumbs: ["Super Admin", "Salões"],
    Component: SuperAdminSalonsPage,
  },
  {
    path: "/users",
    title: "Usuarios",
    breadcrumbs: ["Super Admin", "Usuarios"],
    Component: SuperAdminUsersPage,
  },
  {
    path: "/subscriptions",
    title: "Assinaturas",
    breadcrumbs: ["Super Admin", "Assinaturas"],
    Component: SuperAdminSubscriptionsPage,
  },
  {
    path: "/platform-plans",
    title: "Planos Landing",
    breadcrumbs: ["Super Admin", "Planos Landing"],
    Component: SuperAdminPlansPage,
  },
  {
    path: "/areschat",
    title: "AresChat",
    breadcrumbs: ["Super Admin", "AresChat"],
    Component: SuperAdminAresChatPage,
  },
  {
    path: "/landing-leads",
    title: "Contatos interessados",
    breadcrumbs: ["Super Admin", "Contatos interessados"],
    Component: SuperAdminLandingLeadsPage,
  },
  {
    path: "/feature-updates",
    title: "Novas Funcionalidades",
    breadcrumbs: ["Super Admin", "Novas Funcionalidades"],
    Component: SuperAdminFeatureUpdatesPage,
  },
  {
    path: "/reports",
    title: "Relatorios",
    breadcrumbs: ["Super Admin", "Relatorios"],
    Component: SuperAdminReportsPage,
  },
  {
    path: "/crm-comercial",
    title: "Funil de Vendas",
    breadcrumbs: ["CRM Comercial", "Funil de Vendas"],
    Component: SalesCrmKanbanPage,
  },
  {
    path: "/crm-comercial/dashboard",
    title: "Dashboard Comercial",
    breadcrumbs: ["CRM Comercial", "Dashboard"],
    Component: SalesCrmDashboardPage,
  },
  {
    path: "/crm-comercial/scripts",
    title: "Scripts Comerciais",
    breadcrumbs: ["CRM Comercial", "Scripts"],
    Component: SalesCrmScriptsPage,
  },
];
