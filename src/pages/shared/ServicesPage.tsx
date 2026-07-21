import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import {
  AlertCircle,
  Archive,
  Clock,
  Edit,
  Filter,
  Image as ImageIcon,
  Loader2,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Scissors,
  Search,
  ShieldCheck,
  Tag,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";

import {
  createService,
  deleteService,
  listServices,
  reactivateService,
  updateService,
  type Service,
} from "@/service/serviceService";
import { getMyActiveSubscription, type Subscription } from "@/service/subscriptionService";
import { uploadImage } from "@/service/uploadService";
import { getSettings, type SubscriptionProfessionalRule } from "@/service/settingsService";

const normalizeText = (value: string) => {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
};

type ServiceFilter = "all" | "active" | "inactive" | "covered";

interface ServiceFormState {
  name: string;
  basePrice: string;
  durationMinutes: string;
  servicePoints: string;
  commissionPercent: string;
  promotionalPrice: string;
  imageUrl: string;
  imagePublicId: string | null;
  coveredByPlan: boolean;
  active: boolean;
}

const emptyForm: ServiceFormState = {
  name: "",
  basePrice: "",
  durationMinutes: "30",
  servicePoints: "1",
  commissionPercent: "",
  promotionalPrice: "0",
  imageUrl: "",
  imagePublicId: null,
  coveredByPlan: false,
  active: true,
};

const statusStyles = {
  active: "border-emerald-500/20 bg-emerald-500/10 text-emerald-600",
  inactive: "border-muted-foreground/20 bg-muted text-muted-foreground",
};

function getApiMessage(error: unknown) {
  const responseData = (error as { response?: { data?: unknown } })?.response?.data;

  if (Array.isArray(responseData)) return responseData.join(" ");

  if (responseData && typeof responseData === "object") {
    const message = (responseData as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }

  if (typeof responseData === "string") return responseData;
  if (error instanceof Error) return error.message;

  return "Nao foi possivel concluir a operacao.";
}

function parseCurrencyInput(value: string) {
  const normalized = value.replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : NaN;
}

function formatCurrency(value?: number | null) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value || 0);
}


function getCommission(service: Service) {
  return service.commissionPercent ?? service.comissionPercent ?? service.commission_percent ?? null;
}

function serviceToForm(service: Service): ServiceFormState {
  return {
    name: service.name ?? "",
    basePrice: String(service.basePrice ?? ""),
    durationMinutes: String(service.durationMinutes ?? 30),
    servicePoints: String(service.servicePoints ?? service.service_points ?? 1),
    commissionPercent: getCommission(service) == null ? "" : String(getCommission(service)),
    promotionalPrice: String(service.promotionalPrice ?? 0),
    imageUrl: service.imageUrl ?? "",
    imagePublicId: service.imagePublicId ?? service.image_public_id ?? null,
    coveredByPlan: service.covered_by_plan === true,
    active: service.active !== false,
  };
}

