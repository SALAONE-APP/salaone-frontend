import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";

import { getSalonPlatformSubscription, type PlatformSubscription } from "@/service/platformSubscriptionService";
import { getSalonProfile } from "@/service/salonProfileService";

const DEFAULT_TRIAL_PERIOD_DAYS = 14;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

interface TrialInfo {
  daysLeft: number;
  endsAt: Date;
}

interface OverdueInfo { daysOverdue: number; blockedAt: Date; }

function getDaysLeft(endsAt: Date) {
  return Math.max(0, Math.ceil((endsAt.getTime() - Date.now()) / DAY_IN_MS));
}

function getTrialInfoFromSubscription(subscription: PlatformSubscription | null): TrialInfo | null {
  if (!subscription) return null;

  // nextBillingDate also exists for paid subscriptions, so it cannot prove a trial.
  const trialEndsAt = subscription.trialEndsAt;
  if (!trialEndsAt) return null;

  const endsAt = new Date(trialEndsAt);
  if (Number.isNaN(endsAt.getTime())) return null;

  const daysLeft = getDaysLeft(endsAt);
  return daysLeft > 0 ? { daysLeft, endsAt } : null;
}

function getFallbackTrialInfo(createdAt: string | null | undefined): TrialInfo | null {
  if (!createdAt) return null;

  const createdAtDate = new Date(createdAt);
  if (Number.isNaN(createdAtDate.getTime())) return null;

  const endsAt = new Date(createdAtDate.getTime() + DEFAULT_TRIAL_PERIOD_DAYS * DAY_IN_MS);
  const daysLeft = getDaysLeft(endsAt);
  return daysLeft > 0 ? { daysLeft, endsAt } : null;
}

export function PlatformTrialBanner() {
  const [trialInfo, setTrialInfo] = useState<TrialInfo | null>(null);
  const [checkingTrial, setCheckingTrial] = useState(true);
  const [overdueInfo, setOverdueInfo] = useState<OverdueInfo | null>(null);

  useEffect(() => {
    let active = true;
    const profileRequest = getSalonProfile();
    const updateTrialInfo = (info: TrialInfo | null) => {
      if (!active) return;
      setTrialInfo(info);
    };

    void getSalonPlatformSubscription()
      .then(async ({ subscription }) => {
        if (!active) return;

        const blockedAt = subscription?.accessBlockedAt ? new Date(subscription.accessBlockedAt) : null;
        if (subscription && Number(subscription.daysOverdue) > 0 && blockedAt && !Number.isNaN(blockedAt.getTime())) {
          setOverdueInfo({ daysOverdue: Number(subscription.daysOverdue), blockedAt });
        } else {
          setOverdueInfo(null);
        }

        const info = getTrialInfoFromSubscription(subscription);
        if (info) {
          updateTrialInfo(info);
          return;
        }

        // Apenas contas que ainda não têm assinatura usam a data de criação
        // como contingência. Assim, uma assinatura paga não exibe aviso indevido.
        if (subscription) {
          updateTrialInfo(null);
          return;
        }
        const profile = await profileRequest.catch(() => null);
        updateTrialInfo(getFallbackTrialInfo(profile?.createdAt));
      })
      .catch(async () => {
        // Se a assinatura ainda não estiver disponível, mantém o fallback
        // para que uma conta nova não fique sem o aviso.
        const profile = await profileRequest.catch(() => null);
        updateTrialInfo(getFallbackTrialInfo(profile?.createdAt));
      })
      .finally(() => {
        if (active) setCheckingTrial(false);
      });

    return () => {
      active = false;
    };
  }, []);

  if (!trialInfo && !overdueInfo && !checkingTrial) return null;

  return (
    <div className="sticky top-3 z-30 mb-6">
      <div className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 shadow-sm backdrop-blur sm:px-5">
        <AlertTriangle size={19} className="mt-0.5 shrink-0 text-amber-600" aria-hidden="true" />
        <div className="min-w-0">
          {overdueInfo ? (
            <>
              <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                Pagamento em atraso há {overdueInfo.daysOverdue} {overdueInfo.daysOverdue === 1 ? "dia" : "dias"}.
              </p>
              <p className="mt-0.5 text-xs text-amber-700/85 dark:text-amber-300/85">
                Confirme o pagamento para evitar o bloqueio do acesso em {overdueInfo.blockedAt.toLocaleDateString("pt-BR")}.
              </p>
            </>
          ) : trialInfo ? (
            <>
              <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                Seu período de teste termina em {trialInfo.daysLeft === 1 ? "1 dia" : `${trialInfo.daysLeft} dias`}.
              </p>
              <p className="mt-0.5 text-xs text-amber-700/85 dark:text-amber-300/85">
                Acesso gratuito até {trialInfo.endsAt.toLocaleDateString("pt-BR")}. Assine um plano para continuar usando a plataforma.
              </p>
            </>
          ) : (
            <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">Verificando o período de teste…</p>
          )}
        </div>
      </div>
    </div>
  );
}
