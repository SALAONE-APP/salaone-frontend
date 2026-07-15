import { Calendar, Home, Scissors, Settings, UserCheck, Wallet } from "lucide-react";

import { usePermissions } from "../../hooks/usePermissions";
import { ProfileSidebar } from "../shared/ProfileSidebar";
import type { SidebarItem, SidebarSection } from "../shared/ProfileSidebar";

export function ProfessionalSidebar() {
  const { can } = usePermissions();

  const operationItems: SidebarItem[] = [
    { icon: Calendar, label: "Agenda do dia", href: "/schedules" },
    { icon: Calendar, label: "Agendamentos", href: "/bookings" },
  ];

  const serviceItems: SidebarItem[] = [
    { icon: UserCheck, label: "Clientes", href: "/customers" },
    { icon: Scissors, label: "Servicos", href: "/services" },
  ];

  const financialItems: SidebarItem[] = [
    { icon: Wallet, label: "Ganhos", href: "/payments" },
  ];

  const bottomItems: SidebarItem[] = [];

  if (can("manageSettings")) {
    bottomItems.push({ icon: Settings, label: "Configuracoes", href: "/settings" });
  }

  const sections: SidebarSection[] = [
    { items: [{ icon: Home, label: "Home", href: "/home" }] },
    {
      items: [
        {
          icon: Calendar,
          label: "Operacao",
          children: operationItems,
        },
      ],
    },
    {
      items: [
        {
          icon: UserCheck,
          label: "Atendimento",
          children: serviceItems,
        },
      ],
    },
    {
      items: [
        {
          icon: Wallet,
          label: "Financeiro",
          children: financialItems,
        },
      ],
    },
    ...(bottomItems.length > 0 ? [{ items: bottomItems }] : []),
  ];

  return <ProfileSidebar title="Painel do Profissional" homeHref="/home" sections={sections} />;
}
