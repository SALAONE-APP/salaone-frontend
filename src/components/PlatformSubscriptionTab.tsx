import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, AlertTriangle, Check, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { SubscriptionPaymentModal } from '@/components/SubscriptionPaymentModal';
import {
  getBarbershopPlatformSubscription,
  cancelBarbershopPlatformSubscription,
  getPublicPlatformPlans,
  type PlatformPlan,
  type PlatformSubscription,
} from '@/service/platformSubscriptionService';
import { getBarbershopProfile } from '@/service/barbershopProfileService';

const TRIAL_PERIOD_DAYS = 14;

function isActivePlatformSubscription(sub: PlatformSubscription | null): boolean {
  if (!sub) return false;
  const status = String(sub.status || '').trim().toLowerCase().replace('canceled', 'cancelled');
  if (status !== 'active') return false;
  if (sub.canceledAt !== null) return false;
  if (!sub.nextBillingDate) return true;
  return new Date(sub.nextBillingDate) > new Date();
}

function computeTrialInfo(createdAt: string | null | undefined, platformSubscriptionStatus: string | null | undefined) {
  if (!createdAt) return null;
  const subStatus = String(platformSubscriptionStatus || '').toLowerCase().trim();
  if (subStatus === 'active') return null;
  const created = new Date(createdAt);
  const trialEndsAt = new Date(created.getTime() + TRIAL_PERIOD_DAYS * 24 * 60 * 60 * 1000);
  const now = new Date();
  if (now > trialEndsAt) return null;
  const msLeft = trialEndsAt.getTime() - now.getTime();
  const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));
  return { daysLeft, trialEndsAt };
}

function formatCurrency(value: number | null | undefined) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return '-';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(value: string | null | undefined) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('pt-BR');
}

function intervalLabel(interval: string, count: number) {
  const n = Number(count || 1);
  const map: Record<string, string> = { day: 'dia', week: 'semana', month: 'mês', year: 'ano' };
  const unit = map[interval] ?? 'mês';
  return n === 1 ? `por ${unit}` : `a cada ${n} ${unit}s`;
}

function getApiErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null) {
    const e = error as { response?: { data?: { message?: string } }; message?: string };
    if (e.response?.data?.message) return e.response.data.message;
    if (e.message) return e.message;
  }
  return 'Erro desconhecido.';
}

function normalizeStatus(raw: string): string {
  return raw?.trim().toLowerCase().replace('canceled', 'cancelled');
}

const STATUS_LABEL: Record<string, string> = {
  active: 'Ativo',
  trialing: 'Período de teste',
  future: 'Agendado',
  paused: 'Pausado',
  pending: 'Pendente',
  cancelled: 'Cancelado',
  expired: 'Expirado',
};

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  active: 'default',
  trialing: 'default',
  future: 'secondary',
  paused: 'secondary',
  pending: 'outline',
  cancelled: 'destructive',
  expired: 'destructive',
};

