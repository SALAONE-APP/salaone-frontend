import { BarChart3, Building2, FileText, KanbanSquare, Scissors } from "lucide-react";

import type { SidebarItem } from "../shared/ProfileSidebar";

function productGroup(label: string, product: string, icon: SidebarItem["icon"]): SidebarItem {
  const base = `/crm-comercial/${product}`;
  return {
    icon,
    label,
    children: [
      { icon: KanbanSquare, label: "Funil de Vendas", href: base },
      { icon: BarChart3, label: "Dashboard", href: `${base}/dashboard` },
      { icon: FileText, label: "Scripts", href: `${base}/scripts` },
    ],
  };
}

// Um grupo por produto vendido; compartilhado pelas sidebars do super_admin e do vendedor.
export const salesCrmProductItems: SidebarItem[] = [
  productGroup("SalaOne", "salaone", Building2),
  productGroup("BarberOne", "barberone", Scissors),
];
