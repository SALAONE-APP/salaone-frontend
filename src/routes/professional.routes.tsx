import { ProfessionalBookingsPage } from "../pages/professional/ProfessionalBookingsPage";
import { ProfessionalDashboard } from "../pages/professional/ProfessionalDashboard";
import { ProfessionalEarningsPage } from "../pages/professional/ProfessionalEarningsPage";
import { ProfessionalSchedulePage } from "../pages/professional/ProfessionalSchedulePage";
import { ProfessionalSettingsPage } from "../pages/professional/ProfessionalSettingsPage";
import { CustomersPage } from "../pages/shared/CustomersPage";
import { HelpCenterPage } from "../pages/shared/HelpCenterPage";
import { ServicesPage } from "../pages/shared/ServicesPage";
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
  },
  {
    path: "/services",
    title: "Servicos",
    breadcrumbs: ["Profissional", "Servicos"],
    Component: ServicesPage,
  },
  {
    path: "/payments",
    title: "Ganhos",
    breadcrumbs: ["Profissional", "Ganhos"],
    Component: ProfessionalEarningsPage,
    // sempre visível — é direito do profissional ver os próprios ganhos
  },
  {
    path: "/settings",
    title: "Configuracoes",
    breadcrumbs: ["Profissional", "Configuracoes"],
    Component: ProfessionalSettingsPage,
  },
  {
    path: "/help",
    title: "Central de Ajuda",
    breadcrumbs: ["Profissional", "Ajuda"],
    Component: HelpCenterPage,
  },
];
