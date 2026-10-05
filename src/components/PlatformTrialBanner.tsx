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

function getDaysLeft(endsAt: Date) {
  return Math.max(0, Math.ceil((endsAt.getTime() - Date.now()) / DAY_IN_MS));
}

function getTrialInfoFromSubscription(subscription: PlatformSubscription | null): TrialInfo | null {
  if (subscription?.status?.trim().toLowerCase() !== "trialing" || !subscription.nextBillingDate) {
    return null;
  }

  const endsAt = new Date(subscription.nextBillingDate);
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

  useEffect(() => {
    let active = true;

    void Promise.allSettled([getSalonPlatformSubscription(), getSalonProfile()]).then(([subscriptionResult, profileResult]) => {
      if (!active || subscriptionResult.status !== "fulfilled") return;

      const subscription = subscriptionResult.value.subscription;
      const subscriptionStatus = subscription?.status?.trim().toLowerCase();
      const info = getTrialInfoFromSubscription(subscription)
        ?? (subscriptionStatus ? null : getFallbackTrialInfo(profileResult.status === "fulfilled" ? profileResult.value.createdAt : null));

      setTrialInfo(info);
    });

    return () => {
      active = false;
    };
  }, []);

  if (!trialInfo) return null;

  return (
    <div className="sticky top-3 z-30 mb-6">
      <div className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 shadow-sm backdrop-blur sm:px-5">
        <AlertTriangle size={19} className="mt-0.5 shrink-0 text-amber-600" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
            Seu período de teste termina em {trialInfo.daysLeft === 1 ? "1 dia" : `${trialInfo.daysLeft} dias`}.
          </p>
          <p className="mt-0.5 text-xs text-amber-700/85 dark:text-amber-300/85">
            Acesso gratuito até {trialInfo.endsAt.toLocaleDateString("pt-BR")}. Assine um plano para continuar usando a plataforma.
          </p>
        </div>
      </div>
    </div>
  );
}