export function PlatformSubscriptionTab() {
  const [currentSub, setCurrentSub] = useState<PlatformSubscription | null>(null);
  const [plans, setPlans] = useState<PlatformPlan[]>([]);
  const [loadingSubscription, setLoadingSubscription] = useState(true);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [subscriptionError, setSubscriptionError] = useState<string | null>(null);
  const [plansError, setPlansError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlatformPlan | null>(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [changePlanTarget, setChangePlanTarget] = useState<PlatformPlan | null>(null);
  const [trialInfo, setTrialInfo] = useState<{ daysLeft: number; trialEndsAt: Date } | null>(null);

  const loadSubscription = useCallback(async () => {
    setLoadingSubscription(true);
    setSubscriptionError(null);
    try {
      const data = await getBarbershopPlatformSubscription();
      setCurrentSub(data.subscription);
    } catch (err) {
      setSubscriptionError('Não foi possível carregar a assinatura atual. Tente novamente.');
    } finally {
      setLoadingSubscription(false);
    }
  }, []);

  const loadPlans = useCallback(async () => {
    setLoadingPlans(true);
    setPlansError(null);
    try {
      const data = await getPublicPlatformPlans();
      setPlans(Array.isArray(data.items) ? data.items : []);
    } catch (err) {
      setPlansError('Não foi possível carregar os planos disponíveis. Tente novamente.');
    } finally {
      setLoadingPlans(false);
    }
  }, []);

  useEffect(() => {
    loadSubscription();
    loadPlans();
    getBarbershopProfile()
      .then((profile) => {
        const info = computeTrialInfo(profile.createdAt, profile.platformSubscriptionStatus);
        setTrialInfo(info);
      })
      .catch(() => {});
  }, [loadSubscription, loadPlans]);

  const normalizedStatus = currentSub ? normalizeStatus(currentSub.status) : '';
  const hasActiveSub = isActivePlatformSubscription(currentSub);
  const isCurrentPlan = (plan: PlatformPlan) => hasActiveSub && currentSub?.plan?.id === plan.id;

  function handleSelectPlan(plan: PlatformPlan, upgrade: boolean) {
    if (upgrade) { setChangePlanTarget(plan); return; }
    setSelectedPlan(plan);
    setPaymentModalOpen(true);
  }

  async function handleCancelAndChangePlan() {
    setCancelling(true);
    try {
      await cancelBarbershopPlatformSubscription();
      await loadSubscription();
      setSelectedPlan(changePlanTarget);
      setChangePlanTarget(null);
      setPaymentModalOpen(true);
    } catch (err) {
      toast.error(getApiErrorMessage(err) || 'Não foi possível cancelar a assinatura.');
    } finally {
      setCancelling(false);
    }
  }

  async function handleCancelSubscription() {
    setConfirmCancel(false);
    setCancelling(true);
    try {
      await cancelBarbershopPlatformSubscription();
      toast.success('Assinatura cancelada com sucesso.');
      await loadSubscription();
    } catch (err) {
      toast.error(getApiErrorMessage(err) || 'Não foi possível cancelar a assinatura.');
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div className="space-y-6">

      {/* Banner de período de teste */}
      {trialInfo && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-5 py-4">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-500" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-amber-600">
              Você está no período de teste —{' '}
              {trialInfo.daysLeft === 1 ? '1 dia restante' : `${trialInfo.daysLeft} dias restantes`}
            </p>
            <p className="mt-0.5 text-xs text-amber-600/80">
              Assine um plano para garantir o acesso após{' '}
              {trialInfo.trialEndsAt.toLocaleDateString('pt-BR')}.
            </p>
          </div>
        </div>
      )}

      {/* Card de assinatura atual */}
      <div className="bg-card rounded-xl border border-border p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-lg font-medium text-foreground">Assinatura da plataforma</h3>
          {!loadingSubscription && !subscriptionError && currentSub && (
            <Badge variant={hasActiveSub ? (STATUS_VARIANT[normalizedStatus] ?? 'default') : 'destructive'}>
              {hasActiveSub ? (STATUS_LABEL[normalizedStatus] ?? currentSub.status) : 'Expirado'}
            </Badge>
          )}
          {!loadingSubscription && !subscriptionError && !currentSub && (
            <Badge variant="outline">Sem assinatura</Badge>
          )}
        </div>

        {loadingSubscription ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
            <Spinner /> Carregando assinatura...
          </div>
        ) : subscriptionError ? (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
            <AlertCircle size={16} className="mt-0.5 shrink-0 text-destructive" />
            <div className="space-y-2">
              <p className="text-sm text-foreground">{subscriptionError}</p>
              <Button variant="outline" size="sm" className="gap-2" onClick={loadSubscription}>
                <RefreshCw size={13} /> Tentar novamente
              </Button>
            </div>
          </div>
        ) : currentSub ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div>
                <p className="text-xs text-muted-foreground">Plano atual</p>
                <p className="font-semibold text-foreground">
                  {currentSub.plan?.name || currentSub.selectedPlan || '-'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Valor</p>
                <p className="font-semibold text-foreground">
                  {currentSub.plan?.price != null
                    ? `${formatCurrency(currentSub.plan.price)}/mês`
                    : currentSub.amount != null
                    ? `${formatCurrency(currentSub.amount)}/mês`
                    : '-'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Próxima cobrança</p>
                <p className="font-semibold text-foreground">
                  {formatDate(currentSub.nextBillingDate)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Ativo desde</p>
                <p className="font-semibold text-foreground">
                  {formatDate(currentSub.startDate ?? currentSub.createdAt)}
                </p>
              </div>
            </div>

            {hasActiveSub && (
              confirmCancel ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-3">
                  <div className="flex items-start gap-2 text-sm text-foreground">
                    <AlertCircle size={16} className="mt-0.5 shrink-0 text-destructive" />
                    Confirma o cancelamento? Você perderá o acesso ao final do período pago.
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setConfirmCancel(false)}>
                      Não, manter
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleCancelSubscription}
                      disabled={cancelling}
                      className="gap-2"
                    >
                      {cancelling && <Spinner />}
                      {cancelling ? 'Cancelando...' : 'Sim, cancelar assinatura'}
                    </Button>
                  </div>
                </div>
              ) : (
                <Button variant="outline" size="sm" onClick={() => setConfirmCancel(true)}>
                  Cancelar assinatura
                </Button>
              )
            )}
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-secondary/40 p-4">
            <p className="text-sm font-medium text-foreground">Nenhuma assinatura ativa encontrada.</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Escolha um plano abaixo para ativar sua assinatura da plataforma.
            </p>
          </div>
        )}
      </div>

      {/* Grid de planos */}
      <div className="bg-card rounded-xl border border-border p-6">
        <h3 className="text-lg font-medium text-foreground mb-4">
          {hasActiveSub ? 'Fazer upgrade de plano' : 'Escolha seu plano'}
        </h3>

        {loadingPlans ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
            <Spinner /> Carregando planos disponíveis...
          </div>
        ) : plansError ? (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
            <AlertCircle size={16} className="mt-0.5 shrink-0 text-destructive" />
            <div className="space-y-2">
              <p className="text-sm text-foreground">{plansError}</p>
              <Button variant="outline" size="sm" className="gap-2" onClick={loadPlans}>
                <RefreshCw size={13} /> Tentar novamente
              </Button>
            </div>
          </div>
        ) : plans.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum plano disponível no momento. Entre em contato com o suporte.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {plans.map((plan) => {
              const isCurrent = isCurrentPlan(plan);
              const canSubscribe = !hasActiveSub;
              const canUpgrade = hasActiveSub && !isCurrent;

              return (
                <div
                  key={plan.id}
                  className={`relative flex flex-col rounded-xl border p-5 transition-all ${
                    isCurrent
                      ? 'border-primary bg-primary/5'
                      : plan.isRecommended
                      ? 'border-primary/40 bg-card'
                      : 'border-border bg-card'
                  }`}
                  style={plan.color ? { borderColor: plan.color } : undefined}
                >
                  {plan.isRecommended && !isCurrent && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-xs font-semibold text-primary-foreground">
                      Recomendado
                    </span>
                  )}
                  {isCurrent && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-xs font-semibold text-primary-foreground">
                      Plano atual
                    </span>
                  )}

                  <div className="mb-3">
                    <h4 className="font-semibold text-foreground">{plan.name}</h4>
                    {plan.description && (
                      <p className="mt-0.5 text-xs text-muted-foreground">{plan.description}</p>
                    )}
                  </div>

                  <div className="mb-4">
                    <span className="text-2xl font-bold text-foreground">
                      {formatCurrency(plan.price)}
                    </span>
                    <span className="ml-1 text-xs text-muted-foreground">
                      {intervalLabel(plan.interval, plan.intervalCount)}
                    </span>
                  </div>

                  {plan.features.length > 0 && (
                    <ul className="mb-4 space-y-1.5 flex-1">
                      {plan.features.map((f, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <Check size={13} className="mt-0.5 shrink-0 text-primary" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  )}

                  {plan.trialPeriodDays > 0 && (
                    <p className="mb-3 text-xs font-medium text-emerald-600">
                      {plan.trialPeriodDays} dias grátis
                    </p>
                  )}

                  <div className="mt-auto pt-2">
                    {isCurrent ? (
                      <span className="block text-center text-sm font-medium text-primary">
                        Plano ativo
                      </span>
                    ) : canSubscribe ? (
                      <Button className="w-full" onClick={() => handleSelectPlan(plan, false)}>
                        Assinar plano
                      </Button>
                    ) : canUpgrade ? (
                      <Button variant="outline" className="w-full" onClick={() => handleSelectPlan(plan, true)}>
                        Fazer upgrade
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal de troca de plano */}
      {changePlanTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => !cancelling && setChangePlanTarget(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600 mx-auto">
              <AlertCircle size={24} />
            </div>
            <h4 className="text-center text-lg font-semibold text-foreground">Trocar de plano</h4>
            <p className="text-center text-sm text-muted-foreground">
              Para assinar o plano <strong className="text-foreground">{changePlanTarget.name}</strong>,
              é necessário cancelar o plano atual primeiro.
            </p>
            <p className="text-center text-xs text-destructive">
              O cancelamento é imediato e você perderá o acesso ao final do período já pago.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setChangePlanTarget(null)} disabled={cancelling}>
                Voltar
              </Button>
              <Button variant="destructive" className="flex-1 gap-2" onClick={handleCancelAndChangePlan} disabled={cancelling}>
                {cancelling && <Spinner />}
                {cancelling ? 'Cancelando...' : 'Cancelar plano atual'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de pagamento */}
      <SubscriptionPaymentModal
        isOpen={paymentModalOpen}
        plan={selectedPlan}
        onClose={() => { setPaymentModalOpen(false); setSelectedPlan(null); }}
        onSuccess={loadSubscription}
      />
    </div>
  );
}
