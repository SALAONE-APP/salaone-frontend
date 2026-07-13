import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  CheckCircle2,
  Edit,
  Filter,
  Loader2,
  MoreHorizontal,
  Play,
  Plus,
  PowerOff,
  Search,
  Star,
  TrendingUp,
  Users,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useAuth } from "@/hooks/useAuth";
import {
  createPlan,
  listPlans,
  updatePlan,
  type Plan,
  type PlanPaymentMethod,
} from "@/service/planService";
import { listServices, type Service } from "@/service/serviceService";
import {
  listSubscriptions,
  updateSubscription,
  type Subscription,
} from "@/service/subscriptionService";

type PlanFilter = "all" | "active" | "inactive" | "recommended";
type SearchTab = "name" | "cpf";

interface PlanFormState {
  name: string;
  subtitle: string;
  price: string;
  color: string;
  cutsPerMonth: string;
  paymentMethod: PlanPaymentMethod;
  maxAdmins: string;
  active: boolean;
  recommended: boolean;
  features: string[];
}

const emptyForm: PlanFormState = {
  name: "",
  subtitle: "",
  price: "",
  color: "#6366f1",
  cutsPerMonth: "4",
  paymentMethod: "credito",
  maxAdmins: "",
  active: true,
  recommended: false,
  features: [],
};

const COLOR_PRESETS = [
  { label: "Índigo", value: "#6366f1" },
  { label: "Roxo", value: "#8b5cf6" },
  { label: "Rosa", value: "#ec4899" },
  { label: "Laranja", value: "#f97316" },
  { label: "Âmbar", value: "#f59e0b" },
  { label: "Verde", value: "#10b981" },
  { label: "Ciano", value: "#06b6d4" },
  { label: "Azul", value: "#3b82f6" },
];

