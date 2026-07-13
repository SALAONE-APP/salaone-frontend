import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

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

export function SuperAdminSubscriptionsPage() {
  const [salons, setSalons] = useState<SuperAdminSalon[]>([]);
  const [plans, setPlans] = useState<PlatformPlan[]>([]);
  const [loading, setLoading] = useState(true);
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
    salons.map((shop) => ({
      id: shop.id,
      name: shop.name,
      shop,
      plan: shop.platformSubscription?.platform_plans?.name ?? shop.platformSubscription?.selected_plan ?? "Sem plano",
      status: shop.platformSubscription?.status ?? "none",
      paymentMethod: shop.platformSubscription?.payment_method ?? "-",
      nextBillingAt: shop.platformSubscription?.next_billing_date ?? null,
      price: shop.platformSubscription?.amount ?? shop.platformSubscription?.platform_plans?.price ?? null,
    })),
    [salons]
  );

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-foreground">Gestao de Assinaturas</h3>
        <p className="text-sm text-muted-foreground">Visualize o resumo de planos e situacao atual das assinaturas.</p>
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
                <th className="px-5 py-3">Proxima cobranca</th>
                <th className="px-5 py-3">Valor</th>
                <th className="px-5 py-3">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">
                  <Loader2 className="mx-auto mb-2 animate-spin" size={20} />Carregando...
                </td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={7} className="p-8 text-center text-sm text-muted-foreground">Nenhuma assinatura encontrada.</td></tr>
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
