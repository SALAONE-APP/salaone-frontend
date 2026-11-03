import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Loader2, LogIn } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/hooks/useAuth";
import {
  deleteSuperAdminSalon,
  getPlatformPlans,
  getSalonMetrics,
  listSuperAdminSalonUsers,
  resetSuperAdminUserPassword,
  updateSuperAdminSalonUnitLimit,
  type PlatformPlan,
  type SuperAdminSalon,
  type SuperAdminSalonUser,
} from "@/service/superAdminService";
import {
  getSalonFile,
  previewSalonDueDate,
  salonFileActions,
  type DueDatePreview,
  type SalonFile,
  type SalonFilePayment,
} from "@/service/salonFileService";

// ─── formatacao ───────────────────────────────────────────

const money = (value?: number | null) =>
  Number(value ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const date = (value?: string | null) => (value ? new Date(value).toLocaleDateString("pt-BR") : "—");
const dateTime = (value?: string | null) =>
  value ? new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";
const toInputDate = (value: string | Date) => {
  const d = new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
// Data escolhida no calendario, ao meio-dia local, para nao "voltar um dia" no fuso.
const fromInputDate = (value: string) => new Date(`${value}T12:00:00`).toISOString();

function errorMessage(error: unknown, fallback: string) {
  const message = (error as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
  return typeof message === "string" ? message : fallback;
}

const SALON_STATUS: Record<string, [string, string]> = {
  active: ["Ativo", "bg-emerald-500/10 text-emerald-700"],
  inactive: ["Inativo", "bg-secondary text-muted-foreground"],
  blocked: ["Suspenso", "bg-destructive/10 text-destructive"],
  pending: ["Aguardando pagamento", "bg-amber-500/15 text-amber-700"],
};

const PAYMENT_METHODS: Record<string, string> = {
  credit_card: "Cartão (recorrência)",
  pix: "Pix",
  cash: "Dinheiro",
  transfer: "Transferência",
  card_machine: "Cartão na maquininha",
  free: "Sem cobrança",
};

const BILLING_MODES: Record<string, string> = { free: "Sem cobrança", manual_pix: "Cobrança manual", card: "Cartão" };

const BUSINESS_TYPES: Record<string, string> = {
  beauty_salon: "Salão de beleza",
  aesthetics: "Clínica de estética",
  manicure_pedicure: "Manicure e pedicure",
  spa: "Spa",
  other: "Outro",
};

const ACTIONS: Record<string, string> = {
  "trial.extended": "Teste prorrogado",
  "trial.ended": "Teste encerrado",
  "trial.converted": "Teste convertido em assinatura paga",
  "trial.granted": "Novo teste concedido",
  "payment.manual_registered": "Pagamento manual registrado",
  "payment.manual_reverted": "Pagamento manual desfeito",
  "plan.change_scheduled": "Troca de plano agendada",
  "plan.change_canceled": "Troca de plano cancelada",
  "plan.change_applied": "Troca de plano aplicada",
  "due_date.changed": "Vencimento alterado",
  "subscription.canceled": "Assinatura cancelada",
  "subscription.cancel_scheduled": "Cancelamento agendado para o fim do período",
  "subscription.canceled_at_period_end": "Assinatura encerrada no fim do período",
  "subscription.reactivated": "Assinatura reativada",
  "salon.suspended": "Salão suspenso",
  "salon.inactivated": "Salão inativado",
  "salon.unblocked": "Salão liberado",
  "salon.trusted_release": "Liberação temporária (em confiança)",
};

const FIELD_LABELS: Record<string, string> = {
  salonStatus: "Status do salão",
  planId: "Plano",
  status: "Status da assinatura",
  billingMode: "Cobrança",
  paymentMethod: "Forma de pagamento",
  manualPaymentStatus: "Pagamento",
  amount: "Valor",
  nextBillingDate: "Vencimento",
  trialEndsAt: "Fim do teste",
  canceledAt: "Cancelada em",
  cancelAtPeriodEnd: "Cancelar no fim do período",
  scheduledPlanId: "Plano agendado",
  scheduledPlanAt: "Troca agendada para",
  suspendedAt: "Suspenso em",
  suspensionReason: "Motivo da suspensão",
  accessReleasedUntil: "Liberado até",
  nextChargeAdjustment: "Ajuste da próxima cobrança",
};

const STATUS_VALUES: Record<string, string> = {
  active: "Ativa",
  pending: "Pendente",
  paused: "Pausada",
  cancelled: "Cancelada",
  canceled: "Cancelada",
  expired: "Expirada",
  blocked: "Suspenso",
  inactive: "Inativo",
  paid: "Pago",
  trialing: "Em teste",
  not_applicable: "—",
};

type ModalKind =
  | "extendTrial"
  | "endTrial"
  | "convertTrial"
  | "grantTrial"
  | "manualPayment"
  | "revertPayment"
  | "changePlan"
  | "cancelScheduledPlan"
  | "dueDate"
  | "cancel"
  | "reactivate"
  | "suspend"
  | "unblock"
  | "inactivate";

const MODAL_TITLES: Record<ModalKind, string> = {
  extendTrial: "Prorrogar período de teste",
  endTrial: "Encerrar teste agora",
  convertTrial: "Converter teste em assinatura paga",
  grantTrial: "Conceder novo período de teste",
  manualPayment: "Registrar pagamento manual",
  revertPayment: "Desfazer pagamento manual",
  changePlan: "Trocar plano",
  cancelScheduledPlan: "Cancelar troca de plano agendada",
  dueDate: "Mudar vencimento",
  cancel: "Cancelar assinatura",
  reactivate: "Reativar assinatura",
  suspend: "Suspender salão",
  unblock: "Liberar salão",
  inactivate: "Inativar salão",
};

// Acoes que pedem confirmacao explicita alem do motivo.
const SENSITIVE: ModalKind[] = ["cancel", "revertPayment", "suspend", "endTrial", "inactivate"];

// ─── componentes simples ──────────────────────────────────

function Pill({ className, children }: { className: string; children: ReactNode }) {
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}>{children}</span>;
}

function Notice({ tone, children }: { tone: "info" | "warning" | "danger"; children: ReactNode }) {
  const cls = {
    info: "border-primary/20 bg-primary/5 text-foreground",
    warning: "border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200",
    danger: "border-destructive/30 bg-destructive/5 text-destructive",
  }[tone];
  return <div className={`rounded-lg border px-4 py-3 text-sm ${cls}`}>{children}</div>;
}

function Panel({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function ActionButton({ label, onClick, enabled = true, danger = false, title }: { label: string; onClick: () => void; enabled?: boolean; danger?: boolean; title?: string }) {
  return (
    <button
      type="button"
      disabled={!enabled}
      title={title}
      onClick={onClick}
      className={`w-full rounded-lg px-3 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        danger
          ? "bg-destructive text-white hover:bg-destructive/90"
          : "border border-border bg-background text-foreground hover:bg-secondary"
      }`}
    >
      {label}
    </button>
  );
}

function subscriptionStatus(file: SalonFile): [string, string] {
  const sub = file.subscription;
  if (!sub) return ["Sem assinatura", "bg-secondary text-muted-foreground"];
  if (sub.canceled) return ["Cancelada", "bg-secondary text-muted-foreground"];
  if (sub.cancelAtPeriodEnd) return ["Cancelamento agendado", "bg-amber-500/15 text-amber-700"];
  if (sub.inTrial) return sub.trialActive ? ["Em teste", "bg-blue-500/10 text-blue-700"] : ["Teste encerrado", "bg-destructive/10 text-destructive"];
  if (sub.overdue) return ["Em atraso", "bg-amber-500/15 text-amber-700"];
  if (sub.status === "active") return ["Ativa", "bg-emerald-500/10 text-emerald-700"];
  return [STATUS_VALUES[sub.status] ?? sub.status, "bg-amber-500/15 text-amber-700"];
}

// ─── pagina ───────────────────────────────────────────────

export function SuperAdminSalonFilePage() {
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { enterSalonAccess } = useAuth();
  const [file, setFile] = useState<SalonFile | null>(null);
  const [plans, setPlans] = useState<PlatformPlan[]>([]);
  const [users, setUsers] = useState<SuperAdminSalonUser[]>([]);
  const [metrics, setMetrics] = useState<SuperAdminSalon["metrics"] | null>(null);
  const [error, setError] = useState("");
  const [modal, setModal] = useState<{ kind: ModalKind; payment?: SalonFilePayment } | null>(null);
  const [accessing, setAccessing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [unitsOpen, setUnitsOpen] = useState(false);
  const [resetUser, setResetUser] = useState<SuperAdminSalonUser | null>(null);

  const load = useCallback(async () => {
    try {
      setFile(await getSalonFile(id));
      setError("");
    } catch (err) {
      setError(errorMessage(err, "Não foi possível carregar a ficha do salão."));
    }
  }, [id]);

  useEffect(() => {
    void load();
    void getPlatformPlans().then((items) => setPlans(items.filter((plan) => plan.active !== false))).catch(() => setPlans([]));
    void listSuperAdminSalonUsers(id).then((data) => setUsers(data.items)).catch(() => setUsers([]));
    const empty = { appointmentsCount: 0, servicesCount: 0, productsCount: 0, clientsCount: 0, employeesCount: 0 };
    void getSalonMetrics(id, empty).then(setMetrics).catch(() => setMetrics(null));
  }, [id, load]);

  if (!file) {
    return (
      <div className="space-y-4">
        <Link to="/salons" className="text-sm text-primary hover:underline">← Voltar para salões</Link>
        {error ? <Notice tone="danger">{error}</Notice> : <div className="flex justify-center py-16"><Loader2 className="animate-spin text-muted-foreground" /></div>}
      </div>
    );
  }

  const { salon, subscription: sub } = file;
  const linked = Boolean(file.billingSalon);
  const subActions = Boolean(sub) && !linked;
  const [statusLabel, statusClass] = subscriptionStatus(file);
  const [salonLabel, salonClass] = SALON_STATUS[salon.status] ?? [salon.status, "bg-secondary text-muted-foreground"];
  const lastPaid = sub?.payments.find((payment) => payment.status === "paid");
  const open = (kind: ModalKind, payment?: SalonFilePayment) => setModal({ kind, payment });
  const noSubTitle = linked ? "Unidade vinculada: a cobrança é do salão principal" : !sub ? "Este salão não tem assinatura" : undefined;

  async function accessSalon() {
    setAccessing(true);
    try {
      await enterSalonAccess(salon.id);
      toast.success(`Acessando o painel de ${salon.name}.`);
      navigate("/home", { replace: true });
    } catch (err) {
      toast.error(errorMessage(err, "Não foi possível acessar este salão."));
    } finally {
      setAccessing(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Salões · cobrança SaaS</p>
          <h1 className="mt-1 text-2xl font-bold text-foreground">{salon.name}</h1>
          <p className="text-sm text-muted-foreground">/{salon.slug}{sub ? ` · plano ${sub.plan.name}` : ""}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void accessSalon()} disabled={accessing} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
            {accessing ? <Loader2 size={14} className="animate-spin" /> : <LogIn size={14} />} Acessar painel
          </button>
          <Link to="/salons" className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-secondary">Voltar</Link>
        </div>
      </div>

      {error && <Notice tone="danger">{error}</Notice>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Status</p>
          <div className="mt-3 flex flex-wrap gap-1.5"><Pill className={statusClass}>{statusLabel}</Pill><Pill className={salonClass}>{salonLabel}</Pill></div>
          <p className={`mt-3 text-xs ${file.access.allowed ? "text-muted-foreground" : "text-destructive"}`}>
            {file.access.allowed ? "Acesso ao painel liberado" : `Acesso bloqueado: ${file.access.reason}`}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Plano</p>
          <p className="mt-2 text-2xl font-bold text-foreground">{sub ? money(sub.amount) : "—"}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {sub ? `${sub.plan.name} · ${BILLING_MODES[sub.billingMode] ?? sub.billingMode}${sub.paymentMethod ? ` · ${PAYMENT_METHODS[sub.paymentMethod] ?? sub.paymentMethod}` : ""}` : "Sem assinatura"}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">{sub?.inTrial ? "Fim do teste" : sub?.canceled ? "Cancelada em" : "Próximo vencimento"}</p>
          <p className="mt-2 text-2xl font-bold text-foreground">{date(sub?.canceled ? sub.canceledAt : sub?.dueAt)}</p>
          <p className="mt-1 text-xs text-muted-foreground">Último pagamento: {date(lastPaid?.paidAt)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Próxima cobrança</p>
          <p className={`mt-2 text-2xl font-bold ${sub?.overdue && !sub.canceled ? "text-destructive" : "text-foreground"}`}>
            {sub && !sub.canceled && sub.billingMode !== "free" ? money(sub.nextChargeAmount) : "—"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {sub?.overdue && !sub.canceled ? `Vencida · bloqueio em ${date(file.access.blockAt)}` : sub?.nextChargeAdjustment ? `Inclui ajuste de ${money(sub.nextChargeAdjustment)}` : "Sem pendências"}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {linked && file.billingSalon && (
          <Notice tone="info">
            Unidade vinculada. A assinatura e os pagamentos ficam no salão principal{" "}
            <Link className="font-semibold underline" to={`/salons/${file.billingSalon.id}`}>{file.billingSalon.name}</Link>.
          </Notice>
        )}
        {!sub && !linked && <Notice tone="info">Este salão ainda não tem assinatura. Crie a cobrança pela tela <Link className="font-semibold underline" to="/subscriptions">Assinaturas</Link> (PIX ou link do cartão).</Notice>}
        {salon.status === "blocked" && <Notice tone="danger">Salão suspenso em {dateTime(salon.blockedAt)}. Motivo: {salon.blockedReason ?? "—"}</Notice>}
        {sub?.accessReleasedUntil && <Notice tone="warning">Liberação temporária (em confiança) até <strong>{date(sub.accessReleasedUntil)}</strong>. Depois disso o acesso volta a ser bloqueado se não pagar.</Notice>}
        {sub?.overdue && !sub.canceled && !sub.inTrial && file.access.allowed && !sub.accessReleasedUntil && (
          <Notice tone="warning">Em atraso. O acesso continua liberado até <strong>{date(file.access.blockAt)}</strong> ({file.overdueGraceDays} dias de tolerância).</Notice>
        )}
        {sub?.cancelAtPeriodEnd && <Notice tone="warning">Cancelamento agendado: a assinatura termina em <strong>{date(sub.nextBillingDate)}</strong>. A recorrência no cartão já foi interrompida.</Notice>}
        {sub?.scheduledPlan && <Notice tone="info">Troca para <strong>{sub.scheduledPlan.name}</strong> ({money(sub.scheduledPlan.price)}) em <strong>{date(sub.scheduledPlanAt)}</strong>.</Notice>}
        {sub && !sub.hasRemoteRecurrence && sub.paymentMethod === "credit_card" && !sub.canceled && (
          <Notice tone="info">Sem recorrência ativa no cartão. As mudanças valem só na SalaOne.</Notice>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
        <Panel title="Período de teste">
          <div className="space-y-2">
            <ActionButton label="Prorrogar teste" enabled={subActions && Boolean(sub?.inTrial)} title={noSubTitle} onClick={() => open("extendTrial")} />
            <ActionButton label="Encerrar teste" enabled={subActions && Boolean(sub?.inTrial)} title={noSubTitle} onClick={() => open("endTrial")} />
            <ActionButton label="Converter em pago" enabled={subActions && Boolean(sub?.inTrial)} title={noSubTitle} onClick={() => open("convertTrial")} />
            <ActionButton label="Conceder novo teste" enabled={subActions && !sub?.trialActive} title={noSubTitle} onClick={() => open("grantTrial")} />
          </div>
        </Panel>
        <Panel title="Pagamentos">
          <div className="space-y-2">
            <ActionButton label="Registrar pagamento manual" enabled={subActions && !sub?.canceled} title={noSubTitle} onClick={() => open("manualPayment")} />
          </div>
        </Panel>
        <Panel title="Plano e vencimento">
          <div className="space-y-2">
            <ActionButton label="Trocar plano" enabled={subActions && !sub?.canceled} title={noSubTitle} onClick={() => open("changePlan")} />
            <ActionButton label="Cancelar troca agendada" enabled={subActions && Boolean(sub?.scheduledPlan)} title={noSubTitle} onClick={() => open("cancelScheduledPlan")} />
            <ActionButton label="Mudar vencimento" enabled={subActions && !sub?.canceled && Boolean(sub?.dueAt)} title={noSubTitle} onClick={() => open("dueDate")} />
          </div>
        </Panel>
        <Panel title="Status da assinatura">
          <div className="space-y-2">
            <ActionButton label="Reativar" enabled={subActions && Boolean(sub?.canceled || sub?.cancelAtPeriodEnd)} title={noSubTitle} onClick={() => open("reactivate")} />
            <ActionButton label="Liberar salão" enabled={salon.status !== "active" || !file.access.allowed} onClick={() => open("unblock")} />
            <ActionButton label="Suspender salão" enabled={salon.status !== "blocked"} danger onClick={() => open("suspend")} />
            <ActionButton label="Cancelar assinatura" enabled={subActions && !sub?.canceled && !sub?.cancelAtPeriodEnd} danger title={noSubTitle} onClick={() => open("cancel")} />
          </div>
        </Panel>
        <Panel title="Salão">
          <div className="space-y-2">
            <ActionButton label={`Unidades (${file.units.current}/${file.units.max ?? "∞"})`} enabled={Boolean(file.owner)} onClick={() => setUnitsOpen(true)} />
            <ActionButton label="Inativar salão" enabled={salon.status !== "inactive"} onClick={() => open("inactivate")} />
            <ActionButton label="Excluir salão" danger onClick={() => setDeleteOpen(true)} />
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Panel title="Dados do salão">
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            {[
              ["Tipo de empresa", BUSINESS_TYPES[salon.businessType ?? ""] ?? "Não informado"],
              ["CNPJ/CPF", salon.document ?? "—"],
              ["E-mail", salon.email ?? "—"],
              ["Telefone", salon.phone ?? "—"],
              ["Criado em", date(salon.createdAt)],
              ["Responsável", file.owner ? `${file.owner.name} (${file.owner.email})` : "—"],
            ].map(([label, value]) => (
              <div key={label} className="min-w-0"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="truncate font-medium text-foreground" title={value}>{value}</dd></div>
            ))}
          </dl>
          {metrics && (
            <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border pt-4 text-xs sm:grid-cols-5">
              {[
                ["Agendamentos", metrics.appointmentsCount],
                ["Clientes", metrics.clientsCount],
                ["Funcionários", metrics.employeesCount],
                ["Serviços", metrics.servicesCount],
                ["Produtos", metrics.productsCount],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg bg-secondary/40 p-2"><p className="text-muted-foreground">{label}</p><p className="text-base font-semibold text-foreground">{value}</p></div>
              ))}
            </div>
          )}
        </Panel>
        <Panel title={`Usuários vinculados (${users.length})`}>
          {users.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum usuário encontrado.</p>
          ) : (
            <ul className="divide-y divide-border">
              {users.map((user) => (
                <li key={user.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{user.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{user.email} · {user.role}</p>
                  </div>
                  <button type="button" onClick={() => setResetUser(user)} className="shrink-0 rounded border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-secondary">Resetar senha</button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {sub && (
        <Panel title="Faturas" description="Mensalidades da SalaOne para este salão. Pagamentos registrados não são recalculados.">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <th className="px-3 py-2">Vencimento / data</th>
                  <th className="px-3 py-2">Descrição</th>
                  <th className="px-3 py-2">Valor</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Pagamento</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {!sub.canceled && sub.billingMode !== "free" && sub.dueAt && (
                  <tr className="border-b border-border">
                    <td className="px-3 py-2">{date(sub.dueAt)}</td>
                    <td className="px-3 py-2"><span className="font-medium text-foreground">{sub.inTrial ? "Primeira mensalidade após o teste" : "Próxima mensalidade"}</span><span className="block text-xs text-muted-foreground">{sub.hasRemoteRecurrence ? "Cobrada no cartão pelo Pagar.me" : "Cobrança manual"}</span></td>
                    <td className="px-3 py-2">{money(sub.nextChargeAmount)}</td>
                    <td className="px-3 py-2">{sub.overdue ? <Pill className="bg-destructive/10 text-destructive">Vencida</Pill> : <Pill className="bg-amber-500/15 text-amber-700">{sub.inTrial ? "Em teste" : "A vencer"}</Pill>}</td>
                    <td className="px-3 py-2">—</td>
                    <td className="px-3 py-2 text-right">
                      {!linked && <button type="button" onClick={() => open("manualPayment")} className="rounded border border-primary/30 px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/10">Dar baixa</button>}
                    </td>
                  </tr>
                )}
                {sub.payments.map((payment) => (
                  <tr key={payment.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2">{date(payment.paidAt ?? payment.createdAt)}</td>
                    <td className="px-3 py-2">
                      <span className="font-medium text-foreground">Mensalidade</span>
                      <span className="block text-xs text-muted-foreground">{payment.source === "pagarme" ? "Pagar.me" : "Manual"}{payment.note ? ` · ${payment.note}` : ""}</span>
                      {payment.revertedAt && <span className="block text-xs text-destructive">Desfeito em {date(payment.revertedAt)}: {payment.revertReason}</span>}
                    </td>
                    <td className="px-3 py-2">{money(payment.amount)}</td>
                    <td className="px-3 py-2">{payment.status === "reverted" ? <Pill className="bg-secondary text-muted-foreground">Desfeito</Pill> : <Pill className="bg-emerald-500/10 text-emerald-700">Pago</Pill>}</td>
                    <td className="px-3 py-2 text-muted-foreground">{payment.method ? PAYMENT_METHODS[payment.method] ?? payment.method : "—"}</td>
                    <td className="px-3 py-2 text-right">
                      {payment.revertible && !linked && <button type="button" onClick={() => open("revertPayment", payment)} className="rounded border border-destructive/40 px-2 py-1 text-xs font-semibold text-destructive hover:bg-destructive/10">Desfazer</button>}
                    </td>
                  </tr>
                ))}
                {sub.payments.length === 0 && (sub.canceled || sub.billingMode === "free" || !sub.dueAt) && (
                  <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">Nenhum pagamento registrado.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      <Panel title="Histórico" description="Quem fez, quando, o que mudou e por quê.">
        <EventTimeline file={file} plans={plans} />
      </Panel>

      {modal && (
        <ActionModal
          kind={modal.kind}
          payment={modal.payment}
          file={file}
          plans={plans}
          onClose={() => setModal(null)}
          onDone={(next, message) => {
            setFile(next);
            setModal(null);
            toast.success(message);
          }}
        />
      )}
      {deleteOpen && <DeleteSalonModal salon={salon} onClose={() => setDeleteOpen(false)} onDeleted={() => navigate("/salons", { replace: true })} />}
      {unitsOpen && <UnitLimitModal salonId={salon.id} salonName={salon.name} current={file.units} onClose={() => setUnitsOpen(false)} onSaved={() => { setUnitsOpen(false); void load(); }} />}
      {resetUser && <ResetPasswordModal user={resetUser} onClose={() => setResetUser(null)} />}
    </div>
  );
}

// ─── historico ────────────────────────────────────────────

function EventTimeline({ file, plans }: { file: SalonFile; plans: PlatformPlan[] }) {
  if (file.events.length === 0) return <p className="text-sm text-muted-foreground">Nenhuma ação registrada ainda.</p>;
  const show = (value: unknown, key: string) => {
    if (value == null || value === "") return "—";
    if (typeof value === "boolean") return value ? "Sim" : "Não";
    if (key === "planId" || key === "scheduledPlanId") return plans.find((plan) => plan.id === value)?.name ?? String(value).slice(0, 8);
    if (key === "amount" || key === "nextChargeAdjustment") return money(Number(value));
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) return date(value);
    if (key === "billingMode") return BILLING_MODES[String(value)] ?? String(value);
    if (key === "paymentMethod") return PAYMENT_METHODS[String(value)] ?? String(value);
    return STATUS_VALUES[String(value)] ?? String(value);
  };
  return (
    <ol className="space-y-3">
      {file.events.map((event) => {
        const before = event.beforeData ?? {};
        const after = event.afterData ?? {};
        const changes = Object.keys({ ...before, ...after }).filter(
          (key) => FIELD_LABELS[key] && JSON.stringify(before[key] ?? null) !== JSON.stringify(after[key] ?? null),
        );
        return (
          <li key={event.id} className="rounded-lg border border-border p-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <strong className="text-sm text-foreground">{ACTIONS[event.action] ?? event.action}</strong>
              <span className="text-xs text-muted-foreground">{dateTime(event.createdAt)} · {event.actorType === "system" ? "Rotina automática" : event.actorName ?? "Superadmin"}</span>
            </div>
            {event.reason && <p className="mt-1 text-sm text-muted-foreground">Motivo: {event.reason}</p>}
            {changes.length > 0 && (
              <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                {changes.map((key) => (
                  <li key={key}>{FIELD_LABELS[key]}: {show(before[key], key)} → <strong className="text-foreground">{show(after[key], key)}</strong></li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ol>
  );
}

// ─── modais ───────────────────────────────────────────────

const inputClass = "mt-1 h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40";

function ModalShell({ title, onClose, busy, children }: { title: string; onClose: () => void; busy?: boolean; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => !busy && onClose()}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-xl" onClick={(event) => event.stopPropagation()}>
        <h3 className="mb-4 text-lg font-semibold text-foreground">{title}</h3>
        <div className="space-y-3 text-sm">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block text-sm text-muted-foreground">{label}{children}</label>;
}

function ActionModal({
  kind,
  payment,
  file,
  plans,
  onClose,
  onDone,
}: {
  kind: ModalKind;
  payment?: SalonFilePayment;
  file: SalonFile;
  plans: PlatformPlan[];
  onClose: () => void;
  onDone: (file: SalonFile, message: string) => void;
}) {
  const sub = file.subscription;
  const salonId = file.salon.id;
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [days, setDays] = useState(7);
  const [untilDate, setUntilDate] = useState("");
  const [planId, setPlanId] = useState(sub?.scheduledPlan?.id ?? "");
  const [newDueDate, setNewDueDate] = useState("");
  const [prorate, setProrate] = useState(true);
  const [preview, setPreview] = useState<DueDatePreview | null>(null);
  const [cancelMode, setCancelMode] = useState<"immediate" | "period_end">(sub?.nextBillingDate && new Date(sub.nextBillingDate) > new Date() ? "period_end" : "immediate");
  const [reasonCode, setReasonCode] = useState("");
  const [billing, setBilling] = useState<"manual" | "card">("manual");
  const [paidAt, setPaidAt] = useState(toInputDate(new Date()));
  const [amount, setAmount] = useState((sub?.nextChargeAmount ?? 0).toFixed(2).replace(".", ","));
  const [method, setMethod] = useState("pix");
  const [note, setNote] = useState("");
  const [nextBillingDate, setNextBillingDate] = useState("");

  useEffect(() => {
    if (kind !== "dueDate" || !newDueDate) {
      setPreview(null);
      return;
    }
    const timer = window.setTimeout(() => {
      previewSalonDueDate(salonId, fromInputDate(newDueDate), prorate)
        .then((result) => { setPreview(result); setError(""); })
        .catch((err) => setError(errorMessage(err, "Erro na simulação.")));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [kind, newDueDate, prorate, salonId]);

  const parsedAmount = Number(amount.replace(/\./g, "").replace(",", "."));
  const sensitive = SENSITIVE.includes(kind);
  const valid =
    reason.trim().length >= 5 &&
    (!sensitive || confirmed) &&
    (kind !== "extendTrial" || days > 0 || Boolean(untilDate)) &&
    (kind !== "changePlan" || (Boolean(planId) && planId !== sub?.plan.id)) &&
    (kind !== "dueDate" || Boolean(preview?.allowed)) &&
    (kind !== "cancel" || Boolean(reasonCode)) &&
    (kind !== "manualPayment" || (Boolean(paidAt) && parsedAmount > 0));

  async function submit() {
    setBusy(true);
    setError("");
    const r = reason.trim();
    try {
      let response: { file: SalonFile; result: unknown };
      let message = "Alteração registrada no histórico.";
      switch (kind) {
        case "extendTrial":
          response = await salonFileActions.extendTrial(salonId, untilDate ? { until: fromInputDate(untilDate), reason: r } : { days, reason: r });
          message = "Teste prorrogado.";
          break;
        case "endTrial":
          response = await salonFileActions.endTrial(salonId, r);
          message = "Teste encerrado. A mensalidade vence hoje.";
          break;
        case "convertTrial":
          response = await salonFileActions.convertTrial(salonId, r);
          message = "Teste convertido em assinatura paga.";
          break;
        case "grantTrial":
          response = await salonFileActions.grantTrial(salonId, { days, reason: r });
          message = "Novo período de teste concedido.";
          break;
        case "manualPayment":
          response = await salonFileActions.manualPayment(salonId, {
            amount: parsedAmount,
            paidAt: fromInputDate(paidAt),
            method,
            note: note.trim() || undefined,
            nextBillingDate: nextBillingDate ? fromInputDate(nextBillingDate) : null,
            reason: r,
          });
          message = "Pagamento registrado. O salão está liberado.";
          break;
        case "revertPayment":
          response = await salonFileActions.revertPayment(salonId, payment!.id, r);
          message = "Pagamento desfeito. A assinatura voltou ao estado anterior.";
          break;
        case "changePlan": {
          response = await salonFileActions.changePlan(salonId, { planId, reason: r });
          const result = response.result as { effectiveAt?: string; immediate?: boolean } | null;
          message = result?.immediate ? "Plano trocado." : `Troca agendada para ${date(result?.effectiveAt)}.`;
          break;
        }
        case "cancelScheduledPlan":
          response = await salonFileActions.cancelScheduledPlan(salonId, r);
          message = "Troca de plano cancelada.";
          break;
        case "dueDate":
          response = await salonFileActions.changeDueDate(salonId, { newDueDate: fromInputDate(newDueDate), prorate, reason: r });
          message = "Vencimento alterado.";
          break;
        case "cancel":
          response = await salonFileActions.cancel(salonId, { mode: cancelMode, reasonCode, reason: r });
          message = cancelMode === "immediate" ? "Assinatura cancelada. O acesso foi bloqueado." : "Cancelamento agendado para o fim do período.";
          break;
        case "reactivate":
          response = await salonFileActions.reactivate(salonId, { planId: planId || null, billing, reason: r });
          message = "Assinatura reativada.";
          break;
        case "suspend":
          response = await salonFileActions.suspend(salonId, r);
          message = "Salão suspenso. O acesso foi bloqueado.";
          break;
        case "inactivate":
          response = await salonFileActions.inactivate(salonId, r);
          message = "Salão inativado.";
          break;
        case "unblock":
          response = await salonFileActions.unblock(salonId, { days, reason: r });
          message = "Salão liberado.";
          break;
      }
      onDone(response.file, message);
    } catch (err) {
      setError(errorMessage(err, "Não foi possível concluir a ação."));
    } finally {
      setBusy(false);
    }
  }

  const needsTrustedRelease = kind === "unblock" && !file.access.allowed && Boolean(sub) && !file.billingSalon;

  return (
    <ModalShell title={MODAL_TITLES[kind]} onClose={onClose} busy={busy}>
      {error && <Notice tone="danger">{error}</Notice>}

      {kind === "extendTrial" && (
        <>
          <p className="text-muted-foreground">O teste termina em {date(sub?.trialEndsAt)}. Prorrogue por dias ou escolha a nova data.</p>
          <Field label="Dias a mais"><input type="number" min={1} max={365} value={days} disabled={Boolean(untilDate)} onChange={(e) => setDays(Number(e.target.value))} className={inputClass} /></Field>
          <Field label="Ou nova data de término"><input type="date" value={untilDate} min={toInputDate(new Date(Date.now() + 86_400_000))} onChange={(e) => setUntilDate(e.target.value)} className={inputClass} /></Field>
        </>
      )}
      {(kind === "endTrial" || kind === "convertTrial") && (
        <p className="text-muted-foreground">
          A mensalidade de {money(sub?.amount)} vence hoje.{" "}
          {sub?.hasRemoteRecurrence ? "O Pagar.me cobra no cartão cadastrado." : `Sem cartão: a mensalidade fica em aberto para baixa manual, com ${file.overdueGraceDays} dias de tolerância.`}
        </p>
      )}
      {kind === "grantTrial" && (
        <>
          <p className="text-muted-foreground">
            A equipe já concedeu {sub?.trialGrantsCount ?? 0} teste(s) a este salão.{" "}
            {sub?.hasRemoteRecurrence ? "A próxima cobrança no cartão será adiada para o fim do novo teste." : ""}
          </p>
          <Field label="Dias de teste"><input type="number" min={1} max={365} value={days} onChange={(e) => setDays(Number(e.target.value))} className={inputClass} /></Field>
        </>
      )}
      {kind === "manualPayment" && (
        <>
          <p className="text-muted-foreground">
            {sub?.hasRemoteRecurrence
              ? "As faturas em aberto no Pagar.me serão canceladas para o cartão não ser cobrado de novo."
              : "Cobre o próximo período da assinatura."}
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Data do pagamento"><input type="date" value={paidAt} max={toInputDate(new Date())} onChange={(e) => setPaidAt(e.target.value)} className={inputClass} /></Field>
            <Field label="Valor recebido (R$)"><input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} /></Field>
            <Field label="Forma de pagamento">
              <select value={method} onChange={(e) => setMethod(e.target.value)} className={inputClass}>
                {Object.entries(file.manualPaymentMethods).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
            </Field>
            {!sub?.hasRemoteRecurrence && (
              <Field label="Próximo vencimento (opcional)"><input type="date" value={nextBillingDate} onChange={(e) => setNextBillingDate(e.target.value)} className={inputClass} /></Field>
            )}
          </div>
          <Field label="Observação"><input value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: Pix recebido na conta Itaú" className={inputClass} /></Field>
        </>
      )}
      {kind === "revertPayment" && payment && (
        <p className="text-muted-foreground">
          O pagamento de {date(payment.paidAt)} ({money(payment.amount)}) deixa de contar e a assinatura volta ao estado anterior. Se o vencimento já passou, o salão entra em atraso.
          {sub?.hasRemoteRecurrence ? " As faturas canceladas no Pagar.me na baixa não são recriadas lá." : ""}
        </p>
      )}
      {(kind === "changePlan" || kind === "reactivate") && (
        <Field label={kind === "changePlan" ? "Novo plano" : "Plano (opcional, padrão: atual)"}>
          <select value={planId} onChange={(e) => setPlanId(e.target.value)} className={inputClass}>
            <option value="">{kind === "changePlan" ? "Selecione" : `Manter ${sub?.plan.name ?? "plano atual"}`}</option>
            {plans
              .filter((plan) => kind === "reactivate" || plan.id !== sub?.plan.id)
              .map((plan) => <option key={plan.id} value={plan.id}>{plan.name} · {money(plan.price)}/{plan.interval === "year" ? "ano" : "mês"}</option>)}
          </select>
        </Field>
      )}
      {kind === "changePlan" && (
        <p className="text-muted-foreground">
          A troca vale no fim do ciclo atual{sub?.dueAt ? <>, em <strong>{date(sub.dueAt)}</strong></> : " (sem vencimento: aplica na hora)"}.
          {sub?.hasRemoteRecurrence ? " O novo preço já é enviado ao Pagar.me para a próxima fatura." : ""}
        </p>
      )}
      {kind === "cancelScheduledPlan" && (
        <p className="text-muted-foreground">A troca para {sub?.scheduledPlan?.name} será desfeita e a próxima cobrança volta para {money(sub?.amount)}.</p>
      )}
      {kind === "dueDate" && sub?.dueAt && (
        <>
          <p className="text-muted-foreground">Vencimento atual: <strong>{date(sub.dueAt)}</strong>. O novo vencimento pode ser até 10 dias depois do atual.</p>
          <Field label="Novo vencimento">
            <input type="date" value={newDueDate} min={toInputDate(new Date(Date.now() + 86_400_000))} max={toInputDate(new Date(new Date(sub.dueAt).getTime() + 10 * 86_400_000))} onChange={(e) => setNewDueDate(e.target.value)} className={inputClass} />
          </Field>
          <label className="flex items-center gap-2 text-foreground"><input type="checkbox" checked={prorate} onChange={(e) => setProrate(e.target.checked)} /> Cobrar ou abater os dias de diferença</label>
          {preview && (
            <Notice tone={preview.allowed ? "info" : "danger"}>
              {preview.allowed ? (
                <>Próxima cobrança: <strong>{money(preview.transitionAmountCents / 100)}</strong>{preview.prorationCents !== 0 && ` (${preview.prorationCents > 0 ? "+" : ""}${money(preview.prorationCents / 100)} por ${Math.abs(preview.shiftDays)} dia(s))`}.</>
              ) : preview.error}
            </Notice>
          )}
        </>
      )}
      {kind === "cancel" && (
        <>
          <Field label="Quando">
            <select value={cancelMode} onChange={(e) => setCancelMode(e.target.value as "immediate" | "period_end")} className={inputClass}>
              <option value="period_end" disabled={!sub?.nextBillingDate || new Date(sub.nextBillingDate) <= new Date()}>No fim do período já pago ({date(sub?.nextBillingDate)})</option>
              <option value="immediate">Imediatamente (o acesso é bloqueado agora)</option>
            </select>
          </Field>
          <Field label="Motivo do cancelamento">
            <select value={reasonCode} onChange={(e) => setReasonCode(e.target.value)} className={inputClass}>
              <option value="">Selecione</option>
              {Object.entries(file.cancelReasons).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </Field>
          <p className="text-muted-foreground">Nos dois casos a recorrência no cartão é interrompida no Pagar.me.</p>
        </>
      )}
      {kind === "reactivate" && (
        <Field label="Cobrança">
          <select value={billing} onChange={(e) => setBilling(e.target.value as "manual" | "card")} className={inputClass}>
            <option value="manual">Manual (Pix, dinheiro...) · mensalidade em aberto com {file.overdueGraceDays} dias de tolerância</option>
            <option value="card" disabled={!sub?.hasSavedCard}>Cartão já salvo no Pagar.me</option>
          </select>
        </Field>
      )}
      {kind === "suspend" && <p className="text-muted-foreground">O acesso ao painel é bloqueado até o salão ser liberado.</p>}
      {kind === "inactivate" && <p className="text-muted-foreground">O salão fica inativo e sem acesso ao painel até ser liberado.</p>}
      {kind === "unblock" && (
        <>
          <p className="text-muted-foreground">
            {needsTrustedRelease
              ? "A mensalidade está em aberto. A liberação é temporária (em confiança): depois do prazo, o acesso volta a ser bloqueado se não pagar."
              : "O salão volta a ter acesso ao painel."}
          </p>
          {needsTrustedRelease && <Field label="Liberar por quantos dias"><input type="number" min={1} max={30} value={days} onChange={(e) => setDays(Number(e.target.value))} className={inputClass} /></Field>}
        </>
      )}

      <Field label="Motivo (obrigatório, vai para o histórico)">
        <textarea rows={3} maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40" />
      </Field>
      {sensitive && (
        <label className="flex items-start gap-2 text-foreground">
          <input type="checkbox" className="mt-1" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
          <span>Confirmo que revisei e quero executar esta ação em <strong>{file.salon.name}</strong>.</span>
        </label>
      )}
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" disabled={busy} onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-secondary">Fechar</button>
        <button type="button" disabled={!valid || busy} onClick={() => void submit()} className={`rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-40 ${sensitive ? "bg-destructive hover:bg-destructive/90" : "bg-primary hover:bg-primary/90"}`}>
          {busy ? "Salvando..." : "Confirmar"}
        </button>
      </div>
    </ModalShell>
  );
}

function DeleteSalonModal({ salon, onClose, onDeleted }: { salon: SalonFile["salon"]; onClose: () => void; onDeleted: () => void }) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit() {
    setBusy(true);
    try {
      const result = await deleteSuperAdminSalon(salon.id, typed.trim());
      toast.success(`Salão ${result.name} excluído (${result.deletedUsers} usuário(s) removido(s)).`);
      onDeleted();
    } catch (err) {
      toast.error(errorMessage(err, "Não foi possível excluir o salão."));
      setBusy(false);
    }
  }
  return (
    <ModalShell title="Excluir salão permanentemente" onClose={onClose} busy={busy}>
      <p className="text-muted-foreground">
        Isso apaga <strong className="text-foreground">{salon.name}</strong> e todos os dados vinculados (agendamentos, clientes, serviços, produtos, funcionários e usuários que ficarem sem salão). Não pode ser desfeito.
      </p>
      <Field label={`Digite o slug "${salon.slug}" para confirmar`}><input value={typed} onChange={(e) => setTyped(e.target.value)} className={inputClass} /></Field>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onClose} disabled={busy} className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-secondary">Cancelar</button>
        <button type="button" onClick={() => void submit()} disabled={busy || typed.trim() !== salon.slug} className="rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-white hover:bg-destructive/90 disabled:opacity-40">
          {busy ? "Excluindo..." : "Excluir definitivamente"}
        </button>
      </div>
    </ModalShell>
  );
}

function UnitLimitModal({ salonId, salonName, current, onClose, onSaved }: { salonId: string; salonName: string; current: SalonFile["units"]; onClose: () => void; onSaved: () => void }) {
  const [maxUnits, setMaxUnits] = useState(String(current.max ?? Math.max(1, current.current)));
  const [unlimited, setUnlimited] = useState(current.max === null);
  const [busy, setBusy] = useState(false);
  async function submit() {
    const value = unlimited ? null : Number(maxUnits);
    if (value !== null && (!Number.isInteger(value) || value < 1)) {
      toast.error("Informe um limite de unidades válido.");
      return;
    }
    setBusy(true);
    try {
      const result = await updateSuperAdminSalonUnitLimit(salonId, value);
      toast.success(result.maxSalonUnits === null ? "Unidades ilimitadas liberadas." : `Limite atualizado para ${result.maxSalonUnits} unidade(s).`);
      onSaved();
    } catch (err) {
      toast.error(errorMessage(err, "Não foi possível atualizar o limite de unidades."));
      setBusy(false);
    }
  }
  return (
    <ModalShell title="Gerenciar unidades" onClose={onClose} busy={busy}>
      <p className="text-muted-foreground">{salonName}. Este limite vale para todas as unidades do mesmo responsável ({current.current} em uso).</p>
      <Field label="Quantidade máxima de unidades"><input type="number" min={1} disabled={unlimited} value={maxUnits} onChange={(e) => setMaxUnits(e.target.value)} className={`${inputClass} disabled:opacity-50`} /></Field>
      <label className="flex items-center gap-2 text-foreground"><input type="checkbox" checked={unlimited} onChange={(e) => setUnlimited(e.target.checked)} /> Liberar unidades ilimitadas</label>
      <p className="rounded-lg bg-secondary/50 p-3 text-xs text-muted-foreground">Não é possível definir um limite menor que a quantidade de unidades já vinculadas.</p>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onClose} disabled={busy} className="rounded-lg border border-border px-4 py-2 text-sm">Cancelar</button>
        <button type="button" onClick={() => void submit()} disabled={busy} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">{busy ? "Salvando..." : "Salvar limite"}</button>
      </div>
    </ModalShell>
  );
}

function ResetPasswordModal({ user, onClose }: { user: SuperAdminSalonUser; onClose: () => void }) {
  const [newPassword, setNewPassword] = useState("");
  const [generated, setGenerated] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit() {
    setBusy(true);
    try {
      const result = await resetSuperAdminUserPassword(user.id, newPassword.trim() || undefined);
      setGenerated(result?.password ?? "");
      toast.success("Senha redefinida com sucesso.");
    } catch {
      toast.error("Erro ao redefinir senha.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <ModalShell title="Redefinir senha" onClose={onClose} busy={busy}>
      {!generated ? (
        <>
          <p className="text-muted-foreground">Redefinir a senha de <strong className="text-foreground">{user.name || user.email}</strong>.</p>
          <Field label="Nova senha (deixe vazio para gerar automaticamente)"><input value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Ex.: Abc@1234" className={inputClass} /></Field>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-secondary">Cancelar</button>
            <button type="button" onClick={() => void submit()} disabled={busy} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">{busy ? "Redefinindo..." : "Confirmar"}</button>
          </div>
        </>
      ) : (
        <>
          <Field label="Senha temporária"><input readOnly value={generated} onClick={(e) => (e.target as HTMLInputElement).select()} className={`${inputClass} font-mono`} /></Field>
          <p className="text-xs text-muted-foreground">Compartilhe esta senha com o usuário. Ele deverá alterá-la no primeiro acesso.</p>
          <div className="flex justify-end pt-2"><button type="button" onClick={onClose} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Concluído</button></div>
        </>
      )}
    </ModalShell>
  );
}
