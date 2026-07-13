import { ClientBookingsPage } from "../pages/client/ClientBookingsPage";
import { ClientDashboard } from "../pages/client/ClientDashboard";
import { ClientPlansPage } from "../pages/client/ClientPlansPage";
import { ClientReviewsPage } from "../pages/client/ClientReviewsPage";
import { ClientSettingsPage } from "../pages/client/ClientSettingsPage";
import { ServicesPage } from "../pages/shared/ServicesPage";
import type { AppRoute } from "./types";

export const clientRoutes: AppRoute[] = [
  {
    path: "/home",
    title: "Home",
    breadcrumbs: ["Cliente", "Home"],
    Component: ClientDashboard,
  },
  {
    path: "/bookings",
    title: "Agendamentos",
    breadcrumbs: ["Cliente", "Agendamentos"],
    Component: ClientBookingsPage,
  },
  {
    path: "/reviews",
    title: "Avaliacoes",
    breadcrumbs: ["Cliente", "Avaliacoes"],
    Component: ClientReviewsPage,
  },
  {
    path: "/services",
    title: "Servicos",
    breadcrumbs: ["Cliente", "Servicos"],
    Component: ServicesPage,
  },
  {
    path: "/plans",
    title: "Planos",
    breadcrumbs: ["Cliente", "Planos"],
    Component: ClientPlansPage,
  },
  {
    path: "/settings",
    title: "Configuracoes",
    breadcrumbs: ["Cliente", "Configuracoes"],
    Component: ClientSettingsPage,
  },
];
