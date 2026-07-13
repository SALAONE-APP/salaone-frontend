import { ReceptionistDashboard } from "../pages/receptionist/ReceptionistDashboard";
import { ReceptionistSettingsPage } from "../pages/receptionist/ReceptionistSettingsPage";
import { BookingsPage } from "../pages/shared/BookingsPage";
import { CashClosingPage } from "../pages/shared/CashClosingPage";
import { CustomersPage } from "../pages/shared/CustomersPage";
import { FitAppointmentPage } from "../pages/shared/FitAppointmentPage";
import { PaymentsPage } from "../pages/shared/PaymentsPage";
import { PlansPage } from "../pages/admin/PlansPage";
import { ProductsPage } from "../pages/admin/ProductsPage";
import { SchedulesPage } from "../pages/shared/SchedulesPage";
import { ServicesPage } from "../pages/shared/ServicesPage";
import type { AppRoute } from "./types";

export const receptionistRoutes: AppRoute[] = [
  {
    path: "/home",
    title: "Home",
    breadcrumbs: ["Recepcao", "Home"],
    Component: ReceptionistDashboard,
  },
  {
    path: "/bookings",
    title: "Agendamentos",
    breadcrumbs: ["Operacao", "Agendamentos"],
    Component: BookingsPage,
  },
  {
    path: "/encaixe",
    title: "Agenda",
    breadcrumbs: ["Operacao", "Agenda"],
    Component: FitAppointmentPage,
  },
  {
    path: "/schedules",
    title: "Agenda",
    breadcrumbs: ["Operacao", "Agenda"],
    Component: SchedulesPage,
    requiredPermission: "manageBlockedDates",
  },
  {
    path: "/payments",
    title: "Pagamentos",
    breadcrumbs: ["Financeiro", "Pagamentos"],
    Component: PaymentsPage,
    requiredPermission: "managePayments",
  },
  {
    path: "/cash-closing",
    title: "Fechamento de caixa",
    breadcrumbs: ["Financeiro", "Fechamento de caixa"],
    Component: CashClosingPage,
    requiredPermission: "managePayments",
  },
  {
    path: "/customers",
    title: "Clientes",
    breadcrumbs: ["Atendimento", "Clientes"],
    Component: CustomersPage,
    requiredPermission: "manageCustomers",
  },
  /* Visualização sem permissão — ações de edição são bloqueadas dentro das páginas */
  {
    path: "/services",
    title: "Servicos",
    breadcrumbs: ["Catalogo", "Servicos"],
    Component: ServicesPage,
  },
  {
    path: "/products",
    title: "Produtos",
    breadcrumbs: ["Catalogo", "Produtos"],
    Component: ProductsPage,
  },
  {
    path: "/plans",
    title: "Planos",
    breadcrumbs: ["Catalogo", "Planos"],
    Component: PlansPage,
  },
  {
    path: "/settings",
    title: "Configuracoes",
    breadcrumbs: ["Recepcao", "Configuracoes"],
    Component: ReceptionistSettingsPage,
  },
];
