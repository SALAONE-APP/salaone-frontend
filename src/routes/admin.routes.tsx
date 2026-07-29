import { AdminDashboard } from "../pages/admin/AdminDashboard";
import { AdminSettingsPage } from "../pages/admin/AdminSettingsPage";
import { EmployeePayrollPage } from "../pages/admin/EmployeePayrollPage";
import { EmployeeAppointmentHistoryPage } from "../pages/admin/EmployeeAppointmentHistoryPage";
import { ExtraPaymentsPage } from "../pages/admin/ExtraPaymentsPage";
import { GalleryPage } from "../pages/admin/GalleryPage";
import { ProductsPage } from "../pages/admin/ProductsPage";
import { ProductOrdersPage } from "../pages/admin/ProductOrdersPage";
import { PromotionsPage } from "../pages/admin/PromotionsPage";
import { BookingsPage } from "../pages/shared/BookingsPage";
import { CashClosingPage } from "../pages/shared/CashClosingPage";
import { FitAppointmentPage } from "../pages/shared/FitAppointmentPage";
import { CustomersPage } from "../pages/shared/CustomersPage";
import { ClientRecordsPage } from "../pages/shared/ClientRecordsPage";
import { HelpCenterPage } from "../pages/shared/HelpCenterPage";
import { OverviewPage } from "../pages/shared/OverviewPage";
import { PaymentsPage } from "../pages/shared/PaymentsPage";
import { ReviewsPage } from "../pages/shared/ReviewsPage";
import { SchedulesPage } from "../pages/shared/SchedulesPage";
import { ServicesPage } from "../pages/shared/ServicesPage";
import { ServiceTabsPage } from "../pages/shared/ServiceTabsPage";
import { StockPage } from "../pages/admin/StockPage";
import { ServiceTabHistoryPage } from "../pages/admin/ServiceTabHistoryPage";
import { UsersPage } from "../pages/shared/UsersPage";
import type { AppRoute } from "./types";

export const adminRoutes: AppRoute[] = [
  {
    path: "/home",
    title: "Home",
    breadcrumbs: ["Administracao", "Home"],
    Component: AdminDashboard,
  },
  {
    path: "/overview",
    title: "Dashboard",
    breadcrumbs: ["Administracao", "Dashboard"],
    Component: OverviewPage,
  },
  {
    path: "/bookings",
    title: "Agendamentos",
    breadcrumbs: ["Operacao", "Agendamentos"],
    Component: BookingsPage,
  },
  {
    path: "/employee-appointment-history",
    title: "Histórico por funcionário",
    breadcrumbs: ["Operação", "Histórico por funcionário"],
    Component: EmployeeAppointmentHistoryPage,
  },
  {
    path: "/encaixe",
    title: "Agenda",
    breadcrumbs: ["Operacao", "Agenda"],
    Component: FitAppointmentPage,
  },
  {
    path: "/payments",
    title: "Pagamentos",
    breadcrumbs: ["Financeiro", "Pagamentos"],
    Component: PaymentsPage,
  },
  {
    path: "/product-orders",
    title: "Pedidos de produtos",
    breadcrumbs: ["Financeiro", "Pedidos de produtos"],
    Component: ProductOrdersPage,
  },
  {
    path: "/service-tabs",
    title: "Comandas",
    breadcrumbs: ["Operacao", "Comandas"],
    Component: ServiceTabsPage,
  },
  {
    path: "/service-tab-history",
    title: "Histórico de comandas",
    breadcrumbs: ["Operação", "Histórico de comandas"],
    Component: ServiceTabHistoryPage,
  },
  {
    path: "/cash-closing",
    title: "Fechamento de caixa",
    breadcrumbs: ["Financeiro", "Fechamento de caixa"],
    Component: CashClosingPage,
  },
  {
    path: "/users",
    title: "Funcionarios",
    breadcrumbs: ["Administracao", "Funcionarios"],
    Component: UsersPage,
  },
  {
    path: "/employee-payroll",
    title: "Pagamento Funcionário",
    breadcrumbs: ["Administracao", "Pagamento Funcionário"],
    Component: EmployeePayrollPage,
  },
  {
    path: "/customers",
    title: "Clientes",
    breadcrumbs: ["Administracao", "Clientes"],
    Component: CustomersPage,
  },
  {
    path: "/client-records",
    title: "Prontuário",
    breadcrumbs: ["Administração", "Prontuário"],
    Component: ClientRecordsPage,
  },
  {
    path: "/extra-payments",
    title: "Pagamentos Extras",
    breadcrumbs: ["Administracao", "Pagamentos Extras"],
    Component: ExtraPaymentsPage,
  },
  {
    path: "/services",
    title: "Serviços",
    breadcrumbs: ["Gerenciar", "Serviços"],
    Component: ServicesPage,
  },
  {
    path: "/products",
    title: "Produtos",
    breadcrumbs: ["Gerenciar", "Produtos"],
    Component: ProductsPage,
  },
  {
    path: "/stock",
    title: "Estoque",
    breadcrumbs: ["Gerenciar", "Estoque"],
    Component: StockPage,
    requiredPermission: "manageProducts",
  },
  {
    path: "/gallery",
    title: "Galeria",
    breadcrumbs: ["Gerenciar", "Galeria"],
    Component: GalleryPage,
  },
  {
    path: "/schedules",
    title: "Calendario",
    breadcrumbs: ["Operacao", "Calendario"],
    Component: SchedulesPage,
  },
  {
    path: "/promotions",
    title: "Promocoes",
    breadcrumbs: ["Marketing", "Promocoes"],
    Component: PromotionsPage,
  },
  {
    path: "/reviews",
    title: "Avaliacoes",
    breadcrumbs: ["Relacionamento", "Avaliacoes"],
    Component: ReviewsPage,
  },
  {
    path: "/settings",
    title: "Configuracoes",
    breadcrumbs: ["Administracao", "Configuracoes"],
    Component: AdminSettingsPage,
  },
  {
    path: "/help",
    title: "Central de Ajuda",
    breadcrumbs: ["Administracao", "Ajuda"],
    Component: HelpCenterPage,
  },
];
