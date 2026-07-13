import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  listSuperAdminBarbershops,
  getSuperAdminDashboard,
  type SuperAdminBarbershop,
  type SuperAdminDashboard,
} from "@/service/superAdminService";

function fmtCurrency(value?: number | null) {
  if (value == null) return "-";
  const n = Number(value);
  if (!Number.isFinite(n)) return "-";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    active: "Ativa", inactive: "Inativa", blocked: "Bloqueada", pending: "Pendente",
  };
  return map[String(status || "").toLowerCase()] || String(status || "-");
}

function StatusBadge({ status }: { status: string }) {
  const cls: Record<string, string> = {
    active: "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20",
    inactive: "bg-secondary text-muted-foreground border border-border",
    blocked: "bg-destructive/10 text-destructive border border-destructive/20",
    pending: "bg-amber-500/10 text-amber-600 border border-amber-500/20",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls[status] ?? "bg-secondary text-muted-foreground border border-border"}`}>
      {statusLabel(status)}
    </span>
  );
}

export function SuperAdminDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState<SuperAdminDashboard | null>(null);
  const [barbershops, setBarbershops] = useState<SuperAdminBarbershop[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dash, shops] = await Promise.all([
        getSuperAdminDashboard(),
        listSuperAdminBarbershops({ limit: 100, sortBy: "createdAt", sortOrder: "desc" }),
      ]);
      setDashboard(dash);
      setBarbershops(Array.isArray(shops?.items) ? shops.items : []);
    } catch {
      toast.error("Nao foi possivel carregar o dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const subscriptionRows = useMemo(() =>
    barbershops.map((shop) => ({
      status: shop.subscription?.status ?? "none",
      price: shop.subscription?.subscription_plans?.price ?? null,
    })),
    [barbershops]
  );

  const recurringRevenue = useMemo(() =>
    subscriptionRows.reduce((t, r) => r.status === "active" ? t + Number(r.price || 0) : t, 0),
    [subscriptionRows]
  );

  const topBarbershops = useMemo(() =>
    [...barbershops].sort((a, b) => Number(b?.metrics?.appointmentsCount || 0) - Number(a?.metrics?.appointmentsCount || 0)).slice(0, 4),
    [barbershops]
  );

  const recentShops = useMemo(() => barbershops.slice(0, 5), [barbershops]);

  const maxAppointments = useMemo(() =>
    Math.max(...topBarbershops.map((s) => s?.metrics?.appointmentsCount ?? 0), 1),
    [topBarbershops]
  );

  const totalClients = useMemo(() =>
    barbershops.reduce((t, s) => t + Number(s?.metrics?.clientsCount || 0), 0),
    [barbershops]
  );

  const totalAppointments = useMemo(() =>
    barbershops.reduce((t, s) => t + Number(s?.metrics?.appointmentsCount || 0), 0),
    [barbershops]
  );

  const trafficBreakdown = useMemo(() => {
    const tot = Math.max(totalAppointments + totalClients, 1);
    const direct = Math.round((totalClients / tot) * 100);
    const traffic = Math.max(0, 100 - direct);
    const outbound = Math.max(0, 100 - direct - traffic);
    return [
      { label: "Clientes diretos", value: direct, color: "hsl(var(--primary))" },
      { label: "Agendamentos", value: traffic, color: "#7c3aed" },
      { label: "Assinaturas", value: outbound, color: "#3b82f6" },
    ];
  }, [totalClients, totalAppointments]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-muted-foreground" size={24} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-primary/20 bg-primary/10 p-6">
        <h2 className="text-xl font-semibold text-foreground">Visao Geral da Plataforma</h2>
        <p className="mt-1 text-sm text-muted-foreground">Acompanhe os principais indicadores globais do sistema.</p>
      </section>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        {[
          { title: "Total de barbearias", value: dashboard?.totalBarbershops ?? 0, hint: "Base cadastrada na plataforma" },
          { title: "Ativas", value: dashboard?.activeBarbershops ?? 0, hint: "Barbearias em operacao" },
          { title: "Bloqueadas/Inativas", value: (dashboard?.blockedBarbershops ?? 0) + (dashboard?.inactiveBarbershops ?? 0), hint: "Unidades com restricao" },
          { title: "Assinaturas ativas", value: dashboard?.activeSubscriptions ?? 0, hint: "Receita recorrente ativa" },
          { title: "Novas no mes", value: dashboard?.newBarbershopsThisMonth ?? 0, hint: "Novos cadastros recentes" },
        ].map((card) => (
          <div key={card.title} className="rounded-xl border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground">{card.title}</p>
            <strong className="block text-2xl font-bold text-foreground">{card.value}</strong>
            <small className="text-xs text-muted-foreground">{card.hint}</small>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="col-span-2 rounded-xl border border-border bg-card p-5">
          <div className="mb-3 flex items-start justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Receita e atividade</h3>
              <p className="text-xs text-muted-foreground">Resumo operacional das ultimas barbearias cadastradas.</p>
            </div>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">Atualizado agora</span>
          </div>
          <strong className="block text-2xl font-bold text-foreground">{fmtCurrency(recurringRevenue)}</strong>
          <p className="mb-4 text-xs text-muted-foreground">Estimativa de receita recorrente</p>

          <div className="mb-4 flex items-end gap-3" style={{ height: 80 }}>
            {topBarbershops.map((shop, idx) => {
              const h = Math.max(12, Math.round(((shop?.metrics?.appointmentsCount ?? 0) / maxAppointments) * 72));
              return (
                <div key={shop.id} className="flex flex-1 flex-col items-center gap-1">
                  <div className="w-full rounded-t bg-primary" style={{ height: h, opacity: 0.5 + idx * 0.15 }}
                    title={`${shop.name}: ${shop.metrics?.appointmentsCount ?? 0} ag.`} />
                  <p className="max-w-full truncate text-center text-xs text-muted-foreground">{shop.name.split(" ")[0]}</p>
                </div>
              );
            })}
          </div>

          <div className="divide-y divide-border">
            {recentShops.map((shop) => (
              <div key={shop.id} className="flex items-center justify-between py-2">
                <strong className="text-sm font-medium text-foreground">{shop.name}</strong>
                <StatusBadge status={shop.status} />
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="mb-1 text-sm font-semibold text-foreground">Distribuicao</h3>
          <p className="mb-4 text-xs text-muted-foreground">Visao rapida do trafego do painel.</p>

          <div className="mb-5 flex justify-center">
            <div
              className="relative flex h-32 w-32 items-center justify-center rounded-full"
              style={{
                background: `conic-gradient(${trafficBreakdown[0].color} 0% ${trafficBreakdown[0].value}%, ${trafficBreakdown[1].color} ${trafficBreakdown[0].value}% ${trafficBreakdown[0].value + trafficBreakdown[1].value}%, ${trafficBreakdown[2].color} ${trafficBreakdown[0].value + trafficBreakdown[1].value}% 100%)`,
              }}
            >
              <div className="absolute inset-[28%] flex flex-col items-center justify-center rounded-full bg-card">
                <strong className="text-lg font-bold leading-none text-foreground">{trafficBreakdown[0].value}%</strong>
                <span className="text-[10px] text-muted-foreground">Clientes</span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            {trafficBreakdown.map((item) => (
              <div key={item.label} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-muted-foreground">{item.label}</span>
                </div>
                <strong className="text-foreground">{item.value}%</strong>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
