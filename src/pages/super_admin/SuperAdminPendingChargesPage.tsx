import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, QrCode } from "lucide-react";
import { toast } from "sonner";

import { confirmManualPixPayment, listSuperAdminSalons, type SuperAdminSalon } from "@/service/superAdminService";

function dateLabel(value?: string | null) {
  if (!value) return "-";
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString("pt-BR");
}

function money(value?: number | null) {
  return value == null ? "-" : Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function SuperAdminPendingChargesPage() {
  const [salons, setSalons] = useState<SuperAdminSalon[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listSuperAdminSalons({ limit: 100, page: 1, sortBy: "createdAt", sortOrder: "asc" });
      setSalons(result.items);
    } catch { toast.error("Não foi possível carregar as cobranças pendentes."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);
  const charges = useMemo(() => salons.filter((salon) => {
    const subscription = salon.platformSubscription;
    return subscription?.billing_mode === "manual_pix" && subscription.manual_payment_status === "pending";
  }), [salons]);

  async function confirm(salon: SuperAdminSalon) {
    if (!window.confirm(`Confirmar o recebimento do PIX de ${salon.name}? A unidade será ativada e o próximo vencimento será agendado.`)) return;
    setConfirming(salon.id);
    try {
      await confirmManualPixPayment(salon.id);
      toast.success("Pagamento confirmado. Unidade ativada e próximo vencimento agendado.");
      await load();
    } catch (error) {
      toast.error((error as { response?: { data?: { message?: string } } })?.response?.data?.message || "Não foi possível confirmar o pagamento.");
    } finally { setConfirming(null); }
  }

  return <div className="space-y-6">
    <div><h2 className="text-xl font-semibold text-foreground">Cobranças pendentes</h2><p className="mt-1 text-sm text-muted-foreground">PIX manuais aguardando confirmação da equipe.</p></div>
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      {loading ? <div className="py-12 text-center text-muted-foreground"><Loader2 className="mx-auto animate-spin" size={20} /></div> : charges.length === 0 ? <div className="py-12 text-center text-sm text-muted-foreground"><QrCode className="mx-auto mb-3 opacity-50" size={24} />Nenhuma cobrança PIX pendente.</div> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground"><th className="px-5 py-3">Unidade</th><th className="px-5 py-3">Valor</th><th className="px-5 py-3">Periodicidade</th><th className="px-5 py-3">Vencimento</th><th className="px-5 py-3 text-right">Ação</th></tr></thead><tbody>{charges.map((salon) => { const subscription = salon.platformSubscription!; return <tr key={salon.id} className="border-b border-border last:border-0"><td className="px-5 py-4"><p className="font-medium text-foreground">{salon.name}</p><p className="text-xs text-muted-foreground">{salon.admin?.email || salon.email || "-"}</p></td><td className="px-5 py-4 font-medium text-foreground">{money(subscription.amount)}</td><td className="px-5 py-4 text-muted-foreground">{subscription.billing_interval === "year" ? "Anual" : "Mensal"}</td><td className="px-5 py-4 text-muted-foreground">{dateLabel(subscription.next_billing_date)}</td><td className="px-5 py-4 text-right"><button type="button" disabled={confirming !== null} onClick={() => void confirm(salon)} className="inline-flex items-center gap-1.5 rounded bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50">{confirming === salon.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Confirmar pagamento</button></td></tr>; })}</tbody></table></div>}
    </div>
  </div>;
}
