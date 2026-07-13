import { Calendar, Home, LayoutList, Scissors, Settings, Star } from "lucide-react";

import { ProfileSidebar } from "../shared/ProfileSidebar";
import type { SidebarSection } from "../shared/ProfileSidebar";

const sections: SidebarSection[] = [
  { items: [{ icon: Home, label: "Home", href: "/home" }] },
  {
    items: [
      {
        icon: Calendar,
        label: "Operacao",
        children: [
          { icon: Calendar, label: "Agendamentos", href: "/bookings" },
          { icon: Star, label: "Avaliacoes", href: "/reviews" },
        ],
      },
    ],
  },
  {
    items: [
      {
        icon: Scissors,
        label: "Catalogo",
        children: [
          { icon: Scissors, label: "Servicos", href: "/services" },
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

export function ClientSidebar() {
  return <ProfileSidebar title="Area do Cliente" homeHref="/home" sections={sections} />;
}
