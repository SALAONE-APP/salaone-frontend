import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "../../hooks/useAuth";

import {
  listSuperAdminSalons,
  type SuperAdminSalon,
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

const subscriptionDueLookaheadDays = 7;

interface SubscriptionDueReminder {
  id: string;
  salonName: string;
  planName: string;
  dueAt: string;
  daysUntil: number;
  isTrial: boolean;
}

function startOfLocalDay(value = new Date()) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function buildSubscriptionDueReminders(salons: SuperAdminSalon[]): SubscriptionDueReminder[] {
  const today = startOfLocalDay();

  return salons.flatMap((salon) => {
    const subscription = salon.platformSubscription;
    if (!subscription || !["active", "trialing"].includes(subscription.status)) return [];

    const isTrial = subscription.status === "trialing";
    const dueAt = isTrial
      ? subscription.trial_ends_at ?? subscription.next_billing_date
      : subscription.next_billing_date;
    if (!dueAt) return [];

    const dueDate = new Date(dueAt);
    if (Number.isNaN(dueDate.getTime())) return [];
    const daysUntil = Math.round((startOfLocalDay(dueDate).getTime() - today.getTime()) / 86400000);
    if (daysUntil < 0 || daysUntil > subscriptionDueLookaheadDays) return [];

    return [{
      id: subscription.id,
      salonName: salon.name,
      planName: subscription.platform_plans?.name ?? subscription.selected_plan ?? "Sem plano",
      dueAt,
      daysUntil,
      isTrial,
    }];
  }).sort((a, b) => a.daysUntil - b.daysUntil || a.salonName.localeCompare(b.salonName, "pt-BR"));
}

function SubscriptionDueReminderDialog({
  open,
  onOpenChange,
  reminders,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reminders: SubscriptionDueReminder[];
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-lg">
        <DialogHeader>
          <DialogTitle>Vencimentos de planos</DialogTitle>
          <DialogDescription>
            Planos de saloes com vencimento hoje ou nos proximos {subscriptionDueLookaheadDays} dias.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[55vh] space-y-2 overflow-y-auto">
          {reminders.map((reminder) => (
            <div key={reminder.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{reminder.salonName}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {reminder.planName} · {reminder.isTrial ? "Fim do periodo gratis" : "Proxima cobranca"} · {new Date(reminder.dueAt).toLocaleDateString("pt-BR")}
                </p>
              </div>
              <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-medium ${reminder.daysUntil === 0 ? "bg-destructive/10 text-destructive" : "bg-amber-500/10 text-amber-600"}`}>
                {reminder.daysUntil === 0 ? "Hoje" : `Em ${reminder.daysUntil} dia${reminder.daysUntil > 1 ? "s" : ""}`}
              </span>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Entendi</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SuperAdminDashboardPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [salons, setSalons] = useState<SuperAdminSalon[]>([]);
  const [dueReminderOpen, setDueReminderOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const shops = await listSuperAdminSalons({ limit: 100, sortBy: "createdAt", sortOrder: "desc" });
      setSalons(Array.isArray(shops?.items) ? shops.items : []);
    } catch {
      toast.error("Nao foi possivel carregar o dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const subscriptionDueReminders = useMemo(() => buildSubscriptionDueReminders(salons), [salons]);

  useEffect(() => {
    if (loading || !user?.id || subscriptionDueReminders.length === 0) return;
    const today = new Date().toISOString().slice(0, 10);
    const signature = subscriptionDueReminders.map((item) => `${item.id}:${item.dueAt}`).join("|");
    const storageKey = `superadmin:subscription-due:${user.id}:${today}:${signature}`;
    if (sessionStorage.getItem(storageKey) !== "dismissed") setDueReminderOpen(true);
  }, [loading, subscriptionDueReminders, user?.id]);

  function handleDueReminderOpenChange(open: boolean) {
    setDueReminderOpen(open);
    if (open || !user?.id) return;
    const today = new Date().toISOString().slice(0, 10);
    const signature = subscriptionDueReminders.map((item) => `${item.id}:${item.dueAt}`).join("|");
    sessionStorage.setItem(`superadmin:subscription-due:${user.id}:${today}:${signature}`, "dismissed");
  }

  // O backend atual ainda nao expoe /super-admin/dashboard. Os indicadores
  // disponiveis sao calculados a partir da listagem global de saloes.
  const dashboard = useMemo<SuperAdminDashboard>(() => {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    return {
      totalSalons: salons.length,
      activeSalons: salons.filter((salon) => salon.status === "active").length,
      inactiveSalons: salons.filter((salon) => salon.status === "inactive").length,
      blockedSalons: salons.filter((salon) => salon.status === "blocked").length,
      pendingSalons: salons.filter((salon) => salon.status === "pending").length,
      activeSubscriptions: salons.filter(
        (salon) => salon.subscription?.status === "active" || salon.platformSubscription?.status === "active"
      ).length,
      newSalonsThisMonth: salons.filter(
        (salon) => new Date(salon.createdAt).getTime() >= startOfMonth.getTime()
      ).length,
    };
  }, [salons]);

  const subscriptionRows = useMemo(() =>
    salons.map((shop) => ({
      status: shop.subscription?.status ?? "none",
      price: shop.subscription?.subscription_plans?.price ?? null,
    })),
    [salons]
  );

  const recurringRevenue = useMemo(() =>
    subscriptionRows.reduce((t, r) => r.status === "active" ? t + Number(r.price || 0) : t, 0),
    [subscriptionRows]
  );

  const topSalons = useMemo(() =>
    [...salons].sort((a, b) => Number(b?.metrics?.appointmentsCount || 0) - Number(a?.metrics?.appointmentsCount || 0)).slice(0, 4),
    [salons]
  );

  const recentShops = useMemo(() => salons.slice(0, 5), [salons]);

  const maxAppointments = useMemo(() =>
    Math.max(...topSalons.map((s) => s?.metrics?.appointmentsCount ?? 0), 1),
    [topSalons]
  );

  const totalClients = useMemo(() =>
    salons.reduce((t, s) => t + Number(s?.metrics?.clientsCount || 0), 0),
    [salons]
  );

  const totalAppointments = useMemo(() =>
    salons.reduce((t, s) => t + Number(s?.metrics?.appointmentsCount || 0), 0),
    [salons]
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
      <SubscriptionDueReminderDialog
        open={dueReminderOpen}
        onOpenChange={handleDueReminderOpenChange}
        reminders={subscriptionDueReminders}
      />
      <section className="rounded-xl border border-primary/20 bg-primary/10 p-6">
        <h2 className="text-xl font-semibold text-foreground">Visao Geral da Plataforma</h2>
        <p className="mt-1 text-sm text-muted-foreground">Acompanhe os principais indicadores globais do sistema.</p>
      </section>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        {[
          { title: "Total de salões", value: dashboard?.totalSalons ?? 0, hint: "Base cadastrada na plataforma" },
          { title: "Ativas", value: dashboard?.activeSalons ?? 0, hint: "Salões em operacao" },
          { title: "Bloqueadas/Inativas", value: (dashboard?.blockedSalons ?? 0) + (dashboard?.inactiveSalons ?? 0), hint: "Unidades com restricao" },
          { title: "Assinaturas ativas", value: dashboard?.activeSubscriptions ?? 0, hint: "Receita recorrente ativa" },
          { title: "Novas no mes", value: dashboard?.newSalonsThisMonth ?? 0, hint: "Novos cadastros recentes" },
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
              <p className="text-xs text-muted-foreground">Resumo operacional das ultimas salões cadastradas.</p>
            </div>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">Atualizado agora</span>
          </div>
          <strong className="block text-2xl font-bold text-foreground">{fmtCurrency(recurringRevenue)}</strong>
          <p className="mb-4 text-xs text-muted-foreground">Estimativa de receita recorrente</p>

          <div className="mb-4 flex items-end gap-3" style={{ height: 80 }}>
            {topSalons.map((shop, idx) => {
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
