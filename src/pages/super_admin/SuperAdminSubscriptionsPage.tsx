import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

import {
  activatePixPlatformSubscription,
  listSuperAdminSalons,
  getPlatformPlans,
  type PlatformPlan,
  type SuperAdminSalon,
} from "@/service/superAdminService";

function fmtDate(value?: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("pt-BR");
}

function fmtCurrency(value?: number | null) {
  if (value == null) return "-";
  const n = Number(value);
  if (!Number.isFinite(n)) return "-";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function getTrialEndsAt(shop: SuperAdminSalon) {
  const subscription = shop.platformSubscription;
  if (!subscription) return null;
  if (subscription.trial_ends_at) return subscription.trial_ends_at;

  const trialDays = Number(subscription.platform_plans?.trial_period_days ?? 0);
  const startedAt = subscription.start_date ?? subscription.created_at;
  const start = new Date(startedAt);
  if (subscription.status !== "trialing" || trialDays <= 0 || Number.isNaN(start.getTime())) return null;

  start.setDate(start.getDate() + trialDays);
  return start.toISOString();
}

export function SuperAdminSubscriptionsPage() {
  const [salons, setSalons] = useState<SuperAdminSalon[]>([]);
  const [plans, setPlans] = useState<PlatformPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [pixModal, setPixModal] = useState({
    open: false,
    salonId: "",
    salonName: "",
    platformPlanId: "",
    paidAt: new Date().toISOString().slice(0, 10),
    nextBillingDate: "",
    amount: "",
    isSubmitting: false,
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [plansData] = await Promise.all([
        getPlatformPlans(),
      ]);
      const activePlans = plansData.filter((plan) => plan.active !== false);
      setPlans(activePlans);

      const all: SuperAdminSalon[] = [];
      let page = 1;
      while (true) {
        const result = await listSuperAdminSalons({ limit: 100, page, sortBy: "name", sortOrder: "asc" });
        const items = Array.isArray(result?.items) ? result.items : [];
        all.push(...items);
        if (all.length >= (result?.total ?? 0) || items.length < 100) break;
        page++;
      }
      setSalons(all);
    } catch { toast.error("Nao foi possivel carregar as assinaturas."); } finally { setLoading(false); }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const openPixModal = (shop: SuperAdminSalon) => {
    const currentPlanId = shop.platformSubscription?.platform_plans?.id ?? plans[0]?.id ?? "";
    const selectedPlan = plans.find((plan) => plan.id === currentPlanId) ?? plans[0];
    setPixModal({
      open: true,
      salonId: shop.id,
      salonName: shop.name,
      platformPlanId: currentPlanId,
      paidAt: new Date().toISOString().slice(0, 10),
      nextBillingDate: "",
      amount: selectedPlan?.price != null ? String(Number(selectedPlan.price)) : "",
      isSubmitting: false,
    });
  };

  const closePixModal = () => {
    setPixModal((prev) => ({ ...prev, open: false, isSubmitting: false }));
  };

  const handlePixPlanChange = (platformPlanId: string) => {
    const selectedPlan = plans.find((plan) => plan.id === platformPlanId);
    setPixModal((prev) => ({
      ...prev,
      platformPlanId,
      amount: selectedPlan?.price != null ? String(Number(selectedPlan.price)) : prev.amount,
    }));
  };

  const submitPixActivation = async () => {
    if (!pixModal.platformPlanId) {
      toast.error("Selecione um plano para liberar a assinatura.");
      return;
    }

    const amount = pixModal.amount.trim() ? Number(pixModal.amount.replace(",", ".")) : undefined;
    if (amount !== undefined && !Number.isFinite(amount)) {
      toast.error("Informe um valor valido.");
      return;
    }

    setPixModal((prev) => ({ ...prev, isSubmitting: true }));
    try {
      await activatePixPlatformSubscription(pixModal.salonId, {
        platformPlanId: pixModal.platformPlanId,
        paidAt: pixModal.paidAt || undefined,
        nextBillingDate: pixModal.nextBillingDate || undefined,
        amount,
      });
      toast.success("Assinatura PIX liberada e salão ativada.");
      closePixModal();
      await loadData();
    } catch {
      toast.error("Nao foi possivel liberar a assinatura PIX.");
      setPixModal((prev) => ({ ...prev, isSubmitting: false }));
    }
  };

  const rows = useMemo(() =>
    salons.map((shop) => {
      const trialEndsAt = getTrialEndsAt(shop);
      return {
        id: shop.id,
        name: shop.name,
        shop,
        plan: shop.platformSubscription?.platform_plans?.name ?? shop.platformSubscription?.selected_plan ?? "Sem plano",
        status: shop.platformSubscription?.status ?? "none",
        paymentMethod: shop.platformSubscription?.payment_method ?? "-",
        trialEndsAt,
        nextBillingAt: shop.platformSubscription?.next_billing_date
          ?? (shop.platformSubscription?.status === "trialing" ? trialEndsAt : null),
        price: shop.platformSubscription?.amount ?? shop.platformSubscription?.platform_plans?.price ?? null,
      };
    }),
    [salons]
  );

  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const first = new Date(year, month, 1);
    const gridStart = new Date(year, month, 1 - first.getDay());
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + index);
      const events = rows.filter((row) => {
        if (!row.nextBillingAt) return false;
        const due = new Date(row.nextBillingAt);
        return due.getFullYear() === date.getFullYear() && due.getMonth() === date.getMonth() && due.getDate() === date.getDate();
      });
      return { date, events, currentMonth: date.getMonth() === month };
    });
  }, [calendarMonth, rows]);

  const monthLabel = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(calendarMonth);
  const todayKey = new Date().toDateString();

  function changeMonth(offset: number) {
    setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-foreground">Gestao de Assinaturas</h3>
        <p className="text-sm text-muted-foreground">Visualize o resumo de planos e situacao atual das assinaturas.</p>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            <div>
              <h4 className="font-medium capitalize text-foreground">{monthLabel}</h4>
              <p className="text-xs text-muted-foreground">Vencimentos das assinaturas dos saloes</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => changeMonth(-1)} aria-label="Mes anterior"><ChevronLeft className="h-4 w-4" /></Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setCalendarMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}>Hoje</Button>
            <Button type="button" variant="outline" size="sm" onClick={() => changeMonth(1)} aria-label="Proximo mes"><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
        <div className="grid grid-cols-7 border-b border-border bg-secondary/30 text-center text-xs font-medium uppercase text-muted-foreground">
          {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"].map((day) => <div key={day} className="p-2">{day}</div>)}
        </div>
        {loading ? <div className="flex h-64 items-center justify-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Carregando vencimentos...</div> : (
          <div className="grid grid-cols-7">
            {calendarDays.map(({ date, events, currentMonth }) => (
              <div key={date.toISOString()} className={`min-h-24 border-b border-r border-border p-1.5 sm:min-h-28 ${currentMonth ? "bg-card" : "bg-secondary/20"}`}>
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${date.toDateString() === todayKey ? "bg-primary font-semibold text-primary-foreground" : currentMonth ? "text-foreground" : "text-muted-foreground/50"}`}>{date.getDate()}</span>
                <div className="mt-1 space-y-1">
                  {events.slice(0, 3).map((event) => (
                    <div key={event.id} title={`${event.name} - ${event.plan} - ${fmtCurrency(event.price)}`} className={`truncate rounded px-1.5 py-1 text-[10px] font-medium sm:text-xs ${event.status === "active" ? "bg-emerald-500/10 text-emerald-700" : event.status === "past_due" ? "bg-amber-500/15 text-amber-700" : "bg-destructive/10 text-destructive"}`}>
                      {event.name}
                    </div>
                  ))}
                  {events.length > 3 ? <p className="px-1 text-[10px] text-muted-foreground">+{events.length - 3} vencimento(s)</p> : null}
                </div>
              </div>
            ))}
          </div>
        )}
        {!loading && rows.every((row) => !row.nextBillingAt) ? <p className="border-t border-border p-4 text-center text-sm text-muted-foreground">Nenhum salao possui data de vencimento cadastrada.</p> : null}
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <th className="px-5 py-3">Salão</th>
                <th className="px-5 py-3">Plano</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Pagamento</th>
                <th className="px-5 py-3">Fim do periodo gratis</th>
                <th className="px-5 py-3">Proxima cobranca</th>
                <th className="px-5 py-3">Valor</th>
                <th className="px-5 py-3">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">
                  <Loader2 className="mx-auto mb-2 animate-spin" size={20} />Carregando...
                </td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={8} className="p-8 text-center text-sm text-muted-foreground">Nenhuma assinatura encontrada.</td></tr>
              ) : rows.map((row) => (
                <tr key={row.id} className="border-b border-border last:border-0 hover:bg-secondary/30">
                  <td className="px-5 py-3 font-medium text-foreground">{row.name}</td>
                  <td className="px-5 py-3 text-foreground">{row.plan}</td>
                  <td className="px-5 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      row.status === "active" ? "bg-emerald-500/10 text-emerald-600"
                      : row.status === "trialing" ? "bg-blue-500/10 text-blue-600"
                      : row.status === "past_due" ? "bg-amber-500/10 text-amber-600"
                      : row.status === "none" ? "bg-secondary text-muted-foreground"
                      : "bg-destructive/10 text-destructive"
                    }`}>
                      {row.status === "active" ? "Ativa"
                        : row.status === "trialing" ? "Teste"
                        : row.status === "past_due" ? "Pagamento pendente"
                        : row.status === "pending" ? "Pendente"
                        : row.status === "none" ? "Sem assinatura"
                        : row.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">{row.paymentMethod === "pix" ? "PIX" : row.paymentMethod}</td>
                  <td className="px-5 py-3 text-muted-foreground">{fmtDate(row.trialEndsAt)}</td>
                  <td className="px-5 py-3 text-muted-foreground">{fmtDate(row.nextBillingAt)}</td>
                  <td className="px-5 py-3 font-medium text-foreground">{fmtCurrency(row.price)}</td>
                  <td className="px-5 py-3">
                    <button
                      type="button"
                      onClick={() => openPixModal(row.shop)}
                      disabled={plans.length === 0}
                      className="rounded bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-600 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Liberar PIX
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {pixModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={closePixModal}>
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-foreground">Liberar assinatura PIX</h3>
                <p className="text-sm text-muted-foreground">{pixModal.salonName}</p>
              </div>
              <button type="button" onClick={closePixModal} className="rounded border border-border px-3 py-1 text-sm text-muted-foreground hover:bg-secondary">Fechar</button>
            </div>

            <div className="space-y-3">
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">Plano</span>
                <select
                  value={pixModal.platformPlanId}
                  onChange={(e) => handlePixPlanChange(e.target.value)}
                  className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  {plans.map((plan) => (
                    <option key={plan.id} value={plan.id}>{plan.name} - {fmtCurrency(plan.price)}</option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">Data do pagamento</span>
                <input
                  type="date"
                  value={pixModal.paidAt}
                  onChange={(e) => setPixModal((prev) => ({ ...prev, paidAt: e.target.value }))}
                  className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">Proxima cobranca (opcional)</span>
                <input
                  type="date"
                  value={pixModal.nextBillingDate}
                  onChange={(e) => setPixModal((prev) => ({ ...prev, nextBillingDate: e.target.value }))}
                  className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">Valor pago</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={pixModal.amount}
                  onChange={(e) => setPixModal((prev) => ({ ...prev, amount: e.target.value }))}
                  placeholder="Ex.: 99.90"
                  className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={closePixModal} className="rounded border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-secondary">Cancelar</button>
              <button
                type="button"
                onClick={() => void submitPixActivation()}
                disabled={pixModal.isSubmitting}
                className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {pixModal.isSubmitting ? "Liberando..." : "Confirmar pagamento"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
