import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Calendar, CreditCard, Scissors, UserCheck, Zap } from "lucide-react";

import { StatCard } from "@/components/StatCard";
import { useAuth } from "../../hooks/useAuth";
import { listAppointments } from "@/service/appointmentService";
import { listAllPayments } from "@/service/paymentService";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

const shortcuts = [
  {
    label: "Novo agendamento",
    description: "Agende um horario para o cliente.",
    href: "/bookings",
    icon: Calendar,
  },
  {
    label: "Agenda",
    description: "Gerencie horarios livres e agendamentos.",
    href: "/encaixe",
    icon: Zap,
  },
  {
    label: "Confirmar pagamentos",
    description: "Pagamentos pendentes de confirmacao.",
    href: "/payments",
    icon: CreditCard,
  },
  {
    label: "Clientes",
    description: "Consulte o cadastro de clientes.",
    href: "/customers",
    icon: UserCheck,
  },
  {
    label: "Servicos",
    description: "Veja os servicos disponiveis.",
    href: "/services",
    icon: Scissors,
  },
];

export function ReceptionistDashboard() {
  const { user } = useAuth();
  const userName = user?.name?.trim() || "Recepcionista";

  const today = new Date().toISOString().slice(0, 10);

  const [todayCount, setTodayCount] = useState<number | string>("—");
  const [confirmedCount, setConfirmedCount] = useState<number | string>("—");
  const [pendingPayments, setPendingPayments] = useState<number | string>("—");
  const [pendingValue, setPendingValue] = useState<string>("—");

  useEffect(() => {
    listAppointments({ limit: 100 })
      .then((res) => {
        const todayItems = res.items.filter(
          (a) => new Date(a.startAt).toISOString().slice(0, 10) === today,
        );
        setTodayCount(todayItems.length);
        setConfirmedCount(
          todayItems.filter((a) => a.status === "confirmed").length,
        );
      })
      .catch(() => {
        setTodayCount("—");
        setConfirmedCount("—");
      });

    listAllPayments({ status: "pending", limit: 100 })
      .then((res) => {
        setPendingPayments(res.total);
        const total = res.items.reduce((sum, p) => sum + p.amount, 0);
        setPendingValue(formatCurrency(total));
      })
      .catch(() => {
        setPendingPayments("—");
        setPendingValue("—");
      });
  }, [today]);

  return (
    <div className="space-y-6">
      {/* Boas-vindas */}
      <section className="rounded-xl border border-primary/20 bg-primary/10 p-6">
        <p className="mb-2 text-sm font-medium text-primary">Recepcionista</p>
        <h2 className="mb-2 text-2xl font-semibold text-foreground">
          Bem-vindo, {userName}
        </h2>
        <p className="max-w-3xl text-muted-foreground">
          Gerencie agendamentos, clientes e pagamentos da salão.
        </p>
      </section>

      {/* Estatísticas do dia */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Agendamentos hoje"
          value={String(todayCount)}
          change="Total do dia"
          icon={Calendar}
          iconBg="bg-blue-500/10"
        />
        <StatCard
          title="Confirmados hoje"
          value={String(confirmedCount)}
          change="Status confirmado"
          icon={Calendar}
          iconBg="bg-emerald-500/10"
        />
        <StatCard
          title="Pagamentos pendentes"
          value={String(pendingPayments)}
          change="Aguardando confirmacao"
          icon={CreditCard}
          iconBg="bg-amber-500/10"
        />
        <StatCard
          title="Valor pendente"
          value={pendingValue}
          change="A receber"
          icon={CreditCard}
          iconBg="bg-purple-500/10"
        />
      </section>

      {/* Atalhos */}
      <section>
        <h3 className="mb-4 text-base font-semibold text-foreground">Acesso rapido</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shortcuts.map((shortcut) => (
            <Link
              key={shortcut.label}
              to={shortcut.href}
              className="group rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/60"
            >
              <div className="mb-4 flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <shortcut.icon size={20} />
                </div>
                <ArrowRight
                  size={18}
                  className="text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary"
                />
              </div>
              <h3 className="text-base font-semibold text-foreground">{shortcut.label}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{shortcut.description}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
