import { SalesCrmDashboardPage } from "../pages/sales_crm/SalesCrmDashboardPage";
import { SalesCrmKanbanPage } from "../pages/sales_crm/SalesCrmKanbanPage";
import { SalesCrmScriptsPage } from "../pages/sales_crm/SalesCrmScriptsPage";
import type { AppRoute } from "./types";

export const salesRepRoutes: AppRoute[] = [
  {
    path: "/crm-comercial",
    title: "Funil de Vendas",
    breadcrumbs: ["CRM Comercial", "Funil de Vendas"],
    Component: SalesCrmKanbanPage,
  },
  {
    path: "/crm-comercial/dashboard",
    title: "Dashboard",
    breadcrumbs: ["CRM Comercial", "Dashboard"],
    Component: SalesCrmDashboardPage,
  },
  {
    path: "/crm-comercial/scripts",
    title: "Scripts",
    breadcrumbs: ["CRM Comercial", "Scripts"],
    Component: SalesCrmScriptsPage,
  },
];
