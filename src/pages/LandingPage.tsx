import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { PasswordInput } from '@/components/PasswordInput';
import { LandingLeadChat } from '@/components/LandingLeadChat';
import { WhatsAppIcon } from '@/components/icons/WhatsAppIcon';
import {
  ArrowRight, BadgeCheck, CalendarCheck, CheckCircle2, ClipboardCheck,
  Clock, CreditCard, Lock, Menu, MessageCircle, Scissors,
  ShieldCheck, Star, Store, TrendingUp, Users, Wallet, X,
} from "lucide-react";
import salaOneLogo from "../assets/image/logo-icone-salaone.jpeg";
import axios from "axios";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Plan {
  id: string;
  name: string;
  description?: string;
  price: number;
  interval: "month" | "year" | "week";
  intervalCount: number;
  features: string[];
  isRecommended?: boolean;
}

interface RegForm {
  salonName: string;
  slug: string;
  cnpj: string;
  phone: string;
  adminName: string;
  adminEmail: string;
  adminPhone: string;
  password: string;
  confirmPassword: string;
  subscriptionBarberRule: SubscriptionBarberRule;
}

type SubscriptionBarberRule = "fixed" | "free_choice";

interface CardForm {
  number: string;
  holderName: string;
  expMonth: string;
  expYear: string;
  cvv: string;
  document: string;
  phone: string;
}

interface RegisterResult {
  token: string;
  refreshToken: string;
  salon: { id: string; name: string; slug: string };
  user: { id: string; name: string; email: string; role: string };
}

// ─── API ──────────────────────────────────────────────────────────────────────

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: { "Content-Type": "application/json" },
});

async function apiFetchPlans(): Promise<Plan[]> {
  const { data } = await api.get<{ items: Plan[] } | Plan[]>("/public/platform-plans");
  if (Array.isArray(data)) return data as Plan[];
  if (Array.isArray((data as any)?.items)) return (data as any).items as Plan[];
  return [];
}

async function apiRegister(form: RegForm, planId: string): Promise<RegisterResult> {
  const { data } = await api.post<RegisterResult>("/salons/register", {
    salonName: form.salonName.trim(),
    slug: form.slug.trim().toLowerCase() || undefined,
    cnpj: form.cnpj || null,
    phone: form.phone || null,
    adminName: form.adminName.trim(),
    adminEmail: form.adminEmail.trim().toLowerCase(),
    adminPhone: form.adminPhone || null,
    password: form.password,
    selectedPlan: planId,
    subscriptionBarberRule: form.subscriptionBarberRule,
  });
  localStorage.setItem("token", data.token);
  localStorage.setItem("refreshToken", data.refreshToken);
  localStorage.setItem("user", JSON.stringify(data.user));
  localStorage.setItem("salon", JSON.stringify(data.salon));
  return data;
}

