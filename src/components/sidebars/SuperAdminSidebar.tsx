import {
  BarChart3,
  Building2,
  ContactRound,
  CreditCard,
  FileText,
  Handshake,
  KanbanSquare,
  LayoutDashboard,
  Megaphone,
  MessageSquareMore,
  Users,
} from "lucide-react";

import { ProfileSidebar } from "../shared/ProfileSidebar";
import type { SidebarSection } from "../shared/ProfileSidebar";

const sections: SidebarSection[] = [
  {
    items: [
      { icon: LayoutDashboard, label: "Dashboard", href: "/home" },
      { icon: Building2, label: "Salões", href: "/salons" },
      { icon: Users, label: "Usuarios", href: "/users" },
      { icon: CreditCard, label: "Assinaturas", href: "/subscriptions" },
      { icon: FileText, label: "Planos Landing", href: "/platform-plans" },
      { icon: MessageSquareMore, label: "AresChat", href: "/areschat" },
      { icon: ContactRound, label: "Contatos interessados", href: "/landing-leads" },
      { icon: Megaphone, label: "Novas Funcionalidades", href: "/feature-updates" },
      { icon: BarChart3, label: "Relatorios", href: "/reports" },
      {
        icon: Handshake,
        label: "CRM Comercial",
        children: [
          { icon: KanbanSquare, label: "Funil de Vendas", href: "/crm-comercial" },
          { icon: BarChart3, label: "Dashboard", href: "/crm-comercial/dashboard" },
          { icon: FileText, label: "Scripts", href: "/crm-comercial/scripts" },
        ],
      },
    ],
  },
];

export function SuperAdminSidebar() {
  return <ProfileSidebar title="Admin Global" homeHref="/home" sections={sections} />;
}
