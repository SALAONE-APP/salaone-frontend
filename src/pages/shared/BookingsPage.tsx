import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ArrowLeftRight,
  Calendar,
  CheckCircle2,
  Clock,
  Filter,
  Loader2,
  MoreHorizontal,
  Package,
  Plus,
  Search,
  Scissors,
  User,
  XCircle,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import { AppCalendar } from "@/components/AppCalendar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { useTableSelection } from "@/hooks/useTableSelection";
import {
  cancelAppointment,
  createAppointment,
  getAppointmentById,
  getAvailableSlots,
  listAppointments,
  updateAppointment,
  type Appointment,
  type AppointmentStatus,
} from "@/service/appointmentService";
import { listProfessionals, type Professional } from "@/service/professionalService";
import { listBlockedDates, type BlockedDate } from "@/service/blockedDateService";
import { getSalonProfile, type SalonProfile } from "@/service/salonProfileService";
import { listServices, type Service } from "@/service/serviceService";
import { isFitAppointment } from "@/utils/fitAppointment";
import { ClientPickerModal } from "@/components/ClientPickerModal";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { hasWhatsAppPhone, sendAppointmentWhatsApp } from "@/utils/whatsapp";

type StatusFilter = "all" | "active" | AppointmentStatus;

interface BookingFormState {
  clientId: string;
  professionalId: string;
  date: string;
  time: string;
  serviceIds: string[];
  notes: string;
  allowOutsideBusinessHours: boolean;
}

const emptyForm: BookingFormState = {
  clientId: "",
  professionalId: "",
  date: dateToDateString(new Date()),
  time: "",
  serviceIds: [],
  notes: "",
  allowOutsideBusinessHours: false,
};

const statusLabels: Record<AppointmentStatus, string> = {
  scheduled: "Agendado",
  confirmed: "Confirmado",
  completed: "Finalizado",
  cancelled: "Cancelado",
  no_show: "Nao compareceu",
};

const statusStyles: Record<AppointmentStatus, string> = {
  scheduled: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  confirmed: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  completed: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  cancelled: "bg-red-500/10 text-red-600 border-red-500/20",
  no_show: "bg-gray-500/10 text-gray-500 border-gray-500/20",
};