async function apiTokenizeCard(card: CardForm): Promise<string> {
  const appId = import.meta.env.VITE_PAGARME_PUBLIC_KEY;
  const baseUrl = import.meta.env.VITE_PAGARME_BASE_URL;
  const digits = card.number.replace(/\s/g, "");
  const month = Number(card.expMonth);
  const year = Number(card.expYear);
  const currentYear = new Date().getFullYear();

  if (digits.length < 13) throw new Error("Número do cartão inválido.");
  if (!card.holderName.trim()) throw new Error("Informe o nome do titular.");
  if (month < 1 || month > 12) throw new Error("Mês de validade inválido.");
  if (year < currentYear) throw new Error("Cartão vencido. Verifique a validade.");
  if (card.cvv.length < 3) throw new Error("CVV inválido.");

  const res = await fetch(`${baseUrl}/tokens?appId=${appId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "card",
      card: {
        number: digits,
        holder_name: card.holderName,
        holder_document: card.document.replace(/\D/g, ""),
        exp_month: month,
        exp_year: year,
        cvv: card.cvv,
        billing_address: { line_1: "Não informado", zip_code: "00000000", city: "Não informado", state: "SP", country: "BR" },
      },
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any)?.message ?? "Erro ao processar cartão. Verifique os dados.");
  }
  const json = await res.json();
  return json.id as string;
}

async function apiSubscribe(
  planId: string,
  cardToken: string,
  amount: number,
  customer: { name: string; email: string; document: string; phone: string },
) {
  const token = localStorage.getItem("token");
  const salon = JSON.parse(localStorage.getItem("salon") || "{}");
  await api.post(
    "/pagarme/subscriptions/salon-platform-subscriptions",
    { platformPlanId: planId, cardToken, amount, salonId: salon?.id, customer },
    { headers: { Authorization: `Bearer ${token}` } },
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPrice(price: number) {
  return price.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getPeriodLabel(interval: string, intervalCount: number) {
  const count = Number(intervalCount || 1);
  if (interval === "month") return count === 1 ? "/mês" : `/${count} meses`;
  if (interval === "year") return count === 1 ? "/ano" : `/${count} anos`;
  if (interval === "week") return count === 1 ? "/semana" : `/${count} semanas`;
  return "/mês";
}

function formatCardNumber(v: string) {
  return v.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
}
function formatCPF(v: string) {
  return v.replace(/\D/g, "").slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}
function formatPhone(v: string) {
  return v.replace(/\D/g, "").slice(0, 11)
    .replace(/^(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{4,5})(\d{4})$/, "$1-$2");
}

const inputClass =
  "w-full mt-1 px-3 py-2.5 bg-neutral-900 border border-neutral-700 rounded-lg text-white text-sm placeholder-neutral-500 focus:outline-none focus:border-primary disabled:opacity-50 transition-colors";

// ─── Static content ───────────────────────────────────────────────────────────

const painPoints = [
  { Icon: MessageCircle, title: "Agenda espalhada", text: "Mensagens no WhatsApp, remarcações e horários livres difíceis de acompanhar." },
  { Icon: Wallet, title: "Caixa sem clareza", text: "Comissões, assinaturas e pagamentos avulsos ficam separados da operação." },
  { Icon: Clock, title: "Tempo perdido", text: "A equipe gasta energia com tarefas repetitivas em vez de atender melhor." },
];

const featuresList = [
  { Icon: CalendarCheck, title: "Agendamento online", text: "Clientes escolhem serviço, profissional e horário em poucos passos." },
  { Icon: Wallet, title: "Financeiro integrado", text: "Pagamentos, comissões e recorrências em uma visão organizada." },
  { Icon: Scissors, title: "Gestão de profissionais", text: "Controle profissionais, permissões e desempenho individual." },
  { Icon: Store, title: "Produtos e serviços", text: "Venda adicionais junto do atendimento e acompanhe o estoque." },
  { Icon: ShieldCheck, title: "Acessos por perfil", text: "Administração, recepção e profissionais com permissões adequadas." },
  { Icon: TrendingUp, title: "Relatórios práticos", text: "Indicadores para entender faturamento, agenda e crescimento." },
];

const differentials = [
  { Icon: BadgeCheck, title: "Implantação guiada", text: "Estrutura inicial, cadastro e primeiros ajustes com foco na rotina real da salão." },
  { Icon: Users, title: "Pensado para equipes", text: "Fluxos simples para administrador, recepção e profissionais trabalharem sem atrito." },
  { Icon: ClipboardCheck, title: "Operação mais previsível", text: "Menos improviso no balcão e mais controle sobre agenda, clientes e recebimentos." },
];

const processSteps = [
  { number: "1", title: "Diagnóstico", text: "Entendemos estrutura, equipe, serviços e rotina atual." },
  { number: "2", title: "Configuração", text: "Organizamos agenda, profissionais, permissões e planos." },
  { number: "3", title: "Operação", text: "A equipe começa a atender com mais controle e previsibilidade." },
];

const navLinks = [
  { href: "#sobre", label: "Quem Somos" },
  { href: "#solucoes", label: "Soluções" },
  { href: "#planos", label: "Planos" },
];

// ─── Card variants ────────────────────────────────────────────────────────────

type CardVariant = "basic" | "premium" | "master";
const cardStyles: Record<CardVariant, { wrapper: string; btn: string; badge: string; price: string }> = {
  basic: {
    wrapper: "bg-neutral-950 border-neutral-800 hover:border-neutral-700",
    btn: "bg-neutral-800 hover:bg-neutral-700 text-white",
    badge: "bg-neutral-800 text-neutral-400 border border-neutral-700",
    price: "text-white",
  },
  premium: {
    wrapper: "bg-neutral-950 border-primary/50 ring-1 ring-primary/20 shadow-xl shadow-primary/10",
    btn: "bg-gradient-to-r from-brand-purple-dark to-primary hover:from-primary hover:to-brand-pink text-black font-bold shadow-lg shadow-primary/20",
    badge: "bg-primary/10 text-brand-pink border border-primary/25",
    price: "text-brand-pink",
  },
  master: {
    wrapper: "bg-gradient-to-b from-neutral-900 to-neutral-950 border-neutral-700 hover:border-neutral-600",
    btn: "bg-neutral-700 hover:bg-neutral-600 text-white",
    badge: "bg-neutral-700/60 text-neutral-300 border border-neutral-600",
    price: "text-white",
  },
};
const variantOrder: CardVariant[] = ["basic", "premium", "master"];

// ─── Register Modal ───────────────────────────────────────────────────────────

function RegisterModal({ plan, onClose, onRegistered }: {
  plan: Plan;
  onClose: () => void;
  onRegistered: (result: RegisterResult) => void;
}) {
  const empty: RegForm = {
    salonName: "",
    slug: "",
    cnpj: "",
    phone: "",
    adminName: "",
    adminEmail: "",
    adminPhone: "",
    password: "",
    confirmPassword: "",
    subscriptionBarberRule: "fixed",
  };
  const [form, setForm] = useState<RegForm>(empty);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleClose = () => { if (submitting) return; onClose(); };
  const set = (k: keyof RegForm, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!form.salonName.trim() || !form.adminName.trim() || !form.adminEmail.trim() || !form.password) {
      setFormError("Preencha todos os campos obrigatórios."); return;
    }
    if (form.slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug)) {
      setFormError("Slug inválido. Use apenas letras minúsculas, números e hífen."); return;
    }
    if (form.password.length < 4) { setFormError("A senha deve ter no mínimo 4 caracteres."); return; }
    if (form.password !== form.confirmPassword) { setFormError("Senha e confirmação de senha não conferem."); return; }

    try {
      setSubmitting(true);
      const result = await apiRegister(form, plan.id);
      onRegistered(result);
    } catch (err: any) {
      const apiErrors = err?.response?.data;
      if (Array.isArray(apiErrors) && apiErrors.length > 0) setFormError(apiErrors[0]);
      else if (err?.response?.data?.message) setFormError(err.response.data.message);
      else setFormError("Não foi possível concluir o cadastro. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm" onClick={handleClose}>
      <div className="relative bg-neutral-950 border border-neutral-800 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={handleClose} disabled={submitting} aria-label="Fechar cadastro"
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors disabled:opacity-50">
          <X size={18} />
        </button>

        <div className="p-6 border-b border-neutral-800">
          <span className="text-primary text-xs font-semibold uppercase tracking-wider">Cadastro rápido</span>
          <h3 className="text-xl font-bold text-white mt-1 mb-1">Cadastro da Salão</h3>
          <p className="text-neutral-400 text-sm">
            Você selecionou o <strong className="text-white">{plan.name}</strong>. Complete os dados para criar sua conta e seguir para o pagamento.
          </p>
        </div>

        <div className="mx-6 mt-4 bg-gradient-to-r from-primary/10 to-brand-purple-dark/5 border border-primary/20 rounded-xl p-4 flex items-center justify-between gap-4">
          <div>
            <div className="text-neutral-500 text-xs uppercase tracking-wider mb-0.5">Plano selecionado</div>
            <div className="text-white font-semibold">{plan.name}</div>
            {plan.description && <div className="text-neutral-400 text-xs mt-0.5">{plan.description}</div>}
          </div>
          <div className="text-right shrink-0">
            <div className="text-brand-pink font-black text-xl">R$ {formatPrice(plan.price)}</div>
            <div className="text-neutral-500 text-xs">{getPeriodLabel(plan.interval, plan.intervalCount)}</div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <h4 className="text-white font-semibold text-sm mb-3 pb-2 border-b border-neutral-800">Dados da Salão</h4>
            <div className="space-y-3">
              <label className="block text-neutral-400 text-sm">
                Nome da salão *
                <input type="text" className={inputClass} value={form.salonName} onChange={(e) => set("salonName", e.target.value)} placeholder="Ex: Salão Rodrigues" required disabled={submitting} />
              </label>
              <label className="block text-neutral-400 text-sm">
                Slug da salão
                <input type="text" className={inputClass} value={form.slug} onChange={(e) => set("slug", e.target.value.toLowerCase())} placeholder="Ex: salão-rodrigues" disabled={submitting} />
                <small className="text-neutral-500 text-xs mt-1 block">Se não informar, o sistema gera automaticamente.</small>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-neutral-400 text-sm">
                  CNPJ
                  <input type="text" className={inputClass} value={form.cnpj} onChange={(e) => set("cnpj", e.target.value)} placeholder="00.000.000/0001-00" disabled={submitting} />
                </label>
                <label className="block text-neutral-400 text-sm">
                  Telefone
                  <input type="tel" className={inputClass} value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="(11) 99999-9999" disabled={submitting} />
                </label>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-white font-semibold text-sm mb-3 pb-2 border-b border-neutral-800">Regra de Profissional para Assinantes</h4>
            <div className="grid gap-3 md:grid-cols-2">
              <label className={`block cursor-pointer rounded-xl border p-4 transition-colors ${form.subscriptionBarberRule === "fixed" ? "border-primary bg-primary/10" : "border-neutral-800 bg-neutral-900/50 hover:border-neutral-700"}`}>
                <input
                  type="radio"
                  name="subscriptionBarberRule"
                  value="fixed"
                  className="sr-only"
                  checked={form.subscriptionBarberRule === "fixed"}
                  onChange={() => set("subscriptionBarberRule", "fixed")}
                  disabled={submitting}
                />
                <span className="block text-sm font-semibold text-white">Profissional fixo</span>
                <span className="mt-1 block text-xs leading-5 text-neutral-400">
                  Cliente com plano fica vinculado ao profissional escolhido no primeiro agendamento e troca apenas na renovacao mensal ou apos 30 dias.
                </span>
              </label>
              <label className={`block cursor-pointer rounded-xl border p-4 transition-colors ${form.subscriptionBarberRule === "free_choice" ? "border-primary bg-primary/10" : "border-neutral-800 bg-neutral-900/50 hover:border-neutral-700"}`}>
                <input
                  type="radio"
                  name="subscriptionBarberRule"
                  value="free_choice"
                  className="sr-only"
                  checked={form.subscriptionBarberRule === "free_choice"}
                  onChange={() => set("subscriptionBarberRule", "free_choice")}
                  disabled={submitting}
                />
                <span className="block text-sm font-semibold text-white">Livre escolha</span>
                <span className="mt-1 block text-xs leading-5 text-neutral-400">
                  Cliente com plano escolhe qualquer profissional disponivel na data e horario, desde que realize o servico solicitado.
                </span>
              </label>
            </div>
          </div>

          <div>
            <h4 className="text-white font-semibold text-sm mb-3 pb-2 border-b border-neutral-800">Conta do Administrador</h4>
            <div className="space-y-3">
              <label className="block text-neutral-400 text-sm">
                Nome do administrador *
                <input type="text" className={inputClass} value={form.adminName} onChange={(e) => set("adminName", e.target.value)} placeholder="Seu nome completo" required disabled={submitting} />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-neutral-400 text-sm">
                  E-mail *
                  <input type="email" className={inputClass} value={form.adminEmail} onChange={(e) => set("adminEmail", e.target.value)} placeholder="voce@empresa.com" required disabled={submitting} />
                </label>
                <label className="block text-neutral-400 text-sm">
                  Telefone
                  <input type="tel" className={inputClass} value={form.adminPhone} onChange={(e) => set("adminPhone", e.target.value)} placeholder="(11) 99999-9999" disabled={submitting} />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-neutral-400 text-sm">
                  Senha *
                  <PasswordInput className={inputClass} value={form.password} onChange={(e) => set("password", e.target.value)} placeholder="Mínimo 4 caracteres" required disabled={submitting} />
                </label>
                <label className="block text-neutral-400 text-sm">
                  Confirmar senha *
                  <PasswordInput className={inputClass} value={form.confirmPassword} onChange={(e) => set("confirmPassword", e.target.value)} placeholder="Repita sua senha" required disabled={submitting} />
                </label>
              </div>
            </div>
          </div>

          {formError && (
            <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{formError}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={handleClose} disabled={submitting}
              className="flex-1 py-2.5 border border-neutral-700 text-neutral-300 hover:text-white hover:border-neutral-500 rounded-lg text-sm transition-colors disabled:opacity-50">
              Cancelar
            </button>
            <button type="submit" disabled={submitting}
              className="flex-1 py-2.5 bg-gradient-to-r from-brand-purple-dark to-primary hover:from-primary hover:to-brand-pink text-black font-semibold rounded-lg text-sm transition-all disabled:opacity-50">
              {submitting ? "Cadastrando..." : "Cadastrar e ir para pagamento"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Subscription Payment Modal ────────────────────────────────────────────────

function SubscriptionPaymentModal({ plan, customerName, customerEmail, onClose, onSuccess, onFreeTrial }: {
  plan: Plan;
  customerName: string;
  customerEmail: string;
  onClose: () => void;
  onSuccess: () => void;
  onFreeTrial?: () => void;
}) {
  const initCard: CardForm = { number: "", holderName: "", expMonth: "", expYear: "", cvv: "", document: "", phone: "" };
  const [card, setCard] = useState<CardForm>(initCard);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleChange = (field: keyof CardForm, value: string) => setCard((p) => ({ ...p, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!acceptedTerms) { setError("Aceite os termos de cobrança recorrente para continuar."); return; }
    if (card.number.replace(/\s/g, "").length < 16) { setError("Número do cartão inválido."); return; }
    if (!card.holderName.trim()) { setError("Informe o nome do titular."); return; }
    if (!card.expMonth || !card.expYear) { setError("Informe a validade do cartão."); return; }
    if (card.cvv.length < 3) { setError("CVV inválido."); return; }
    if (card.document.replace(/\D/g, "").length < 11) { setError("CPF inválido."); return; }
    if (card.phone.replace(/\D/g, "").length < 10) { setError("Telefone inválido."); return; }

    try {
      setLoading(true);
      const cardToken = await apiTokenizeCard(card);
      await apiSubscribe(plan.id, cardToken, plan.price, {
        name: customerName,
        email: customerEmail,
        document: card.document.replace(/\D/g, ""),
        phone: card.phone.replace(/\D/g, ""),
      });
      setSuccess(true);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.response?.data?.error || err?.message || "Não foi possível processar o pagamento. Verifique os dados e tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 15 }, (_, i) => currentYear + i);
  const months = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));

  if (success) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
        <div className="bg-neutral-950 border border-neutral-800 rounded-2xl w-full max-w-md p-10 text-center">
          <div className="w-16 h-16 bg-green-500/10 border border-green-500/20 rounded-full flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 size={32} className="text-green-400" />
          </div>
          <h3 className="text-2xl font-black text-white mb-2">Assinatura confirmada!</h3>
          <p className="text-neutral-400 mb-1">Plano <strong className="text-white">{plan.name}</strong> ativado com sucesso.</p>
          <p className="text-neutral-500 text-sm mb-8">Acesse o sistema para começar a usar sua salão.</p>
          <button onClick={onSuccess}
            className="w-full py-3 bg-gradient-to-r from-brand-purple-dark to-primary hover:from-primary hover:to-brand-pink text-black font-bold rounded-lg transition-all">
            Acessar o sistema
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm" onClick={onClose}>
      <div className="relative bg-neutral-950 border border-neutral-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={onClose} disabled={loading} aria-label="Fechar"
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors disabled:opacity-50">
          <X size={18} />
        </button>

        <div className="p-6 border-b border-neutral-800">
          <div className="flex items-center gap-2 mb-1">
            <CreditCard size={16} className="text-primary" />
            <span className="text-primary text-xs font-semibold uppercase tracking-wider">Pagamento</span>
          </div>
          <h3 className="text-xl font-bold text-white">Assinar plano {plan.name}</h3>
          <p className="text-neutral-400 text-sm mt-1">
            Cobrança de{" "}
            <strong className="text-brand-pink">R$ {formatPrice(plan.price)}{getPeriodLabel(plan.interval, plan.intervalCount)}</strong>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <h4 className="text-white font-semibold text-sm mb-3 pb-2 border-b border-neutral-800">Dados do Cartão</h4>
            <div className="space-y-3">
              <label className="block text-neutral-400 text-sm">
                Número do cartão *
                <input type="text" inputMode="numeric" className={inputClass} value={card.number}
                  onChange={(e) => handleChange("number", formatCardNumber(e.target.value))} placeholder="0000 0000 0000 0000" maxLength={19} required disabled={loading} />
              </label>
              <label className="block text-neutral-400 text-sm">
                Nome no cartão *
                <input type="text" className={inputClass} value={card.holderName}
                  onChange={(e) => handleChange("holderName", e.target.value.toUpperCase())} placeholder="NOME COMO NO CARTÃO" required disabled={loading} />
              </label>
              <div className="grid grid-cols-3 gap-3">
                <label className="block text-neutral-400 text-sm">
                  Mês *
                  <select className={inputClass} value={card.expMonth} onChange={(e) => handleChange("expMonth", e.target.value)} required disabled={loading}>
                    <option value="">MM</option>
                    {months.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </label>
                <label className="block text-neutral-400 text-sm">
                  Ano *
                  <select className={inputClass} value={card.expYear} onChange={(e) => handleChange("expYear", e.target.value)} required disabled={loading}>
                    <option value="">AAAA</option>
                    {years.map((y) => <option key={y} value={String(y)}>{y}</option>)}
                  </select>
                </label>
                <label className="block text-neutral-400 text-sm">
                  CVV *
                  <input type="text" inputMode="numeric" className={inputClass} value={card.cvv}
                    onChange={(e) => handleChange("cvv", e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="000" maxLength={4} required disabled={loading} />
                </label>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-white font-semibold text-sm mb-3 pb-2 border-b border-neutral-800">Dados do Titular</h4>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-neutral-400 text-sm">
                CPF *
                <input type="text" inputMode="numeric" className={inputClass} value={card.document}
                  onChange={(e) => handleChange("document", formatCPF(e.target.value))} placeholder="000.000.000-00" maxLength={14} required disabled={loading} />
              </label>
              <label className="block text-neutral-400 text-sm">
                Telefone *
                <input type="tel" className={inputClass} value={card.phone}
                  onChange={(e) => handleChange("phone", formatPhone(e.target.value))} placeholder="(11) 99999-9999" maxLength={15} required disabled={loading} />
              </label>
            </div>
          </div>

          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input type="checkbox" checked={acceptedTerms} onChange={(e) => setAcceptedTerms(e.target.checked)} disabled={loading} className="mt-0.5 accent-primary shrink-0" />
            <span className="text-neutral-400 text-xs leading-relaxed">
              Autorizo a cobrança recorrente de{" "}
              <strong className="text-white">R$ {formatPrice(plan.price)}{getPeriodLabel(plan.interval, plan.intervalCount)}</strong>{" "}
              no cartão informado até o cancelamento da assinatura.
            </span>
          </label>

          {error && (
            <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} disabled={loading}
              className="flex-1 py-2.5 border border-neutral-700 text-neutral-300 hover:text-white hover:border-neutral-500 rounded-lg text-sm transition-colors disabled:opacity-50">
              Cancelar
            </button>
            <button type="submit" disabled={loading || !acceptedTerms}
              className="flex-1 py-2.5 bg-gradient-to-r from-brand-purple-dark to-primary hover:from-primary hover:to-brand-pink text-black font-semibold rounded-lg text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2">
              <Lock size={13} />
              {loading ? "Criando assinatura..." : "Confirmar assinatura"}
            </button>
          </div>

          <p className="text-center text-neutral-600 text-xs flex items-center justify-center gap-1">
            <Lock size={11} /> Pagamento seguro via Pagar.me
          </p>

          {onFreeTrial && (
            <button type="button" onClick={onFreeTrial} disabled={loading}
              className="w-full py-2 text-neutral-500 hover:text-neutral-300 text-xs underline underline-offset-2 transition-colors disabled:opacity-50">
              Continuar com período grátis
            </button>
          )}
        </form>
      </div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function PlanCardSkeleton() {
  return (
    <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-6 animate-pulse">
      <div className="h-4 bg-neutral-800 rounded w-1/3 mb-4" />
      <div className="h-6 bg-neutral-800 rounded w-1/2 mb-2" />
      <div className="h-4 bg-neutral-800 rounded w-3/4 mb-6" />
      <div className="h-12 bg-neutral-800 rounded mb-6" />
      <div className="space-y-2.5 mb-8">
        <div className="h-4 bg-neutral-800 rounded w-full" />
        <div className="h-4 bg-neutral-800 rounded w-5/6" />
        <div className="h-4 bg-neutral-800 rounded w-4/6" />
        <div className="h-4 bg-neutral-800 rounded w-3/4" />
      </div>
      <div className="h-11 bg-neutral-800 rounded-lg" />
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

interface PaymentCtx { plan: Plan; customerName: string; customerEmail: string; }

export function LandingPage() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [plansError, setPlansError] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [paymentCtx, setPaymentCtx] = useState<PaymentCtx | null>(null);
  const [leadModalOpen, setLeadModalOpen] = useState(false);

  useEffect(() => {
    apiFetchPlans()
      .then(setPlans)
      .catch(() => setPlansError("Não foi possível carregar os planos. Tente novamente."))
      .finally(() => setPlansLoading(false));
  }, []);

  useEffect(() => {
    const target = (state as { scrollTo?: string } | null)?.scrollTo;
    if (!target) return;
    const el = document.getElementById(target);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      // planos carregam via API — tenta de novo após renderizar
      const timer = setTimeout(() => {
        document.getElementById(target)?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [state]);

  const goLogin = () => navigate("/login");

  const onRegistered = (plan: Plan, result: RegisterResult) => {
    setSelectedPlan(null);
    setPaymentCtx({ plan, customerName: result.user.name, customerEmail: result.user.email });
  };

  const onSubscriptionSuccess = () => { setPaymentCtx(null); navigate("/login"); };

  return (
    <div id="topo" className="bg-black min-h-screen">
      {/* orbit animations */}
      <style>{`
        @keyframes lp-orbit { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes lp-orbit-r { from { transform: rotate(360deg); } to { transform: rotate(0deg); } }
        .lp-o1 { animation: lp-orbit 25s linear infinite; }
        .lp-o2 { animation: lp-orbit-r 18s linear infinite; }
      `}</style>

      {/* ── Header ── */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-black/85 backdrop-blur-md border-b border-neutral-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-28 flex items-center justify-between">
          <a href="#topo" aria-label="SalaOne">
            <img src={salaOneLogo} alt="SalaOne" className="h-20 w-20 rounded-full object-cover" />
          </a>

          <nav className="hidden md:flex items-center gap-6" aria-label="Navegação principal">
            {navLinks.map((link) => (
              <a key={link.href} href={link.href} className="text-neutral-400 hover:text-white text-sm transition-colors">
                {link.label}
              </a>
            ))}
            <button onClick={goLogin}
              className="ml-2 px-4 py-2 bg-gradient-to-r from-brand-purple-dark to-primary hover:from-primary hover:to-brand-pink text-black text-sm font-semibold rounded-lg transition-all">
              Acessar Sistema
            </button>
          </nav>

          <button className="md:hidden text-neutral-400 hover:text-white" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Menu">
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {mobileOpen && (
          <div className="md:hidden bg-neutral-950 border-b border-neutral-800 px-4 pb-4">
            <nav className="flex flex-col gap-1 pt-2">
              {navLinks.map((link) => (
                <a key={link.href} href={link.href} onClick={() => setMobileOpen(false)}
                  className="py-2.5 text-neutral-400 hover:text-white text-sm transition-colors">
                  {link.label}
                </a>
              ))}
              <button onClick={() => { goLogin(); setMobileOpen(false); }}
                className="mt-2 w-full py-2.5 bg-gradient-to-r from-brand-purple-dark to-primary text-black text-sm font-semibold rounded-lg">
                Acessar Sistema
              </button>
            </nav>
          </div>
        )}
      </header>

      {/* ── Hero ── */}
      <section className="relative min-h-screen flex items-center pt-28 bg-black overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-purple/40 via-black to-black pointer-events-none" />
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-brand-purple-dark/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-20 grid lg:grid-cols-2 gap-14 items-center w-full">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary/10 border border-primary/25 rounded-full text-brand-pink text-sm mb-6">
              <Scissors size={14} />
              Sistema de gestão para salões
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white leading-[1.1] tracking-tight mb-6">
              Agenda, financeiro e equipe em uma{" "}
              <span className="bg-gradient-to-r from-brand-pink to-brand-purple-dark bg-clip-text text-transparent">
                rotina mais simples.
              </span>
            </h1>

            <p className="text-neutral-400 text-lg leading-relaxed mb-8">
              A SALAONE organiza agendamentos, assinaturas, comissões e relatórios para
              salões que querem vender mais sem perder o controle da operação.
            </p>

            <div className="flex flex-wrap gap-3 mb-8">
              <a href="#planos"
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-brand-purple-dark to-primary hover:from-primary hover:to-brand-pink text-black font-semibold rounded-lg transition-all shadow-lg shadow-primary/20">
                Começar agora <ArrowRight size={18} />
              </a>
              <button onClick={goLogin}
                className="px-6 py-3 border border-neutral-700 hover:border-primary/50 text-neutral-300 hover:text-white rounded-lg transition-colors">
                Já tenho conta
              </button>
            </div>

            <div className="flex flex-wrap gap-5" aria-label="Benefícios principais">
              {["Cadastro rápido", "Planos acessíveis", "Suporte na implantação"].map((item) => (
                <span key={item} className="inline-flex items-center gap-1.5 text-neutral-400 text-sm">
                  <CheckCircle2 size={16} className="text-primary" /> {item}
                </span>
              ))}
            </div>
          </div>

          <div className="flex justify-center lg:justify-end" aria-label="Identidade SalaOne">
            <div className="relative w-72 h-72 sm:w-96 sm:h-96 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border border-primary/15 lp-o1" />
              <div className="absolute inset-8 rounded-full border border-primary/10 lp-o2" />
              <div className="absolute inset-16 rounded-full border border-neutral-800" />
              <div className="relative z-10 w-52 h-52 rounded-full bg-gradient-to-br from-brand-purple-dark/20 to-brand-purple/10 border-2 border-primary/40 flex items-center justify-center overflow-hidden shadow-2xl shadow-primary/20">
                <img src={salaOneLogo} alt="SalaOne" className="h-36 w-36 rounded-full object-cover" />
              </div>
              <div className="absolute top-6 right-4 flex items-center gap-2 bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 shadow-xl">
                <CalendarCheck size={15} className="text-brand-pink" />
                <span className="text-neutral-200 text-xs font-medium">Agenda online</span>
              </div>
              <div className="absolute bottom-14 right-0 flex items-center gap-2 bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 shadow-xl">
                <Wallet size={15} className="text-brand-pink" />
                <span className="text-neutral-200 text-xs font-medium">Financeiro</span>
              </div>
              <div className="absolute bottom-6 left-4 flex items-center gap-2 bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 shadow-xl">
                <Users size={15} className="text-brand-pink" />
                <span className="text-neutral-200 text-xs font-medium">Equipe</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Problems ── */}
      <section className="py-24 bg-neutral-950">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <span className="text-primary text-sm font-semibold uppercase tracking-wider">Desafios reais</span>
            <h2 className="text-3xl sm:text-4xl font-black text-white mt-2 mb-0">
              Quando a salão cresce, improviso começa a custar caro.
            </h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-5 mb-8">
            {painPoints.map(({ Icon, title, text }) => (
              <article key={title} className="bg-black border border-neutral-800 rounded-xl p-6 hover:border-primary/20 transition-colors">
                <div className="w-10 h-10 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center justify-center mb-4">
                  <Icon size={20} className="text-red-400" />
                </div>
                <h3 className="text-white font-semibold mb-2">{title}</h3>
                <p className="text-neutral-400 text-sm leading-relaxed">{text}</p>
              </article>
            ))}
          </div>
          <div className="bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 border border-primary/15 rounded-xl p-6 text-center">
            <p className="text-neutral-300 leading-relaxed">
              Com uma operação centralizada, a equipe enxerga a agenda, atende melhor e acompanha o
              dinheiro sem depender de planilhas soltas.
            </p>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="solucoes" className="py-24 bg-black">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <span className="text-primary text-sm font-semibold uppercase tracking-wider">Solução</span>
            <h2 className="text-3xl sm:text-4xl font-black text-white mt-2 mb-4">
              Uma plataforma completa para o dia a dia da sua salão.
            </h2>
            <p className="text-neutral-400 max-w-xl mx-auto leading-relaxed">
              Recursos essenciais em uma experiência direta, feita para quem precisa operar rápido
              no balcão e acompanhar os números com clareza.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {featuresList.map(({ Icon, title, text }) => (
              <article key={title}
                className="group bg-neutral-950 hover:bg-neutral-900 border border-neutral-800 hover:border-primary/30 rounded-xl p-6 transition-all hover:shadow-lg hover:shadow-primary/5">
                <div className="w-10 h-10 bg-gradient-to-br from-primary/20 to-brand-purple-dark/10 rounded-lg flex items-center justify-center mb-4">
                  <Icon size={20} className="text-brand-pink" />
                </div>
                <h3 className="text-white font-semibold mb-2">{title}</h3>
                <p className="text-neutral-400 text-sm leading-relaxed">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── Differentials ── */}
      <section id="sobre" className="py-24 bg-neutral-950">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <span className="text-primary text-sm font-semibold uppercase tracking-wider">Por que SalaOne</span>
            <h2 className="text-3xl sm:text-4xl font-black text-white mt-2">
              Mais organização sem complicar a rotina da equipe.
            </h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-6">
            {differentials.map(({ Icon, title, text }) => (
              <article key={title} className="text-center bg-black border border-neutral-800 rounded-xl p-8 hover:border-primary/20 transition-colors">
                <div className="w-14 h-14 bg-gradient-to-br from-primary/20 to-brand-purple-dark/10 border border-primary/20 rounded-full flex items-center justify-center mx-auto mb-5">
                  <Icon size={26} className="text-brand-pink" />
                </div>
                <h3 className="text-white font-semibold text-lg mb-3">{title}</h3>
                <p className="text-neutral-400 text-sm leading-relaxed">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="planos" className="py-24 bg-black">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <span className="text-primary text-sm font-semibold uppercase tracking-wider">Planos</span>
            <h2 className="text-3xl sm:text-4xl font-black text-white mt-2 mb-3">
              Escolha o plano ideal para começar.
            </h2>
            <p className="text-neutral-400">Todos incluem agendamento online, cadastro de clientes e recorrência.</p>
          </div>

          {plansError ? (
            <p className="text-center text-red-400 py-8 bg-red-500/5 border border-red-500/20 rounded-xl">{plansError}</p>
          ) : (
            <div className="grid sm:grid-cols-3 gap-6">
              {plansLoading ? (
                <><PlanCardSkeleton /><PlanCardSkeleton /><PlanCardSkeleton /></>
              ) : plans.length === 0 ? (
                <p className="col-span-3 text-center text-neutral-500 py-8">Nenhum plano disponível no momento.</p>
              ) : (
                plans.map((plan, index) => {
                  const variant = variantOrder[Math.min(index, 2)];
                  const styles = cardStyles[variant];
                  return (
                    <article key={plan.id} className={`relative flex flex-col border rounded-2xl p-6 transition-colors ${styles.wrapper}`}>
                      {plan.isRecommended && (
                        <div className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full mb-4 w-fit ${styles.badge}`}>
                          <Star size={11} />
                          {variant === "master" ? "Mais completo" : "Mais popular"}
                        </div>
                      )}
                      <div className="mb-4">
                        <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                        {plan.description && <p className="text-neutral-500 text-sm mt-1">{plan.description}</p>}
                      </div>
                      <div className="flex items-end gap-1 mb-6">
                        <span className="text-neutral-400 text-sm mb-1">R$</span>
                        <span className={`text-4xl font-black leading-none ${styles.price}`}>{formatPrice(plan.price)}</span>
                        <span className="text-neutral-500 text-sm mb-1">{getPeriodLabel(plan.interval, plan.intervalCount)}</span>
                      </div>
                      {plan.features.length > 0 && (
                        <ul className="space-y-2.5 mb-8 flex-1">
                          {plan.features.map((feature) => (
                            <li key={feature} className="flex items-start gap-2 text-sm text-neutral-300">
                              <CheckCircle2 size={15} className="text-primary mt-0.5 shrink-0" /> {feature}
                            </li>
                          ))}
                        </ul>
                      )}
                      <button onClick={() => setSelectedPlan(plan)} className={`w-full py-3 rounded-lg text-sm transition-all ${styles.btn}`}>
                        Assinar {plan.name}
                      </button>
                    </article>
                  );
                })
              )}
            </div>
          )}
        </div>
      </section>

      {/* ── Process ── */}
      <section className="py-24 bg-neutral-950">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <span className="text-primary text-sm font-semibold uppercase tracking-wider">Implantação</span>
            <h2 className="text-3xl sm:text-4xl font-black text-white mt-2">
              Do cadastro ao primeiro agendamento com menos atrito.
            </h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-6">
            {processSteps.map((step, i) => (
              <article key={step.number} className="relative text-center bg-black border border-neutral-800 rounded-xl p-8 hover:border-primary/20 transition-colors">
                {i < processSteps.length - 1 && (
                  <div className="hidden sm:block absolute top-[52px] left-[calc(100%+1px)] w-6 h-px bg-gradient-to-r from-primary/30 to-transparent z-10" />
                )}
                <div className="w-14 h-14 bg-gradient-to-br from-brand-purple-dark to-primary rounded-full flex items-center justify-center mx-auto mb-5 shadow-lg shadow-primary/30">
                  <span className="text-black font-black text-xl">{step.number}</span>
                </div>
                <h3 className="text-white font-semibold text-lg mb-3">{step.title}</h3>
                <p className="text-neutral-400 text-sm leading-relaxed">{step.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-24 bg-black">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="relative overflow-hidden bg-gradient-to-br from-brand-purple-dark via-primary to-brand-pink rounded-2xl px-8 py-16 text-center">
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
            <div className="absolute -top-20 -right-20 w-64 h-64 bg-brand-pink/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-brand-purple/30 rounded-full blur-3xl pointer-events-none" />
            <div className="relative z-10">
              <span className="text-brand-blush text-sm font-semibold uppercase tracking-wider">
                Pronto para organizar sua salão?
              </span>
              <h2 className="text-3xl sm:text-4xl font-black text-black mt-3 mb-8 max-w-xl mx-auto leading-tight">
                Comece pelo plano ideal e avance para o pagamento com cadastro guiado.
              </h2>
              <a href="#planos"
                className="inline-flex items-center gap-2 px-8 py-4 bg-black hover:bg-neutral-900 text-white font-bold rounded-lg transition-colors text-base shadow-xl">
                Ver planos <ArrowRight size={20} />
              </a>
              <div className="mt-8">
                <a href="https://instagram.com/adtechsolutions_ltda" target="_blank" rel="noopener noreferrer"
                  className="text-brand-purple hover:text-black text-sm transition-colors font-medium">
                  @adtechsolutions_ltda
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-neutral-950 border-t border-neutral-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-8">
            <img src={salaOneLogo} alt="SalaOne" className="h-20 w-20 rounded-full object-cover" />
            <div className="flex flex-wrap gap-5 text-sm">
              <a href="https://www.salaone.com.br" target="_blank" rel="noopener noreferrer"
                className="text-neutral-400 hover:text-white transition-colors">
                www.salaone.com.br
              </a>
              <a href="/privacy" className="text-neutral-400 hover:text-white transition-colors">Política de Privacidade</a>
              <a href="/terms" className="text-neutral-400 hover:text-white transition-colors">Termos de Serviço</a>
            </div>
          </div>
          <div className="border-t border-neutral-800 pt-6 text-center text-neutral-600 text-sm">
            © 2026 AD Tech Solution Ltda. Todos os direitos reservados.
          </div>
        </div>
      </footer>

      {/* ── Modals ── */}
      <button
        type="button"
        onClick={() => setLeadModalOpen(true)}
        data-lead-chat-trigger
        className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-3 font-semibold text-white shadow-xl shadow-emerald-500/20 transition hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-black"
        aria-label="Falar com o time de vendas pelo WhatsApp"
      >
        <WhatsAppIcon className="h-5 w-5" />
        <span className="hidden sm:inline">Fale com vendas</span>
      </button>
      <LandingLeadChat open={leadModalOpen} onOpenChange={setLeadModalOpen} />
      {selectedPlan && (
        <RegisterModal plan={selectedPlan} onClose={() => setSelectedPlan(null)}
          onRegistered={(result) => onRegistered(selectedPlan, result)} />
      )}
      {paymentCtx && (
        <SubscriptionPaymentModal
          plan={paymentCtx.plan}
          customerName={paymentCtx.customerName}
          customerEmail={paymentCtx.customerEmail}
          onClose={() => setPaymentCtx(null)}
          onSuccess={onSubscriptionSuccess}
          onFreeTrial={() => { setPaymentCtx(null); navigate("/login"); }}
        />
      )}
    </div>
  );
}
