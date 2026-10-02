import { useState } from "react";
import { Building2, Loader2, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { useAuth } from "@/hooks/useAuth";

export function SuperAdminSalonAccessBanner() {
  const navigate = useNavigate();
  const { salonAccess, exitSalonAccess } = useAuth();
  const [leaving, setLeaving] = useState(false);

  if (!salonAccess) return null;

  async function handleExit() {
    setLeaving(true);
    try {
      await exitSalonAccess();
      toast.success("Você voltou ao painel global.");
      navigate("/salons", { replace: true });
    } catch {
      toast.error("Não foi possível voltar ao painel global.");
      setLeaving(false);
    }
  }

  return (
    <div className="px-4 pt-2 md:px-6">
      <div className="flex flex-col gap-3 rounded-xl border border-blue-500/35 bg-blue-500/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="relative mt-0.5 shrink-0 text-blue-600"><Building2 size={21} /><ShieldCheck className="absolute -bottom-1 -right-1 rounded-full bg-background" size={12} /></div>
          <div><p className="text-sm font-semibold text-foreground">Acesso Super Admin: {salonAccess.name}</p><p className="mt-0.5 text-xs text-muted-foreground">Você está operando no painel deste salão. As ações permanecem vinculadas à sua conta de superadmin.</p></div>
        </div>
        <button type="button" onClick={() => void handleExit()} disabled={leaving} className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground shadow-sm transition hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60">
          {leaving && <Loader2 size={14} className="animate-spin" />} Voltar ao painel global
        </button>
      </div>
    </div>
  );
}
