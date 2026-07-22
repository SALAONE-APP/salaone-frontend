import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Calendar,
  Cake,
  Download,
  Edit,
  Filter,
  Loader2,
  Mail,
  MoreHorizontal,
  Phone,
  Plus,
  Search,
  Trash2,
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { AppCalendar } from "@/components/AppCalendar";
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
import { usePermissions } from "@/hooks/usePermissions";

import type { UserProfile } from "@/service/userService";
import { createAdminClient, deleteAdminClient, listAdminClients, updateAdminClient } from "@/service/adminClientService";
import {
  createSubscription,
  type Subscription,
} from "@/service/subscriptionService";
import type { Plan } from "@/service/planService";
import type { BookingPaymentMethod } from "@/service/settingsService";
import { downloadCsvReport, downloadPdfReport, type ReportColumn } from "@/utils/reportExport";

type CustomerStatus = "active" | "inactive" | "new";
type CustomerFilter = "all" | CustomerStatus | "missing-phone";

interface CustomerFormState {
  name: string;
  email: string;
  phone: string;
  cpf: string;
  birthDate: string;
  password: string;
}

const emptyForm: CustomerFormState = {
  name: "",
  email: "",
  phone: "",
  cpf: "",
  birthDate: "",
  password: "",
};

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function maskPhone(value: string) {
  const digits = onlyDigits(value).slice(0, 11);

  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }

  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function maskCpf(value: string) {
  const digits = onlyDigits(value).slice(0, 11);

  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  }

  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function dateStringToDate(value: string) {
  if (!value) return undefined;

  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return undefined;

  return new Date(year, month - 1, day);
}

function dateToDateString(date?: Date) {
  if (!date) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDate(value?: string | null) {
  if (!value) return "Sem visitas";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sem visitas";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function getDaysSinceLastVisit(customer: UserProfile) {
  if (!customer.lastVisit) return null;

  const lastVisit = new Date(customer.lastVisit);
  if (Number.isNaN(lastVisit.getTime())) return null;

  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const lastVisitStart = new Date(
    lastVisit.getFullYear(),
    lastVisit.getMonth(),
    lastVisit.getDate(),
  ).getTime();

  return Math.max(0, Math.floor((todayStart - lastVisitStart) / 86400000));
}

function formatDaysSinceLastVisit(customer: UserProfile) {
  const days = getDaysSinceLastVisit(customer);
  if (days == null) return "Sem visitas";
  if (days === 0) return "Hoje";
  if (days === 1) return "1 dia";
  return `${days} dias`;
}

function reportTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function formatPhone(value?: string | null) {
  const digits = onlyDigits(value ?? "");

  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }

  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }

  return value || "Sem telefone";
}

