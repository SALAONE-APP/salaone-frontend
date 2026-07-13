import { type FormEvent, useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  listSuperAdminSalons,
  getSuperAdminSalonById,
  listSuperAdminSalonUsers,
  updateSuperAdminSalonStatus,
  resetSuperAdminUserPassword,
  type SalonStatus,
  type SuperAdminSalon,
  type SuperAdminSalonDetail,
  type SuperAdminSalonUser,
} from "@/service/superAdminService";

function fmtDate(value?: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("pt-BR");
}

function fmtCurrency(value?: number | null) {
  if (value == null) return "-";
  const n = Number(value);
  if (!Number.isFinite(n)) return "-";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    active: "Ativa", inactive: "Inativa", blocked: "Bloqueada", pending: "Pendente",
  };
  return map[String(status || "").toLowerCase()] || String(status || "-");
}

function StatusBadge({ status }: { status: string }) {
  const cls: Record<string, string> = {
    active: "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20",
    inactive: "bg-secondary text-muted-foreground border border-border",
    blocked: "bg-destructive/10 text-destructive border border-destructive/20",
    pending: "bg-amber-500/10 text-amber-600 border border-amber-500/20",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls[status] ?? "bg-secondary text-muted-foreground border border-border"}`}>
      {statusLabel(status)}
    </span>
  );
}

const STATUS_OPTIONS = [
  { value: "", label: "Todos os status" },
  { value: "active", label: "Ativa" },
  { value: "inactive", label: "Inativa" },
  { value: "blocked", label: "Bloqueada" },
  { value: "pending", label: "Pendente" },
];

const SUBSCRIPTION_OPTIONS = [
  { value: "", label: "Todas as assinaturas" },
  { value: "active", label: "Ativa" },
  { value: "pending", label: "Pendente" },
  { value: "paused", label: "Pausada" },
  { value: "cancelled", label: "Cancelada" },
  { value: "expired", label: "Expirada" },
  { value: "none", label: "Sem assinatura" },
];

export function SuperAdminSalonsPage() {
  const [salons, setSalons] = useState<SuperAdminSalon[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const limit = 15;
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({
    q: "", status: "", plan: "", subscriptionStatus: "", createdFrom: "", createdTo: "",
  });

  const [selectedSalon, setSelectedSalon] = useState<SuperAdminSalonDetail | null>(null);
  const [selectedSalonUsers, setSelectedSalonUsers] = useState<SuperAdminSalonUser[]>([]);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [statusReasonModal, setStatusReasonModal] = useState({
    open: false, salonId: "", salonName: "", nextStatus: "", reason: "",
  });
  const [resetPasswordModal, setResetPasswordModal] = useState({
    open: false,
    user: null as SuperAdminSalonUser | null,
    newPassword: "",
    generatedPassword: "",
    isSubmitting: false,
  });

  const loadSalons = useCallback(async () => {
    const result = await listSuperAdminSalons({
      page, limit,
      q: filters.q || undefined,
      status: (filters.status || undefined) as SalonStatus | undefined,
      plan: filters.plan || undefined,
      subscriptionStatus: (filters.subscriptionStatus || undefined) as "active" | "paused" | "cancelled" | "expired" | "pending" | "none" | undefined,
      createdFrom: filters.createdFrom || undefined,
      createdTo: filters.createdTo || undefined,
      sortBy: "createdAt",
      sortOrder: "desc",
    });
    setSalons(Array.isArray(result?.items) ? result.items : []);
    setTotal(Number(result?.total || 0));
    setTotalPages(Number(result?.totalPages || 1));
  }, [filters, page]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try { await loadSalons(); } catch { toast.error("Nao foi possivel carregar as salões."); } finally { setLoading(false); }
    })();
  }, [loadSalons]);

  const handleSearchSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setPage(1);
    setLoading(true);
    try { await loadSalons(); } catch { toast.error("Erro ao aplicar filtros."); } finally { setLoading(false); }
  };

  const openDetails = async (salonId: string) => {
    setDetailsLoading(true);
    try {
      const [details, usersData] = await Promise.all([
        getSuperAdminSalonById(salonId),
        listSuperAdminSalonUsers(salonId),
      ]);
      setSelectedSalon(details);
      setSelectedSalonUsers(Array.isArray(usersData?.items) ? usersData.items : []);
    } catch { toast.error("Nao foi possivel carregar os detalhes."); } finally { setDetailsLoading(false); }
  };

  const closeDetails = () => { setSelectedSalon(null); setSelectedSalonUsers([]); };

  const performStatusUpdate = async (salonId: string, nextStatus: string, reason?: string | null) => {
    try {
      await updateSuperAdminSalonStatus(salonId, nextStatus as SalonStatus, reason);
      toast.success("Status atualizado com sucesso.");
      await loadSalons();
      if (selectedSalon?.id === salonId) {
        const details = await getSuperAdminSalonById(salonId);
        setSelectedSalon(details);
      }
    } catch { toast.error("Nao foi possivel atualizar o status."); }
  };

  const handleStatusUpdate = async (salonId: string, nextStatus: string) => {
    if (nextStatus === "blocked" || nextStatus === "inactive") {
      const shop = salons.find((s) => s.id === salonId);
      setStatusReasonModal({ open: true, salonId, salonName: shop?.name ?? "Salão", nextStatus, reason: "" });
      return;
    }
    await performStatusUpdate(salonId, nextStatus, null);
  };

  const closeStatusReasonModal = () =>
    setStatusReasonModal({ open: false, salonId: "", salonName: "", nextStatus: "", reason: "" });

  const submitStatusReasonModal = async () => {
    const reason = statusReasonModal.reason.trim() || null;
    const { salonId, nextStatus } = statusReasonModal;
    closeStatusReasonModal();
    await performStatusUpdate(salonId, nextStatus, reason);
  };

  const openResetPasswordModal = (user: SuperAdminSalonUser) =>
    setResetPasswordModal({ open: true, user, newPassword: "", generatedPassword: "", isSubmitting: false });

  const closeResetPasswordModal = () =>
    setResetPasswordModal({ open: false, user: null, newPassword: "", generatedPassword: "", isSubmitting: false });

  const submitResetPasswordModal = async () => {
    if (!resetPasswordModal.user) return;
    setResetPasswordModal((p) => ({ ...p, isSubmitting: true }));
    try {
      const pw = resetPasswordModal.newPassword.trim() || undefined;
      const res = await resetSuperAdminUserPassword(resetPasswordModal.user.id, pw);
      setResetPasswordModal((p) => ({ ...p, generatedPassword: res?.password ?? "", isSubmitting: false }));
      toast.success("Senha redefinida com sucesso.");
    } catch {
      setResetPasswordModal((p) => ({ ...p, isSubmitting: false }));
      toast.error("Erro ao redefinir senha.");
    }
  };

  const subscriptionsByShop: Record<string, { planName: string | null; price: number | null }> = {};
  for (const shop of salons) {
    const platformSub = shop.platformSubscription;
    const platformPlan = platformSub?.platform_plans ?? null;
    const sub = shop.subscription;
    const clientPlan = sub?.subscription_plans ?? null;
    subscriptionsByShop[shop.id] = {
      planName: platformPlan?.name ?? platformSub?.selected_plan ?? clientPlan?.name ?? null,
      price: platformSub?.amount ?? platformPlan?.price ?? clientPlan?.price ?? null,
    };
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-foreground">Gestao de Salões</h3>
        <p className="text-sm text-muted-foreground">Filtre, visualize detalhes e atualize o status das salões.</p>
      </div>

      <form onSubmit={handleSearchSubmit} className="flex flex-wrap gap-2">
        <input type="text" placeholder="Buscar por nome, email, telefone, slug ou documento"
          value={filters.q} onChange={(e) => setFilters((p) => ({ ...p, q: e.target.value }))}
          className="h-9 min-w-48 flex-1 rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
        <select value={filters.status} onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}
          className="h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40">
          {STATUS_OPTIONS.map((o) => <option key={o.value || "all"} value={o.value}>{o.label}</option>)}
        </select>
        <select value={filters.subscriptionStatus} onChange={(e) => setFilters((p) => ({ ...p, subscriptionStatus: e.target.value }))}
          className="h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40">
          {SUBSCRIPTION_OPTIONS.map((o) => <option key={o.value || "all-sub"} value={o.value}>{o.label}</option>)}
        </select>
        <input type="text" placeholder="Filtrar por plano" value={filters.plan}
          onChange={(e) => setFilters((p) => ({ ...p, plan: e.target.value }))}
          className="h-9 w-40 rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
        <input type="date" value={filters.createdFrom} onChange={(e) => setFilters((p) => ({ ...p, createdFrom: e.target.value }))}
          className="h-9 w-36 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40" />
        <input type="date" value={filters.createdTo} onChange={(e) => setFilters((p) => ({ ...p, createdTo: e.target.value }))}
          className="h-9 w-36 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40" />
        <button type="submit" className="h-9 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">Filtrar</button>
      </form>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <th className="px-5 py-3">Salão</th>
                <th className="px-5 py-3">Responsavel</th>
                <th className="px-5 py-3">Plano</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Criacao</th>
                <th className="px-5 py-3">Indicadores</th>
                <th className="px-5 py-3">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">
                  <Loader2 className="mx-auto mb-2 animate-spin" size={20} />Carregando...
                </td></tr>
              ) : salons.length === 0 ? (
                <tr><td colSpan={7} className="p-8 text-center text-sm text-muted-foreground">Nenhuma salão encontrada.</td></tr>
              ) : salons.map((shop) => (
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
                    <strong className="block text-foreground">{subscriptionsByShop[shop.id]?.planName ?? "Sem plano"}</strong>
                    <small className="text-muted-foreground">{fmtCurrency(subscriptionsByShop[shop.id]?.price)}</small>
                  </td>
                  <td className="px-5 py-3"><StatusBadge status={shop.status} /></td>
                  <td className="px-5 py-3 text-muted-foreground">{fmtDate(shop.createdAt)}</td>
                  <td className="px-5 py-3">
                    <small className="block text-muted-foreground">Ag: {shop.metrics?.appointmentsCount ?? 0} | Cli: {shop.metrics?.clientsCount ?? 0} | Func: {shop.metrics?.employeesCount ?? 0}</small>
                    <small className="block text-muted-foreground">Serv: {shop.metrics?.servicesCount ?? 0} | Prod: {shop.metrics?.productsCount ?? 0}</small>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex flex-wrap gap-1">
                      <button type="button" onClick={() => void openDetails(shop.id)} className="rounded bg-secondary px-2 py-1 text-xs font-medium text-foreground hover:bg-secondary/80">Detalhes</button>
                      <button type="button" onClick={() => void handleStatusUpdate(shop.id, "active")} className="rounded bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-600 hover:bg-emerald-500/20">Ativar</button>
                      <button type="button" onClick={() => void handleStatusUpdate(shop.id, "inactive")} className="rounded bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-600 hover:bg-amber-500/20">Inativar</button>
                      <button type="button" onClick={() => void handleStatusUpdate(shop.id, "blocked")} className="rounded bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/20">Bloquear</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-border px-5 py-3 text-sm text-muted-foreground">
          <span>Pagina {page} de {totalPages} | Total: {total}</span>
          <div className="flex gap-2">
            <button type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded border border-border px-3 py-1 text-xs disabled:opacity-40 hover:bg-secondary">Anterior</button>
            <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded border border-border px-3 py-1 text-xs disabled:opacity-40 hover:bg-secondary">Proxima</button>
          </div>
        </div>
      </div>

      {/* Modal Detalhes */}
      {selectedSalon && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={closeDetails}>
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            {detailsLoading ? (
              <div className="flex justify-center py-10"><Loader2 className="animate-spin text-muted-foreground" size={24} /></div>
            ) : (
              <>
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-foreground">{selectedSalon.name}</h3>
                  <button type="button" onClick={closeDetails} className="rounded border border-border px-3 py-1 text-sm text-muted-foreground hover:bg-secondary">Fechar</button>
                </div>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div className="space-y-2 text-sm">
                    <h4 className="font-semibold text-foreground">Dados principais</h4>
                    <p><strong className="text-muted-foreground">Slug:</strong> <span className="text-foreground">{selectedSalon.slug}</span></p>
                    <p><strong className="text-muted-foreground">Email:</strong> <span className="text-foreground">{selectedSalon.email ?? "-"}</span></p>
                    <p><strong className="text-muted-foreground">Telefone:</strong> <span className="text-foreground">{selectedSalon.phone ?? "-"}</span></p>
                    <p><strong className="text-muted-foreground">CNPJ:</strong> <span className="text-foreground">{selectedSalon.cnpj ?? "-"}</span></p>
                    <p><strong className="text-muted-foreground">Status:</strong> <StatusBadge status={selectedSalon.status} /></p>
                    <p><strong className="text-muted-foreground">Criada em:</strong> <span className="text-foreground">{fmtDate(selectedSalon.createdAt)}</span></p>
                  </div>
                  <div className="space-y-2 text-sm">
                    <h4 className="font-semibold text-foreground">Assinaturas recentes</h4>
                    {!selectedSalon.subscriptions?.length ? (
                      <p className="text-muted-foreground">Sem assinaturas registradas.</p>
                    ) : (
                      <ul className="space-y-2">
                        {selectedSalon.subscriptions.map((sub) => (
                          <li key={sub.id} className="rounded-lg border border-border bg-secondary/30 p-3">
                            <p className="font-medium text-foreground">{sub.subscription_plans?.name ?? "Plano desconhecido"}</p>
                            <p className="text-xs text-muted-foreground">Status: {sub.status}</p>
                            <p className="text-xs text-muted-foreground">Proxima cobranca: {fmtDate(sub.next_billing_at)}</p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
                {selectedSalonUsers.length > 0 && (
                  <div className="mt-5 space-y-2">
                    <h4 className="text-sm font-semibold text-foreground">Usuarios vinculados ({selectedSalonUsers.length})</h4>
                    <div className="overflow-hidden rounded-lg border border-border">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                            <th className="px-4 py-2">Nome</th>
                            <th className="px-4 py-2">Email</th>
                            <th className="px-4 py-2">Telefone</th>
                            <th className="px-4 py-2">Perfil</th>
                            <th className="px-4 py-2">Criacao</th>
                            <th className="px-4 py-2">Acoes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedSalonUsers.map((u) => (
                            <tr key={u.id} className="border-b border-border last:border-0">
                              <td className="px-4 py-2 font-medium text-foreground">{u.name}</td>
                              <td className="px-4 py-2 text-muted-foreground">{u.email ?? "-"}</td>
                              <td className="px-4 py-2 text-muted-foreground">{u.phone ?? "-"}</td>
                              <td className="px-4 py-2 text-muted-foreground">{u.role}</td>
                              <td className="px-4 py-2 text-muted-foreground">{fmtDate(u.created_at)}</td>
                              <td className="px-4 py-2">
                                <button type="button" onClick={() => openResetPasswordModal(u)}
                                  className="rounded border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-secondary">
                                  Resetar senha
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Modal Motivo de status */}
      {statusReasonModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={closeStatusReasonModal}>
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">
                {statusReasonModal.nextStatus === "blocked" ? "Bloquear salão" : "Inativar salão"}
              </h3>
              <button type="button" onClick={closeStatusReasonModal} className="rounded border border-border px-3 py-1 text-sm text-muted-foreground hover:bg-secondary">Fechar</button>
            </div>
            <p className="mb-4 text-sm text-muted-foreground">
              Informe um motivo (opcional) para {statusReasonModal.nextStatus === "blocked" ? "bloquear" : "inativar"}{" "}
              <strong className="text-foreground">{statusReasonModal.salonName}</strong>.
            </p>
            <textarea value={statusReasonModal.reason}
              onChange={(e) => setStatusReasonModal((p) => ({ ...p, reason: e.target.value }))}
              rows={4} placeholder="Ex.: pendencia financeira, solicitacao do responsavel..."
              className="mb-4 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={closeStatusReasonModal} className="rounded border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-secondary">Cancelar</button>
              <button type="button" onClick={() => void submitStatusReasonModal()}
                className={`rounded px-4 py-2 text-sm font-medium text-white ${statusReasonModal.nextStatus === "blocked" ? "bg-destructive hover:bg-destructive/90" : "bg-amber-600 hover:bg-amber-700"}`}>
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Resetar senha */}
      {resetPasswordModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={closeResetPasswordModal}>
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">Redefinir Senha</h3>
              <button type="button" onClick={closeResetPasswordModal} className="rounded border border-border px-3 py-1 text-sm text-muted-foreground hover:bg-secondary">Fechar</button>
            </div>
            {!resetPasswordModal.generatedPassword ? (
              <>
                <p className="mb-4 text-sm text-muted-foreground">
                  Redefinir senha de <strong className="text-foreground">{resetPasswordModal.user?.name ?? resetPasswordModal.user?.email}</strong>.
                </p>
                <div className="mb-4 space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Nova senha (deixe vazio para gerar automaticamente)</label>
                  <input type="text" value={resetPasswordModal.newPassword}
                    onChange={(e) => setResetPasswordModal((p) => ({ ...p, newPassword: e.target.value }))}
                    placeholder="Ex.: Abc@1234"
                    className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={closeResetPasswordModal} className="rounded border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-secondary">Cancelar</button>
                  <button type="button" onClick={() => void submitResetPasswordModal()} disabled={resetPasswordModal.isSubmitting}
                    className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                    {resetPasswordModal.isSubmitting ? "Redefinindo..." : "Confirmar"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="mb-3 text-sm text-muted-foreground">Senha redefinida com sucesso!</p>
                <div className="mb-3 space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Senha temporaria</label>
                  <input type="text" readOnly value={resetPasswordModal.generatedPassword}
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                    className="h-9 w-full cursor-text rounded-lg border border-border bg-secondary px-3 font-mono text-sm text-foreground focus:outline-none"
                  />
                </div>
                <p className="mb-4 text-xs text-muted-foreground">Compartilhe esta senha com o usuario. Ele devera altera-la no primeiro acesso.</p>
                <div className="flex justify-end">
                  <button type="button" onClick={closeResetPasswordModal} className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">Concluido</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
