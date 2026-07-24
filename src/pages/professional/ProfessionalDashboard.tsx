import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Calendar, Clock, Loader2, Scissors, Users, Wallet } from "lucide-react";
import { toast } from "sonner";

import { StatCard } from "@/components/StatCard";
import { Badge } from "@/components/ui/badge";
import { listAppointments, type Appointment } from "@/service/appointmentService";
import { useMyProfessional } from "@/hooks/useMyProfessional";
import { useAuth } from "../../hooks/useAuth";

function dateToDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getWeekRange(): { start: string; end: string } {
  const today = new Date();
  const day = today.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(today);
  monday.setDate(today.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { start: dateToDateString(monday), end: dateToDateString(sunday) };
}

function formatTime(isoString: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(isoString));
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

type AppointmentStatus = Appointment["status"];

const statusLabels: Record<AppointmentStatus, string> = {
  scheduled: "Agendado",
  confirmed: "Confirmado",
  in_service: "Em andamento",
  completed: "Finalizado",
  cancelled: "Cancelado",
  no_show: "Nao compareceu",
};

const statusStyles: Record<AppointmentStatus, string> = {
  scheduled: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  confirmed: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  in_service: "bg-violet-500/10 text-violet-600 border-violet-500/20",
  completed: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  cancelled: "bg-red-500/10 text-red-600 border-red-500/20",
  no_show: "bg-gray-500/10 text-gray-500 border-gray-500/20",
};

const shortcuts = [
  {
    label: "Abrir agenda",
    description: "Organize os horarios do dia.",
    href: "/schedules",
    icon: Calendar,
  },
  {
    label: "Clientes",
    description: "Acesse fichas e contatos.",
    href: "/customers",
    icon: Users,
  },
  {
    label: "Servicos",
    description: "Consulte servicos vinculados.",
    href: "/services",
    icon: Scissors,
  },
];

export function ProfessionalDashboard() {
  const { user } = useAuth();
  const { professional, loading: professionalLoading } = useMyProfessional();
  const [todayAppointments, setTodayAppointments] = useState<Appointment[]>([]);
  const [weekAppointments, setWeekAppointments] = useState<Appointment[]>([]);
  const [dataLoading, setDataLoading] = useState(false);

  const loadData = useCallback(async (professionalId: string) => {
    const today = dateToDateString(new Date());
    const week = getWeekRange();
    setDataLoading(true);
    try {
      const [todayResult, weekResult] = await Promise.all([
        listAppointments({ professionalId, dateFrom: today, dateTo: today, allAppointments: true, limit: 100 }),
        listAppointments({ professionalId, dateFrom: week.start, dateTo: week.end, allAppointments: true, limit: 100 }),
      ]);
      setTodayAppointments(todayResult.items);
      setWeekAppointments(weekResult.items);
    } catch {
      toast.error("Erro ao carregar dados da agenda.");
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    if (professional?.id) {
      void loadData(professional.id);
    }
  }, [professional, loadData]);

  const stats = useMemo(() => {
    const activeToday = todayAppointments.filter(
      (a) => a.status !== "cancelled" && a.status !== "no_show",
    );
    const completedToday = todayAppointments.filter((a) => a.status === "completed");
    const completedWeek = weekAppointments.filter((a) => a.status === "completed");
    const totalServicesWeek = completedWeek.reduce((sum, a) => sum + a.services.length, 0);
    const earningsWeek = completedWeek.reduce((sum, a) => sum + (a.totalAmount ?? 0), 0);

    return {
      agendaHoje: activeToday.length,
      clientesHoje: completedToday.length,
      servicosSemana: totalServicesWeek,
      ganhosSemana: earningsWeek,
    };
  }, [todayAppointments, weekAppointments]);

  const nextAppointments = useMemo(() => {
    const now = new Date();
    return todayAppointments
      .filter((a) => a.status !== "cancelled" && a.status !== "no_show")
      .filter((a) => new Date(a.endAt) > now)
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
      .slice(0, 5);
  }, [todayAppointments]);

  const isLoading = professionalLoading || dataLoading;
  const displayName = professional?.displayName || user?.name?.trim() || "Usuario";

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-primary/20 bg-primary/10 p-6">
        <p className="mb-2 text-sm font-medium text-primary">Profissional</p>
        <h2 className="mb-2 text-2xl font-semibold text-foreground">
          Agenda de hoje, {displayName}
        </h2>
        <p className="max-w-3xl text-muted-foreground">
          Veja seus horarios, clientes atendidos, servicos e ganhos do periodo.
        </p>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading ? (
          <div className="col-span-4 flex items-center justify-center py-8">
            <Loader2 size={24} className="animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <StatCard
              title="Agenda do dia"
              value={`${stats.agendaHoje} atend.`}
              change="Hoje"
              icon={Calendar}
              iconBg="bg-blue-500/10"
            />
            <StatCard
              title="Clientes atendidos"
              value={String(stats.clientesHoje)}
              change="Hoje"
              icon={Users}
              iconBg="bg-emerald-500/10"
            />
            <StatCard
              title="Servicos feitos"
              value={String(stats.servicosSemana)}
              change="Esta semana"
              icon={Scissors}
              iconBg="bg-primary/10"
            />
            <StatCard
              title="Ganhos"
              value={formatCurrency(stats.ganhosSemana)}
              change="Esta semana"
              icon={Wallet}
              iconBg="bg-amber-500/10"
            />
          </>
        )}
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
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
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-4 text-base font-semibold text-foreground">Proximos atendimentos</h3>
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 size={18} className="animate-spin text-muted-foreground" />
          </div>
        ) : nextAppointments.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Nenhum atendimento pendente para hoje.
          </p>
        ) : (
          <div className="space-y-3">
            {nextAppointments.map((appt) => {
              const serviceNames =
                appt.services.map((s) => s.serviceName).join(", ") || "Sem servico";
              const clientName =
                appt.dependent?.name || appt.client?.name || "Cliente";
              return (
                <div
                  key={appt.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-background px-4 py-3"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5 text-sm">
                      <Clock size={14} className="text-muted-foreground" />
                      <span className="font-semibold text-foreground">
                        {formatTime(appt.startAt)}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{clientName}</p>
                      <p className="text-xs text-muted-foreground">{serviceNames}</p>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={`rounded-full px-2 py-0.5 text-xs ${statusStyles[appt.status]}`}
                  >
                    {statusLabels[appt.status]}
                  </Badge>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
