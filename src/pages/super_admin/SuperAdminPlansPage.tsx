import { type FormEvent, useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  getPlatformPlans,
  createPlatformPlan,
  updatePlatformPlan,
  deletePlatformPlan,
  type PlatformPlan,
} from "@/service/superAdminService";

function fmtCurrency(value?: number | null) {
  if (value == null) return "-";
  const n = Number(value);
  if (!Number.isFinite(n)) return "-";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function parseMoneyToCents(value: string): number {
  const normalized = String(value || "").replace(/\./g, "").replace(",", ".").trim();
  const n = Number(normalized);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * 100);
}

function fmtInterval(interval: string, intervalCount?: number | null) {
  const count = Number(intervalCount || 1);
  const map: Record<string, string> = {
    day: count === 1 ? "dia" : "dias",
    week: count === 1 ? "semana" : "semanas",
    month: count === 1 ? "mes" : "meses",
    year: count === 1 ? "ano" : "anos",
  };
  return `A cada ${count} ${map[interval] ?? "mes"}`;
}

const EMPTY_FORM = {
  name: "", description: "", price: "", interval: "month", intervalCount: "1",
  trialPeriodDays: "0", statementDescriptor: "SALAONE",
  paymentMethods: ["credit_card"] as string[], features: "",
  maxProfessionals: "", maxAdmins: "", maxReceptionists: "",
  isPublic: true, isRecommended: false, sortOrder: "0", syncPagarme: true,
};

type PlanForm = typeof EMPTY_FORM;

function togglePM(form: PlanForm, method: string): PlanForm {
  const exists = form.paymentMethods.includes(method);
  const next = exists ? form.paymentMethods.filter((m) => m !== method) : [...form.paymentMethods, method];
  return { ...form, paymentMethods: next.length > 0 ? next : ["credit_card"] };
}

const FORM_FIELDS: { label: string; id: string; key: keyof PlanForm; type?: string; min?: string; maxLength?: number; placeholder: string }[] = [
  { label: "Nome do plano", id: "pn-name", key: "name", placeholder: "Ex.: Plano Basic", maxLength: 64 },
  { label: "Valor (R$)", id: "pn-price", key: "price", placeholder: "Ex.: 39,90" },
  { label: "Qtd. do intervalo", id: "pn-ic", key: "intervalCount", type: "number", min: "1", placeholder: "1" },
  { label: "Dias gratis (trial)", id: "pn-trial", key: "trialPeriodDays", type: "number", min: "0", placeholder: "0" },
  { label: "Ordem na landing", id: "pn-sort", key: "sortOrder", type: "number", placeholder: "0" },
  { label: "Max. profissionais", id: "pn-mb", key: "maxProfessionals", type: "number", min: "0", placeholder: "Vazio = ilimitado" },
  { label: "Max. admins", id: "pn-ma", key: "maxAdmins", type: "number", min: "0", placeholder: "Vazio = ilimitado" },
  { label: "Max. recepcionistas", id: "pn-mr", key: "maxReceptionists", type: "number", min: "0", placeholder: "Vazio = ilimitado" },
  { label: "Descricao na fatura (max. 13)", id: "pn-stmt", key: "statementDescriptor", maxLength: 13, placeholder: "SALAONE" },
];

