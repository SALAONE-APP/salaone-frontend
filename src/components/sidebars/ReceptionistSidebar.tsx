import { Calendar, CircleDollarSign, CreditCard, Home, LayoutList, Package, Scissors, Settings, UserCheck, Zap } from "lucide-react";

import { ProfileSidebar } from "../shared/ProfileSidebar";
import type { SidebarSection } from "../shared/ProfileSidebar";

const sections: SidebarSection[] = [
  {
    items: [{ icon: Home, label: "Home", href: "/home" }],
  },
  {
    items: [
      {
        icon: Calendar,
        label: "Operacao",
        children: [
          { icon: Calendar, label: "Agendamentos", href: "/bookings" },
          { icon: Zap, label: "Agenda", href: "/encaixe" },
          { icon: Calendar, label: "Agenda", href: "/schedules", requiredPermission: "manageBlockedDates" },
        ],
      },
    ],
  },
  {
    items: [
      {
        icon: CreditCard,
        label: "Financeiro",
        children: [
          { icon: CreditCard, label: "Pagamentos", href: "/payments", requiredPermission: "managePayments" },
          { icon: CircleDollarSign, label: "Fechamento de caixa", href: "/cash-closing", requiredPermission: "managePayments" },
        ],
      },
    ],
  },
  {
    items: [
      {
        icon: UserCheck,
        label: "Atendimento",
        children: [
          { icon: UserCheck, label: "Clientes", href: "/customers", requiredPermission: "manageCustomers" },
        ],
      },
    ],
  },
  {
    items: [
      {
        icon: LayoutList,
        label: "Catalogo",
        children: [
          { icon: Scissors, label: "Servicos", href: "/services" },
          { icon: Package, label: "Produtos", href: "/products" },
          { icon: LayoutList, label: "Planos", href: "/plans" },
        ],
      },
    ],
  },
  {
    items: [
      { icon: Settings, label: "Configuracoes", href: "/settings" },
    ],
  },
];

export function ReceptionistSidebar() {
  return <ProfileSidebar title="Recepcao" homeHref="/home" sections={sections} />;
}
