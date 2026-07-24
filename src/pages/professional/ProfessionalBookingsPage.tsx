import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Filter,
  Loader2,
  MoreHorizontal,
  Plus,
  Scissors,
  Search,
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
import { useMyProfessional } from "@/hooks/useMyProfessional";
import { usePermissions } from "@/hooks/usePermissions";
import {
  cancelAppointment,
  createAppointment,
  getAvailableSlots,
  listAppointments,
  updateAppointment,
  type Appointment,
  type AppointmentStatus,
} from "@/service/appointmentService";
import { getSalonProfile, type SalonProfile } from "@/service/salonProfileService";
import { listServices, type Service } from "@/service/serviceService";
import { isFitAppointment } from "@/utils/fitAppointment";
import { ClientPickerModal } from "@/components/ClientPickerModal";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { sendAppointmentWhatsApp } from "@/utils/whatsapp";

type StatusFilter = "all" | "active" | AppointmentStatus;

interface BookingFormState {
  clientId: string;
  date: string;
  time: string;
  serviceIds: string[];
  notes: string;
  allowOutsideBusinessHours: boolean;
}

function dateToDateString(date?: Date): string {
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateStringToDate(value: string): Date | undefined {
  if (!value) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return undefined;
  return new Date(year, month - 1, day);
}

function getInitials(name?: string | null): string {
  return String(name || "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function formatDateTime(value: string): { date: string; time: string } {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { date: "-", time: "-" };
  return {
    date: new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date),
    time: new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(date),
  };
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);
}

