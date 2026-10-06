import { useEffect, useState, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { getSalonPlatformSubscription } from "@/service/platformSubscriptionService";

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const GRACE_PERIOD_DAYS = 5;

function isSubscriptionBlocked(subscription: Awaited<ReturnType<typeof getSalonPlatformSubscription>>["subscription"]) {
  const status = subscription?.status?.trim().toLowerCase().replace("canceled", "cancelled");
  if (!subscription?.nextBillingDate && ["future", "pending", "paused", "expired", "cancelled"].includes(status ?? "")) return true;
  if (!subscription?.nextBillingDate) return false;

  const blockedAt = subscription.accessBlockedAt
    ? new Date(subscription.accessBlockedAt)
    : new Date(new Date(subscription.nextBillingDate).getTime() + GRACE_PERIOD_DAYS * DAY_IN_MS);

  return !Number.isNaN(blockedAt.getTime()) && Date.now() >= blockedAt.getTime();
}

export function PlatformAccessGate({ children }: { children: ReactNode }) {
  const { user, salonAccess, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [blocked, setBlocked] = useState(false);

  const canManagePlan = user?.role === "admin" || user?.isAdmin === true;
  const isPlanPage = canManagePlan && location.pathname === "/settings" && new URLSearchParams(location.search).get("tab") === "meuPlano";
  const shouldCheck = ["admin", "professional", "receptionist"].includes(user?.role ?? "");

  useEffect(() => {
    let active = true;

    if (!shouldCheck) {
      setBlocked(false);
      return () => { active = false; };
    }

    void getSalonPlatformSubscription()
      .then(({ subscription }) => {
        if (active) setBlocked(isSubscriptionBlocked(subscription));
      })
      .catch(() => {
        // O servidor continua sendo a fonte de verdade e bloqueia as demais APIs.
        // Não escondemos a aplicação por uma falha transitória de rede.
        if (active) setBlocked(false);
      })
      .finally(() => undefined);

    return () => { active = false; };
  }, [shouldCheck, salonAccess?.id]);

  const goToPlan = () => navigate("/settings?tab=meuPlano", { replace: true });

  return (
    <>
      {(!blocked || isPlanPage) && children}
      <Dialog open={blocked && !isPlanPage} onOpenChange={() => undefined}>
        <DialogContent showCloseButton={false} className="sm:max-w-md">
          <DialogHeader>
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertTriangle size={24} aria-hidden="true" />
            </div>
            <DialogTitle>Acesso temporariamente bloqueado</DialogTitle>
            <DialogDescription>
              O pagamento do plano está em atraso há mais de 5 dias. Regularize ou assine um novo plano para voltar a acessar o salão.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            {canManagePlan ? (
              <Button className="w-full sm:w-auto" onClick={goToPlan}>
                Ver planos e regularizar
              </Button>
            ) : (
              <Button className="w-full sm:w-auto" variant="outline" onClick={logout}>
                Sair
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