function dateToDateString(date?: Date) {
  if (!date) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function dateStringToDate(value: string) {
  if (!value) return undefined;

  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return undefined;

  return new Date(year, month - 1, day);
}

function getInitials(name?: string | null) {
  return String(name || "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return { date: "-", time: "-" };
  }

  return {
    date: new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(date),
    time: new Intl.DateTimeFormat("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(date),
  };
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value || 0);
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

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function getServiceDuration(service: Service) {
  return Number(service.durationMinutes ?? 30);
}

export function BookingsPage() {
  const { user } = useAuth();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [clientPickerOpen, setClientPickerOpen] = useState(false);
  const [selectedClientName, setSelectedClientName] = useState("");
  const [bookForSelf, setBookForSelf] = useState(false);
  const [form, setForm] = useState<BookingFormState>(emptyForm);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [slots, setSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [appointmentToTransfer, setAppointmentToTransfer] = useState<Appointment | null>(null);
  const [transferProfessionalId, setTransferProfessionalId] = useState("");
  const [transferSaving, setTransferSaving] = useState(false);
  const [blockedDateWarning, setBlockedDateWarning] = useState<BlockedDate | null>(null);
  const [salonProfile, setSalonProfile] = useState<SalonProfile | null>(null);
  const [todayCount, setTodayCount] = useState<number | null>(null);
  const [sendingWhatsAppId, setSendingWhatsAppId] = useState<string | null>(null);

  const limit = 20;

  const loadAppointments = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await listAppointments({
        allAppointments: true,
        status: statusFilter === "all" ? undefined : statusFilter,
        page,
        limit,
      });

      // Backend retorna em start_at asc — garantir ordenação crescente no cliente também
      result.items.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());

      setAppointments(result.items);
      setTotal(result.total);
    } catch (err) {
      setError(getApiMessage(err));
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    void loadAppointments();
  }, [loadAppointments]);

  useEffect(() => {
    getSalonProfile().then(setSalonProfile).catch(() => null);
  }, []);

  useEffect(() => {
    const today = dateToDateString(new Date());
    listAppointments({ allAppointments: true, dateFrom: today, dateTo: today, limit: 1 })
      .then((r) => setTodayCount(r.total))
      .catch(() => null);
  }, []);

  useEffect(() => {
    if (!dialogOpen) return;

    async function loadFormOptions() {
      try {
        const [professionalsResult, servicesResult] = await Promise.all([
          listProfessionals({ page: 1, limit: 100 }),
          listServices({ includeInactive: false, page: 1, limit: 100 }),
        ]);

        setProfessionals(professionalsResult.items);
        setServices(servicesResult.items.filter((service) => service.active));
      } catch (err) {
        toast.error(getApiMessage(err));
      }
    }

    void loadFormOptions();
  }, [dialogOpen]);

  useEffect(() => {
    if (!transferDialogOpen) return;
    listProfessionals({ page: 1, limit: 100 })
      .then((result) => setProfessionals(result.items))
      .catch((err) => toast.error(getApiMessage(err)));
  }, [transferDialogOpen]);

  const selectedServices = useMemo(
    () => services.filter((service) => form.serviceIds.includes(service.id)),
    [form.serviceIds, services],
  );

  const totalDuration = useMemo(
    () => selectedServices.reduce((sum, service) => sum + getServiceDuration(service), 0),
    [selectedServices],
  );

  useEffect(() => {
    if (!dialogOpen || !form.professionalId || !form.date || totalDuration <= 0 || form.allowOutsideBusinessHours) {
      setSlots([]);
      return;
    }

    let active = true;
    setSlotsLoading(true);

    getAvailableSlots({
      professionalId: form.professionalId,
      date: form.date,
      duration: totalDuration,
    })
      .then((availableSlots) => {
        if (active) setSlots(availableSlots);
      })
      .catch((err) => {
        if (active) toast.error(getApiMessage(err));
      })
      .finally(() => {
        if (active) setSlotsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [dialogOpen, form.allowOutsideBusinessHours, form.professionalId, form.date, totalDuration]);

  // Verifica se a data/profissional selecionado tem bloqueio
  useEffect(() => {
    if (!dialogOpen || !form.date || !form.professionalId) {
      setBlockedDateWarning(null);
      return;
    }

    listBlockedDates({ dateFrom: form.date, dateTo: form.date, professionalId: form.professionalId })
      .then((items) => {
        const block = items.find((b) => {
          if (!b.professionalId && !form.professionalId) return true;
          if (!b.professionalId) return true; // salão inteira
          return b.professionalId === form.professionalId;
        });
        setBlockedDateWarning(block ?? null);
      })
      .catch(() => setBlockedDateWarning(null));
  }, [dialogOpen, form.date, form.professionalId]);

  const filteredAppointments = useMemo(() => {
    const term = normalizeText(search.trim());

    if (!term) return appointments;

    return appointments.filter((appointment) => {
      const serviceNames = appointment.services
        .map((service) => service.serviceName)
        .join(" ");
      const productNames = appointment.products
        .map((product) => product.productName)
        .join(" ");
      const haystack = normalizeText(
        [
          appointment.client?.name,
          appointment.professional?.displayName,
          serviceNames,
          productNames,
          appointment.notes,
        ]
          .filter(Boolean)
          .join(" "),
      );

      return haystack.includes(term);
    });
  }, [appointments, search]);

  const stats = useMemo(() => {
    const today = dateToDateString(new Date());

    return {
      today: appointments.filter((appointment) => appointment.startAt.slice(0, 10) === today)
        .length,
      scheduled: appointments.filter((appointment) => appointment.status === "scheduled").length,
      confirmed: appointments.filter((appointment) => appointment.status === "confirmed").length,
    };
  }, [appointments]);

  const { selectedRows, toggleRow, toggleAll } = useTableSelection(
    filteredAppointments.map((appointment) => appointment.id),
  );

  const totalPages = Math.max(1, Math.ceil(total / limit));

  function openCreateDialog(allowOutsideBusinessHours = false) {
    setForm({
      ...emptyForm,
      date: dateToDateString(new Date()),
      allowOutsideBusinessHours,
    });
    setSelectedClientName("");
    setBookForSelf(false);
    setDialogOpen(true);
  }

  function setField<TField extends keyof BookingFormState>(
    field: TField,
    value: BookingFormState[TField],
  ) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function toggleService(serviceId: string, checked: boolean) {
    setForm((current) => ({
      ...current,
      serviceIds: checked
        ? [...current.serviceIds, serviceId]
        : current.serviceIds.filter((id) => id !== serviceId),
      time: "",
    }));
  }

  function validateForm() {
    if (!form.clientId) return "Selecione o cliente.";
    if (!form.professionalId) return "Selecione o profissional.";
    if (!form.date) return "Selecione a data.";
    if (!form.time) return "Selecione ou informe o horario.";
    if (form.serviceIds.length === 0) return "Selecione pelo menos um servico.";
    if (!/^\d{2}:\d{2}$/.test(form.time)) return "Informe o horario no formato HH:MM.";

    return null;
  }

  async function handleCreateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validationMessage = validateForm();
    if (validationMessage) {
      toast.error(validationMessage);
      return;
    }

    setSaving(true);

    try {
      await createAppointment({
        clientId: form.clientId,
        professionalId: form.professionalId,
        date: form.date,
        time: form.time,
        notes: form.notes.trim() || null,
        allowOutsideBusinessHours: form.allowOutsideBusinessHours,
        services: selectedServices.map((service) => ({
          id: service.id,
          name: service.name,
          basePrice: service.basePrice,
          durationMinutes: service.durationMinutes,
          quantity: 1,
        })),
        products: [],
      });

      toast.success("Agendamento criado.");
      setDialogOpen(false);
      await loadAppointments();
    } catch (err) {
      toast.error(getApiMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleSendAppointmentWhatsApp(appointment: Appointment) {
    setSendingWhatsAppId(appointment.id);

    try {
      const targetAppointment = hasWhatsAppPhone(appointment.client?.phone)
        ? appointment
        : await getAppointmentById(appointment.id);

      if (!hasWhatsAppPhone(targetAppointment.client?.phone)) {
        const clientName =
          targetAppointment.dependent?.name ??
          targetAppointment.client?.name ??
          "cliente";

        toast.error(
          `Nao foi possivel enviar WhatsApp: ${clientName} nao possui telefone valido cadastrado.`,
        );
        return;
      }

      sendAppointmentWhatsApp(targetAppointment, salonProfile);
    } catch (err) {
      toast.error(getApiMessage(err));
    } finally {
      setSendingWhatsAppId(null);
    }
  }

  async function changeStatus(appointment: Appointment, status: AppointmentStatus) {
    try {
      await updateAppointment(appointment.id, { status });
      await loadAppointments();
      if (status === "confirmed") {
        toast.success("Agendamento confirmado.", {
          action: {
            label: (
              <span className="flex items-center gap-1.5">
                <WhatsAppIcon size={14} />
                Enviar WhatsApp
              </span>
            ),
            onClick: () => void handleSendAppointmentWhatsApp(appointment),
          },
        });
      } else {
        toast.success("Agendamento atualizado.");
      }
    } catch (err) {
      toast.error(getApiMessage(err));
    }
  }

  async function handleCancel(appointment: Appointment) {
    try {
      await cancelAppointment(appointment.id);
      toast.success("Agendamento cancelado.");
      await loadAppointments();
    } catch (err) {
      toast.error(getApiMessage(err));
    }
  }

  function openTransferDialog(appointment: Appointment) {
    setAppointmentToTransfer(appointment);
    setTransferProfessionalId(appointment.professional?.id ?? "");
    setTransferDialogOpen(true);
  }

  async function handleTransfer() {
    if (!appointmentToTransfer || !transferProfessionalId) return;
    if (transferProfessionalId === appointmentToTransfer.professional?.id) {
      toast.error("Selecione um profissional diferente do atual.");
      return;
    }
    setTransferSaving(true);
    try {
      await updateAppointment(appointmentToTransfer.id, { professionalId: transferProfessionalId });
      const newProfessionalName = professionals.find((b) => b.id === transferProfessionalId)?.displayName ?? "novo profissional";
      toast.success(`Agendamento transferido para ${newProfessionalName}!`);
      setTransferDialogOpen(false);
      await loadAppointments();
    } catch (err) {
      toast.error(getApiMessage(err));
    } finally {
      setTransferSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="mb-1 text-sm text-muted-foreground">Total Agendamentos</p>
          <h3 className="text-2xl font-semibold text-foreground">{total}</h3>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="mb-1 text-sm text-muted-foreground">Hoje</p>
          <h3 className="text-2xl font-semibold text-foreground">{todayCount ?? "—"}</h3>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="mb-1 text-sm text-muted-foreground">Agendados</p>
          <h3 className="text-2xl font-semibold text-foreground">{stats.scheduled}</h3>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="mb-1 text-sm text-muted-foreground">Confirmados</p>
          <h3 className="text-2xl font-semibold text-foreground">{stats.confirmed}</h3>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center lg:justify-between">
          <h3 className="text-base font-medium text-foreground">
            {statusFilter === "active"
              ? "Agendamentos Ativos"
              : statusFilter === "all"
                ? "Todos Agendamentos"
                : `Agendamentos — ${
                    statusFilter === "scheduled"
                      ? "Agendados"
                      : statusFilter === "confirmed"
                        ? "Confirmados"
                        : statusFilter === "completed"
                          ? "Finalizados"
                          : statusFilter === "cancelled"
                            ? "Cancelados"
                            : "Nao compareceu"
                  }`}
          </h3>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                size={14}
              />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar..."
                className="h-9 w-full bg-secondary pl-9 text-sm sm:w-56"
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Filter size={14} />
                  Status
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuRadioGroup
                  value={statusFilter}
                  onValueChange={(value) => {
                    setStatusFilter(value as StatusFilter);
                    setPage(1);
                  }}
                >
                  <DropdownMenuRadioItem value="active">Ativos (pendentes e confirmados)</DropdownMenuRadioItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuRadioItem value="completed">Finalizados</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="cancelled">Cancelados</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="no_show">Nao compareceu</DropdownMenuRadioItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuRadioItem value="scheduled">Somente agendados</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="confirmed">Somente confirmados</DropdownMenuRadioItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuRadioItem value="all">Todos</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button size="sm" className="gap-2" onClick={() => openCreateDialog(false)}>
              <Plus size={14} />
              Novo Agendamento
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-2"
              onClick={() => openCreateDialog(true)}
            >
              <Clock size={14} />
              Fora do horario
            </Button>
          </div>
        </div>

        {error ? (
          <div className="p-6 text-sm text-destructive">{error}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="w-10 p-4">
                    <Checkbox
                      checked={
                        selectedRows.length === filteredAppointments.length &&
                        filteredAppointments.length > 0
                      }
                      onCheckedChange={toggleAll}
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Cliente
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Serviço / Produtos
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Data e Hora
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Profissional
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Valor
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
                    <td colSpan={8} className="p-8 text-center text-sm text-muted-foreground">
                      <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                      Carregando agendamentos...
                    </td>
                  </tr>
                ) : filteredAppointments.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-sm text-muted-foreground">
                      Nenhum agendamento encontrado.
                    </td>
                  </tr>
                ) : (
                  filteredAppointments.map((appointment) => {
                    const start = formatDateTime(appointment.startAt);
                    const serviceText =
                      appointment.services.map((service) => service.serviceName).join(", ") ||
                      "Sem servico";
                    const clientName = appointment.dependent?.name || appointment.client?.name || "Cliente";
                    const professionalName = appointment.professional?.displayName || "Sem profissional";

                    return (
                      <tr
                        key={appointment.id}
                        className="border-b border-border transition-colors last:border-b-0 hover:bg-secondary/30"
                      >
                        <td className="p-4">
                          <Checkbox
                            checked={selectedRows.includes(appointment.id)}
                            onCheckedChange={() => toggleRow(appointment.id)}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10">
                              <AvatarFallback className="bg-primary/10 text-sm text-primary">
                                {getInitials(clientName)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm font-medium text-foreground">
                                {clientName}
                              </p>
                              {appointment.dependent ? (
                                <p className="text-xs text-muted-foreground">
                                  Dependente de {appointment.client?.name}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 text-sm text-foreground">
                            <Scissors size={14} className="text-muted-foreground" />
                            <span className="max-w-56 truncate">{serviceText}</span>
                          </div>
                          {appointment.products.length > 0 ? (
                            <div className="mt-1 flex items-start gap-2 text-xs text-violet-600">
                              <Package size={13} className="mt-0.5 shrink-0" />
                              <span className="max-w-56">
                                {appointment.products.map((product) => `${product.quantity}x ${product.productName}`).join(", ")}
                              </span>
                            </div>
                          ) : null}
                        </td>
                        <td className="px-4 py-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-sm text-foreground">
                              <Calendar size={14} className="text-muted-foreground" />
                              {start.date}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Clock size={14} />
                              {start.time}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 text-sm text-foreground">
                            <User size={14} className="text-muted-foreground" />
                            {professionalName}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-foreground">
                          {formatCurrency(appointment.totalAmount)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge
                              variant="outline"
                              className={`rounded-full px-2 py-0.5 text-xs ${statusStyles[appointment.status]}`}
                            >
                              {statusLabels[appointment.status]}
                            </Badge>
                            {isFitAppointment(appointment.notes) && (
                              <Badge
                                variant="secondary"
                                className="rounded-full px-2 py-0.5 text-xs bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                              >
                                <Zap size={10} className="mr-1" />
                                Encaixe
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="p-1 text-muted-foreground transition-colors hover:text-foreground">
                                <MoreHorizontal size={16} />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                disabled={appointment.status === "confirmed"}
                                onClick={() => changeStatus(appointment, "confirmed")}
                              >
                                <CheckCircle2 size={14} />
                                Confirmar
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                disabled={appointment.status === "completed"}
                                onClick={() => changeStatus(appointment, "completed")}
                              >
                                <CheckCircle2 size={14} />
                                Finalizar
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                disabled={appointment.status === "no_show"}
                                onClick={() => changeStatus(appointment, "no_show")}
                              >
                                <XCircle size={14} />
                                Nao compareceu
                              </DropdownMenuItem>
                              {(appointment.status === "scheduled" || appointment.status === "confirmed") && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => openTransferDialog(appointment)}>
                                    <ArrowLeftRight size={14} />
                                    Transferir profissional
                                  </DropdownMenuItem>
                                </>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                disabled={sendingWhatsAppId === appointment.id}
                                onClick={() => void handleSendAppointmentWhatsApp(appointment)}
                              >
                                <WhatsAppIcon size={14} />
                                {sendingWhatsAppId === appointment.id ? "Carregando telefone" : "Enviar WhatsApp"}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                variant="destructive"
                                disabled={appointment.status === "cancelled"}
                                onClick={() => handleCancel(appointment)}
                              >
                                <XCircle size={14} />
                                Cancelar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
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
            Pagina {page} de {totalPages} - {total} agendamentos
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

      {/* Dialog de transferência de profissional */}
      <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Transferir Agendamento</DialogTitle>
            <DialogDescription>
              Altere o profissional responsavel por este agendamento.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-secondary/30 p-3 space-y-1.5">
              <p className="text-sm text-muted-foreground">
                Cliente:{" "}
                <span className="font-medium text-foreground">
                  {appointmentToTransfer?.dependent?.name || appointmentToTransfer?.client?.name || "—"}
                </span>
              </p>
              <p className="text-sm text-muted-foreground">
                Profissional atual:{" "}
                <span className="font-medium text-foreground">
                  {appointmentToTransfer?.professional?.displayName || "—"}
                </span>
              </p>
            </div>

            <div className="space-y-2">
              <Label>Novo profissional</Label>
              <Select value={transferProfessionalId} onValueChange={setTransferProfessionalId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecionar profissional" />
                </SelectTrigger>
                <SelectContent>
                  {professionals.map((professional) => (
                    <SelectItem key={professional.id} value={professional.id}>
                      {professional.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setTransferDialogOpen(false)}
              disabled={transferSaving}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleTransfer}
              disabled={
                transferSaving ||
                !transferProfessionalId ||
                transferProfessionalId === appointmentToTransfer?.professional?.id
              }
            >
              {transferSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Transferindo...
                </>
              ) : (
                "Confirmar transferencia"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-3xl">
          <form onSubmit={handleCreateSubmit} className="flex min-h-0 flex-1 flex-col gap-5">
            <DialogHeader>
              <DialogTitle>
                {form.allowOutsideBusinessHours
                  ? "Agendamento fora do horario"
                  : "Novo Agendamento"}
              </DialogTitle>
              <DialogDescription>
                {form.allowOutsideBusinessHours
                  ? "Informe manualmente um horario fora da grade comercial."
                  : "Escolha um dos horarios disponiveis para o profissional selecionado."}
              </DialogDescription>
            </DialogHeader>

            <div className="grid flex-1 gap-4 overflow-y-auto md:grid-cols-2">
              <div className="space-y-2">
                <Label>Cliente</Label>
                {bookForSelf ? (
                  <div className="flex items-center gap-2 rounded-md border border-border bg-secondary/40 px-3 py-2 text-sm">
                    <User size={14} className="text-muted-foreground" />
                    <span className="text-foreground">{user?.name ?? "Administrador"}</span>
                    <span className="ml-auto text-xs text-muted-foreground">(você)</span>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-start font-normal"
                    onClick={() => setClientPickerOpen(true)}
                  >
                    {selectedClientName || "Selecionar cliente"}
                  </Button>
                )}
                <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                  <Checkbox
                    checked={bookForSelf}
                    onCheckedChange={(checked) => {
                      const isSelf = checked === true;
                      setBookForSelf(isSelf);
                      if (isSelf) {
                        setField("clientId", user?.id ?? "");
                        setSelectedClientName(user?.name ?? "Eu mesmo");
                      } else {
                        setField("clientId", "");
                        setSelectedClientName("");
                      }
                    }}
                  />
                  Agendar para mim mesmo
                </label>
              </div>

              <div className="space-y-2">
                <Label>Profissional</Label>
                <Select
                  value={form.professionalId}
                  onValueChange={(value) => {
                    setField("professionalId", value);
                    setField("time", "");
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecionar profissional" />
                  </SelectTrigger>
                  <SelectContent>
                    {professionals.map((professional) => (
                      <SelectItem key={professional.id} value={professional.id}>
                        {professional.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Data</Label>
                <AppCalendar
                  value={dateStringToDate(form.date)}
                  onChange={(date) => {
                    setField("date", dateToDateString(date));
                    setField("time", "");
                  }}
                  fromYear={new Date().getFullYear()}
                  toYear={new Date().getFullYear() + 1}
                  className="h-9 rounded-md"
                />
              </div>

              <div className="space-y-2">
                <Label>Horario</Label>
                {form.allowOutsideBusinessHours ? (
                  <Input
                    type="time"
                    value={form.time}
                    onChange={(event) => setField("time", event.target.value)}
                    className="h-9"
                  />
                ) : (
                  <Select
                    value={form.time}
                    onValueChange={(value) => setField("time", value)}
                    disabled={!form.professionalId || !form.date || totalDuration <= 0 || slotsLoading}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue
                        placeholder={slotsLoading ? "Carregando horarios" : "Selecionar horario"}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {slots.map((slot) => (
                        <SelectItem key={slot} value={slot}>
                          {slot}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {!form.allowOutsideBusinessHours && !slotsLoading && totalDuration > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {slots.length} horarios disponiveis para {totalDuration} min.
                  </p>
                ) : null}
              </div>

              <div className="space-y-3 md:col-span-2">
                <Label>Servicos</Label>
                <div className="grid max-h-56 gap-2 overflow-y-auto rounded-md border border-border p-3 md:grid-cols-2">
                  {services.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum servico ativo.</p>
                  ) : (
                    services.map((service) => (
                      <label
                        key={service.id}
                        className="flex items-start gap-3 rounded-md p-2 text-sm hover:bg-secondary/60"
                      >
                        <Checkbox
                          checked={form.serviceIds.includes(service.id)}
                          onCheckedChange={(checked) =>
                            toggleService(service.id, checked === true)
                          }
                        />
                        <span className="min-w-0">
                          <span className="block font-medium text-foreground">
                            {service.name}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {getServiceDuration(service)} min - {formatCurrency(service.basePrice)}
                          </span>
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              {form.allowOutsideBusinessHours ? (
                <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 md:col-span-2">
                  Este agendamento sera criado fora do horario comercial e ainda respeita conflitos
                  de agenda do profissional.
                </div>
              ) : null}

              {blockedDateWarning && (
                <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive md:col-span-2">
                  <strong>Data bloqueada:</strong>{" "}
                  {blockedDateWarning.startTime && blockedDateWarning.endTime
                    ? `${blockedDateWarning.professionalId ? "Profissional bloqueado" : "Salão bloqueada"} das ${blockedDateWarning.startTime} às ${blockedDateWarning.endTime}`
                    : blockedDateWarning.professionalId
                      ? "O profissional está indisponível neste dia"
                      : "A salão está fechada neste dia"}
                  {blockedDateWarning.reason ? ` — ${blockedDateWarning.reason}` : ""}
                </div>
              )}

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="booking-notes">Observacoes</Label>
                <Textarea
                  id="booking-notes"
                  value={form.notes}
                  onChange={(event) => setField("notes", event.target.value)}
                  placeholder="Opcional"
                />
              </div>
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
              <Button
                type="submit"
                disabled={saving || (!!blockedDateWarning && !blockedDateWarning.startTime)}
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando
                  </>
                ) : (
                  "Criar agendamento"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ClientPickerModal
        open={clientPickerOpen}
        onClose={() => setClientPickerOpen(false)}
        onSelect={(client) => {
          setField("clientId", client.id);
          setSelectedClientName(client.name);
        }}
      />
    </div>
  );
}