export function SuperAdminPlansPage() {
  const [plans, setPlans] = useState<PlatformPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<PlanForm>({ ...EMPTY_FORM });
  const [editingPlan, setEditingPlan] = useState<PlatformPlan | null>(null);
  const [editForm, setEditForm] = useState<PlanForm>({ ...EMPTY_FORM });
  const [savingPlanId, setSavingPlanId] = useState<string | null>(null);
  const [deletingPlanId, setDeletingPlanId] = useState<string | null>(null);

  const loadPlans = useCallback(async () => {
    const data = await getPlatformPlans();
    setPlans(data);
  }, []);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try { await loadPlans(); } catch { toast.error("Nao foi possivel carregar os planos."); } finally { setLoading(false); }
    })();
  }, [loadPlans]);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    const cents = parseMoneyToCents(form.price);
    if (!form.name.trim()) { toast.error("Informe o nome do plano."); return; }
    if (!cents) { toast.error("Informe um valor valido."); return; }
    setCreating(true);
    try {
      const result = await createPlatformPlan({
        name: form.name.trim(), description: form.description.trim() || null,
        price: cents / 100, interval: form.interval, intervalCount: Number(form.intervalCount || 1),
        trialPeriodDays: Number(form.trialPeriodDays || 0), statementDescriptor: form.statementDescriptor.trim(),
        paymentMethods: form.paymentMethods,
        features: form.features.split("\n").map((f) => f.trim()).filter(Boolean),
        maxProfessionals: form.maxProfessionals ? Number(form.maxProfessionals) : null,
        maxAdmins: form.maxAdmins ? Number(form.maxAdmins) : null,
        maxReceptionists: form.maxReceptionists ? Number(form.maxReceptionists) : null,
        isPublic: form.isPublic, isRecommended: form.isRecommended,
        sortOrder: Number(form.sortOrder || 0), syncPagarme: form.syncPagarme,
      });
      const msg = result?.pagarmeSkipped
        ? "Plano salvo no banco. PAGARME_SECRET_KEY nao configurada."
        : form.syncPagarme ? "Plano criado no Pagar.me e salvo." : "Plano salvo (sem Pagar.me).";
      toast.success(msg);
      setForm({ ...EMPTY_FORM });
      await loadPlans();
    } catch { toast.error("Nao foi possivel criar o plano."); } finally { setCreating(false); }
  };

  const openEditPlan = (plan: PlatformPlan) => {
    setEditingPlan(plan);
    const pm = Array.isArray(plan.paymentMethods) && plan.paymentMethods.length ? plan.paymentMethods
      : Array.isArray(plan.payment_methods) && plan.payment_methods!.length ? plan.payment_methods! : ["credit_card"];
    setEditForm({
      name: plan.name ?? "", description: plan.description ?? "",
      price: plan.price != null ? Number(plan.price).toFixed(2).replace(".", ",") : "",
      interval: plan.interval ?? "month",
      intervalCount: String(plan.intervalCount ?? plan.interval_count ?? 1),
      trialPeriodDays: String(plan.trialPeriodDays ?? plan.trial_period_days ?? 0),
      statementDescriptor: plan.statementDescriptor ?? "SALAONE",
      paymentMethods: pm,
      features: Array.isArray(plan.features) ? plan.features.join("\n") : "",
      maxProfessionals: plan.maxProfessionals != null ? String(plan.maxProfessionals) : plan.max_professionals != null ? String(plan.max_professionals) : "",
      maxAdmins: plan.maxAdmins != null ? String(plan.maxAdmins) : plan.max_admins != null ? String(plan.max_admins) : "",
      maxReceptionists: plan.maxReceptionists != null ? String(plan.maxReceptionists) : plan.max_receptionists != null ? String(plan.max_receptionists) : "",
      isPublic: Boolean(plan.isPublic ?? plan.is_public),
      isRecommended: Boolean(plan.isRecommended ?? plan.is_recommended),
      sortOrder: String(plan.sortOrder ?? plan.sort_order ?? 0),
      syncPagarme: true,
    });
  };

  const handleEditSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingPlan) return;
    const cents = parseMoneyToCents(editForm.price);
    if (!cents) { toast.error("Informe um valor valido."); return; }
    setSavingPlanId(editingPlan.id);
    try {
      await updatePlatformPlan(editingPlan.id, {
        name: editForm.name.trim(), description: editForm.description.trim() || null,
        price: cents / 100,
        features: editForm.features.split("\n").map((f) => f.trim()).filter(Boolean),
        isPublic: editForm.isPublic, isRecommended: editForm.isRecommended,
        sortOrder: Number(editForm.sortOrder || 0),
        maxProfessionals: editForm.maxProfessionals ? Number(editForm.maxProfessionals) : null,
        maxAdmins: editForm.maxAdmins ? Number(editForm.maxAdmins) : null,
        maxReceptionists: editForm.maxReceptionists ? Number(editForm.maxReceptionists) : null,
        statementDescriptor: editForm.statementDescriptor.trim(),
        paymentMethods: editForm.paymentMethods,
      });
      toast.success("Plano atualizado.");
      setEditingPlan(null);
      await loadPlans();
    } catch { toast.error("Nao foi possivel atualizar o plano."); } finally { setSavingPlanId(null); }
  };

  const handleTogglePublic = async (plan: PlatformPlan) => {
    const isPublic = Boolean(plan.isPublic ?? plan.is_public);
    setSavingPlanId(plan.id);
    try {
      await updatePlatformPlan(plan.id, { isPublic: !isPublic });
      toast.success(isPublic ? "Plano ocultado da landing." : "Plano publicado na landing.");
      await loadPlans();
    } catch { toast.error("Nao foi possivel alterar a visibilidade."); } finally { setSavingPlanId(null); }
  };

  const handleToggleActive = async (plan: PlatformPlan) => {
    const isActive = plan.active !== false;
    setSavingPlanId(plan.id);
    try {
      await updatePlatformPlan(plan.id, { active: !isActive });
      toast.success(isActive ? "Plano desativado." : "Plano ativado.");
      await loadPlans();
    } catch { toast.error("Nao foi possivel alterar o status."); } finally { setSavingPlanId(null); }
  };

  const handleDelete = async (plan: PlatformPlan) => {
    const pid = plan.pagarmePlanId || plan.pagarme_plan_id;
    const warn = pid ? " O plano tambem sera removido do Pagar.me." : "";
    if (!window.confirm(`Excluir o plano "${plan.name}"?${warn} Essa acao nao pode ser desfeita.`)) return;
    setDeletingPlanId(plan.id);
    try {
      await deletePlatformPlan(plan.id);
      toast.success("Plano excluido.");
      await loadPlans();
    } catch { toast.error("Nao foi possivel excluir o plano."); } finally { setDeletingPlanId(null); }
  };

  const inputCls = "h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40";

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-foreground">Planos da Plataforma</h3>
        <p className="text-sm text-muted-foreground">Crie os planos recorrentes no Pagar.me e publique na landing page.</p>
      </div>

      {/* Formulario */}
      <form onSubmit={handleCreate} className="rounded-xl border border-border bg-card p-5 space-y-5">
        <h4 className="text-sm font-semibold text-foreground">Criar novo plano</h4>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FORM_FIELDS.map((f) => (
            <div key={f.id} className="space-y-1.5">
              <label htmlFor={f.id} className="text-xs font-medium text-muted-foreground">{f.label}</label>
              <input id={f.id} type={f.type ?? "text"} min={f.min} maxLength={f.maxLength} placeholder={f.placeholder}
                value={form[f.key] as string}
                onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                className={inputCls}
              />
            </div>
          ))}
          <div className="space-y-1.5">
            <label htmlFor="pn-interval" className="text-xs font-medium text-muted-foreground">Intervalo</label>
            <select id="pn-interval" value={form.interval} onChange={(e) => setForm((p) => ({ ...p, interval: e.target.value }))}
              className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40">
              <option value="month">Mensal</option>
              <option value="year">Anual</option>
              <option value="week">Semanal</option>
              <option value="day">Diario</option>
            </select>
          </div>
          <div className="col-span-full space-y-1.5">
            <label htmlFor="pn-desc" className="text-xs font-medium text-muted-foreground">Descricao</label>
            <textarea id="pn-desc" rows={2} value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="Descricao curta para a landing page."
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40" />
          </div>
          <div className="col-span-full space-y-1.5">
            <label htmlFor="pn-features" className="text-xs font-medium text-muted-foreground">Beneficios do plano (um por linha)</label>
            <textarea id="pn-features" rows={4} value={form.features} onChange={(e) => setForm((p) => ({ ...p, features: e.target.value }))}
              placeholder={"Ex.: Ate 2 profissionais\nAgenda online\nRelatorios basicos"}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40" />
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Formas de pagamento</p>
          <div className="flex flex-wrap gap-4">
            {[{ id: "credit_card", label: "Cartao de credito" }, { id: "boleto", label: "Boleto" }].map((m) => (
              <label key={m.id} className="flex items-center gap-2 text-sm text-foreground">
                <input type="checkbox" checked={form.paymentMethods.includes(m.id)} onChange={() => setForm((p) => togglePM(p, m.id))} className="rounded border-border accent-primary" />
                {m.label}
              </label>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Pix nao e suportado em recorrencia de assinatura no Pagar.me.</p>
        </div>
        <div className="flex flex-wrap gap-4">
          {[{ key: "isPublic", label: "Exibir na landing page" }, { key: "isRecommended", label: "Marcar como recomendado" }, { key: "syncPagarme", label: "Sincronizar com Pagar.me" }].map((opt) => (
            <label key={opt.key} className="flex items-center gap-2 text-sm text-foreground">
              <input type="checkbox" checked={Boolean(form[opt.key as keyof PlanForm])} onChange={(e) => setForm((p) => ({ ...p, [opt.key]: e.target.checked }))} className="rounded border-border accent-primary" />
              {opt.label}
            </label>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {form.syncPagarme ? "O plano sera criado na API do Pagar.me. Requer PAGARME_SECRET_KEY configurada no servidor." : "Salva o plano apenas no banco, sem chamar a API do Pagar.me."}
        </p>
        <button type="submit" disabled={creating} className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          {creating ? "Criando..." : form.syncPagarme ? "Criar plano no Pagar.me" : "Criar plano (so banco)"}
        </button>
      </form>

      {/* Tabela */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <th className="px-5 py-3">Plano</th>
                <th className="px-5 py-3">Recorrencia</th>
                <th className="px-5 py-3">Valor</th>
                <th className="px-5 py-3">Pagar.me ID</th>
                <th className="px-5 py-3">Landing</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="p-8 text-center text-muted-foreground"><Loader2 className="mx-auto mb-2 animate-spin" size={20} />Carregando...</td></tr>
              ) : plans.length === 0 ? (
                <tr><td colSpan={7} className="p-8 text-center text-sm text-muted-foreground">Nenhum plano criado ainda.</td></tr>
              ) : plans.map((plan) => {
                const isPublic = Boolean(plan.isPublic ?? plan.is_public);
                const isActive = plan.active !== false;
                const isBusy = savingPlanId === plan.id || deletingPlanId === plan.id;
                const pid = plan.pagarmePlanId || plan.pagarme_plan_id;
                return (
                  <tr key={plan.id} className="border-b border-border last:border-0 hover:bg-secondary/30">
                    <td className="px-5 py-3">
                      <strong className="block text-foreground">{plan.name}</strong>
                      {plan.description && <small className="text-muted-foreground">{plan.description}</small>}
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{fmtInterval(plan.interval, plan.intervalCount ?? plan.interval_count)}</td>
                    <td className="px-5 py-3 font-medium text-foreground">{fmtCurrency(plan.price)}</td>
                    <td className="px-5 py-3"><span className="font-mono text-xs text-muted-foreground">{pid || "-"}</span></td>
                    <td className="px-5 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${isPublic ? "bg-emerald-500/10 text-emerald-600" : "bg-secondary text-muted-foreground"}`}>
                        {isPublic ? "Publicado" : "Oculto"}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${isActive ? "bg-emerald-500/10 text-emerald-600" : "bg-secondary text-muted-foreground"}`}>
                        {isActive ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-1">
                        <button type="button" disabled={isBusy} onClick={() => openEditPlan(plan)} className="rounded bg-secondary px-2 py-1 text-xs font-medium text-foreground hover:bg-secondary/80 disabled:opacity-40">Editar</button>
                        <button type="button" disabled={isBusy} onClick={() => void handleTogglePublic(plan)} className="rounded border border-border px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-secondary disabled:opacity-40">{isPublic ? "Ocultar" : "Publicar"}</button>
                        <button type="button" disabled={isBusy} onClick={() => void handleToggleActive(plan)}
                          className={`rounded px-2 py-1 text-xs font-medium disabled:opacity-40 ${isActive ? "bg-amber-500/10 text-amber-600 hover:bg-amber-500/20" : "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20"}`}>
                          {savingPlanId === plan.id ? "..." : isActive ? "Desativar" : "Ativar"}
                        </button>
                        <button type="button" disabled={isBusy} onClick={() => void handleDelete(plan)} className="rounded bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/20 disabled:opacity-40">
                          {deletingPlanId === plan.id ? "..." : "Excluir"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Editar plano */}
      {editingPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setEditingPlan(null)}>
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">Editar plano</h3>
              <button type="button" onClick={() => setEditingPlan(null)} className="rounded border border-border px-3 py-1 text-sm text-muted-foreground hover:bg-secondary">Fechar</button>
            </div>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="col-span-full space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Nome do plano</label>
                  <input type="text" value={editForm.name} onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))} maxLength={64} required className={inputCls} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Valor (R$)</label>
                  <input type="text" value={editForm.price} onChange={(e) => setEditForm((p) => ({ ...p, price: e.target.value }))} placeholder="Ex.: 99,90" required className={inputCls} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Ordem na landing</label>
                  <input type="number" value={editForm.sortOrder} onChange={(e) => setEditForm((p) => ({ ...p, sortOrder: e.target.value }))} className={inputCls} />
                </div>
                {[{ label: "Max. profissionais", key: "maxProfessionals" }, { label: "Max. admins", key: "maxAdmins" }, { label: "Max. recepcionistas", key: "maxReceptionists" }].map((f) => (
                  <div key={f.key} className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">{f.label}</label>
                    <input type="number" min="0" value={editForm[f.key as keyof PlanForm] as string}
                      onChange={(e) => setEditForm((p) => ({ ...p, [f.key]: e.target.value }))} placeholder="Vazio = ilimitado" className={inputCls} />
                  </div>
                ))}
                <div className="col-span-full space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Descricao</label>
                  <textarea rows={2} value={editForm.description} onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40" />
                </div>
                <div className="col-span-full space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Beneficios (um por linha)</label>
                  <textarea rows={4} value={editForm.features} onChange={(e) => setEditForm((p) => ({ ...p, features: e.target.value }))}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Descricao na fatura (max. 13 car.)</label>
                  <input type="text" value={editForm.statementDescriptor} onChange={(e) => setEditForm((p) => ({ ...p, statementDescriptor: e.target.value }))} maxLength={13} className={inputCls} />
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Metodos de pagamento (Pagar.me)</p>
                <div className="flex flex-wrap gap-4">
                  {[{ id: "credit_card", label: "Cartao de credito" }, { id: "boleto", label: "Boleto" }].map((m) => (
                    <label key={m.id} className="flex items-center gap-2 text-sm text-foreground">
                      <input type="checkbox" checked={editForm.paymentMethods.includes(m.id)} onChange={() => setEditForm((p) => togglePM(p, m.id))} className="rounded border-border accent-primary" />
                      {m.label}
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap gap-4">
                {[{ key: "isPublic", label: "Exibir na landing page" }, { key: "isRecommended", label: "Marcar como recomendado" }].map((opt) => (
                  <label key={opt.key} className="flex items-center gap-2 text-sm text-foreground">
                    <input type="checkbox" checked={Boolean(editForm[opt.key as keyof PlanForm])} onChange={(e) => setEditForm((p) => ({ ...p, [opt.key]: e.target.checked }))} className="rounded border-border accent-primary" />
                    {opt.label}
                  </label>
                ))}
              </div>
              {(editingPlan.pagarmePlanId || editingPlan.pagarme_plan_id) && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">ID no Pagar.me</label>
                  <input type="text" readOnly value={editingPlan.pagarmePlanId || editingPlan.pagarme_plan_id || ""}
                    className="h-9 w-full cursor-default rounded-lg border border-border bg-secondary px-3 font-mono text-sm text-muted-foreground" />
                </div>
              )}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setEditingPlan(null)} className="rounded border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-secondary">Cancelar</button>
                <button type="submit" disabled={savingPlanId === editingPlan.id}
                  className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                  {savingPlanId === editingPlan.id ? "Salvando..." : "Salvar alteracoes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
