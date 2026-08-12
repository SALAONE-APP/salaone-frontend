import { Calendar, CircleDollarSign, ClipboardPlus, CreditCard, Home, Package, ReceiptText, Scissors, Settings, UserCheck, Wallet } from "lucide-react";

import { usePermissions } from "../../hooks/usePermissions";
import { ProfileSidebar } from "../shared/ProfileSidebar";
import type { SidebarItem, SidebarSection } from "../shared/ProfileSidebar";

export function ProfessionalSidebar() {
  const { can } = usePermissions();

  const operationItems: SidebarItem[] = [
    { icon: Calendar, label: "Agenda do dia", href: "/schedules" },
    { icon: Calendar, label: "Agendamentos", href: "/bookings" },
    { icon: Calendar, label: "Bloqueios de agenda", href: "/blocked-schedules", requiredPermission: "manageBlockedDates" },
    { icon: ReceiptText, label: "Comandas", href: "/service-tabs", requiredPermission: "managePayments" },
  ];

  const serviceItems: SidebarItem[] = [
    { icon: UserCheck, label: "Clientes", href: "/customers", requiredPermission: "manageCustomers" },
    { icon: ClipboardPlus, label: "Prontuário", href: "/client-records" },
    { icon: Scissors, label: "Serviços", href: "/services", requiredPermission: "manageServices" },
  ];

  serviceItems.push({ icon: Package, label: "Produtos", href: "/products", requiredPermission: "manageProducts" });

  const financialItems: SidebarItem[] = [
    { icon: Wallet, label: "Ganhos", href: "/payments" },
    { icon: CreditCard, label: "Pagamentos do salao", href: "/financial-payments", requiredPermission: "managePayments" },
    { icon: CircleDollarSign, label: "Fechamento de caixa", href: "/cash-closing", requiredPermission: "managePayments" },
  ];

  const bottomItems: SidebarItem[] = [];

  if (can("manageSettings")) {
    bottomItems.push({ icon: Settings, label: "Configuracoes do salao", href: "/salon-settings" });
  }
  bottomItems.push({ icon: Settings, label: "Meu perfil", href: "/settings" });

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
