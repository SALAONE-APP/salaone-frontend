import { BarberBookingsPage } from "../pages/barber/BarberBookingsPage";
import { BarberDashboard } from "../pages/barber/BarberDashboard";
import { BarberEarningsPage } from "../pages/barber/BarberEarningsPage";
import { BarberSchedulePage } from "../pages/barber/BarberSchedulePage";
import { BarberSettingsPage } from "../pages/barber/BarberSettingsPage";
import { CustomersPage } from "../pages/shared/CustomersPage";
import { HelpCenterPage } from "../pages/shared/HelpCenterPage";
import { ServicesPage } from "../pages/shared/ServicesPage";
import type { AppRoute } from "./types";

export const barberRoutes: AppRoute[] = [
  {
    path: "/home",
    title: "Home",
    breadcrumbs: ["Barbeiro", "Home"],
    Component: BarberDashboard,
  },
  {
    path: "/schedules",
    title: "Agenda do dia",
    breadcrumbs: ["Barbeiro", "Agenda"],
    Component: BarberSchedulePage,
  },
  {
    path: "/bookings",
    title: "Agendamentos",
    breadcrumbs: ["Barbeiro", "Agendamentos"],
    Component: BarberBookingsPage,
    // sempre visível — permissões controlam as ações dentro da página
  },
  {
    path: "/customers",
    title: "Clientes",
    breadcrumbs: ["Barbeiro", "Clientes"],
    Component: CustomersPage,
  },
  {
    path: "/services",
    title: "Servicos",
    breadcrumbs: ["Barbeiro", "Servicos"],
    Component: ServicesPage,
  },
  {
    path: "/payments",
    title: "Ganhos",
    breadcrumbs: ["Barbeiro", "Ganhos"],
    Component: BarberEarningsPage,
    // sempre visível — é direito do barbeiro ver os próprios ganhos
  },
  {
    path: "/settings",
    title: "Configuracoes",
    breadcrumbs: ["Barbeiro", "Configuracoes"],
    Component: BarberSettingsPage,
  },
  {
    path: "/help",
    title: "Central de Ajuda",
    breadcrumbs: ["Barbeiro", "Ajuda"],
    Component: HelpCenterPage,
  },
];
