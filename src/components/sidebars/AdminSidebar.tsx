import {
  BarChart3,
  Calendar,
  Boxes,
  CircleDollarSign,
  CreditCard,
  ClipboardPlus,
  HandCoins,
  Image,
  Package,
  PlusCircle,
  Scissors,
  Settings,
  Star,
  UserCog,
  Users,
  Zap,
} from "lucide-react";

import { ProfileSidebar } from "../shared/ProfileSidebar";
import type { SidebarSection } from "../shared/ProfileSidebar";

function buildSections(): SidebarSection[] {
  return [
    {
      items: [
        { icon: BarChart3, label: "Dashboard", href: "/overview" },
      ],
    },
    {
      items: [
        {
          icon: Calendar,
          label: "Operacao",
          children: [
            { icon: Calendar, label: "Agendamentos", href: "/bookings" },
            { icon: Zap, label: "Agenda", href: "/encaixe" },
            { icon: Calendar, label: "Calendario", href: "/schedules" },
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
            { icon: CreditCard, label: "Pagamentos", href: "/payments" },
            { icon: CircleDollarSign, label: "Fechamento de caixa", href: "/cash-closing" },
            { icon: HandCoins, label: "Pagamento Funcionario", href: "/employee-payroll" },
            { icon: PlusCircle, label: "Pagamentos Extras", href: "/extra-payments" },
          ],
        },
      ],
    },
    {
      items: [
        {
          icon: Scissors,
          label: "Gerenciar",
          children: [
            { icon: Scissors, label: "Servicos", href: "/services" },
            { icon: Package, label: "Produtos", href: "/products" },
            { icon: Boxes, label: "Estoque", href: "/stock" },
            { icon: Image, label: "Galeria", href: "/gallery" },
          ],
        },
      ],
    },
    {
      items: [
        {
          icon: Star,
          label: "Relacionamento",
          children: [
            { icon: Star, label: "Avaliacoes", href: "/reviews" },
          ],
        },
      ],
    },
    {
      items: [
        {
          icon: UserCog,
          label: "Administracao",
          children: [
            { icon: UserCog, label: "Funcionarios", href: "/users" },
            { icon: Users, label: "Clientes", href: "/customers" },
            { icon: ClipboardPlus, label: "Prontuário", href: "/client-records" },
            { icon: Settings, label: "Configuracoes", href: "/settings" },
          ],
        },
      ],
    },
  ];
}

export function AdminSidebar() {
  return <ProfileSidebar title="Painel da Salão" homeHref="/home" sections={buildSections()} />;
}
