import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  MoreHorizontal,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  listAppointments,
  updateAppointment,
  cancelAppointment,
  type Appointment,
  type AppointmentStatus,
} from "@/service/appointmentService";
import { useMyProfessional } from "@/hooks/useMyProfessional";
import { usePermissions } from "@/hooks/usePermissions";

/* ─── helpers ─── */

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function dateToDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateLong(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatTime(isoString: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(isoString));
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
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

function getTodayDayIndex(): number {
  const day = new Date().getDay();
  return day === 0 ? 5 : day - 1;
}

const WEEK_DAYS = ["Segunda", "Terca", "Quarta", "Quinta", "Sexta", "Sabado"];

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

/* ─── component ─── */

export function ProfessionalSchedulePage() {
  const { professional, loading: professionalLoading } = useMyProfessional();
  const { can } = usePermissions();
  const canManage = can("manageAgendamentos");

  const [currentWeekMonday, setCurrentWeekMonday] = useState(() => getMonday(new Date()));
  const [selectedDayIndex, setSelectedDayIndex] = useState(getTodayDayIndex);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loadingSchedule, setLoadingSchedule] = useState(false);

  const weekDates = useMemo(
    () => WEEK_DAYS.map((_, i) => addDays(currentWeekMonday, i)),
    [currentWeekMonday],
  );

  const selectedDate = weekDates[selectedDayIndex];
  const selectedDateStr = dateToDateString(selectedDate);
  const todayStr = dateToDateString(new Date());

  const loadSchedule = useCallback(async (dateStr: string, professionalId: string) => {
    setLoadingSchedule(true);
    try {
      const result = await listAppointments({
        professionalId,
        dateFrom: dateStr,
        dateTo: dateStr,
        allAppointments: true,
        limit: 100,
      });
      setAppointments(result.items.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()));
    } catch (err) {
      toast.error(getApiMessage(err));
    } finally {
      setLoadingSchedule(false);
    }
  }, []);

  useEffect(() => {
    if (professional?.id) {
      void loadSchedule(selectedDateStr, professional.id);
    }
  }, [loadSchedule, selectedDateStr, professional]);

  async function changeStatus(appointment: Appointment, status: AppointmentStatus) {
    try {
      await updateAppointment(appointment.id, { status });
      toast.success("Agendamento atualizado.");
      if (professional?.id) await loadSchedule(selectedDateStr, professional.id);
    } catch (err) {
      toast.error(getApiMessage(err));
    }
  }

  async function handleCancel(appointment: Appointment) {
    const confirmed = window.confirm("Cancelar este agendamento?");
    if (!confirmed) return;
    try {
      await cancelAppointment(appointment.id);
      toast.success("Agendamento cancelado.");
      if (professional?.id) await loadSchedule(selectedDateStr, professional.id);
    } catch (err) {
      toast.error(getApiMessage(err));
    }
  }

  const activeAppointments = useMemo(
    () => appointments.filter((a) => a.status !== "cancelled" && a.status !== "no_show"),
    [appointments],
  );

  const confirmedCount = useMemo(
    () => appointments.filter((a) => a.status === "confirmed").length,
    [appointments],
  );

  const completedCount = useMemo(
    () => appointments.filter((a) => a.status === "completed").length,
    [appointments],
  );

  const totalEarnings = useMemo(
    () =>
      appointments
        .filter((a) => a.status === "completed")
        .reduce((sum, a) => sum + (a.totalAmount ?? 0), 0),
    [appointments],
  );

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
          Perfil de profissional nao encontrado. Solicite ao administrador para vincular seu usuario a um perfil de profissional.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-5">
          <div className="rounded-lg bg-blue-500/10 p-2">
            <Calendar size={18} className="text-blue-500" />
          </div>
          <div>
            <p className="mb-1 text-sm text-muted-foreground">Atendimentos do dia</p>
            <h3 className="text-2xl font-semibold text-foreground">{appointments.length}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {selectedDateStr === todayStr ? "hoje" : formatDateLong(selectedDate)}
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-5">
          <div className="rounded-lg bg-emerald-500/10 p-2">
            <CheckCircle2 size={18} className="text-emerald-500" />
          </div>
          <div>
            <p className="mb-1 text-sm text-muted-foreground">Confirmados</p>
            <h3 className="text-2xl font-semibold text-foreground">{confirmedCount}</h3>
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-5">
          <div className="rounded-lg bg-primary/10 p-2">
            <CheckCircle2 size={18} className="text-primary" />
          </div>
          <div>
            <p className="mb-1 text-sm text-muted-foreground">Finalizados</p>
            <h3 className="text-2xl font-semibold text-foreground">{completedCount}</h3>
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-5">
          <div className="rounded-lg bg-amber-500/10 p-2">
            <Calendar size={18} className="text-amber-500" />
          </div>
          <div>
            <p className="mb-1 text-sm text-muted-foreground">Ganhos do dia</p>
            <h3 className="text-2xl font-semibold text-foreground">{formatCurrency(totalEarnings)}</h3>
          </div>
        </div>
      </div>

      {/* Week navigation */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-2">
          <Button variant="outline" size="sm" onClick={() => setCurrentWeekMonday((d) => addDays(d, -7))}>
            <ChevronLeft size={16} />
          </Button>

          <div className="flex flex-1 justify-center gap-1 overflow-x-auto">
            {WEEK_DAYS.map((day, index) => {
              const date = weekDates[index];
              const dateStr = dateToDateString(date);
              const isToday = dateStr === todayStr;
              const isSelected = index === selectedDayIndex;

              return (
                <button
                  key={day}
                  onClick={() => setSelectedDayIndex(index)}
                  className={`flex min-w-[56px] flex-col items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isSelected
                      ? "bg-primary text-primary-foreground"
                      : isToday
                        ? "border border-primary/40 text-primary hover:bg-secondary"
                        : "text-foreground hover:bg-secondary"
                  }`}
                >
                  <span className="text-xs">{day.slice(0, 3)}</span>
                  <span
                    className={`text-base font-semibold leading-tight ${isSelected ? "" : isToday ? "text-primary" : ""}`}
                  >
                    {date.getDate()}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="hidden text-xs text-muted-foreground sm:flex"
              onClick={() => {
                setCurrentWeekMonday(getMonday(new Date()));
                setSelectedDayIndex(getTodayDayIndex());
              }}
            >
              Hoje
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCurrentWeekMonday((d) => addDays(d, 7))}>
              <ChevronRight size={16} />
            </Button>
          </div>
        </div>
      </div>

      {/* Appointments list */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border p-4">
          <div className="flex items-center gap-3">
            <h3 className="text-base font-medium text-foreground">
              {WEEK_DAYS[selectedDayIndex]} — {formatDateLong(selectedDate)}
            </h3>
            <Badge variant="secondary">{activeAppointments.length} ativos</Badge>
            {loadingSchedule && (
              <Loader2 size={14} className="animate-spin text-muted-foreground" />
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Horario
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Cliente
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Servico
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Valor
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Status
                </th>
                {canManage && <th className="w-10 px-4 py-3" />}
              </tr>
            </thead>
            <tbody>
              {loadingSchedule ? (
                <tr>
                  <td colSpan={canManage ? 6 : 5} className="p-8 text-center text-sm text-muted-foreground">
                    <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                    Carregando agenda...
                  </td>
                </tr>
              ) : appointments.length === 0 ? (
                <tr>
                  <td colSpan={canManage ? 6 : 5} className="p-8 text-center text-sm text-muted-foreground">
                    Nenhum atendimento para este dia.
                  </td>
                </tr>
              ) : (
                appointments.map((appt) => {
                  const serviceNames =
                    appt.services.map((s) => s.serviceName).join(", ") || "Sem servico";
                  const clientName =
                    appt.dependent?.name || appt.client?.name || "Cliente";

                  return (
                    <tr
                      key={appt.id}
                      className="border-b border-border transition-colors last:border-b-0 hover:bg-secondary/30"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 text-sm">
                          <Clock size={14} className="text-muted-foreground" />
                          <span className="font-medium text-foreground">
                            {formatTime(appt.startAt)}
                          </span>
                          <span className="text-muted-foreground">–</span>
                          <span className="text-muted-foreground">{formatTime(appt.endAt)}</span>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-primary/10 text-xs text-primary">
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
                        <span className="max-w-[180px] truncate text-sm text-foreground">
                          {serviceNames}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-sm text-foreground">
                        {formatCurrency(appt.totalAmount ?? 0)}
                      </td>

                      <td className="px-4 py-3">
                        <Badge
                          variant="outline"
                          className={`rounded-full px-2 py-0.5 text-xs ${statusStyles[appt.status]}`}
                        >
                          {statusLabels[appt.status]}
                        </Badge>
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
      </div>
    </div>
  );
}
