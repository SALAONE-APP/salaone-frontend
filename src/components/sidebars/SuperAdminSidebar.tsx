import {
  BarChart3,
  Building2,
  ContactRound,
  CreditCard,
  FileText,
  Handshake,
  LayoutDashboard,
  Megaphone,
  MessageSquareMore,
  Users,
} from "lucide-react";

import { salesCrmProductItems } from "./salesCrmMenu";
import { ProfileSidebar } from "../shared/ProfileSidebar";
import type { SidebarSection } from "../shared/ProfileSidebar";

const sections: SidebarSection[] = [
  {
    items: [
      { icon: LayoutDashboard, label: "Dashboard", href: "/home" },
      { icon: Building2, label: "Salões", href: "/salons" },
      { icon: Users, label: "Usuarios", href: "/users" },
      { icon: CreditCard, label: "Assinaturas", href: "/subscriptions" },
      { icon: CreditCard, label: "Cobranças pendentes", href: "/pending-charges" },
      { icon: FileText, label: "Planos Landing", href: "/platform-plans" },
      { icon: MessageSquareMore, label: "AresChat", href: "/areschat" },
      { icon: ContactRound, label: "Contatos interessados", href: "/landing-leads" },
      { icon: Megaphone, label: "Novas Funcionalidades", href: "/feature-updates" },
      { icon: BarChart3, label: "Relatorios", href: "/reports" },
      {
        icon: Handshake,
        label: "CRM Comercial",
        children: salesCrmProductItems,
      },
    ],
  },
];

export function SuperAdminSidebar() {
  return <ProfileSidebar title="Admin Global" homeHref="/home" sections={sections} />;
}
