import { useEffect, useState } from "react";
import {
  Check,
  CreditCard,
  LayoutList,
  Loader2,
  ShieldCheck,
  Star,
  X,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SubscriptionPixModal } from "@/components/SubscriptionPixModal";
import { useAuth } from "@/hooks/useAuth";
import { listPlans, type Plan } from "@/service/planService";
import {
  subscribeClientToPlan,
} from "@/service/platformSubscriptionService";
import {
  createSubscription,
  getMyActiveSubscription,
  type Subscription,
} from "@/service/subscriptionService";
import { getSettings, type BookingPaymentMethod } from "@/service/settingsService";

/* ── helpers ── */

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value ?? 0);
}

const paymentMethodLabels: Record<Plan["paymentMethod"], string> = {
  credito: "Cartao de credito",
  debito: "Cartao de debito",
  pix: "Pix",
  local: "Pagar no local",
};

function formatCardNumber(value: string) {
  return value
    .replace(/\D/g, "")
    .slice(0, 16)
    .replace(/(.{4})/g, "$1 ")
    .trim();
}

function getApiMessage(error: unknown): string {
  const data = (error as { response?: { data?: unknown } })?.response?.data;
  if (Array.isArray(data)) return data.join(" ");
  if (data && typeof data === "object") {
    const msg = (data as { message?: unknown }).message;
    if (typeof msg === "string") return msg;
  }
  if (error instanceof Error) return error.message;
  return "Nao foi possivel concluir a operacao.";
}

/* ── Card form modal ── */

