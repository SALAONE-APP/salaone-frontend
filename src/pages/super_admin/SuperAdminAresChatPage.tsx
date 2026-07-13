import { type FormEvent, useCallback, useEffect, useState } from "react";
import { Loader2, MessageSquareMore, Search } from "lucide-react";
import { toast } from "sonner";

import { AresChatIntegrationModal } from "@/components/AresChatIntegrationModal";
import { Button } from "@/components/ui/button";
import {
  listSuperAdminBarbershops,
  type SuperAdminBarbershop,
} from "@/service/superAdminService";

function statusLabel(status: string) {
  const map: Record<string, string> = {
    active: "Ativa",
    inactive: "Inativa",
    blocked: "Bloqueada",
    pending: "Pendente",
  };
  return map[String(status || "").toLowerCase()] || String(status || "-");
}

function fmtDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("pt-BR");
}

export function SuperAdminAresChatPage() {
  const [barbershops, setBarbershops] = useState<SuperAdminBarbershop[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [selectedBarbershop, setSelectedBarbershop] = useState<SuperAdminBarbershop | null>(null);

  const loadBarbershops = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listSuperAdminBarbershops({
        q: appliedSearch || undefined,
        page: 1,
        limit: 100,
        sortBy: "name",
        sortOrder: "asc",
      });
      setBarbershops(Array.isArray(result.items) ? result.items : []);
    } catch {
      toast.error("Nao foi possivel carregar as barbearias.");
    } finally {
      setLoading(false);
    }
  }, [appliedSearch]);

  useEffect(() => {
    void loadBarbershops();
  }, [loadBarbershops]);

  function handleSearchSubmit(event: FormEvent) {
    event.preventDefault();
    setAppliedSearch(search.trim());
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground">Integracao AresChat</h3>
          <p className="text-sm text-muted-foreground">
            Consulte os dados de configuracao e gere credenciais por barbearia.
          </p>
        </div>

        <form onSubmit={handleSearchSubmit} className="flex w-full gap-2 md:w-auto">
          <div className="relative min-w-0 flex-1 md:w-80">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar barbearia"
              className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <Button type="submit" size="sm" disabled={loading}>
            Filtrar
          </Button>
        </form>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <th className="px-5 py-3">Barbearia</th>
                <th className="px-5 py-3">Responsavel</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Criacao</th>
                <th className="px-5 py-3">Credencial</th>
                <th className="px-5 py-3">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    <Loader2 className="mx-auto mb-2 animate-spin" size={20} />
                    Carregando...
                  </td>
                </tr>
              ) : barbershops.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-sm text-muted-foreground">
                    Nenhuma barbearia encontrada.
                  </td>
                </tr>
              ) : (
                barbershops.map((shop) => (
                  <tr key={shop.id} className="border-b border-border last:border-0 hover:bg-secondary/30">
                    <td className="px-5 py-3">
                      <strong className="block text-foreground">{shop.name}</strong>
                      <small className="text-muted-foreground">{shop.email ?? "-"} | {shop.phone ?? "-"}</small>
                    </td>
                    <td className="px-5 py-3">
                      <strong className="block text-foreground">{shop.admin?.name ?? "-"}</strong>
                      <small className="text-muted-foreground">{shop.admin?.email ?? "-"}</small>
                    </td>
                    <td className="px-5 py-3">
                      <span className="rounded-full border border-border bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground">
                        {statusLabel(shop.status)}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{fmtDate(shop.createdAt)}</td>
                    <td className="px-5 py-3 text-muted-foreground">
                      Abra os dados para consultar a credencial ativa.
                    </td>
                    <td className="px-5 py-3">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedBarbershop(shop)}
                      >
                        <MessageSquareMore size={14} />
                        Dados AresChat
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AresChatIntegrationModal
        open={Boolean(selectedBarbershop)}
        barbershopId={selectedBarbershop?.id ?? null}
        onClose={() => setSelectedBarbershop(null)}
      />
    </div>
  );
}
