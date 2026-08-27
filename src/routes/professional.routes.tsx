import { ProfessionalBookingsPage } from "../pages/professional/ProfessionalBookingsPage";
import { ProfessionalDashboard } from "../pages/professional/ProfessionalDashboard";
import { ProfessionalEarningsPage } from "../pages/professional/ProfessionalEarningsPage";
import { ProfessionalSchedulePage } from "../pages/professional/ProfessionalSchedulePage";
import { ProfessionalSettingsPage } from "../pages/professional/ProfessionalSettingsPage";
import { CustomersPage } from "../pages/shared/CustomersPage";
import { ClientRecordsPage } from "../pages/shared/ClientRecordsPage";
import { HelpCenterPage } from "../pages/shared/HelpCenterPage";
import { ServicesPage } from "../pages/shared/ServicesPage";
import { ServiceTabsPage } from "../pages/shared/ServiceTabsPage";
import { ProductsPage } from "../pages/admin/ProductsPage";
import { SchedulesPage } from "../pages/shared/SchedulesPage";
import { PaymentsPage } from "../pages/shared/PaymentsPage";
import { CashClosingPage } from "../pages/shared/CashClosingPage";
import { AdminSettingsPage } from "../pages/admin/AdminSettingsPage";
import type { AppRoute } from "./types";

export const professionalRoutes: AppRoute[] = [
  {
    path: "/home",
    title: "Home",
    breadcrumbs: ["Profissional", "Home"],
    Component: ProfessionalDashboard,
  },
  {
    path: "/schedules",
    title: "Agenda do dia",
    breadcrumbs: ["Profissional", "Agenda"],
    Component: ProfessionalSchedulePage,
  },
  {
    path: "/bookings",
    title: "Agendamentos",
    breadcrumbs: ["Profissional", "Agendamentos"],
    Component: ProfessionalBookingsPage,
    // sempre visível — permissões controlam as ações dentro da página
  },
  {
    path: "/customers",
    title: "Clientes",
    breadcrumbs: ["Profissional", "Clientes"],
    Component: CustomersPage,
    requiredPermission: "manageCustomers",
  },
  {
    path: "/client-records",
    title: "Prontuário",
    breadcrumbs: ["Profissional", "Prontuário"],
    Component: ClientRecordsPage,
  },
  {
    path: "/services",
    title: "Serviços",
    breadcrumbs: ["Profissional", "Serviços"],
    Component: ServicesPage,
    requiredPermission: "manageServices",
  },
  {
    path: "/payments",
    title: "Ganhos",
    breadcrumbs: ["Profissional", "Ganhos"],
    Component: ProfessionalEarningsPage,
    // sempre visível — é direito do profissional ver os próprios ganhos
  },
  {
    path: "/products",
    title: "Produtos",
    breadcrumbs: ["Profissional", "Produtos"],
    Component: ProductsPage,
    requiredPermission: "manageProducts",
  },
  {
    path: "/service-tabs",
    title: "Comandas",
    breadcrumbs: ["Profissional", "Comandas"],
    Component: ServiceTabsPage,
    requiredPermission: "managePayments",
  },
  {
    path: "/financial-payments",
    title: "Pagamentos do salao",
    breadcrumbs: ["Profissional", "Financeiro", "Pagamentos"],
    Component: PaymentsPage,
    requiredPermission: "managePayments",
  },
  {
    path: "/cash-closing",
    title: "Fechamento de caixa",
    breadcrumbs: ["Profissional", "Financeiro", "Fechamento de caixa"],
    Component: CashClosingPage,
    requiredPermission: "managePayments",
  },
  {
    path: "/blocked-schedules",
    title: "Bloqueios de agenda",
    breadcrumbs: ["Profissional", "Bloqueios de agenda"],
    Component: SchedulesPage,
    requiredPermission: "manageBlockedDates",
  },
  {
    path: "/settings",
    title: "Configuracoes",
    breadcrumbs: ["Profissional", "Configuracoes"],
    Component: ProfessionalSettingsPage,
  },
  {
    path: "/salon-settings",
    title: "Configuracoes do salao",
    breadcrumbs: ["Profissional", "Configuracoes do salao"],
    Component: AdminSettingsPage,
    requiredPermission: "manageSettings",
  },
  {
    path: "/help",
    title: "Central de Ajuda",
    breadcrumbs: ["Profissional", "Ajuda"],
    Component: HelpCenterPage,
  },
];
