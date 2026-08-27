import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarDays, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
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
  const d = parseDate(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("pt-BR");
}

// Datas sem horario representam um dia do calendario, nao um instante UTC.
// Interpretar "2026-09-18" com new Date() desloca a exibicao para 17/09 no Brasil.
function parseDate(value: string) {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (dateOnly) return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
  return new Date(value);
}

function startOfToday() {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), today.getDate());
}

function fmtCurrency(value?: number | null) {
  if (value == null) return "-";
  const n = Number(value);
  if (!Number.isFinite(n)) return "-";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function getPaymentStatus(status: CalendarSubscriptionEvent["billingStatus"], dueAt: string) {
  if (status === "paid") return { label: "Pago", className: "bg-emerald-500/10 text-emerald-700" };
  const dueDate = parseDate(dueAt);
  if (dueDate.getTime() < startOfToday().getTime()) {
    return { label: "Em atraso", className: "bg-destructive/10 text-destructive" };
  }
  return { label: "Pendente", className: "bg-amber-500/15 text-amber-700" };
}

type CalendarSubscriptionEvent = {
  id: string;
  name: string;
  plan: string;
  billingStatus: "paid" | "pending";
  paymentMethod: string;
  occursAt: string;
  price: number | null;
};

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
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<{
    date: Date;
    events: CalendarSubscriptionEvent[];
  } | null>(null);
  const [showDefaulters, setShowDefaulters] = useState(false);
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
      toast.success("Ciclo PIX renovado e salao ativado.");
      closePixModal();
      await loadData();
    } catch {
      toast.error("Nao foi possivel renovar o ciclo PIX.");
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
        startedAt: shop.platformSubscription?.start_date ?? null,
        nextBillingAt: shop.platformSubscription?.next_billing_date
          ?? (shop.platformSubscription?.status === "trialing" ? trialEndsAt : null),
        price: shop.platformSubscription?.amount ?? shop.platformSubscription?.platform_plans?.price ?? null,
      };
    }),
    [salons]
  );

  const calendarEvents = useMemo<CalendarSubscriptionEvent[]>(() => rows.flatMap((row) => {
    const events: CalendarSubscriptionEvent[] = [];
    // O inicio do ciclo ativo e a competencia que acabou de ser paga.
    if (row.status === "active" && row.startedAt) {
      events.push({ id: `${row.id}-paid-${row.startedAt}`, name: row.name, plan: row.plan, billingStatus: "paid", paymentMethod: row.paymentMethod, occursAt: row.startedAt, price: row.price });
    }
    // A proxima cobranca nunca esta paga antecipadamente apenas porque a assinatura esta ativa.
    if (row.nextBillingAt) {
      events.push({ id: `${row.id}-due-${row.nextBillingAt}`, name: row.name, plan: row.plan, billingStatus: "pending", paymentMethod: row.paymentMethod, occursAt: row.nextBillingAt, price: row.price });
    }
    return events;
  }), [rows]);

  const defaulters = useMemo(() => calendarEvents.filter((event) =>
    event.billingStatus === "pending" && parseDate(event.occursAt).getTime() < startOfToday().getTime()
  ), [calendarEvents]);

  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const first = new Date(year, month, 1);
    const gridStart = new Date(year, month, 1 - first.getDay());
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + index);
      const events = calendarEvents.filter((event) => {
        const due = parseDate(event.occursAt);
        return due.getFullYear() === date.getFullYear() && due.getMonth() === date.getMonth() && due.getDate() === date.getDate();
      });
      return { date, events, currentMonth: date.getMonth() === month };
    });
  }, [calendarMonth, calendarEvents]);

  const subscriptionSummary = useMemo(() => {
    const calendarYear = calendarMonth.getFullYear();
    const calendarMonthIndex = calendarMonth.getMonth();
    const monthEvents = calendarEvents.filter((event) => {
      const eventDate = parseDate(event.occursAt);
      return !Number.isNaN(eventDate.getTime())
        && eventDate.getFullYear() === calendarYear
        && eventDate.getMonth() === calendarMonthIndex;
    });
    const payments = monthEvents.filter((event) => event.billingStatus === "paid");

    return {
      monthReceivables: monthEvents.reduce((total, event) => total + Number(event.price || 0), 0),
      received: payments.reduce((total, event) => total + Number(event.price || 0), 0),
      monthCharges: monthEvents.length,
    };
  }, [calendarMonth, calendarEvents]);

  const monthLabel = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(calendarMonth);
  const todayKey = new Date().toDateString();

  function changeMonth(offset: number) {
    setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-foreground">Gestao de Assinaturas</h3>
        <p className="text-sm text-muted-foreground">Renove ciclos PIX manualmente e acompanhe a recorrencia automatica dos cartoes.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Recebiveis no mes</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">{fmtCurrency(subscriptionSummary.monthReceivables)}</p>
        </div>

        <button type="button" onClick={() => setShowDefaulters(true)} className="rounded-xl border border-border bg-card p-5 text-left transition-colors hover:bg-destructive/5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Inadimplentes</p>
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </div>
          <p className="mt-1 text-2xl font-semibold text-destructive">{defaulters.length}</p>
          <p className="mt-1 text-xs text-muted-foreground">Clique para visualizar</p>
        </button>

        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Recebidos no mes</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-600">{fmtCurrency(subscriptionSummary.received)}</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Cobrancas no mes</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">{subscriptionSummary.monthCharges}</p>
        </div>
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
              <button
                key={date.toISOString()}
                type="button"
                onClick={() => setSelectedCalendarDay({ date, events })}
                disabled={events.length === 0}
                className={`min-h-24 border-b border-r border-border p-1.5 text-left sm:min-h-28 ${events.length > 0 ? "cursor-pointer transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary" : "cursor-default"} ${currentMonth ? "bg-card" : "bg-secondary/20"}`}
                aria-label={events.length > 0 ? `Ver vencimentos de ${date.toLocaleDateString("pt-BR")}` : undefined}
              >
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${date.toDateString() === todayKey ? "bg-primary font-semibold text-primary-foreground" : currentMonth ? "text-foreground" : "text-muted-foreground/50"}`}>{date.getDate()}</span>
                <div className="mt-1 space-y-1">
                  {events.slice(0, 3).map((event) => (
                    <div key={event.id} title={`${event.name} - ${event.plan} - ${fmtCurrency(event.price)}`} className={`truncate rounded px-1.5 py-1 text-[10px] font-medium sm:text-xs ${getPaymentStatus(event.billingStatus, event.occursAt).className}`}>
                      {event.name}
                    </div>
                  ))}
                  {events.length > 3 ? <p className="px-1 text-[10px] text-muted-foreground">+{events.length - 3} vencimento(s)</p> : null}
                </div>
              </button>
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
                  <td className="px-5 py-3 text-muted-foreground">
                    {row.paymentMethod === "pix" ? "PIX (manual)"
                      : row.paymentMethod === "credit_card" ? "Cartao (automatico)"
                      : row.paymentMethod}
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">{fmtDate(row.trialEndsAt)}</td>
                  <td className="px-5 py-3 text-muted-foreground">{fmtDate(row.nextBillingAt)}</td>
                  <td className="px-5 py-3 font-medium text-foreground">{fmtCurrency(row.price)}</td>
                  <td className="px-5 py-3">
                    {row.paymentMethod === "credit_card" ? (
                      <span className="text-xs font-medium text-muted-foreground">Renovacao automatica</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => openPixModal(row.shop)}
                        disabled={plans.length === 0}
                        className="rounded bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-600 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Renovar ciclo PIX
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedCalendarDay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setSelectedCalendarDay(null)}>
          <div className="w-full max-w-2xl rounded-xl border border-border bg-card shadow-xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-border p-5">
              <div>
                <h3 className="text-lg font-semibold text-foreground">Mensalidades do dia</h3>
                <p className="text-sm text-muted-foreground">
                  {selectedCalendarDay.date.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
                </p>
              </div>
              <button type="button" onClick={() => setSelectedCalendarDay(null)} className="rounded border border-border px-3 py-1 text-sm text-muted-foreground hover:bg-secondary">Fechar</button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-5">
              {selectedCalendarDay.events.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma mensalidade com vencimento neste dia.</p>
              ) : (
                <div className="space-y-3">
                  {selectedCalendarDay.events.map((event) => {
                    const paymentStatus = getPaymentStatus(event.billingStatus, event.occursAt);
                    return (
                      <div key={event.id} className="rounded-lg border border-border bg-background p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="font-semibold text-foreground">{event.name}</p>
                            <p className="text-sm text-muted-foreground">{event.plan}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {event.paymentMethod === "pix" ? "Pagamento manual via PIX"
                                : event.paymentMethod === "credit_card" ? "Recorrencia automatica no cartao"
                                : "Forma de pagamento nao informada"}
                            </p>
                          </div>
                          <div className="text-left sm:text-right">
                            <p className="text-lg font-semibold text-foreground">{fmtCurrency(event.price)}</p>
                            <span className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${paymentStatus.className}`}>
                              {paymentStatus.label}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showDefaulters && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowDefaulters(false)}>
          <div className="w-full max-w-2xl rounded-xl border border-border bg-card shadow-xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-border p-5">
              <div>
                <h3 className="text-lg font-semibold text-foreground">Assinaturas inadimplentes</h3>
                <p className="text-sm text-muted-foreground">Mensalidades cujo vencimento ja passou e ainda estao pendentes.</p>
              </div>
              <button type="button" onClick={() => setShowDefaulters(false)} className="rounded border border-border px-3 py-1 text-sm text-muted-foreground hover:bg-secondary">Fechar</button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-5">
              {defaulters.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma assinatura inadimplente.</p>
              ) : (
                <div className="space-y-3">
                  {defaulters.map((event) => (
                    <div key={event.id} className="flex flex-col justify-between gap-2 rounded-lg border border-border bg-background p-4 sm:flex-row sm:items-center">
                      <div>
                        <p className="font-semibold text-foreground">{event.name}</p>
                        <p className="text-sm text-muted-foreground">{event.plan} · Vencimento em {fmtDate(event.occursAt)}</p>
                      </div>
                      <div className="sm:text-right">
                        <p className="font-semibold text-foreground">{fmtCurrency(event.price)}</p>
                        <span className="text-xs font-medium text-destructive">Em atraso</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {pixModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={closePixModal}>
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-foreground">Renovar ciclo PIX</h3>
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
                {pixModal.isSubmitting ? "Renovando..." : "Confirmar pagamento e renovar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
