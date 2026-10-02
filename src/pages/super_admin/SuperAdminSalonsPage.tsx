import { type FormEvent, useCallback, useEffect, useState } from "react";
import { CreditCard, Loader2, LogIn, QrCode } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import {
  listSuperAdminSalons,
  getSuperAdminSalonById,
  listSuperAdminSalonUsers,
  updateSuperAdminSalonStatus,
  deleteSuperAdminSalon,
  createSuperAdminSalonUnit,
  createPagarmeSubscriptionPaymentLink,
  getPlatformPlans,
  resetSuperAdminUserPassword,
  type SalonStatus,
  type SuperAdminSalon,
  type SuperAdminSalonDetail,
  type SuperAdminSalonUser,
  type PlatformPlan,
} from "@/service/superAdminService";
import { useAuth } from "@/hooks/useAuth";

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

function businessTypeLabel(type?: string | null) {
  const labels: Record<string, string> = {
    beauty_salon: "Salão de beleza",
    aesthetics: "Clínica de estética",
    manicure_pedicure: "Manicure e pedicure",
    spa: "Spa",
    other: "Outro",
  };
  return labels[type ?? ""] ?? "Não informado";
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
  const navigate = useNavigate();
  const { enterSalonAccess } = useAuth();
  const [salons, setSalons] = useState<SuperAdminSalon[]>([]);
  const [platformPlans, setPlatformPlans] = useState<PlatformPlan[]>([]);
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
  const [accessingSalonId, setAccessingSalonId] = useState<string | null>(null);
  const [deleteModal, setDeleteModal] = useState({ open: false, salonId: "", salonName: "", slug: "", typedSlug: "", isSubmitting: false });
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
  const [createUnitModal, setCreateUnitModal] = useState({
    open: false, submitting: false, name: "", phone: "", ownerName: "", ownerEmail: "", ownerPassword: "", maxUnits: "1", unlimited: false,
    billingMode: "free" as "free" | "manual_pix" | "card", negotiatedAmount: "", billingInterval: "month" as "month" | "year", dueDate: "", platformPlanId: "",
  });
  const [paymentLinkModal, setPaymentLinkModal] = useState({ open: false, salonName: "", url: "", expiresAt: null as string | null });

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

  useEffect(() => { void getPlatformPlans().then((plans) => setPlatformPlans(plans.filter((plan) => plan.active !== false))).catch(() => setPlatformPlans([])); }, []);

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

  const accessSalon = async (salon: Pick<SuperAdminSalon, "id" | "name">) => {
    setAccessingSalonId(salon.id);
    try {
      await enterSalonAccess(salon.id);
      toast.success(`Acessando o painel de ${salon.name}.`);
      navigate("/home", { replace: true });
    } catch (error) {
      toast.error((error as { response?: { data?: { message?: string } } })?.response?.data?.message || "Não foi possível acessar este salão.");
    } finally {
      setAccessingSalonId(null);
    }
  };

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

  const closeDeleteModal = () => setDeleteModal({ open: false, salonId: "", salonName: "", slug: "", typedSlug: "", isSubmitting: false });

  const submitDeleteModal = async () => {
    setDeleteModal((p) => ({ ...p, isSubmitting: true }));
    try {
      const result = await deleteSuperAdminSalon(deleteModal.salonId, deleteModal.typedSlug.trim());
      toast.success(`Salão ${result.name} excluído (${result.deletedUsers} usuário(s) removido(s)).`);
      closeDeleteModal();
      await loadSalons();
    } catch (err) {
      setDeleteModal((p) => ({ ...p, isSubmitting: false }));
      toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Não foi possível excluir o salão.");
    }
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

  const closeCreateUnitModal = () => setCreateUnitModal({ open: false, submitting: false, name: "", phone: "", ownerName: "", ownerEmail: "", ownerPassword: "", maxUnits: "1", unlimited: false, billingMode: "free", negotiatedAmount: "", billingInterval: "month", dueDate: "", platformPlanId: "" });
  const submitCreateUnit = async () => {
    const form = createUnitModal;
    if (!form.name.trim() || !form.ownerEmail.trim()) { toast.error("Informe a unidade e o e-mail do responsável."); return; }
    if (!form.unlimited && (!Number.isInteger(Number(form.maxUnits)) || Number(form.maxUnits) < 1)) { toast.error("Informe um limite de unidades válido."); return; }
    const negotiatedAmount = form.negotiatedAmount.trim() ? Number(form.negotiatedAmount.replace(",", ".")) : undefined;
    if (form.billingMode === "manual_pix" && (negotiatedAmount === undefined || !Number.isFinite(negotiatedAmount) || negotiatedAmount < 0)) { toast.error("Informe o valor negociado do PIX."); return; }
    if (form.billingMode === "manual_pix" && !form.dueDate) { toast.error("Informe o vencimento do PIX."); return; }
    if (form.billingMode !== "free" && !form.platformPlanId) { toast.error("Selecione o plano da assinatura."); return; }
    setCreateUnitModal((current) => ({ ...current, submitting: true }));
    try {
      const result = await createSuperAdminSalonUnit({
        name: form.name.trim(), businessType: "beauty_salon", phone: form.phone.trim() || null,
        ownerName: form.ownerName.trim() || undefined, ownerEmail: form.ownerEmail.trim(), ownerPassword: form.ownerPassword.trim() || undefined,
        maxSalonUnits: form.unlimited ? null : Number(form.maxUnits),
        billingMode: form.billingMode,
        negotiatedAmount: form.billingMode === "manual_pix" ? negotiatedAmount : undefined,
        billingInterval: form.billingMode === "manual_pix" ? form.billingInterval : undefined,
        dueDate: form.billingMode === "manual_pix" ? form.dueDate : undefined,
        selectedPlanId: form.billingMode !== "free" ? form.platformPlanId : undefined,
      });
      if (form.billingMode === "card") {
        const link = await createPagarmeSubscriptionPaymentLink(result.salon.id, form.platformPlanId);
        setPaymentLinkModal({ open: true, salonName: result.salon.name, url: link.paymentUrl, expiresAt: link.expiresAt ?? null });
        toast.success("Unidade criada. Envie o link para o cliente concluir a assinatura.");
      } else toast.success(form.billingMode === "manual_pix" ? "Unidade criada e aguardando pagamento." : `Unidade criada para ${result.owner.name}.`);
      closeCreateUnitModal();
      await loadSalons();
    } catch (error) {
      toast.error((error as { response?: { data?: { message?: string } } })?.response?.data?.message || "Não foi possível criar a unidade.");
      setCreateUnitModal((current) => ({ ...current, submitting: false }));
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h3 className="text-base font-semibold text-foreground">Gestao de Salões</h3><p className="text-sm text-muted-foreground">Filtre, visualize detalhes e atualize o status das salões.</p></div>
        <button type="button" onClick={() => setCreateUnitModal((current) => ({ ...current, open: true }))} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">Cadastrar unidade</button>
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
                    <small className="block text-primary">{businessTypeLabel(shop.businessType)}</small>
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
                    <div className="grid min-w-56 grid-cols-2 gap-x-4 gap-y-1 text-xs">
                      <span className="text-muted-foreground">Agendamentos: <strong className="text-foreground">{shop.metrics?.appointmentsCount ?? 0}</strong></span>
                      <span className="text-muted-foreground">Clientes: <strong className="text-foreground">{shop.metrics?.clientsCount ?? 0}</strong></span>
                      <span className="text-muted-foreground">Funcionários: <strong className="text-foreground">{shop.metrics?.employeesCount ?? 0}</strong></span>
                      <span className="text-muted-foreground">Serviços: <strong className="text-foreground">{shop.metrics?.servicesCount ?? 0}</strong></span>
                      <span className="text-muted-foreground">Produtos: <strong className="text-foreground">{shop.metrics?.productsCount ?? 0}</strong></span>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex flex-wrap gap-1">
                      <button type="button" onClick={() => void openDetails(shop.id)} className="rounded bg-secondary px-2 py-1 text-xs font-medium text-foreground hover:bg-secondary/80">Detalhes</button>
                      <button type="button" onClick={() => void accessSalon(shop)} disabled={accessingSalonId !== null} className="inline-flex items-center gap-1 rounded bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
                        {accessingSalonId === shop.id ? <Loader2 size={12} className="animate-spin" /> : <LogIn size={12} />} Acessar
                      </button>
                      <button type="button" onClick={() => void handleStatusUpdate(shop.id, "active")} className="rounded bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-600 hover:bg-emerald-500/20">Ativar</button>
                      <button type="button" onClick={() => void handleStatusUpdate(shop.id, "inactive")} className="rounded bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-600 hover:bg-amber-500/20">Inativar</button>
                      <button type="button" onClick={() => void handleStatusUpdate(shop.id, "blocked")} className="rounded bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/20">Bloquear</button>
                      <button type="button" onClick={() => setDeleteModal({ open: true, salonId: shop.id, salonName: shop.name, slug: shop.slug, typedSlug: "", isSubmitting: false })} className="rounded border border-destructive/40 px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/10">Excluir</button>
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

      {createUnitModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={closeCreateUnitModal}>
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-xl" onClick={(event) => event.stopPropagation()}>
            <div className="mb-4"><h3 className="text-lg font-semibold text-foreground">Cadastrar unidade</h3><p className="mt-1 text-sm text-muted-foreground">Defina o responsável e o limite contratado de unidades.</p></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm text-muted-foreground sm:col-span-2">Nome da unidade<input value={createUnitModal.name} onChange={(e) => setCreateUnitModal((p) => ({ ...p, name: e.target.value }))} className="h-9 w-full rounded-lg border border-border bg-background px-3 text-foreground" /></label>
              <label className="space-y-1 text-sm text-muted-foreground sm:col-span-2">Telefone da unidade (opcional)<input value={createUnitModal.phone} onChange={(e) => setCreateUnitModal((p) => ({ ...p, phone: e.target.value }))} className="h-9 w-full rounded-lg border border-border bg-background px-3 text-foreground" /></label>
              <label className="space-y-1 text-sm text-muted-foreground">Nome do responsável<input value={createUnitModal.ownerName} onChange={(e) => setCreateUnitModal((p) => ({ ...p, ownerName: e.target.value }))} placeholder="Obrigatório se for uma conta nova" className="h-9 w-full rounded-lg border border-border bg-background px-3 text-foreground" /></label>
              <label className="space-y-1 text-sm text-muted-foreground">E-mail do responsável<input type="email" value={createUnitModal.ownerEmail} onChange={(e) => setCreateUnitModal((p) => ({ ...p, ownerEmail: e.target.value }))} className="h-9 w-full rounded-lg border border-border bg-background px-3 text-foreground" /></label>
              <label className="space-y-1 text-sm text-muted-foreground sm:col-span-2">Senha temporária (necessária somente para conta nova)<input type="password" value={createUnitModal.ownerPassword} onChange={(e) => setCreateUnitModal((p) => ({ ...p, ownerPassword: e.target.value }))} className="h-9 w-full rounded-lg border border-border bg-background px-3 text-foreground" /></label>
              <label className="space-y-1 text-sm text-muted-foreground">Limite de unidades<input type="number" min="1" disabled={createUnitModal.unlimited} value={createUnitModal.maxUnits} onChange={(e) => setCreateUnitModal((p) => ({ ...p, maxUnits: e.target.value }))} className="h-9 w-full rounded-lg border border-border bg-background px-3 text-foreground disabled:opacity-50" /></label>
              <label className="flex items-end gap-2 pb-2 text-sm text-foreground"><input type="checkbox" checked={createUnitModal.unlimited} onChange={(e) => setCreateUnitModal((p) => ({ ...p, unlimited: e.target.checked }))} /> Unidades ilimitadas</label>
            </div>
            <p className="mt-4 rounded-lg bg-secondary/50 p-3 text-xs text-muted-foreground">Para um dono existente, informe apenas o e-mail. O novo limite substituirá o limite atual contratado.</p>
            <fieldset className="mt-5">
              <legend className="text-sm font-medium text-foreground">Cobrança inicial da unidade</legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {([{ value: "free", label: "Sem cobrança", icon: CreditCard }, { value: "manual_pix", label: "PIX manual", icon: QrCode }, { value: "card", label: "Cartão recorrente", icon: CreditCard }] as const).map(({ value, label, icon: Icon }) => <label key={value} className={`cursor-pointer rounded-lg border p-3 text-sm ${createUnitModal.billingMode === value ? "border-primary bg-primary/5" : "border-border"}`}><input className="sr-only" type="radio" checked={createUnitModal.billingMode === value} onChange={() => setCreateUnitModal((p) => ({ ...p, billingMode: value }))} /><Icon size={17} className="mb-1.5 text-primary" /><span className="block font-medium text-foreground">{label}</span></label>)}
              </div>
            </fieldset>
            {createUnitModal.billingMode === "manual_pix" && <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4"><label className="block space-y-1 text-sm text-muted-foreground">Plano da assinatura<select value={createUnitModal.platformPlanId} onChange={(e) => setCreateUnitModal((p) => ({ ...p, platformPlanId: e.target.value }))} className="h-9 w-full rounded-lg border border-border bg-background px-3 text-foreground"><option value="">Selecione um plano</option>{platformPlans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name} — {fmtCurrency(plan.price)}</option>)}</select></label></div>}
            {createUnitModal.billingMode === "manual_pix" && <div className="mt-4 grid gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 sm:grid-cols-2"><label className="space-y-1 text-sm text-muted-foreground">Valor negociado<input inputMode="decimal" placeholder="Ex.: 99,90" value={createUnitModal.negotiatedAmount} onChange={(e) => setCreateUnitModal((p) => ({ ...p, negotiatedAmount: e.target.value }))} className="h-9 w-full rounded-lg border border-border bg-background px-3 text-foreground" /></label><label className="space-y-1 text-sm text-muted-foreground">Periodicidade<select value={createUnitModal.billingInterval} onChange={(e) => setCreateUnitModal((p) => ({ ...p, billingInterval: e.target.value as "month" | "year" }))} className="h-9 w-full rounded-lg border border-border bg-background px-3 text-foreground"><option value="month">Mensal</option><option value="year">Anual</option></select></label><label className="space-y-1 text-sm text-muted-foreground sm:col-span-2">Vencimento<input type="date" value={createUnitModal.dueDate} onChange={(e) => setCreateUnitModal((p) => ({ ...p, dueDate: e.target.value }))} className="h-9 w-full rounded-lg border border-border bg-background px-3 text-foreground" /></label><p className="text-xs text-amber-800 sm:col-span-2">A unidade será criada com o status “Aguardando pagamento”.</p></div>}
            {createUnitModal.billingMode === "card" && <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4"><label className="block space-y-1 text-sm text-muted-foreground">Plano da assinatura recorrente<select value={createUnitModal.platformPlanId} onChange={(e) => setCreateUnitModal((p) => ({ ...p, platformPlanId: e.target.value }))} className="h-9 w-full rounded-lg border border-border bg-background px-3 text-foreground"><option value="">Selecione um plano</option>{platformPlans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name} — {fmtCurrency(plan.price)}</option>)}</select></label><p className="mt-2 text-xs text-muted-foreground">Ao criar, será gerado um link do Pagar.me para você enviar ao cliente. A recorrência começa após o pagamento.</p></div>}
            <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={closeCreateUnitModal} className="rounded border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-secondary">Cancelar</button><button type="button" onClick={() => void submitCreateUnit()} disabled={createUnitModal.submitting} className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">{createUnitModal.submitting ? "Criando..." : "Criar unidade"}</button></div>
          </div>
        </div>
      )}

      {paymentLinkModal.open && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" onClick={() => setPaymentLinkModal((p) => ({ ...p, open: false }))}><div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-xl" onClick={(event) => event.stopPropagation()}><h3 className="text-lg font-semibold text-foreground">Link de assinatura criado</h3><p className="mt-1 text-sm text-muted-foreground">Envie este link para {paymentLinkModal.salonName}. Após o pagamento, o Pagar.me ativa a recorrência.</p><input readOnly value={paymentLinkModal.url} className="mt-4 h-10 w-full rounded-lg border border-border bg-secondary px-3 text-sm text-foreground" /><div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => setPaymentLinkModal((p) => ({ ...p, open: false }))} className="rounded border border-border px-4 py-2 text-sm">Fechar</button><button type="button" onClick={() => void navigator.clipboard.writeText(paymentLinkModal.url).then(() => toast.success("Link copiado."))} className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Copiar link</button></div></div></div>}

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
                    <p><strong className="text-muted-foreground">Tipo de empresa:</strong> <span className="text-foreground">{businessTypeLabel(selectedSalon.businessType)}</span></p>
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

      {/* Modal Excluir salao */}
      {deleteModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={closeDeleteModal}>
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-3 text-lg font-semibold text-destructive">Excluir salão permanentemente</h3>
            <p className="mb-3 text-sm text-muted-foreground">
              Isso apaga <strong className="text-foreground">{deleteModal.salonName}</strong> e todos os dados vinculados (agendamentos, clientes, serviços, produtos, funcionários e usuários que ficarem sem salão). Não pode ser desfeito.
            </p>
            <p className="mb-2 text-sm text-muted-foreground">Digite o slug <code className="rounded bg-secondary px-1 text-foreground">{deleteModal.slug}</code> para confirmar:</p>
            <input type="text" value={deleteModal.typedSlug} onChange={(e) => setDeleteModal((p) => ({ ...p, typedSlug: e.target.value }))}
              className="mb-4 h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-destructive/40" />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={closeDeleteModal} className="rounded border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-secondary">Cancelar</button>
              <button type="button" onClick={() => void submitDeleteModal()} disabled={deleteModal.isSubmitting || deleteModal.typedSlug.trim() !== deleteModal.slug}
                className="rounded bg-destructive px-4 py-2 text-sm font-medium text-white hover:bg-destructive/90 disabled:opacity-40">
                {deleteModal.isSubmitting ? "Excluindo..." : "Excluir definitivamente"}
              </button>
            </div>
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
