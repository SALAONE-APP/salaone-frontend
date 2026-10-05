import { SalesCrmDashboardPage } from "../pages/sales_crm/SalesCrmDashboardPage";
import { RedirectToDefaultProduct } from "../pages/sales_crm/RedirectToDefaultProduct";
import { keyedByProduct } from "../pages/sales_crm/keyedByProduct";
import { SalesCrmKanbanPage } from "../pages/sales_crm/SalesCrmKanbanPage";
import { SalesCrmScriptsPage } from "../pages/sales_crm/SalesCrmScriptsPage";
import { SalesDocPage } from "../pages/sales_docs/SalesDocPage";
import { SalesDocsListPage } from "../pages/sales_docs/SalesDocsListPage";
import type { AppRoute } from "./types";

export const salesRepRoutes: AppRoute[] = [
  {
    path: "/crm-comercial",
    title: "Funil de Vendas",
    breadcrumbs: ["CRM Comercial", "Funil de Vendas"],
    Component: RedirectToDefaultProduct,
  },
  {
    path: "/crm-comercial/:product",
    title: "Funil de Vendas",
    breadcrumbs: ["CRM Comercial", "Funil de Vendas"],
    Component: keyedByProduct(SalesCrmKanbanPage),
  },
  {
    path: "/crm-comercial/:product/dashboard",
    title: "Dashboard",
    breadcrumbs: ["CRM Comercial", "Dashboard"],
    Component: keyedByProduct(SalesCrmDashboardPage),
  },
  {
    path: "/crm-comercial/:product/scripts",
    title: "Scripts",
    breadcrumbs: ["CRM Comercial", "Scripts"],
    Component: keyedByProduct(SalesCrmScriptsPage),
  },
  {
    path: "/documentacoes/:product",
    title: "Documentações",
    breadcrumbs: ["Documentações"],
    Component: keyedByProduct(SalesDocsListPage),
  },
  {
    path: "/documentacoes/:product/:slug",
    title: "Documentação",
    breadcrumbs: ["Documentações", "Documento"],
    Component: keyedByProduct(SalesDocPage),
  },
];
