import { BookOpen, Building2, Scissors } from "lucide-react";

import type { SidebarItem } from "../shared/ProfileSidebar";

// Documentacoes internas, uma entrada por produto; compartilhado pelas sidebars
// do super_admin e do vendedor (mesmo padrao do salesCrmMenu).
export const docsMenuItem: SidebarItem = {
  icon: BookOpen,
  label: "Documentações",
  children: [
    { icon: Building2, label: "SalaOne", href: "/documentacoes/salaone" },
    { icon: Scissors, label: "BarberOne", href: "/documentacoes/barberone" },
  ],
};