function formatCpf(value?: string | null) {
  const digits = onlyDigits(value ?? "");

  if (digits.length !== 11) return value || "";

  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function formatBirthday(birthDate?: string | null) {
  if (!birthDate) return null;
  const date = new Date(birthDate);
  if (Number.isNaN(date.getTime())) return null;
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}`;
}

function isBirthdayToday(birthDate?: string | null) {
  if (!birthDate) return false;
  const today = new Date();
  const date = new Date(birthDate);
  if (Number.isNaN(date.getTime())) return false;
  return date.getDate() === today.getDate() && date.getMonth() === today.getMonth();
}

function isBirthdaySoon(birthDate?: string | null, withinDays = 7) {
  if (!birthDate) return false;
  const today = new Date();
  const date = new Date(birthDate);
  if (Number.isNaN(date.getTime())) return false;
  const nextBirthday = new Date(today.getFullYear(), date.getMonth(), date.getDate());
  if (nextBirthday < today) nextBirthday.setFullYear(today.getFullYear() + 1);
  const diffDays = Math.floor((nextBirthday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays >= 0 && diffDays <= withinDays;
}

function getCustomerStatus(customer: UserProfile): CustomerStatus {
  if (customer.lastAppointmentStatus === "inactive") return "inactive";
  const visits = customer.visits ?? 0;

  if (visits === 0) return "new";
  if (!customer.lastVisit) return "inactive";

  const lastVisit = new Date(customer.lastVisit);
  if (Number.isNaN(lastVisit.getTime())) return "inactive";

  const daysSinceLastVisit =
    (Date.now() - lastVisit.getTime()) / (1000 * 60 * 60 * 24);

  return daysSinceLastVisit <= 180 ? "active" : "inactive";
}

function statusLabel(status: CustomerStatus) {
  const labels = {
    active: "Ativo",
    inactive: "Inativo",
    new: "Novo",
  };

  return labels[status];
}

function statusClass(status: CustomerStatus) {
  const classes = {
    active: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    inactive: "bg-gray-500/10 text-gray-500 border-gray-500/20",
    new: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  };

  return classes[status];
}

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

export function CustomersPage() {
  const { user } = useAuth();
  const { can, isAdmin } = usePermissions();
  // Profissional vê somente leitura por padrão; apenas admins e profissionais com manageCustomers podem editar
  const canEdit = isAdmin || user?.role !== "professional" || can("manageCustomers");

  const [customers, setCustomers] = useState<UserProfile[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<CustomerFilter>("all");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<UserProfile | null>(null);
  const [form, setForm] = useState<CustomerFormState>(emptyForm);
  const [customerToDelete, setCustomerToDelete] = useState<UserProfile | null>(null);
  const [subscriptionMap, setSubscriptionMap] = useState<Map<string, Subscription>>(new Map());
  const [subDialogCustomer, setSubDialogCustomer] = useState<UserProfile | null>(null);
  const [availablePlans] = useState<Plan[]>([]);
  const [subForm, setSubForm] = useState({ planId: "", paymentMethod: "credito", amount: "" });
  const [hiddenPaymentMethods] = useState<BookingPaymentMethod[]>([]);
  const [savingSub, setSavingSub] = useState(false);

  const limit = 20;

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      setError(null);

      try {
        const result = await listAdminClients({
          q: search.trim() || undefined,
          page,
          limit,
        });

        if (!controller.signal.aborted) {
          setCustomers(result.items);
          setTotal(result.total);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(getApiMessage(err));
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }, 300);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [page, search]);

  async function handleCreateSubscription(e: FormEvent) {
    e.preventDefault();
    if (!subDialogCustomer || !subForm.planId) return;
    if (!subForm.paymentMethod) {
      toast.error("Nenhuma forma de pagamento habilitada nas configuracoes.");
      return;
    }
    const amount = parseFloat(subForm.amount.replace(",", "."));
    if (!amount || amount <= 0) {
      toast.error("Informe um valor válido.");
      return;
    }
    setSavingSub(true);
    try {
      const newSub = await createSubscription({
        userId: subDialogCustomer.id,
        planId: subForm.planId,
        amount,
        paymentMethod: subForm.paymentMethod,
      });
      setSubscriptionMap((prev) => {
        const next = new Map(prev);
        next.set(subDialogCustomer.id, newSub);
        return next;
      });
      toast.success("Plano criado com sucesso.");
      setSubDialogCustomer(null);
    } catch (err) {
      toast.error(getApiMessage(err));
    } finally {
      setSavingSub(false);
    }
  }

  const filteredCustomers = useMemo(() => {
    return customers.filter((customer) => {
      const status = getCustomerStatus(customer);

      if (filter === "all") return true;
      if (filter === "missing-phone") return !customer.phone;

      return status === filter;
    });
  }, [customers, filter]);

  const stats = useMemo(() => {
    const active = customers.filter(
      (customer) => getCustomerStatus(customer) === "active",
    ).length;
    const newCustomers = customers.filter(
      (customer) => getCustomerStatus(customer) === "new",
    ).length;
    const withPhone = customers.filter((customer) => Boolean(customer.phone)).length;
    const birthdayToday = customers.filter((customer) =>
      isBirthdayToday(customer.birthDate ?? customer.birth_date),
    ).length;
    const maxDaysWithoutVisit = customers.reduce((max, customer) => {
      const days = getDaysSinceLastVisit(customer);
      return days == null ? max : Math.max(max, days);
    }, 0);

    return { active, newCustomers, withPhone, birthdayToday, maxDaysWithoutVisit };
  }, [customers]);

  const reportColumns: ReportColumn<UserProfile>[] = useMemo(() => [
    { header: "Cliente", getValue: (customer) => customer.name },
    { header: "CPF", getValue: (customer) => formatCpf(customer.cpf) || "-" },
    { header: "Email", getValue: (customer) => customer.email || "-" },
    { header: "Telefone", getValue: (customer) => formatPhone(customer.phone) },
    { header: "Visitas", getValue: (customer) => customer.visits ?? 0, align: "center" },
    { header: "Ultima visita", getValue: (customer) => formatDate(customer.lastVisit) },
    { header: "Dias ausente", getValue: (customer) => formatDaysSinceLastVisit(customer), align: "center" },
    { header: "Status", getValue: (customer) => statusLabel(getCustomerStatus(customer)) },
    {
      header: "Plano",
      getValue: (customer) => {
        const sub = subscriptionMap.get(customer.id);
        if (!sub) return "Sem plano";
        const labelMap: Record<string, string> = {
          active: "Ativo",
          paused: "Pausado",
          cancelled: "Cancelado",
          expired: "Expirado",
        };
        return `${sub.plan?.name ?? "Plano"} - ${labelMap[sub.status] ?? sub.status}`;
      },
    },
    {
      header: "Aniversario",
      getValue: (customer) => formatBirthday(customer.birthDate ?? customer.birth_date) ?? "-",
      align: "center",
    },
  ], [subscriptionMap]);

  function ensureReportRows() {
    if (filteredCustomers.length === 0) {
      toast.error("Nao ha clientes para gerar o relatorio.");
      return false;
    }

    return true;
  }

  function handleExportPdf() {
    if (!ensureReportRows()) return;
    downloadPdfReport(
      `clientes-${reportTimestamp()}.pdf`,
      {
        title: "Relatorio de Clientes",
        subtitle: `Filtro: ${filter === "all" ? "Todos" : filter} - Busca: ${search.trim() || "sem busca"}`,
        columns: reportColumns,
        rows: filteredCustomers,
        summary: [
          ["Clientes na pagina", filteredCustomers.length],
          ["Clientes ativos", stats.active],
          ["Novos clientes", stats.newCustomers],
          ["Maior ausencia", `${stats.maxDaysWithoutVisit} dias`],
        ],
      },
    );
  }

  function handleExportCsv() {
    if (!ensureReportRows()) return;
    downloadCsvReport(
      `clientes-${reportTimestamp()}.csv`,
      reportColumns,
      filteredCustomers,
    );
  }



  const totalPages = Math.max(1, Math.ceil(total / limit));

  function openCreateDialog() {
    setEditingCustomer(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEditDialog(customer: UserProfile) {
    setEditingCustomer(customer);
    setForm({
      name: customer.name,
      email: customer.email ?? "",
      phone: maskPhone(customer.phone ?? ""),
      cpf: customer.cpf ? maskCpf(customer.cpf) : "",
      birthDate: String(customer.birthDate ?? customer.birth_date ?? "").slice(0, 10),
      password: "",
    });
    setDialogOpen(true);
  }

  function setField(field: keyof CustomerFormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function validateForm() {
    if (!form.name.trim()) return "Informe o nome do cliente.";
    if (form.email.trim() && !/^\S+@\S+\.\S+$/.test(form.email.trim())) return "Informe um e-mail valido.";

    const phone = onlyDigits(form.phone);
    if (!phone || phone.length < 10 || phone.length > 15) {
      return "O telefone deve ter entre 10 e 15 digitos.";
    }

    const cpf = onlyDigits(form.cpf);
    if (cpf && cpf.length !== 11) {
      return "O CPF deve ter 11 digitos.";
    }

    return null;
  }

  async function reloadCurrentPage() {
    const result = await listAdminClients({
      q: search.trim() || undefined,
      page,
      limit,
    });

    setCustomers(result.items);
    setTotal(result.total);
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
      email: form.email.trim().toLowerCase(),
      phone: onlyDigits(form.phone),
      cpf: onlyDigits(form.cpf) || null,
      birthDate: form.birthDate || null,
      photoUrl: null,
    };

    setSaving(true);

    try {
      if (editingCustomer) {
        await updateAdminClient(editingCustomer.id, payload);
        toast.success("Cliente atualizado.");
      } else {
        await createAdminClient(payload);
        toast.success("Cliente cadastrado.");
      }

      setDialogOpen(false);
      await reloadCurrentPage();
    } catch (err) {
      toast.error(getApiMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!customerToDelete) return;

    try {
      await deleteAdminClient(customerToDelete.id);
      toast.success("Cliente desativado.");
      setCustomerToDelete(null);
      await reloadCurrentPage();
    } catch (err) {
      toast.error(getApiMessage(err));
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-5">
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="mb-1 text-sm text-muted-foreground">Total Clientes</p>
          <h3 className="text-2xl font-semibold text-foreground">{total}</h3>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="mb-1 text-sm text-muted-foreground">Clientes Ativos</p>
          <h3 className="text-2xl font-semibold text-foreground">{stats.active}</h3>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="mb-1 text-sm text-muted-foreground">Novos Clientes</p>
          <h3 className="text-2xl font-semibold text-foreground">
            {stats.newCustomers}
          </h3>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="mb-1 text-sm text-muted-foreground">Com Telefone</p>
          <h3 className="text-2xl font-semibold text-foreground">{stats.withPhone}</h3>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-1 flex items-center gap-1.5">
            <Cake size={14} className="text-pink-500" />
            <p className="text-sm text-muted-foreground">Aniversariantes Hoje</p>
          </div>
          <h3 className={`text-2xl font-semibold ${stats.birthdayToday > 0 ? "text-pink-500" : "text-foreground"}`}>
            {stats.birthdayToday}
          </h3>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center lg:justify-between">
          <h3 className="text-base font-medium text-foreground">Todos os Clientes</h3>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                size={14}
              />
              <Input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Buscar clientes..."
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
                  onValueChange={(value) => setFilter(value as CustomerFilter)}
                >
                  <DropdownMenuRadioItem value="all">Todos</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="active">Ativos</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="new">Novos</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="inactive">Inativos</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="missing-phone">
                    Sem telefone
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" size="sm" className="gap-2" onClick={handleExportPdf}>
              <Download size={14} />
              PDF
            </Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={handleExportCsv}>
              <Download size={14} />
              CSV
            </Button>
            {canEdit && (
              <Button size="sm" className="gap-2" onClick={openCreateDialog}>
                <Plus size={14} />
                Adicionar Cliente
              </Button>
            )}
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
                    Cliente
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Contato
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Visitas
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Ultima Visita
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Dias sem comparecer
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Status Plano
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Aniversário
                  </th>
                  {canEdit && <th className="w-10 px-4 py-3" />}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={canEdit ? 9 : 8} className="p-8 text-center text-sm text-muted-foreground">
                      <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                      Carregando clientes...
                    </td>
                  </tr>
                ) : filteredCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={canEdit ? 9 : 8} className="p-8 text-center text-sm text-muted-foreground">
                      Nenhum cliente encontrado.
                    </td>
                  </tr>
                ) : (
                  filteredCustomers.map((customer) => {
                    const status = getCustomerStatus(customer);

                    return (
                      <tr
                        key={customer.id}
                        className="border-b border-border transition-colors last:border-b-0 hover:bg-secondary/30"
                      >

                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10">
                              <AvatarImage
                                src={customer.photoUrl ?? undefined}
                                alt={customer.name}
                              />
                              <AvatarFallback className="bg-primary/10 text-sm text-primary">
                                {getInitials(customer.name)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm font-medium text-foreground">
                                {customer.name}
                              </p>
                              {customer.cpf ? (
                                <p className="text-xs text-muted-foreground">
                                  CPF {formatCpf(customer.cpf)}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Mail size={12} />
                              {customer.email || "Sem e-mail"}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Phone size={12} />
                              {formatPhone(customer.phone)}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-foreground">
                          {customer.visits ?? 0}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Calendar size={14} />
                            {formatDate(customer.lastVisit)}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-foreground">
                          {formatDaysSinceLastVisit(customer)}
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant="outline"
                            className={`rounded-full px-2 py-0.5 text-xs ${statusClass(status)}`}
                          >
                            {statusLabel(status)}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          {(() => {
                            const sub = subscriptionMap.get(customer.id);
                            if (!sub) {
                              return (
                                <Badge variant="outline" className="border-muted-foreground/20 bg-muted text-muted-foreground">
                                  Sem plano
                                </Badge>
                              );
                            }
                            const classMap: Record<string, string> = {
                              active: "border-emerald-500/20 bg-emerald-500/10 text-emerald-600",
                              paused: "border-amber-500/20 bg-amber-500/10 text-amber-600",
                              cancelled: "border-muted-foreground/20 bg-muted text-muted-foreground",
                              expired: "border-muted-foreground/20 bg-muted text-muted-foreground",
                            };
                            const labelMap: Record<string, string> = {
                              active: "Ativo",
                              paused: "Pausado",
                              cancelled: "Cancelado",
                              expired: "Expirado",
                            };
                            return (
                              <Badge variant="outline" className={classMap[sub.status] ?? ""}>
                                {labelMap[sub.status] ?? sub.status}
                              </Badge>
                            );
                          })()}
                        </td>
                        <td className="px-4 py-3">
                          {(() => {
                            const bd = customer.birthDate ?? customer.birth_date;
                            const formatted = formatBirthday(bd);
                            const isToday = isBirthdayToday(bd);
                            const isSoon = !isToday && isBirthdaySoon(bd);
                            if (!formatted) {
                              return <span className="text-xs text-muted-foreground">—</span>;
                            }
                            return (
                              <div className="flex items-center gap-1.5">
                                <Cake
                                  size={14}
                                  className={
                                    isToday
                                      ? "text-pink-500"
                                      : isSoon
                                        ? "text-amber-500"
                                        : "text-muted-foreground"
                                  }
                                />
                                <span
                                  className={`text-sm font-medium ${
                                    isToday
                                      ? "text-pink-500"
                                      : isSoon
                                        ? "text-amber-500"
                                        : "text-foreground"
                                  }`}
                                >
                                  {formatted}
                                </span>
                                {isToday && (
                                  <Badge
                                    variant="outline"
                                    className="rounded-full border-pink-300 bg-pink-50 px-1.5 py-0 text-[10px] text-pink-600"
                                  >
                                    Hoje!
                                  </Badge>
                                )}
                              </div>
                            );
                          })()}
                        </td>
                        {canEdit && (
                          <td className="px-4 py-3">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="p-1 text-muted-foreground transition-colors hover:text-foreground">
                                <MoreHorizontal size={16} />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {isBirthdayToday(customer.birthDate ?? customer.birth_date) && (
                                <>
                                  <DropdownMenuItem className="text-pink-600 focus:text-pink-600" disabled>
                                    <Cake size={14} />
                                    Aniversário hoje!
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                </>
                              )}
                              <DropdownMenuItem onClick={() => openEditDialog(customer)}>
                                <Edit size={14} />
                                Editar cliente
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                variant="destructive"
                                onClick={() => setCustomerToDelete(customer)}
                              >
                                <Trash2 size={14} />
                                Remover
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-col gap-3 border-t border-border p-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>
            Pagina {page} de {totalPages} - {total} clientes
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || loading}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            >
              Proxima
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <form onSubmit={handleSubmit} className="space-y-5">
            <DialogHeader>
              <DialogTitle>
                {editingCustomer ? "Editar Cliente" : "Adicionar Cliente"}
              </DialogTitle>
              <DialogDescription>
                {editingCustomer
                  ? "Atualize os dados cadastrais do cliente."
                  : "Cadastre um cliente para esta salão."}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 md:grid-cols-2">
              <>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="customer-name">Nome</Label>
                    <Input
                      id="customer-name"
                      value={form.name}
                      onChange={(event) => setField("name", event.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="customer-email">E-mail</Label>
                    <Input
                      id="customer-email"
                      type="email"
                      value={form.email}
                      onChange={(event) => setField("email", event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="customer-phone">Telefone</Label>
                    <Input
                      id="customer-phone"
                      value={form.phone}
                      onChange={(event) => setField("phone", maskPhone(event.target.value))}
                      placeholder="(11) 99999-9999"
                      inputMode="numeric"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="customer-cpf">CPF</Label>
                    <Input
                      id="customer-cpf"
                      value={form.cpf}
                      onChange={(event) => setField("cpf", maskCpf(event.target.value))}
                      placeholder="000.000.000-00"
                      inputMode="numeric"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="customer-birth-date">Data de nascimento</Label>
                    <AppCalendar
                      value={dateStringToDate(form.birthDate)}
                      onChange={(date) => setField("birthDate", dateToDateString(date))}
                      placeholder="Selecionar data"
                      disableFuture
                      popoverPortal={false}
                      className="h-9 rounded-md"
                    />
                  </div>
              </>
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

      <Dialog open={Boolean(subDialogCustomer)} onOpenChange={(open) => { if (!open) setSubDialogCustomer(null); }}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleCreateSubscription} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Criar Plano</DialogTitle>
              <DialogDescription>
                Associar uma assinatura a {subDialogCustomer?.name}.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Plano</Label>
                <Select
                  value={subForm.planId || undefined}
                  onValueChange={(val) => {
                    const plan = availablePlans.find((p) => p.id === val);
                    setSubForm((f) => ({
                      ...f,
                      planId: val,
                      amount: plan ? String(plan.price) : f.amount,
                      paymentMethod: plan?.paymentMethod ?? "credito",
                    }));
                  }}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um plano" />
                  </SelectTrigger>
                  <SelectContent>
                    {availablePlans.map((plan) => (
                      <SelectItem key={plan.id} value={plan.id}>
                        {plan.name} — {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(plan.price)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {availablePlans.find((plan) => plan.id === subForm.planId)?.paymentMethod === "credito" ? (
                  <p className="text-xs text-amber-600">
                    Este plano exige cartao. O cliente deve concluir a assinatura na tela de planos.
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label>Valor (R$)</Label>
                <Input
                  value={subForm.amount}
                  onChange={(e) => setSubForm((f) => ({ ...f, amount: e.target.value }))}
                  placeholder="Ex: 89,90"
                  inputMode="decimal"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Forma de pagamento</Label>
                <Select
                  value={subForm.paymentMethod}
                  onValueChange={(val: any) => setSubForm(f => ({ ...f, paymentMethod: val }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {!hiddenPaymentMethods.includes("pix") && <SelectItem value="pix">Pix</SelectItem>}
                    {!hiddenPaymentMethods.includes("local") && <SelectItem value="dinheiro">Dinheiro</SelectItem>}
                    {!hiddenPaymentMethods.includes("cartao") && <SelectItem value="debito">Debito</SelectItem>}
                    {!hiddenPaymentMethods.includes("cartao") && <SelectItem value="credito">Credito</SelectItem>}
                    {!hiddenPaymentMethods.includes("local") && <SelectItem value="local">Local</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSubDialogCustomer(null)} disabled={savingSub}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={
                  savingSub ||
                  !subForm.planId ||
                  subForm.paymentMethod === "credito"
                }
              >
                {savingSub ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando</> : "Criar plano"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(customerToDelete)}
        onOpenChange={(open) => {
          if (!open) setCustomerToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acao remove {customerToDelete?.name} do cadastro da salão.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