function getApiMessage(error: unknown) {
  const responseData = (error as { response?: { data?: unknown } })?.response?.data;
  if (Array.isArray(responseData)) return responseData.join(" ");
  if (responseData && typeof responseData === "object") {
    const message = (responseData as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  if (error instanceof Error) return error.message;
  return "Nao foi possivel concluir a operacao.";
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function normalizeFeature(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const text = raw.trim();
  if (!text) return null;
  // Compound format stored in DB: TYPE::uuid::Human name
  if (text.includes("::")) {
    const parts = text.split("::");
    const label = parts[parts.length - 1].trim();
    return label.length > 0 ? label : null;
  }
  // Plain UUID — discard
  if (UUID_RE.test(text)) return null;
  return text;
}

function getDisplayFeatures(features: unknown): string[] {
  if (!Array.isArray(features)) return [];
  return features
    .map(normalizeFeature)
    .filter((f): f is string => f !== null);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value || 0);
}

function parseCurrencyInput(value: string) {
  const normalized = value.replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function planToForm(plan: Plan): PlanFormState {
  return {
    name: plan.name ?? "",
    subtitle: plan.subtitle ?? "",
    price: String(plan.price ?? ""),
    color: plan.color ?? "#6366f1",
    cutsPerMonth: String(plan.cutsPerMonth ?? 4),
    paymentMethod: plan.paymentMethod ?? "credito",
    maxAdmins: plan.maxAdmins != null ? String(plan.maxAdmins) : "",
    active: plan.active !== false,
    recommended: plan.recommended === true,
    features: getDisplayFeatures(plan.features),
  };
}

export function PlansPage() {
  const { user } = useAuth();
  const isAdmin = user?.isAdmin === true || user?.role === "admin";
  const [plans, setPlans] = useState<Plan[]>([]);
  const [filter, setFilter] = useState<PlanFilter>("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [form, setForm] = useState<PlanFormState>(emptyForm);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [availableServices, setAvailableServices] = useState<Service[]>([]);
  const [loadingServices, setLoadingServices] = useState(false);
  const [serviceSelectKey, setServiceSelectKey] = useState(0);

  // Subscriptions state
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [subscriptionsTotal, setSubscriptionsTotal] = useState(0);
  const [loadingSubscriptions, setLoadingSubscriptions] = useState(true);
  const [searchTab, setSearchTab] = useState<SearchTab>("name");
  const [searchValue, setSearchValue] = useState("");
  const [togglingSubId, setTogglingSubId] = useState<string | null>(null);
  const isMountedRef = useRef(false);

  const monthlyRevenue = useMemo(() => {
    return subscriptions
      .filter((s) => s.status === "active")
      .reduce((sum, s) => sum + s.amount, 0);
  }, [subscriptions]);

  const filteredPlans = useMemo(() => {
    return plans.filter((plan) => {
      if (filter === "active" && !plan.active) return false;
      if (filter === "inactive" && plan.active) return false;
      if (filter === "recommended" && !plan.recommended) return false;
      return true;
    });
  }, [filter, plans]);



  const stats = useMemo(() => {
    const active = plans.filter((p) => p.active).length;
    const inactive = plans.filter((p) => !p.active).length;
    const recommended = plans.filter((p) => p.recommended).length;
    return { total: plans.length, active, inactive, recommended };
  }, [plans]);

  const loadPlans = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listPlans();
      setPlans(result);
    } catch (err) {
      setError(getApiMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSubscriptions = useCallback(async (search?: string, searchType?: SearchTab) => {
    setLoadingSubscriptions(true);
    try {
      const params: { limit: number; search?: string; searchType?: SearchTab } = { limit: 100 };
      if (search?.trim()) {
        params.search = search.trim();
        params.searchType = searchType ?? "name";
      }
      const result = await listSubscriptions(params);
      setSubscriptions(result.items);
      setSubscriptionsTotal(result.total);
    } catch {
      setSubscriptions([]);
      setSubscriptionsTotal(0);
    } finally {
      setLoadingSubscriptions(false);
    }
  }, []);

  useEffect(() => {
    void loadPlans();
    void loadSubscriptions();
  }, [loadPlans, loadSubscriptions]);

  useEffect(() => {
    if (!isMountedRef.current) {
      isMountedRef.current = true;
      return;
    }
    const debounce = setTimeout(() => {
      void loadSubscriptions(searchValue, searchTab);
    }, 400);
    return () => clearTimeout(debounce);
  }, [searchValue, searchTab, loadSubscriptions]);

  useEffect(() => {
    if (!dialogOpen) return;
    setLoadingServices(true);
    listServices({ limit: 100, includeInactive: false })
      .then((res) => {
        console.info("[PlansPage] Serviços carregados:", res);
        setAvailableServices(res.items);
      })
      .catch((err) => {
        console.error("[PlansPage] Erro ao carregar serviços:", err);
        toast.error("Não foi possível carregar os serviços.");
        setAvailableServices([]);
      })
      .finally(() => setLoadingServices(false));
  }, [dialogOpen]);

  function setField<TField extends keyof PlanFormState>(
    field: TField,
    value: PlanFormState[TField],
  ) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function openCreateDialog() {
    setEditingPlan(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEditDialog(plan: Plan) {
    setEditingPlan(plan);
    setForm(planToForm(plan));
    setDialogOpen(true);
  }

  function addServiceFeature(serviceId: string) {
    const svc = availableServices.find((s) => s.id === serviceId);
    if (!svc) return;
    if (form.features.includes(svc.name)) {
      toast.error("Serviço já adicionado.");
      return;
    }
    setField("features", [...form.features, svc.name]);
    setServiceSelectKey((k) => k + 1);
  }

  function removeFeature(index: number) {
    setField(
      "features",
      form.features.filter((_, i) => i !== index),
    );
  }

  function validateForm() {
    const price = parseCurrencyInput(form.price);
    const cuts = Number(form.cutsPerMonth);

    if (!form.name.trim()) return "Informe o nome do plano.";
    if (!Number.isFinite(price) || price <= 0) return "Informe um preco maior que zero.";
    if (!Number.isInteger(cuts) || cuts < 0) return "Informe a quantidade de cortes (mínimo 0).";

    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validationMessage = validateForm();
    if (validationMessage) {
      toast.error(validationMessage);
      return;
    }

    const payload = {
      name: form.name.trim(),
      subtitle: form.subtitle.trim() || null,
      price: parseCurrencyInput(form.price),
      color: form.color || null,
      cutsPerMonth: Number(form.cutsPerMonth),
      paymentMethod: form.paymentMethod,
      maxAdmins: form.maxAdmins !== "" ? Number(form.maxAdmins) : null,
      active: form.active,
      recommended: form.recommended,
      features: form.features,
    };

    setSaving(true);

    try {
      if (editingPlan) {
        await updatePlan(editingPlan.id, payload);
        toast.success("Plano atualizado.");
      } else {
        await createPlan(payload);
        toast.success("Plano cadastrado.");
      }

      setDialogOpen(false);
      await loadPlans();
    } catch (err) {
      toast.error(getApiMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(plan: Plan) {
    setTogglingId(plan.id);
    try {
      await updatePlan(plan.id, { active: !plan.active });
      toast.success(plan.active ? "Plano inativado." : "Plano ativado.");
      await loadPlans();
    } catch (err) {
      toast.error(getApiMessage(err));
    } finally {
      setTogglingId(null);
    }
  }

  async function toggleSubscriptionStatus(sub: Subscription) {
    setTogglingSubId(sub.id);
    try {
      const newStatus = sub.status === "active" ? "cancelled" : "active";
      await updateSubscription(sub.id, { status: newStatus });
      toast.success(sub.status === "active" ? "Assinatura cancelada." : "Assinatura ativada.");
      await loadSubscriptions(searchValue || undefined, searchTab);
    } catch (err) {
      toast.error(getApiMessage(err));
    } finally {
      setTogglingSubId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="mb-1 text-sm text-muted-foreground">Planos cadastrados</p>
          <h3 className="text-2xl font-semibold text-foreground">{stats.total}</h3>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="mb-1 text-sm text-muted-foreground">Ativos</p>
          <h3 className="text-2xl font-semibold text-foreground">{stats.active}</h3>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="mb-1 text-sm text-muted-foreground">Inativos</p>
          <h3 className="text-2xl font-semibold text-foreground">{stats.inactive}</h3>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="mb-1 text-sm text-muted-foreground">Recomendados</p>
          <h3 className="text-2xl font-semibold text-foreground">{stats.recommended}</h3>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 sm:col-span-1">
          <div className="mb-1 flex items-center gap-1.5">
            <Users size={14} className="text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Assinantes ativos</p>
          </div>
          <h3 className="text-2xl font-semibold text-foreground">
            {subscriptions.filter((s) => s.status === "active").length}
          </h3>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 sm:col-span-1">
          <div className="mb-1 flex items-center gap-1.5">
            <TrendingUp size={14} className="text-emerald-500" />
            <p className="text-sm text-muted-foreground">Receita mensal</p>
          </div>
          <h3 className="text-2xl font-semibold text-emerald-600">
            {formatCurrency(monthlyRevenue)}
          </h3>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center lg:justify-between">
          <h3 className="text-base font-medium text-foreground">Planos de Assinatura</h3>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Filter size={14} />
                  Filtro
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuRadioGroup
                  value={filter}
                  onValueChange={(value) => setFilter(value as PlanFilter)}
                >
                  <DropdownMenuRadioItem value="all">Todos</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="active">Ativos</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="inactive">Inativos</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="recommended">Recomendados</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            {isAdmin ? (
              <Button size="sm" className="gap-2" onClick={openCreateDialog}>
                <Plus size={14} />
                Adicionar Plano
              </Button>
            ) : null}
          </div>
        </div>

        {error ? (
          <div className="p-6 text-sm text-destructive">{error}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">

                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Plano
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Preco/mes
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Cortes
                  </th>
                  <th className="min-w-[220px] px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Beneficios
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Status
                  </th>
                  <th className="w-10 px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-sm text-muted-foreground">
                      <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                      Carregando planos...
                    </td>
                  </tr>
                ) : filteredPlans.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-sm text-muted-foreground">
                      Nenhum plano encontrado.
                    </td>
                  </tr>
                ) : (
                  filteredPlans.map((plan) => (
                    <tr
                      key={plan.id}
                      className="border-b border-border transition-colors last:border-b-0 hover:bg-secondary/30"
                    >

                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="h-9 w-1.5 shrink-0 rounded-full"
                            style={{ backgroundColor: plan.color ?? "#6366f1" }}
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="truncate text-sm font-medium text-foreground">
                                {plan.name}
                              </p>
                              {plan.recommended && (
                                <Star
                                  size={13}
                                  className="shrink-0 fill-amber-400 text-amber-400"
                                />
                              )}
                            </div>
                            {plan.subtitle && (
                              <p className="truncate text-xs text-muted-foreground">
                                {plan.subtitle}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-foreground">
                        {formatCurrency(plan.price)}
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">
                        {plan.cutsPerMonth} / mês
                      </td>
                      <td className="min-w-0 px-4 py-3">
                        {(() => {
                          const features = getDisplayFeatures(plan.features);
                          return (
                            <div className="flex min-w-0 flex-wrap gap-1.5">
                              {features.length === 0 ? (
                                <span className="text-xs text-muted-foreground">—</span>
                              ) : (
                                features.slice(0, 3).map((feature, i) => (
                                  <Badge
                                    key={i}
                                    variant="secondary"
                                    className="h-auto whitespace-normal break-words text-xs"
                                  >
                                    {feature}
                                  </Badge>
                                ))
                              )}
                              {features.length > 3 && (
                                <Badge variant="secondary" className="shrink-0 text-xs">
                                  +{features.length - 3}
                                </Badge>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant="outline"
                          className={
                            plan.active
                              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600"
                              : "border-muted-foreground/20 bg-muted text-muted-foreground"
                          }
                        >
                          {plan.active ? "Ativo" : "Inativo"}
                        </Badge>
                      </td>
                      {isAdmin ? (
                        <td className="px-4 py-3">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="p-1 text-muted-foreground transition-colors hover:text-foreground">
                                <MoreHorizontal size={16} />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEditDialog(plan)}>
                                <Edit size={14} />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                disabled={togglingId === plan.id}
                                onClick={() => toggleActive(plan)}
                              >
                                {plan.active ? (
                                  <>
                                    <PowerOff size={14} />
                                    Inativar
                                  </>
                                ) : (
                                  <>
                                    <Zap size={14} />
                                    Ativar
                                  </>
                                )}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      ) : null}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Active Client Subscriptions */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center lg:justify-between">
          <h3 className="text-base font-medium text-foreground">Assinantes</h3>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {/* Tabs Nome / CPF */}
            <div className="flex rounded-md border border-border overflow-hidden text-sm">
              <button
                type="button"
                onClick={() => { setSearchTab("name"); setSearchValue(""); }}
                className={`px-3 py-1.5 transition-colors ${
                  searchTab === "name"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-secondary/50"
                }`}
              >
                Nome
              </button>
              <button
                type="button"
                onClick={() => { setSearchTab("cpf"); setSearchValue(""); }}
                className={`px-3 py-1.5 transition-colors ${
                  searchTab === "cpf"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-secondary/50"
                }`}
              >
                CPF
              </button>
            </div>
            {/* Search input */}
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                placeholder={
                  searchTab === "name"
                    ? "Buscar por nome do cliente..."
                    : "Buscar por CPF..."
                }
                className="pl-8 h-8 w-64 text-sm"
              />
              {searchValue && (
                <button
                  type="button"
                  onClick={() => setSearchValue("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Cliente
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Plano
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Valor/mês
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Ativo até
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Status
                </th>
                {isAdmin ? <th className="px-4 py-3" /> : null}
              </tr>
            </thead>
            <tbody>
              {loadingSubscriptions ? (
                <tr>
                  <td colSpan={isAdmin ? 5 : 4} className="p-8 text-center text-sm text-muted-foreground">
                    <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                    Carregando assinaturas...
                  </td>
                </tr>
              ) : subscriptions.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 5 : 4} className="p-8 text-center text-sm text-muted-foreground">
                    Nenhuma assinatura encontrada.
                  </td>
                </tr>
              ) : (
                subscriptions.map((sub) => (
                  <tr
                    key={sub.id}
                    className="border-b border-border transition-colors last:border-b-0 hover:bg-secondary/30"
                  >
                    <td className="px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {sub.user?.name ?? "—"}
                        </p>
                        {sub.user?.cpf && (
                          <p className="text-xs text-muted-foreground">{sub.user.cpf}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {sub.plan?.color && (
                          <div
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ backgroundColor: sub.plan.color }}
                          />
                        )}
                        <span className="text-sm text-foreground">{sub.plan?.name ?? "—"}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-foreground">
                      {formatCurrency(sub.amount)}
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground">
                      {sub.nextBillingAt
                        ? new Date(sub.nextBillingAt).toLocaleDateString("pt-BR")
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant="outline"
                        className={
                          sub.status === "active"
                            ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600"
                            : sub.status === "pending"
                            ? "border-amber-500/20 bg-amber-500/10 text-amber-700"
                            : sub.status === "paused"
                            ? "border-amber-500/20 bg-amber-500/10 text-amber-600"
                            : "border-muted-foreground/20 bg-muted text-muted-foreground"
                        }
                      >
                        {sub.status === "active"
                          ? "Ativo"
                          : sub.status === "pending"
                          ? "Pendente"
                          : sub.status === "paused"
                          ? "Pausado"
                          : sub.status === "cancelled"
                          ? "Cancelado"
                          : "Expirado"}
                      </Badge>
                    </td>
                    {isAdmin ? (
                      <td className="px-4 py-3">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="p-1 text-muted-foreground transition-colors hover:text-foreground">
                              <MoreHorizontal size={16} />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              disabled={
                                togglingSubId === sub.id ||
                                sub.status === "expired"
                              }
                              onClick={() => toggleSubscriptionStatus(sub)}
                            >
                              {sub.status === "active" ? (
                                <>
                                  <PowerOff size={14} />
                                  Cancelar
                                </>
                              ) : (
                                <>
                                  <Play size={14} />
                                  {sub.status === "pending" ? "Confirmar pagamento" : "Ativar"}
                                </>
                              )}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    ) : null}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {subscriptionsTotal > subscriptions.length && (
          <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
            Exibindo {subscriptions.length} de {subscriptionsTotal} assinaturas
          </div>
        )}
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleSubmit} className="space-y-5">
            <DialogHeader>
              <DialogTitle>
                {editingPlan ? "Editar Plano" : "Adicionar Plano"}
              </DialogTitle>
              <DialogDescription>
                Configure os detalhes e beneficios do plano de assinatura.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 md:grid-cols-2">
              {/* Nome */}
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="plan-name">Nome do plano</Label>
                <Input
                  id="plan-name"
                  value={form.name}
                  onChange={(e) => setField("name", e.target.value)}
                  placeholder="Ex: Plano Mensal"
                  required
                />
              </div>

              {/* Subtítulo */}
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="plan-subtitle">Subtitulo</Label>
                <Input
                  id="plan-subtitle"
                  value={form.subtitle}
                  onChange={(e) => setField("subtitle", e.target.value)}
                  placeholder="Ex: Perfeito para quem vai toda semana"
                />
              </div>

              {/* Preço */}
              <div className="space-y-2">
                <Label htmlFor="plan-price">Preco mensal (R$)</Label>
                <Input
                  id="plan-price"
                  value={form.price}
                  onChange={(e) => setField("price", e.target.value)}
                  placeholder="59,90"
                  inputMode="decimal"
                  required
                />
              </div>

              {/* Cortes por mês */}
              <div className="space-y-2">
                <Label htmlFor="plan-cuts">Cortes por mes</Label>
                <Input
                  id="plan-cuts"
                  type="number"
                  min={0}
                  step={1}
                  value={form.cutsPerMonth}
                  onChange={(e) => setField("cutsPerMonth", e.target.value)}
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="plan-payment-method">Forma de pagamento do plano</Label>
                <Select
                  value={form.paymentMethod}
                  onValueChange={(value) => setField("paymentMethod", value as PlanPaymentMethod)}
                >
                  <SelectTrigger id="plan-payment-method">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="credito">Cartao de credito</SelectItem>
                    <SelectItem value="debito">Cartao de debito</SelectItem>
                    <SelectItem value="pix">Pix</SelectItem>
                    <SelectItem value="local">Pagar no local</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  No cartao de credito, o cliente so consegue assinar pelo checkout seguro e a renovacao e automatica.
                  Em "Pagar no local", a cobranca deve ser conferida pela salão.
                </p>
              </div>

              {/* Cor */}
              <div className="space-y-2 md:col-span-2">
                <Label>Cor do plano</Label>
                <div className="flex flex-wrap gap-2">
                  {COLOR_PRESETS.map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      title={preset.label}
                      onClick={() => setField("color", preset.value)}
                      className="h-8 w-8 rounded-full border-2 transition-all"
                      style={{
                        backgroundColor: preset.value,
                        borderColor:
                          form.color === preset.value ? "#fff" : "transparent",
                        boxShadow:
                          form.color === preset.value
                            ? `0 0 0 2px ${preset.value}`
                            : "none",
                      }}
                    />
                  ))}
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={form.color || "#6366f1"}
                      onChange={(e) => setField("color", e.target.value)}
                      className="h-8 w-8 cursor-pointer rounded-full border border-border bg-transparent p-0.5"
                      title="Cor personalizada"
                    />
                    <span className="text-xs text-muted-foreground">Personalizar</span>
                  </div>
                </div>
              </div>

              {/* Benefícios */}
              <div className="space-y-2 md:col-span-2">
                <Label>Beneficios do plano</Label>
                <Select
                  key={serviceSelectKey}
                  onValueChange={addServiceFeature}
                  disabled={loadingServices}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue
                      placeholder={
                        loadingServices
                          ? "Carregando serviços..."
                          : "Selecione um serviço para adicionar"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    {availableServices
                      .filter((svc) => !form.features.includes(svc.name))
                      .map((svc) => (
                        <SelectItem key={svc.id} value={svc.id}>
                          {svc.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {form.features.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {form.features.map((feature, i) => (
                      <Badge
                        key={i}
                        variant="secondary"
                        className="flex items-center gap-1 pr-1 text-xs"
                      >
                        <CheckCircle2 size={11} className="text-emerald-500" />
                        {feature}
                        <button
                          type="button"
                          onClick={() => removeFeature(i)}
                          className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
                        >
                          <X size={10} />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Checkboxes */}
              <label className="flex items-center gap-2 rounded-md border border-border p-3 text-sm">
                <Checkbox
                  checked={form.recommended}
                  onCheckedChange={(checked) => setField("recommended", checked === true)}
                />
                Marcar como recomendado
              </label>

              <label className="flex items-center gap-2 rounded-md border border-border p-3 text-sm">
                <Checkbox
                  checked={form.active}
                  onCheckedChange={(checked) => setField("active", checked === true)}
                />
                Plano ativo
              </label>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={saving}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando
                  </>
                ) : (
                  "Salvar"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

    </div>
  );
}
