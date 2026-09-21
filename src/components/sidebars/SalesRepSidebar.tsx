import { BarChart3, FileText, KanbanSquare } from "lucide-react";

import { ProfileSidebar } from "../shared/ProfileSidebar";
import type { SidebarSection } from "../shared/ProfileSidebar";

const sections: SidebarSection[] = [
  {
    items: [
      { icon: KanbanSquare, label: "Funil de Vendas", href: "/crm-comercial" },
      { icon: BarChart3, label: "Dashboard", href: "/crm-comercial/dashboard" },
      { icon: FileText, label: "Scripts", href: "/crm-comercial/scripts" },
    ],
  },
];

export function SalesRepSidebar() {
  return <ProfileSidebar title="CRM Comercial" homeHref="/crm-comercial" sections={sections} />;
}
