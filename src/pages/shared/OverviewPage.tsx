import { useEffect, useState } from "react";
import { Calendar, Loader2, Scissors, TrendingUp, Users, Wallet, XCircle } from "lucide-react";

import { RecentBookings } from "@/components/RecentBookings";
import { RevenueChart } from "@/components/RevenueChart";
import { StaffPerformance } from "@/components/StaffPerformance";
import { StatCard } from "@/components/StatCard";
import { fetchDashboardStats, type DashboardStats } from "@/service/dashboardService";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function StatSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-border bg-card p-5">
      <div className="mb-2 h-3 w-24 rounded bg-muted" />
      <div className="h-7 w-20 rounded bg-muted" />
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="flex h-80 animate-pulse items-center justify-center rounded-xl border border-border bg-card">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

export function OverviewPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetchDashboardStats()
      .then(setStats)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground">
        <XCircle size={32} />
        <p className="text-sm">Não foi possível carregar os dados do dashboard.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => <StatSkeleton key={i} />)
        ) : (
          <>
            <StatCard
              title="Receita do mes"
              value={formatCurrency(stats?.revenueThisMonth ?? 0)}
              icon={Wallet}
              iconBg="bg-primary/10"
            />
            <StatCard
              title="Receita recorrente"
              value={formatCurrency(stats?.monthlyRecurringRevenue ?? 0)}
              icon={TrendingUp}
              iconBg="bg-emerald-500/10"
            />
            <StatCard
              title="Agendamentos hoje"
              value={String(stats?.appointmentsToday ?? 0)}
              icon={Calendar}
              iconBg="bg-blue-500/10"
            />
            <StatCard
              title="Agendamentos no mes"
              value={String(stats?.appointmentsThisMonth ?? 0)}
              change={
                stats?.appointmentsCancelledThisMonth
                  ? `${stats.appointmentsCancelledThisMonth} cancelados`
                  : undefined
              }
              changeType="negative"
              icon={Scissors}
              iconBg="bg-primary/10"
            />
            <StatCard
              title="Clientes cadastrados"
              value={String(stats?.totalClients ?? 0)}
              change={
                stats?.newClientsThisMonth
                  ? `+${stats.newClientsThisMonth} este mes`
                  : undefined
              }
              changeType="positive"
              icon={Users}
              iconBg="bg-purple-500/10"
            />
            <StatCard
              title="Assinantes ativos"
              value={String(stats?.activeSubscriptions ?? 0)}
              icon={TrendingUp}
              iconBg="bg-emerald-500/10"
            />
          </>
        )}
      </div>

      {/* Chart + Staff */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {loading ? (
            <ChartSkeleton />
          ) : (
            <RevenueChart
              data={stats?.revenueByDay ?? []}
              totalRevenue={stats?.revenueThisMonth ?? 0}
            />
          )}
        </div>
        <div className="lg:col-span-1">
          {loading ? (
            <ChartSkeleton />
          ) : (
            <StaffPerformance staff={stats?.staff ?? []} />
          )}
        </div>
      </div>

      {/* Recent Bookings */}
      {loading ? (
        <ChartSkeleton />
      ) : (
        <RecentBookings appointments={stats?.recentAppointments ?? []} />
      )}
    </div>
  );
}