export function ServicesPage() {
  const { user } = useAuth();
  const { can } = usePermissions();
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const isAdmin = user?.role === "admin" || user?.isAdmin === true;
  const canManage = isAdmin || can("manageServices");
  const [services, setServices] = useState<Service[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ServiceFilter>("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [serviceToDeactivate, setServiceToDeactivate] = useState<Service | null>(null);
  const [serviceToReactivate, setServiceToReactivate] = useState<Service | null>(null);
  const [form, setForm] = useState<ServiceFormState>(emptyForm);
  const [subscriptionProfessionalRule, setSubscriptionProfessionalRule] = useState<SubscriptionProfessionalRule>("fixed");

  useEffect(() => {
    getSettings()
      .then((s) => setSubscriptionProfessionalRule(s.subscriptionProfessionalRule ?? "fixed"))
      .catch(() => {});
  }, []);

  const isFreeChoice = subscriptionProfessionalRule === "free_choice" && user?.role !== "client";

  const [mySubscription, setMySubscription] = useState<Subscription | null>(null);

  const isServiceCovered = useCallback(
    (service: Service) => {
      if (
        user?.role === "client" &&
        mySubscription &&
        (mySubscription.status === "active" || mySubscription.status === "paused")
      ) {
        if (mySubscription.plan?.features) {
          const normService = normalizeText(service.name || "");
          const isFeatured = mySubscription.plan.features.some((f: string) => {
            const normFeature = normalizeText(f);
            return (
              normFeature === normService ||
              normFeature.includes(normService) ||
              normService.includes(normFeature)
            );
          });
          if (isFeatured) return true;
        }
      }
      return service.covered_by_plan === true;
    },
    [user?.role, mySubscription],
  );

  const filteredServices = useMemo(() => {
    return services.filter((service) => {
      if (filter === "active" && !service.active) return false;
      if (filter === "inactive" && service.active) return false;
      if (filter === "covered" && !isServiceCovered(service)) return false;
      return true;
    });
  }, [filter, services, isServiceCovered]);



  const stats = useMemo(() => {
    const active = services.filter((service) => service.active).length;
    const inactive = services.filter((service) => !service.active).length;
    const covered = services.filter((service) => isServiceCovered(service)).length;

    return {
      total: services.length,
      active,
      inactive,
      covered,
    };
  }, [services, isServiceCovered]);

  const loadServices = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [result, sub] = await Promise.all([
        listServices({
          q: search.trim() || undefined,
          includeInactive: isAdmin ? true : undefined,
          limit: 100,
        }),
        user?.role === "client" ? getMyActiveSubscription().catch(() => null) : Promise.resolve(null),
      ]);
      setServices(result.items);
      setMySubscription(sub);
    } catch (err) {
      setError(getApiMessage(err));
    } finally {
      setLoading(false);
    }
  }, [isAdmin, search, user?.role]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadServices();
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [loadServices]);

  function setField<TField extends keyof ServiceFormState>(
    field: TField,
    value: ServiceFormState[TField],
  ) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function resetImageInput() {
    if (imageInputRef.current) imageInputRef.current.value = "";
  }

  function openCreateDialog() {
    setEditingService(null);
    setForm(emptyForm);
    resetImageInput();
    setDialogOpen(true);
  }

  function openEditDialog(service: Service) {
    setEditingService(service);
    setForm(serviceToForm(service));
    resetImageInput();
    setDialogOpen(true);
  }

  async function handleImageFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);

    try {
      const image = await uploadImage(file, "services");
      setForm((current) => ({ ...current, imageUrl: image.secure_url, imagePublicId: image.public_id }));
      toast.success("Imagem do servico enviada.");
    } catch (err) {
      toast.error(getApiMessage(err));
    } finally {
      setUploadingImage(false);
      resetImageInput();
    }
  }

  function removeServiceImage() {
    setForm((current) => ({ ...current, imageUrl: "", imagePublicId: null }));
    resetImageInput();
  }

  function validateForm() {
    const basePrice = parseCurrencyInput(form.basePrice);
    const durationMinutes = Number(form.durationMinutes);
    const servicePoints = Number(form.servicePoints);
    const commissionPercent = form.commissionPercent.trim()
      ? Number(form.commissionPercent)
      : null;
    const promotionalPrice = parseCurrencyInput(form.promotionalPrice || "0");

    if (!form.name.trim()) return "Informe o nome do servico.";
    if (!Number.isFinite(basePrice) || basePrice <= 0) return "Informe um preco maior que zero.";
    if (!Number.isInteger(durationMinutes) || durationMinutes < 1) {
      return "Informe uma duracao valida.";
    }
    if (!Number.isInteger(servicePoints) || servicePoints < 1) {
      return "Informe uma pontuacao valida para o servico.";
    }
    if (
      commissionPercent !== null &&
      (!Number.isFinite(commissionPercent) || commissionPercent < 0 || commissionPercent > 100)
    ) {
      return "A comissao deve estar entre 0 e 100.";
    }
    if (!Number.isFinite(promotionalPrice) || promotionalPrice < 0) {
      return "Informe um preco promocional valido.";
    }

    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validationMessage = validateForm();
    if (validationMessage) {
      toast.error(validationMessage);
      return;
    }

    const commissionPercent = form.commissionPercent.trim()
      ? Number(form.commissionPercent)
      : null;

    const payload = {
      name: form.name.trim(),
      basePrice: parseCurrencyInput(form.basePrice),
      durationMinutes: Number(form.durationMinutes),
      servicePoints: Number(form.servicePoints),
      commissionPercent,
      promotionalPrice: parseCurrencyInput(form.promotionalPrice || "0"),
      covered_by_plan: form.coveredByPlan,
      imageUrl: form.imageUrl || null,
      imagePublicId: form.imagePublicId,
      active: form.active,
    };

    setSaving(true);

    try {
      if (editingService) {
        await updateService(editingService.id, payload);
        toast.success("Servico atualizado.");
      } else {
        await createService(payload);
        toast.success("Servico cadastrado.");
      }

      setDialogOpen(false);
      await loadServices();
    } catch (err) {
      toast.error(getApiMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate() {
    if (!serviceToDeactivate) return;

    try {
      await deleteService(serviceToDeactivate.id);
      toast.success("Servico desativado.");
      setServiceToDeactivate(null);
      await loadServices();
    } catch (err) {
      toast.error(getApiMessage(err));
    }
  }

  async function handleReactivate() {
    if (!serviceToReactivate) return;

    try {
      await reactivateService(serviceToReactivate.id);
      toast.success("Servico reativado.");
      setServiceToReactivate(null);
      await loadServices();
    } catch (err) {
      toast.error(getApiMessage(err));
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="mb-1 text-sm text-muted-foreground">Servicos cadastrados</p>
          <h3 className="text-2xl font-semibold text-foreground">{stats.total}</h3>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="mb-1 text-sm text-muted-foreground">Ativos</p>
          <h3 className="text-2xl font-semibold text-foreground">{stats.active}</h3>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="mb-1 text-sm text-muted-foreground">Cobertos pelo plano</p>
          <h3 className="text-2xl font-semibold text-foreground">{stats.covered}</h3>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="mb-1 text-sm text-muted-foreground">Inativos</p>
          <h3 className="text-2xl font-semibold text-foreground">{stats.inactive}</h3>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center lg:justify-between">
          <h3 className="text-base font-medium text-foreground">Servicos</h3>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                size={14}
              />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar servicos..."
                className="h-9 w-full bg-secondary pl-9 text-sm sm:w-60"
              />
            </div>
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
                  onValueChange={(value) => setFilter(value as ServiceFilter)}
                >
                  <DropdownMenuRadioItem value="all">Todos</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="active">Ativos</DropdownMenuRadioItem>
                  {canManage ? (
                    <DropdownMenuRadioItem value="inactive">Inativos</DropdownMenuRadioItem>
                  ) : null}
                  <DropdownMenuRadioItem value="covered">Cobertos pelo plano</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            {canManage ? (
              <Button size="sm" className="gap-2" onClick={openCreateDialog}>
                <Plus size={14} />
                Adicionar Servico
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
                    Servico
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Duracao
                  </th>
                  {isFreeChoice && (
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Pontos
                    </th>
                  )}
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Preco
                  </th>
                  {isAdmin ? (
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Comissao
                    </th>
                  ) : null}
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Plano
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Status
                  </th>
                  {canManage ? <th className="w-10 px-4 py-3" /> : null}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={(isAdmin ? 8 : canManage ? 7 : 6) - (isFreeChoice ? 0 : 1)}
                      className="p-8 text-center text-sm text-muted-foreground"
                    >
                      <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                      Carregando servicos...
                    </td>
                  </tr>
                ) : filteredServices.length === 0 ? (
                  <tr>
                    <td
                      colSpan={(isAdmin ? 8 : canManage ? 7 : 6) - (isFreeChoice ? 0 : 1)}
                      className="p-8 text-center text-sm text-muted-foreground"
                    >
                      Nenhum servico encontrado.
                    </td>
                  </tr>
                ) : (
                  filteredServices.map((service) => {
                    const commission = getCommission(service);

                    return (
                      <tr
                        key={service.id}
                        className="border-b border-border transition-colors last:border-b-0 hover:bg-secondary/30"
                      >

                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg bg-secondary">
                              {service.imageUrl ? (
                                <img
                                  src={service.imageUrl}
                                  alt={service.name}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <Scissors size={18} className="text-muted-foreground" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-foreground">
                                {service.name}
                              </p>
                              {service.promotionalPrice && service.promotionalPrice > 0 ? (
                                <p className="text-xs text-muted-foreground">
                                  Promocional: {formatCurrency(service.promotionalPrice)}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 text-sm text-foreground">
                            <Clock size={14} className="text-muted-foreground" />
                            {service.durationMinutes} min
                          </div>
                        </td>
                        {isFreeChoice && (
                          <td className="px-4 py-3 text-sm font-medium text-foreground">
                            {service.servicePoints ?? service.service_points ?? 1}
                          </td>
                        )}
                        <td className="px-4 py-3 text-sm font-medium text-foreground">
                          {formatCurrency(service.basePrice)}
                        </td>
                        {isAdmin ? (
                          <td className="px-4 py-3 text-sm text-muted-foreground">
                            {commission == null ? "-" : `${commission}%`}
                          </td>
                        ) : null}
                        <td className="px-4 py-3">
                          {isServiceCovered(service) ? (
                            <Badge
                              variant="outline"
                              className="gap-1 border-primary/20 bg-primary/10 text-primary"
                            >
                              <ShieldCheck size={12} />
                              Incluso
                            </Badge>
                          ) : (
                            <span className="text-sm text-muted-foreground">Avulso</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant="outline"
                            className={`rounded-full px-2 py-0.5 text-xs ${
                              service.active ? statusStyles.active : statusStyles.inactive
                            }`}
                          >
                            {!service.active ? (
                              <AlertCircle size={12} className="mr-1" />
                            ) : null}
                            {service.active ? "Ativo" : "Inativo"}
                          </Badge>
                        </td>
                        {canManage ? (
                          <td className="px-4 py-3">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button className="p-1 text-muted-foreground transition-colors hover:text-foreground">
                                  <MoreHorizontal size={16} />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openEditDialog(service)}>
                                  <Edit size={14} />
                                  Editar
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                {service.active ? (
                                  <DropdownMenuItem
                                    variant="destructive"
                                    onClick={() => setServiceToDeactivate(service)}
                                  >
                                    <Trash2 size={14} />
                                    Desativar
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem
                                    onClick={() => setServiceToReactivate(service)}
                                  >
                                    <RotateCcw size={14} />
                                    Reativar
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        ) : null}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <form onSubmit={handleSubmit} className="space-y-5">
            <DialogHeader>
              <DialogTitle>
                {editingService ? "Editar Servico" : "Adicionar Servico"}
              </DialogTitle>
              <DialogDescription>
                Configure preco, duracao, comissao e exibicao do servico.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="service-name">Nome</Label>
                <Input
                  id="service-name"
                  value={form.name}
                  onChange={(event) => setField("name", event.target.value)}
                  placeholder="Ex: Corte degradê"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="service-price">Preco base</Label>
                <Input
                  id="service-price"
                  value={form.basePrice}
                  onChange={(event) => setField("basePrice", event.target.value)}
                  placeholder="50,00"
                  inputMode="decimal"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="service-promotional-price">Preco promocional</Label>
                <Input
                  id="service-promotional-price"
                  value={form.promotionalPrice}
                  onChange={(event) => setField("promotionalPrice", event.target.value)}
                  placeholder="0"
                  inputMode="decimal"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="service-duration">Duracao em minutos</Label>
                <Input
                  id="service-duration"
                  type="number"
                  min={1}
                  step={1}
                  value={form.durationMinutes}
                  onChange={(event) => setField("durationMinutes", event.target.value)}
                  required
                />
              </div>
              {isFreeChoice && (
                <div className="space-y-2">
                  <Label htmlFor="service-points">Pontos do servico</Label>
                  <Input
                    id="service-points"
                    type="number"
                    min={1}
                    step={1}
                    value={form.servicePoints}
                    onChange={(event) => setField("servicePoints", event.target.value)}
                    required
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="service-commission">Comissao (%)</Label>
                <Input
                  id="service-commission"
                  type="number"
                  min={0}
                  max={100}
                  step={0.01}
                  value={form.commissionPercent}
                  onChange={(event) => setField("commissionPercent", event.target.value)}
                  placeholder="Opcional"
                />
              </div>
              <div className="space-y-3 md:col-span-2">
                <Label htmlFor="service-image-file">Imagem do servico</Label>
                <input
                  ref={imageInputRef}
                  id="service-image-file"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageFileChange}
                />
                <div className="flex flex-col gap-3 rounded-md border border-border p-3 sm:flex-row sm:items-center">
                  <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
                    {form.imageUrl ? (
                      <img
                        src={form.imageUrl}
                        alt="Imagem do servico"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <ImageIcon className="h-8 w-8 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="gap-2"
                      onClick={() => imageInputRef.current?.click()}
                      disabled={saving || uploadingImage}
                    >
                      {uploadingImage ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4" />
                      )}
                      {form.imageUrl ? "Substituir imagem" : "Enviar imagem"}
                    </Button>
                    {form.imageUrl ? (
                      <Button
                        type="button"
                        variant="ghost"
                        className="gap-2 text-muted-foreground"
                        onClick={removeServiceImage}
                        disabled={saving || uploadingImage}
                      >
                        <X className="h-4 w-4" />
                        Remover imagem
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
              <label className="flex items-center gap-2 rounded-md border border-border p-3 text-sm">
                <Checkbox
                  checked={form.coveredByPlan}
                  onCheckedChange={(checked) => setField("coveredByPlan", checked === true)}
                />
                <Tag className="h-4 w-4 text-muted-foreground" />
                Coberto pelo plano
              </label>
              <label className="flex items-center gap-2 rounded-md border border-border p-3 text-sm">
                <Checkbox
                  checked={form.active}
                  onCheckedChange={(checked) => setField("active", checked === true)}
                />
                Servico ativo
              </label>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={saving || uploadingImage}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={saving || uploadingImage}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando
                  </>
                ) : uploadingImage ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando imagem
                  </>
                ) : (
                  "Salvar"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(serviceToDeactivate)}
        onOpenChange={(open) => {
          if (!open) setServiceToDeactivate(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar servico?</AlertDialogTitle>
            <AlertDialogDescription>
              O servico {serviceToDeactivate?.name} ficara inativo, mas o historico sera
              mantido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeactivate}
            >
              <Archive className="mr-2 h-4 w-4" />
              Desativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(serviceToReactivate)}
        onOpenChange={(open) => {
          if (!open) setServiceToReactivate(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reativar servico?</AlertDialogTitle>
            <AlertDialogDescription>
              O servico {serviceToReactivate?.name} voltara a aparecer como ativo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleReactivate}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Reativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
