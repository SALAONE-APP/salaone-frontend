import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { LockKeyhole, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getSalonPlatformSubscription, hasActivePlatformSubscription, type PlatformSubscription } from "@/service/platformSubscriptionService";

export function subscriptionIncludesCrm(subscription: PlatformSubscription | null) {
  return hasActivePlatformSubscription(subscription)
    && (subscription?.plan?.features ?? []).some((feature) => String(feature).trim().toLowerCase() === "crm");
}

export function CrmFeatureGate({ children }: { children: ReactNode }) {
  const [subscription, setSubscription] = useState<PlatformSubscription | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSalonPlatformSubscription()
      .then(({ subscription: current }) => setSubscription(current))
      .catch(() => setSubscription(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex min-h-64 items-center justify-center text-sm text-muted-foreground"><Loader2 className="mr-2 size-4 animate-spin" />Carregando acesso ao CRM...</div>;
  }
  if (subscriptionIncludesCrm(subscription)) return <>{children}</>;

  return (
    <div className="mx-auto flex min-h-80 max-w-lg flex-col items-center justify-center rounded-xl border bg-card p-8 text-center">
      <div className="mb-4 rounded-full bg-primary/10 p-3 text-primary"><LockKeyhole className="size-6" /></div>
      <h1 className="text-xl font-semibold">CRM não incluído no seu plano</h1>
      <p className="mt-2 text-sm text-muted-foreground">Escolha um plano que inclua CRM de Relacionamento ou contrate o adicional CRM para liberar este recurso.</p>
      <Button asChild className="mt-5"><Link to="/settings">Ver planos e adicionais</Link></Button>
    </div>
  );
}