function getApiMessage(error: unknown): string {
  const responseData = (error as { response?: { data?: unknown } })?.response?.data;
  if (Array.isArray(responseData)) return responseData.join(" ");
  if (responseData && typeof responseData === "object") {
    const message = (responseData as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  if (error instanceof Error) return error.message;
  return "Nao foi possivel concluir a operacao.";
}

function normalizeText(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function getServiceDuration(service: Service): number {
  return Number(service.durationMinutes ?? 30);
}

const statusLabels: Record<AppointmentStatus, string> = {
  scheduled: "Agendado",
  confirmed: "Confirmado",
  in_service: "Em andamento",
  completed: "Finalizado",
  cancelled: "Cancelado",
  no_show: "Nao compareceu",
};

const statusStyles: Record<AppointmentStatus, string> = {
  scheduled: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  confirmed: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  in_service: "bg-violet-500/10 text-violet-600 border-violet-500/20",
  completed: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  cancelled: "bg-red-500/10 text-red-600 border-red-500/20",
  no_show: "bg-gray-500/10 text-gray-500 border-gray-500/20",
};

const emptyForm: BookingFormState = {
  clientId: "",
  date: dateToDateString(new Date()),
  time: "",
  serviceIds: [],
  notes: "",
  allowOutsideBusinessHours: false,
};

/* ─── component ─── */

export function ProfessionalBookingsPage() {
  const { professional, loading: professionalLoading } = useMyProfessional();
  const { can } = usePermissions();
  const canManage = can("manageAgendamentos");

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [clientPickerOpen, setClientPickerOpen] = useState(false);
  const [selectedClientName, setSelectedClientName] = useState("");
  const [salonProfile, setSalonProfile] = useState<SalonProfile | null>(null);
  const [todayCount, setTodayCount] = useState<number | null>(null);
  const [form, setForm] = useState<BookingFormState>(emptyForm);
  const [services, setServices] = useState<Service[]>([]);
  const [slots, setSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);

  const limit = 20;

  const loadAppointments = useCallback(
    async (professionalId: string) => {
      setLoading(true);
      try {
        const result = await listAppointments({
          professionalId,
          allAppointments: true,
          status: statusFilter === "all" ? undefined : statusFilter,
          page,
          limit,
        });
        result.items.sort(
          (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
        );
        setAppointments(result.items);
        setTotal(result.total);
      } catch (err) {
        toast.error(getApiMessage(err));
      } finally {
        setLoading(false);
      }
    },
    [page, statusFilter],
  );

  useEffect(() => {
    if (professional?.id) void loadAppointments(professional.id);
  }, [professional, loadAppointments]);

  useEffect(() => {
    getSalonProfile().then(setSalonProfile).catch(() => null);
  }, []);

  useEffect(() => {
    if (!professional?.id) return;
    const today = dateToDateString(new Date());
    listAppointments({ professionalId: professional.id, allAppointments: true, dateFrom: today, dateTo: today, limit: 1 })
      .then((r) => setTodayCount(r.total))
      .catch(() => null);
  }, [professional?.id]);

  useEffect(() => {
    if (!dialogOpen) return;
    async function loadFormOptions() {
      try {
        const servicesResult = await listServices({ includeInactive: false, page: 1, limit: 100 });
        setServices(servicesResult.items.filter((s) => s.active));
      } catch (err) {
        toast.error(getApiMessage(err));
      }
    }
    void loadFormOptions();
  }, [dialogOpen]);

  const selectedServices = useMemo(
    () => services.filter((s) => form.serviceIds.includes(s.id)),
    [form.serviceIds, services],
  );

  const totalDuration = useMemo(
    () => selectedServices.reduce((sum, s) => sum + getServiceDuration(s), 0),
    [selectedServices],
  );

  useEffect(() => {
    if (!dialogOpen || !professional?.id || !form.date || totalDuration <= 0 || form.allowOutsideBusinessHours) {
      setSlots([]);
      return;
    }
    let active = true;
    setSlotsLoading(true);
    getAvailableSlots({ professionalId: professional.id, date: form.date, duration: totalDuration })
      .then((s) => { if (active) setSlots(s); })
      .catch((err) => { if (active) toast.error(getApiMessage(err)); })
      .finally(() => { if (active) setSlotsLoading(false); });
    return () => { active = false; };
  }, [dialogOpen, professional, form.allowOutsideBusinessHours, form.date, totalDuration]);

  const filteredAppointments = useMemo(() => {
    const term = normalizeText(search.trim());
    if (!term) return appointments;
    return appointments.filter((appt) => {
      const serviceNames = appt.services.map((s) => s.serviceName).join(" ");
      const haystack = normalizeText(
        [appt.client?.name, appt.dependent?.name, serviceNames, appt.notes]
          .filter(Boolean)
          .join(" "),
      );
      return haystack.includes(term);
    });
  }, [appointments, search]);

  const stats = useMemo(() => {
    const today = dateToDateString(new Date());
    return {
      today: appointments.filter((a) => a.startAt.slice(0, 10) === today).length,
      scheduled: appointments.filter((a) => a.status === "scheduled").length,
      confirmed: appointments.filter((a) => a.status === "confirmed").length,
    };
  }, [appointments]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  function setField<T extends keyof BookingFormState>(field: T, value: BookingFormState[T]) {
    setForm((curr) => ({ ...curr, [field]: value }));
  }

  function toggleService(serviceId: string, checked: boolean) {
    setForm((curr) => ({
      ...curr,
      serviceIds: checked
        ? [...curr.serviceIds, serviceId]
        : curr.serviceIds.filter((id) => id !== serviceId),
      time: "",
    }));
  }

  function openCreateDialog(allowOutside = false) {
    setForm({ ...emptyForm, date: dateToDateString(new Date()), allowOutsideBusinessHours: allowOutside });
    setSelectedClientName("");
    setDialogOpen(true);
  }

  async function handleCreateSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!professional?.id) return;
    if (!form.clientId) { toast.error("Selecione o cliente."); return; }
    if (!form.date) { toast.error("Selecione a data."); return; }
    if (!form.time) { toast.error("Selecione ou informe o horario."); return; }
    if (form.serviceIds.length === 0) { toast.error("Selecione pelo menos um servico."); return; }
    if (!/^\d{2}:\d{2}$/.test(form.time)) { toast.error("Horario invalido. Use HH:MM."); return; }
    if (form.allowOutsideBusinessHours && !can("manageOffScheduleAppointments")) {
      toast.error("Voce nao tem permissao para criar agendamentos fora do horario.");
      return;
    }

    setSaving(true);
    try {
      await createAppointment({
        clientId: form.clientId,
        professionalId: professional.id,
        date: form.date,
        time: form.time,
        notes: form.notes.trim() || null,
        allowOutsideBusinessHours: form.allowOutsideBusinessHours,
        services: selectedServices.map((s) => ({
          id: s.id,
          name: s.name,
          basePrice: s.basePrice,
          durationMinutes: s.durationMinutes,
          quantity: 1,
        })),
        products: [],
      });
      toast.success("Agendamento criado.");
      setDialogOpen(false);
      void loadAppointments(professional.id);
    } catch (err) {
      toast.error(getApiMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(appt: Appointment, status: AppointmentStatus) {
    try {
      await updateAppointment(appt.id, { status });
      if (professional?.id) void loadAppointments(professional.id);
      if (status === "confirmed" && salonProfile?.phone) {
        toast.success("Agendamento confirmado.", {
          action: {
            label: (
              <span className="flex items-center gap-1.5">
                <WhatsAppIcon size={14} />
                Enviar WhatsApp
              </span>
            ),
            onClick: () => sendAppointmentWhatsApp(appt, salonProfile),
          },
        });
      } else {
        toast.success("Agendamento atualizado.");
      }
    } catch (err) {
      toast.error(getApiMessage(err));
    }
  }

  async function handleCancel(appt: Appointment) {
    try {
      await cancelAppointment(appt.id);
      toast.success("Agendamento cancelado.");
      if (professional?.id) void loadAppointments(professional.id);
    } catch (err) {
      toast.error(getApiMessage(err));
    }
  }

  if (professionalLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={24} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!professional) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <p className="text-muted-foreground">
          Perfil de profissional nao encontrado. Solicite ao administrador para vincular seu usuario.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
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

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center lg:justify-between">
          <h3 className="text-base font-medium text-foreground">
            {statusFilter === "active"
              ? "Meus Agendamentos Ativos"
              : statusFilter === "all"
                ? "Todos Meus Agendamentos"
                : `Agendamentos — ${statusLabels[statusFilter as AppointmentStatus] ?? statusFilter}`}
          </h3>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
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
                  onValueChange={(v) => { setStatusFilter(v as StatusFilter); setPage(1); }}
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
            {canManage && (
              <>
                <Button size="sm" className="gap-2" onClick={() => openCreateDialog(false)}>
                  <Plus size={14} />
                  Novo Agendamento
                </Button>
                {can("manageOffScheduleAppointments") && (
                  <Button size="sm" variant="outline" className="gap-2" onClick={() => openCreateDialog(true)}>
                    <Clock size={14} />
                    Fora do horario
                  </Button>
                )}
              </>
            )}
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
                  Servico
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Data e Hora
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
                  <td colSpan={6} className="p-8 text-center text-sm text-muted-foreground">
                    <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                    Carregando agendamentos...
                  </td>
                </tr>
              ) : filteredAppointments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-sm text-muted-foreground">
                    Nenhum agendamento encontrado.
                  </td>
                </tr>
              ) : (
                filteredAppointments.map((appt) => {
                  const start = formatDateTime(appt.startAt);
                  const serviceText =
                    appt.services.map((s) => s.serviceName).join(", ") || "Sem servico";
                  const clientName = appt.dependent?.name || appt.client?.name || "Cliente";

                  return (
                    <tr
                      key={appt.id}
                      className="border-b border-border transition-colors last:border-b-0 hover:bg-secondary/30"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className="bg-primary/10 text-sm text-primary">
                              {getInitials(clientName)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-medium text-foreground">{clientName}</p>
                            {appt.dependent && (
                              <p className="text-xs text-muted-foreground">
                                dep. de {appt.client?.name}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 text-sm text-foreground">
                          <Scissors size={14} className="text-muted-foreground" />
                          <span className="max-w-48 truncate">{serviceText}</span>
                        </div>
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
                      <td className="px-4 py-3 text-sm text-foreground">
                        {formatCurrency(appt.totalAmount)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge
                            variant="outline"
                            className={`rounded-full px-2 py-0.5 text-xs ${statusStyles[appt.status]}`}
                          >
                            {statusLabels[appt.status]}
                          </Badge>
                          {isFitAppointment(appt.notes) && (
                            <Badge
                              variant="secondary"
                              className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-600"
                            >
                              <Zap size={10} className="mr-1" />
                              Encaixe
                            </Badge>
                          )}
                        </div>
                      </td>
                      {canManage && (
                        <td className="px-4 py-3">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="p-1 text-muted-foreground transition-colors hover:text-foreground">
                                <MoreHorizontal size={16} />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                disabled={appt.status === "confirmed"}
                                onClick={() => changeStatus(appt, "confirmed")}
                              >
                                <CheckCircle2 size={14} />
                                Confirmar
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                disabled={appt.status === "completed"}
                                onClick={() => changeStatus(appt, "completed")}
                              >
                                <CheckCircle2 size={14} />
                                Finalizar
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                disabled={appt.status === "no_show"}
                                onClick={() => changeStatus(appt, "no_show")}
                              >
                                <XCircle size={14} />
                                Nao compareceu
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => sendAppointmentWhatsApp(appt, salonProfile)}
                              >
                                <WhatsAppIcon size={14} />
                                Enviar WhatsApp
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                variant="destructive"
                                disabled={appt.status === "cancelled"}
                                onClick={() => handleCancel(appt)}
                              >
                                <XCircle size={14} />
                                Cancelar
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

        <div className="flex flex-col gap-3 border-t border-border p-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>
            Pagina {page} de {totalPages} — {total} agendamentos
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Proxima
            </Button>
          </div>
        </div>
      </div>

      {/* Create dialog */}
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
                  : "Escolha um dos horarios disponiveis."}
              </DialogDescription>
            </DialogHeader>

            <div className="grid flex-1 gap-4 overflow-y-auto md:grid-cols-2">
              <div className="space-y-2">
                <Label>Cliente</Label>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-start font-normal"
                  onClick={() => setClientPickerOpen(true)}
                >
                  {selectedClientName || "Selecionar cliente"}
                </Button>
              </div>

              <div className="space-y-2">
                <Label>Profissional</Label>
                <div className="flex h-9 items-center rounded-md border border-border bg-secondary/50 px-3 text-sm text-foreground">
                  {professional.displayName}
                </div>
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
                    onChange={(e) => setField("time", e.target.value)}
                    className="h-9"
                  />
                ) : (
                  <Select
                    value={form.time}
                    onValueChange={(v) => setField("time", v)}
                    disabled={!form.date || totalDuration <= 0 || slotsLoading}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={slotsLoading ? "Carregando horarios" : "Selecionar horario"} />
                    </SelectTrigger>
                    <SelectContent>
                      {slots.map((slot) => (
                        <SelectItem key={slot} value={slot}>{slot}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {!form.allowOutsideBusinessHours && !slotsLoading && totalDuration > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {slots.length} horarios disponiveis para {totalDuration} min.
                  </p>
                )}
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
                          <span className="block font-medium text-foreground">{service.name}</span>
                          <span className="block text-xs text-muted-foreground">
                            {getServiceDuration(service)} min — {formatCurrency(service.basePrice)}
                          </span>
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              {form.allowOutsideBusinessHours && (
                <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 md:col-span-2">
                  Este agendamento sera criado fora do horario comercial e ainda respeita conflitos de agenda.
                </div>
              )}

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="professional-booking-notes">Observacoes</Label>
                <Textarea
                  id="professional-booking-notes"
                  value={form.notes}
                  onChange={(e) => setField("notes", e.target.value)}
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
              <Button type="submit" disabled={saving}>
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