interface SubscribeModalProps {
  plan: Plan;
  isChangingPlan: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

function SubscribeModal({ plan, isChangingPlan, onClose, onSuccess }: SubscribeModalProps) {
  const { user } = useAuth();
  const [processing, setProcessing] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [form, setForm] = useState({
    number: "",
    holderName: "",
    expMonth: "",
    expYear: "",
    cvv: "",
    document: user?.cpf?.replace(/\D/g, "") ?? "",
    phone: user?.phone?.replace(/\D/g, "") ?? "",
    installments: 1,
  });

  function update(field: keyof typeof form, value: string | number) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function validate(): string | null {
    if (!form.number.replace(/\s/g, "").trim()) return "Informe o numero do cartao.";
    if (!form.holderName.trim()) return "Informe o nome impresso no cartao.";
    if (!form.expMonth.trim()) return "Informe o mes de validade.";
    if (!form.expYear.trim()) return "Informe o ano de validade.";
    if (!form.cvv.trim()) return "Informe o CVV.";
    if (!form.document.replace(/\D/g, "")) return "Informe o CPF do pagador.";
    if (!form.phone.replace(/\D/g, "")) return "Informe o telefone.";
    if (!acceptedTerms) return "Aceite os termos da assinatura para continuar.";
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (plan.paymentMethod !== "credito" && plan.paymentMethod !== "debito") {
      toast.error("Este plano nao esta configurado para pagamento no cartao.");
      return;
    }
    const err = validate();
    if (err) { toast.error(err); return; }

    setProcessing(true);
    try {
      await subscribeClientToPlan({
        planId: plan.id,
        amount: plan.price,
        cardForm: { ...form, number: form.number.replace(/\s/g, "") },
        customer: { name: user?.name, email: user?.email },
      });
      toast.success("Assinatura criada com sucesso!");
      onSuccess();
    } catch (err) {
      toast.error(getApiMessage(err));
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md overflow-y-auto max-h-[90vh] rounded-2xl bg-card border border-border shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Fechar"
        >
          <X size={20} />
        </button>

        {/* Header */}
        <div className="flex flex-col items-center gap-2 border-b border-border px-6 py-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <CreditCard size={22} />
          </div>
          <h2 className="text-lg font-semibold text-foreground">
            {isChangingPlan ? "Trocar de plano" : "Finalizar assinatura"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {isChangingPlan
              ? "Seu plano atual sera cancelado e o novo plano entrara em vigor imediatamente."
              : `Assinatura mensal no ${paymentMethodLabels[plan.paymentMethod].toLowerCase()}.`}
          </p>
        </div>

        {/* Resumo do plano */}
        <div className="mx-6 mt-4 flex justify-between rounded-lg bg-secondary/60 px-4 py-3 text-sm">
          <div>
            <p className="text-muted-foreground">Plano selecionado</p>
            <p className="font-semibold text-foreground">{plan.name}</p>
          </div>
          <div className="text-right">
            <p className="text-muted-foreground">Valor mensal</p>
            <p className="font-semibold text-foreground">{formatCurrency(plan.price)}</p>
          </div>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Numero do cartao</label>
            <input
              type="text"
              inputMode="numeric"
              placeholder="0000 0000 0000 0000"
              value={form.number}
              onChange={(e) => update("number", formatCardNumber(e.target.value))}
              autoComplete="cc-number"
              className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Nome impresso no cartao</label>
            <input
              type="text"
              placeholder="Nome como esta no cartao"
              value={form.holderName}
              onChange={(e) => update("holderName", e.target.value)}
              autoComplete="cc-name"
              className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Mes</label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="MM"
                maxLength={2}
                value={form.expMonth}
                onChange={(e) => update("expMonth", e.target.value.replace(/\D/g, ""))}
                autoComplete="cc-exp-month"
                className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Ano</label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="AAAA"
                maxLength={4}
                value={form.expYear}
                onChange={(e) => update("expYear", e.target.value.replace(/\D/g, ""))}
                autoComplete="cc-exp-year"
                className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">CVV</label>
              <input
                type="password"
                inputMode="numeric"
                placeholder="123"
                maxLength={4}
                value={form.cvv}
                onChange={(e) => update("cvv", e.target.value.replace(/\D/g, ""))}
                autoComplete="cc-csc"
                className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">CPF do pagador</label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="000.000.000-00"
                value={form.document}
                onChange={(e) => update("document", e.target.value)}
                className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Telefone</label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="(00) 00000-0000"
                value={form.phone}
                onChange={(e) => update("phone", e.target.value)}
                className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <label className="flex cursor-pointer items-start gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              className="mt-0.5 accent-primary"
            />
            <span>Li e aceito a cobranca recorrente mensal deste plano.</span>
          </label>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck size={14} className="shrink-0 text-emerald-500" />
            Pagamento seguro processado pelo Pagar.me.
          </div>

          <div className="flex gap-3 pt-1">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={onClose}
              disabled={processing}
            >
              Cancelar
            </Button>
            <Button type="submit" className="flex-1 gap-2" disabled={processing}>
              {processing && <Loader2 size={14} className="animate-spin" />}
              {processing ? "Processando..." : "Confirmar assinatura"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Plan card ── */

interface PlanCardProps {
  plan: Plan;
  isCurrentPlan: boolean;
  isPendingPlan: boolean;
  isChangingPlan: boolean;
  hiddenPaymentMethods: BookingPaymentMethod[];
  processingPlanId?: string | null;
  onSubscribe: (plan: Plan) => void;
}

function getPlanPaymentChannel(plan: Plan): BookingPaymentMethod {
  if (plan.paymentMethod === "local") return "local";
  return plan.paymentMethod === "pix" ? "pix" : "cartao";
}

function PlanCard({
  plan,
  isCurrentPlan,
  isPendingPlan,
  isChangingPlan,
  hiddenPaymentMethods,
  processingPlanId,
  onSubscribe,
}: PlanCardProps) {
  const accentColor = plan.color ?? "#d4af37";
  const canSubscribeOnline = ["credito", "debito", "pix", "local"].includes(plan.paymentMethod);
  const paymentMethodEnabled = !hiddenPaymentMethods.includes(getPlanPaymentChannel(plan));
  const canSubscribe = canSubscribeOnline && paymentMethodEnabled;
  const isProcessing = processingPlanId === plan.id;

  return (
    <div
      className="relative flex flex-col rounded-2xl border border-border bg-card overflow-hidden transition-shadow hover:shadow-lg"
      style={{ borderTopColor: accentColor, borderTopWidth: 3 }}
    >
      <div className="absolute right-4 top-4 flex gap-2">
        {(isCurrentPlan || isPendingPlan) && (
          <Badge className={
            isPendingPlan
              ? "bg-amber-500/15 text-amber-700 border-amber-500/30"
              : "bg-emerald-500/15 text-emerald-600 border-emerald-500/30"
          }>
            {isPendingPlan ? "Pendente" : "Meu plano"}
          </Badge>
        )}
        {plan.recommended && !isCurrentPlan && (
          <Badge className="gap-1 bg-primary text-primary-foreground">
            <Star size={11} />
            Recomendado
          </Badge>
        )}
      </div>

      <div className="p-6">
        <h3 className="text-lg font-semibold text-foreground">{plan.name}</h3>
        {plan.subtitle && (
          <p className="mt-1 text-sm text-muted-foreground">{plan.subtitle}</p>
        )}
        <div className="mt-4 flex items-end gap-1">
          <span className="text-3xl font-bold text-foreground">
            {formatCurrency(plan.price)}
          </span>
          <span className="mb-1 text-sm text-muted-foreground">/mês</span>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {plan.cutsPerMonth} {plan.cutsPerMonth === 1 ? "corte" : "cortes"} por mês
        </p>
      </div>

      {plan.features.length > 0 && (
        <div className="flex-1 border-t border-border px-6 py-4">
          <ul className="space-y-2">
            {plan.features.map((feature, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                <Check size={15} className="mt-0.5 shrink-0 text-primary" />
                {feature}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="px-6 pb-6 pt-4 border-t border-border">
        {isPendingPlan ? (
          <div className="flex items-center justify-center gap-2 rounded-lg bg-amber-500/10 py-2 text-sm font-medium text-amber-700">
            <Check size={15} />
            Aguardando confirmacao
          </div>
        ) : isCurrentPlan && plan.paymentMethod === "pix" ? (
          <Button className="w-full" onClick={() => onSubscribe(plan)} disabled={!paymentMethodEnabled}>
            Renovar com PIX
          </Button>
        ) : isCurrentPlan ? (
          <div className="flex items-center justify-center gap-2 rounded-lg bg-emerald-500/10 py-2 text-sm font-medium text-emerald-600">
            <Check size={15} />
            Plano ativo
          </div>
        ) : (
          <Button
            className="w-full"
            variant={isChangingPlan ? "outline" : "default"}
            onClick={() => onSubscribe(plan)}
            disabled={!canSubscribe || isProcessing}
          >
            {isProcessing
              ? "Registrando..."
              : !paymentMethodEnabled
              ? "Forma de pagamento indisponivel"
              : !canSubscribeOnline
              ? `Pagamento: ${paymentMethodLabels[plan.paymentMethod]}`
              : plan.paymentMethod === "pix"
                ? "Assinar com PIX"
                : plan.paymentMethod === "local"
                  ? "Pagar no local"
                : plan.paymentMethod === "debito"
                  ? "Assinar com cartao de debito"
                : isChangingPlan
                ? "Trocar para este plano"
                : "Assinar agora"}
          </Button>
        )}
      </div>
    </div>
  );
}

/* ── Main page ── */

export function ClientPlansPage() {
  const { user } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [mySubscription, setMySubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [hiddenPaymentMethods, setHiddenPaymentMethods] = useState<BookingPaymentMethod[]>([]);
  const [localSubscribingPlanId, setLocalSubscribingPlanId] = useState<string | null>(null);

  async function load() {
    setError(false);
    try {
      const [plansData, sub, settings] = await Promise.all([
        listPlans({ active: true }),
        getMyActiveSubscription(),
        getSettings(),
      ]);
      setPlans(plansData);
      setMySubscription(sub);
      setHiddenPaymentMethods(settings.hiddenBookingPaymentMethods ?? []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const isActive = mySubscription?.status === "active" || mySubscription?.status === "paused";
  const isPending = mySubscription?.status === "pending";
  const isCancelledOrExpired =
    mySubscription?.status === "cancelled" || mySubscription?.status === "expired";

  async function handleSubscribe(plan: Plan) {
    if (isPending) {
      toast.info("Ja existe uma assinatura aguardando confirmacao de pagamento.");
      return;
    }

    if (plan.paymentMethod !== "local") {
      setSelectedPlan(plan);
      return;
    }

    setLocalSubscribingPlanId(plan.id);
    try {
      await createSubscription({
        planId: plan.id,
        amount: plan.price,
        paymentMethod: "local",
        isRecurring: false,
        autoRenewal: false,
      });
      toast.success("Solicitacao enviada. O plano sera liberado apos confirmacao do pagamento no local.");
      setLoading(true);
      await load();
    } catch (err) {
      toast.error(getApiMessage(err));
    } finally {
      setLocalSubscribingPlanId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 size={24} className="animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground">
        <XCircle size={32} />
        <p className="text-sm">Nao foi possivel carregar os planos.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Planos disponíveis</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Assine um plano e aproveite beneficios exclusivos na barbearia.
        </p>
      </div>

      {isActive && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
          <p className="text-sm font-medium text-emerald-600">
            Voce ja possui uma assinatura ativa
            {mySubscription?.plan?.name ? ` — ${mySubscription.plan.name}` : ""}.
          </p>
          {mySubscription?.nextBillingAt && (
            <p className="mt-0.5 text-xs text-emerald-600/70">
              Proximo vencimento:{" "}
              {new Date(mySubscription.nextBillingAt).toLocaleDateString("pt-BR")}
            </p>
          )}
        </div>
      )}

      {isPending && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
          <p className="text-sm font-medium text-amber-700">
            Sua assinatura esta aguardando confirmacao de pagamento
            {mySubscription?.plan?.name ? ` - ${mySubscription.plan.name}` : ""}.
          </p>
          <p className="mt-0.5 text-xs text-amber-700/80">
            O plano sera liberado pela barbearia apos o pagamento no local.
          </p>
        </div>
      )}

      {isCancelledOrExpired && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
          <p className="text-sm font-medium text-amber-600">
            Sua assinatura anterior
            {mySubscription?.plan?.name ? ` (${mySubscription.plan.name})` : ""}{" "}
            foi {mySubscription?.status === "cancelled" ? "cancelada" : "expirada"}.
          </p>
          <p className="mt-0.5 text-xs text-amber-600/70">
            Entre em contato com a barbearia para reativar seu plano.
          </p>
        </div>
      )}

      {plans.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground">
          <LayoutList size={36} className="opacity-20" />
          <p className="text-sm">Nenhum plano disponivel no momento.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            isCurrentPlan={isActive && mySubscription?.planId === plan.id}
            isPendingPlan={isPending && mySubscription?.planId === plan.id}
            isChangingPlan={(isActive || isPending) && mySubscription?.planId !== plan.id}
            hiddenPaymentMethods={hiddenPaymentMethods}
            processingPlanId={localSubscribingPlanId}
            onSubscribe={(targetPlan) => void handleSubscribe(targetPlan)}
          />
          ))}
        </div>
      )}

      {(selectedPlan?.paymentMethod === "credito" || selectedPlan?.paymentMethod === "debito") && (
        <SubscribeModal
          plan={selectedPlan}
          isChangingPlan={isActive && mySubscription?.planId !== selectedPlan.id}
          onClose={() => setSelectedPlan(null)}
          onSuccess={() => {
            setSelectedPlan(null);
            setLoading(true);
            void load();
          }}
        />
      )}
      {selectedPlan?.paymentMethod === "pix" && (
        <SubscriptionPixModal
          plan={selectedPlan}
          user={user}
          onClose={() => setSelectedPlan(null)}
          onSuccess={() => {
            setSelectedPlan(null);
            setLoading(true);
            void load();
          }}
        />
      )}
    </div>
  );
}
