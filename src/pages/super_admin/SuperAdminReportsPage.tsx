import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { listSuperAdminBarbershops, type SuperAdminBarbershop } from "@/service/superAdminService";

export function SuperAdminReportsPage() {
  const [barbershops, setBarbershops] = useState<SuperAdminBarbershop[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const all: SuperAdminBarbershop[] = [];
        let page = 1;
        while (true) {
          const result = await listSuperAdminBarbershops({ limit: 100, page, sortBy: "createdAt", sortOrder: "desc" });
          const items = Array.isArray(result?.items) ? result.items : [];
          all.push(...items);
          if (all.length >= (result?.total ?? 0) || items.length < 100) break;
          page++;
        }
        setBarbershops(all);
      } catch { toast.error("Nao foi possivel carregar os relatorios."); } finally { setLoading(false); }
    })();
  }, []);

  const summary = useMemo(() =>
    barbershops.reduce(
      (acc, shop) => {
        const s = String(shop?.status || "").toLowerCase();
        if (s === "active") acc.active += 1;
        if (s === "inactive") acc.inactive += 1;
        if (s === "blocked") acc.blocked += 1;
        if (s === "pending") acc.pending += 1;
        acc.totalAppointments += Number(shop?.metrics?.appointmentsCount || 0);
        acc.totalClients += Number(shop?.metrics?.clientsCount || 0);
        return acc;
      },
      { active: 0, inactive: 0, blocked: 0, pending: 0, totalAppointments: 0, totalClients: 0 }
    ),
    [barbershops]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-muted-foreground" size={24} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-foreground">Relatorios Operacionais</h3>
        <p className="text-sm text-muted-foreground">Consulte distribuicao de status e atividade por barbearia.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        {[
          { label: "Ativas", value: summary.active },
          { label: "Inativas", value: summary.inactive },
          { label: "Bloqueadas", value: summary.blocked },
          { label: "Agendamentos totais", value: summary.totalAppointments },
          { label: "Clientes totais", value: summary.totalClients },
        ].map((card) => (
          <div key={card.label} className="rounded-xl border border-border bg-card p-5">
            <h4 className="text-sm text-muted-foreground">{card.label}</h4>
            <strong className="block text-2xl font-bold text-foreground">
              {card.value.toLocaleString("pt-BR")}
            </strong>
          </div>
        ))}
      </div>
    </div>
  );
}
