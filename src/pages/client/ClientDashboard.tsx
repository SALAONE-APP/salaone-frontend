import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Calendar, CreditCard, History, Loader2, Scissors, Star, Trophy } from "lucide-react";

import { BannerCarousel } from "@/components/BannerCarousel";
import { RecentBookings } from "@/components/RecentBookings";
import { StatCard } from "@/components/StatCard";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "../../hooks/useAuth";
import { listAppointments } from "@/service/appointmentService";
import type { DashboardAppointment } from "@/service/dashboardService";
import { listReviews, type CustomerReview } from "@/service/reviewService";

function formatNextAppointment(startAt: string): string {
  const date = new Date(startAt);
  if (Number.isNaN(date.getTime())) return "—";

  const today = new Date();
  const isToday =
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();

  const time = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);

  if (isToday) return `Hoje ${time}`;

  const dayMonth = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  }).format(date);

  return `${dayMonth} ${time}`;
}

function getInitials(name?: string | null) {
  return String(name || "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function renderStars(rating: number) {
  return Array.from({ length: 5 }, (_, index) => (
    <Star
      key={index}
      size={14}
      className={index < Math.round(rating) ? "fill-amber-500 text-amber-500" : "text-muted-foreground/40"}
    />
  ));
}

export function ClientDashboard() {
  const { user } = useAuth();
  const userName = user?.name?.trim() || "Usuario";

  const [appointments, setAppointments] = useState<DashboardAppointment[]>([]);
  const [reviews, setReviews] = useState<CustomerReview[]>([]);
  const [nextAppointment, setNextAppointment] = useState<string>("—");
  const [completedCount, setCompletedCount] = useState<number | string>("—");
  const [upcomingCount, setUpcomingCount] = useState<number | string>("—");
  const [topBarbersLoading, setTopBarbersLoading] = useState(true);
  const [topBarbersError, setTopBarbersError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;

    listAppointments({ clientId: user.id, limit: 50 })
      .then((res) => {
        const mapped: DashboardAppointment[] = res.items.map((a) => ({
          id: a.id,
          startAt: a.startAt,
          status: a.status,
          clientName: a.client?.name ?? "—",
          barberName: a.barber?.displayName ?? "—",
          serviceLabel: a.services[0]?.serviceName ?? "—",
          serviceCount: a.services.length,
        }));
        setAppointments(mapped);

        const now = new Date();
        const upcoming = res.items.filter(
          (a) =>
            (a.status === "scheduled" || a.status === "confirmed") &&
            new Date(a.startAt) >= now,
        );
        upcoming.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());

        setNextAppointment(
          upcoming.length > 0 ? formatNextAppointment(upcoming[0]!.startAt) : "Nenhum",
        );
        setUpcomingCount(upcoming.length);
        setCompletedCount(res.items.filter((a) => a.status === "completed").length);
      })
      .catch(() => {
        setAppointments([]);
        setNextAppointment("—");
      });
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    setTopBarbersLoading(true);
    setTopBarbersError(null);

    listReviews({ limit: 300 })
      .then((res) => {
        setReviews(res.items);
      })
      .catch(() => {
        setReviews([]);
        setTopBarbersError("Nao foi possivel carregar o ranking de barbeiros.");
      })
      .finally(() => {
        setTopBarbersLoading(false);
      });
  }, [user?.id]);

  const topBarbers = useMemo(() => {
    const grouped = new Map<
      string,
      {
        id: string;
        name: string;
        reviewCount: number;
        ratingSum: number;
      }
    >();

    reviews.forEach((review) => {
      if (!review.barberId) return;

      const current = grouped.get(review.barberId) ?? {
        id: review.barberId,
        name: review.barberName || "Barbeiro",
        reviewCount: 0,
        ratingSum: 0,
      };

      current.name = review.barberName || current.name;
      current.reviewCount += 1;
      current.ratingSum += Number(review.rating || 0);
      grouped.set(review.barberId, current);
    });

    return Array.from(grouped.values())
      .map((barber) => ({
        ...barber,
        averageRating: barber.reviewCount ? barber.ratingSum / barber.reviewCount : 0,
      }))
      .sort((a, b) => {
        if (b.reviewCount !== a.reviewCount) return b.reviewCount - a.reviewCount;
        return b.averageRating - a.averageRating;
      })
      .slice(0, 3);
  }, [reviews]);

  const shortcuts = [
    {
      label: "Marcar horario",
      description: "Escolha servico, barbeiro e data.",
      href: "/bookings",
      icon: Calendar,
    },
    {
      label: "Ver historico",
      description: "Consulte agendamentos anteriores.",
      href: "/bookings",
      icon: History,
    },
    {
      label: "Servicos",
      description: "Veja opcoes disponiveis.",
      href: "/services",
      icon: Scissors,
    },
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-primary/20 bg-primary/10 p-6">
        <p className="mb-2 text-sm font-medium text-primary">Cliente</p>
        <h2 className="mb-2 text-2xl font-semibold text-foreground">
          Ola, {userName}
        </h2>
        <p className="max-w-3xl text-muted-foreground">
          Acompanhe seus agendamentos, historico e proximas opcoes para marcar horario.
        </p>
      </section>

      <BannerCarousel />

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Proximo horario"
          value={nextAppointment}
          change="Agendado"
          icon={Calendar}
          iconBg="bg-blue-500/10"
        />
        <StatCard
          title="Proximos agendamentos"
          value={String(upcomingCount)}
          change="Confirmados e agendados"
          icon={History}
          iconBg="bg-emerald-500/10"
        />
        <StatCard
          title="Cortes realizados"
          value={String(completedCount)}
          change="Historico"
          icon={Scissors}
          iconBg="bg-primary/10"
        />
        <StatCard
          title="Pagamentos"
          value="Ver"
          change="Historico de pagamentos"
          icon={CreditCard}
          iconBg="bg-purple-500/10"
        />
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

      <section className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border p-4">
          <div>
            <h3 className="text-base font-medium text-foreground">Top barbeiros mais avaliados</h3>
            <p className="text-sm text-muted-foreground">Ranking por quantidade de avaliacoes recebidas.</p>
          </div>
          <Trophy className="h-5 w-5 text-amber-500" />
        </div>

        {topBarbersLoading ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
            Carregando ranking...
          </div>
        ) : topBarbersError ? (
          <div className="p-6 text-sm text-destructive">{topBarbersError}</div>
        ) : topBarbers.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            <Star className="mx-auto mb-2 h-5 w-5" />
            Nenhuma avaliacao registrada ainda.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {topBarbers.map((barber, index) => (
              <div key={barber.id} className="grid gap-4 p-4 sm:grid-cols-[auto_1fr_auto] sm:items-center">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-500/10 text-sm font-semibold text-amber-600">
                  #{index + 1}
                </div>

                <div className="flex min-w-0 items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-primary/10 text-xs text-primary">
                      {getInitials(barber.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{barber.name}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <div className="flex">{renderStars(barber.averageRating)}</div>
                      <span className="text-xs text-muted-foreground">
                        {barber.averageRating.toFixed(1)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-border px-3 py-2 text-left sm:text-right">
                  <p className="text-lg font-semibold text-foreground">{barber.reviewCount}</p>
                  <p className="text-xs text-muted-foreground">
                    {barber.reviewCount === 1 ? "avaliacao" : "avaliacoes"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <RecentBookings appointments={appointments} />
    </div>
  );
}
