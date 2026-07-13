import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Edit,
  Filter,
  Loader2,
  Plus,
  Search,
  Trash2,
  Users,
  CalendarCheck,
  CalendarX,
  MoreHorizontal,
} from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import {
  createBlockedDate,
  deleteBlockedDate,
  listBlockedDates,
  updateBlockedDate,
  type BlockedDate,
  type BlockedDatePayload,
} from "@/service/blockedDateService";
import { listBarbers, type Barber } from "@/service/barberService";
import { listAppointments, type Appointment } from "@/service/appointmentService";

/* ─── date helpers ─── */

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

function dateToDateString(date?: Date) {
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value || "-";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

function formatDateShort(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

function formatDateLong(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatTimeFromISO(isoString: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(isoString));
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
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

/* ─── blocked date helpers ─── */

interface BlockedDateFormState {
  date: string;
  reason: string;
  blockType: "all" | "barber";
  barberId: string;
  allDay: boolean;
  startTime: string;
  endTime: string;
}

const emptyBlockedDateForm: BlockedDateFormState = {
  date: dateToDateString(new Date()),
  reason: "",
  blockType: "all",
  barberId: "",
  allDay: true,
  startTime: "09:00",
  endTime: "18:00",
};

function blockedDateToForm(item: BlockedDate): BlockedDateFormState {
  return {
    date: item.date,
    reason: item.reason ?? "",
    blockType: item.barberId ? "barber" : "all",
    barberId: item.barberId ?? "",
    allDay: !item.startTime || !item.endTime,
    startTime: item.startTime ?? "09:00",
    endTime: item.endTime ?? "18:00",
  };
}

function buildPayload(form: BlockedDateFormState): BlockedDatePayload {
  return {
    date: form.date,
    reason: form.reason.trim() || null,
    barberId: form.blockType === "barber" ? form.barberId : null,
    startTime: form.allDay ? null : form.startTime,
    endTime: form.allDay ? null : form.endTime,
  };
}

/* ─── week days config ─── */

const WEEK_DAYS = ["Segunda", "Terca", "Quarta", "Quinta", "Sexta", "Sabado"];

function getTodayDayIndex(): number {
  const day = new Date().getDay(); // 0=Sun,1=Mon,...,6=Sat
  return day === 0 ? 5 : day - 1; // clamp Sunday to Saturday slot
}

/* ─── component ─── */

export function SchedulesPage() {
  const [currentWeekMonday, setCurrentWeekMonday] = useState(() => getMonday(new Date()));
  const [selectedDayIndex, setSelectedDayIndex] = useState(getTodayDayIndex);

  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [scheduleAppointments, setScheduleAppointments] = useState<Appointment[]>([]);

  const [search, setSearch] = useState("");
  const [scheduleSearch, setScheduleSearch] = useState("");
  const [scheduleStatusFilter, setScheduleStatusFilter] = useState<"all" | "working" | "free">("all");
  const [loadingBlockedDates, setLoadingBlockedDates] = useState(true);
  const [loadingSchedule, setLoadingSchedule] = useState(false);

  const [savingBlockedDate, setSavingBlockedDate] = useState(false);
  const [blockedDateDialogOpen, setBlockedDateDialogOpen] = useState(false);
  const [editingBlockedDate, setEditingBlockedDate] = useState<BlockedDate | null>(null);
  const [form, setForm] = useState<BlockedDateFormState>(emptyBlockedDateForm);

  const weekDates = useMemo(
    () => WEEK_DAYS.map((_, i) => addDays(currentWeekMonday, i)),
    [currentWeekMonday],
  );

  const selectedDate = weekDates[selectedDayIndex];
  const selectedDateStr = dateToDateString(selectedDate);
  const todayStr = dateToDateString(new Date());

  /* ─── loaders ─── */

  const loadBlockedDates = useCallback(async () => {
    try {
      setLoadingBlockedDates(true);
      const [blockedDatesData, barbersData] = await Promise.all([
        listBlockedDates(),
        listBarbers({ limit: 100 }),
      ]);
      setBlockedDates(blockedDatesData);
      setBarbers(barbersData.items);
    } catch (err) {
      toast.error(getApiMessage(err));
    } finally {
      setLoadingBlockedDates(false);
    }
  }, []);

  const loadScheduleData = useCallback(async (dateStr: string) => {
    try {
      setLoadingSchedule(true);

      const PAGE_LIMIT = 100;
      const first = await listAppointments({
        dateFrom: dateStr,
        dateTo: dateStr,
        allAppointments: true,
        page: 1,
        limit: PAGE_LIMIT,
      });

      let items = first.items;
      const totalPages = Math.ceil(first.total / PAGE_LIMIT);

      if (totalPages > 1) {
        const extras = await Promise.all(
          Array.from({ length: totalPages - 1 }, (_, i) =>
            listAppointments({
              dateFrom: dateStr,
              dateTo: dateStr,
              allAppointments: true,
              page: i + 2,
              limit: PAGE_LIMIT,
            }),
          ),
        );
        items = items.concat(extras.flatMap((r) => r.items));
      }

      const active = items.filter(
        (a) => a.status !== "cancelled" && a.status !== "no_show",
      );
      setScheduleAppointments(active);
    } catch (err) {
      toast.error(getApiMessage(err));
    } finally {
      setLoadingSchedule(false);
    }
  }, []);

  useEffect(() => {
    loadBlockedDates();
  }, [loadBlockedDates]);

  useEffect(() => {
    loadScheduleData(selectedDateStr);
  }, [loadScheduleData, selectedDateStr]);

  /* ─── derived data ─── */

  // per-barber schedule for selected day
  const barberSchedule = useMemo(() => {
    return barbers.map((barber) => {
      const appts = scheduleAppointments
        .filter((a) => a.barberId === barber.id)
        .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());

      const firstStart = appts[0]?.startAt;
      const lastEnd = appts[appts.length - 1]?.endAt;

      return {
        barber,
        appointments: appts,
        firstStart: firstStart ? formatTimeFromISO(firstStart) : "-",
        lastEnd: lastEnd ? formatTimeFromISO(lastEnd) : "-",
        count: appts.length,
        isWorking: appts.length > 0,
      };
    });
  }, [barbers, scheduleAppointments]);

  const workingCount = barberSchedule.filter((b) => b.isWorking).length;
  const totalAppointmentsSelected = scheduleAppointments.length;

  const filteredBarberSchedule = useMemo(() => {
    const term = normalizeText(scheduleSearch.trim());
    return barberSchedule.filter((row) => {
      if (term && !normalizeText(row.barber.displayName).includes(term)) return false;
      if (scheduleStatusFilter === "working" && !row.isWorking) return false;
      if (scheduleStatusFilter === "free" && row.isWorking) return false;
      return true;
    });
  }, [barberSchedule, scheduleSearch, scheduleStatusFilter]);

  /* ─── blocked dates filter ─── */

  const filteredBlockedDates = useMemo(() => {
    const term = normalizeText(search.trim());
    if (!term) return blockedDates;
    return blockedDates.filter((item) => {
      const values = [
        formatDate(item.date),
        item.reason ?? "",
        item.barber?.displayName ?? "Todos",
        item.startTime && item.endTime ? `${item.startTime} ${item.endTime}` : "Dia inteiro",
      ];
      return values.some((value) => normalizeText(value).includes(term));
    });
  }, [blockedDates, search]);

  /* ─── week navigation ─── */

  function prevWeek() {
    setCurrentWeekMonday((d) => addDays(d, -7));
  }

  function nextWeek() {
    setCurrentWeekMonday((d) => addDays(d, 7));
  }

  function goToToday() {
    setCurrentWeekMonday(getMonday(new Date()));
    setSelectedDayIndex(getTodayDayIndex());
  }

  /* ─── blocked date CRUD ─── */

  function openCreateDialog() {
    setEditingBlockedDate(null);
    setForm(emptyBlockedDateForm);
    setBlockedDateDialogOpen(true);
  }

  function openEditDialog(item: BlockedDate) {
    setEditingBlockedDate(item);
    setForm(blockedDateToForm(item));
    setBlockedDateDialogOpen(true);
  }

  async function handleSubmitBlockedDate(event: FormEvent) {
    event.preventDefault();

    if (!form.date) {
      toast.error("Informe a data bloqueada.");
      return;
    }
    if (form.blockType === "barber" && !form.barberId) {
      toast.error("Selecione o funcionario afetado.");
      return;
    }
    if (!form.allDay && (!form.startTime || !form.endTime || form.startTime >= form.endTime)) {
      toast.error("Informe um intervalo de horario valido.");
      return;
    }

    try {
      setSavingBlockedDate(true);
      const payload = buildPayload(form);
      if (editingBlockedDate) {
        await updateBlockedDate(editingBlockedDate.id, payload);
        toast.success("Data bloqueada atualizada.");
      } else {
        await createBlockedDate(payload);
        toast.success("Data bloqueada adicionada.");
      }
      setBlockedDateDialogOpen(false);
      await loadBlockedDates();
    } catch (err) {
      toast.error(getApiMessage(err));
    } finally {
      setSavingBlockedDate(false);
    }
  }

  async function handleDeleteBlockedDate(item: BlockedDate) {
    const confirmed = window.confirm("Remover esta data bloqueada?");
    if (!confirmed) return;
    try {
      await deleteBlockedDate(item.id);
      toast.success("Data bloqueada removida.");
      await loadBlockedDates();
    } catch (err) {
      toast.error(getApiMessage(err));
    }
  }

  /* ─── render ─── */

  return (
    <div className="space-y-6">

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-card rounded-xl p-5 border border-border flex items-start gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Users size={18} className="text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Total Funcionarios</p>
            <h3 className="text-2xl font-semibold text-foreground">{barbers.length}</h3>
          </div>
        </div>

        <div className="bg-card rounded-xl p-5 border border-border flex items-start gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/10">
            <CalendarCheck size={18} className="text-emerald-500" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Com agendamentos</p>
            <h3 className="text-2xl font-semibold text-foreground">{workingCount}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {selectedDateStr === todayStr ? "hoje" : formatDateShort(selectedDate)}
            </p>
          </div>
        </div>

        <div className="bg-card rounded-xl p-5 border border-border flex items-start gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10">
            <Calendar size={18} className="text-blue-500" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Agendamentos do dia</p>
            <h3 className="text-2xl font-semibold text-foreground">{totalAppointmentsSelected}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {selectedDateStr === todayStr ? "hoje" : formatDateShort(selectedDate)}
            </p>
          </div>
        </div>

        <div className="bg-card rounded-xl p-5 border border-border flex items-start gap-3">
          <div className="p-2 rounded-lg bg-red-500/10">
            <CalendarX size={18} className="text-red-500" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Datas Bloqueadas</p>
            <h3 className="text-2xl font-semibold text-foreground">{blockedDates.length}</h3>
          </div>
        </div>
      </div>

      {/* Week navigation */}
      <div className="bg-card rounded-xl border border-border p-4">
        <div className="flex items-center justify-between gap-2">
          <Button variant="outline" size="sm" onClick={prevWeek}>
            <ChevronLeft size={16} />
          </Button>

          <div className="flex gap-1 overflow-x-auto flex-1 justify-center">
            {WEEK_DAYS.map((day, index) => {
              const date = weekDates[index];
              const dateStr = dateToDateString(date);
              const isToday = dateStr === todayStr;
              const isSelected = index === selectedDayIndex;

              return (
                <button
                  key={day}
                  onClick={() => setSelectedDayIndex(index)}
                  className={`flex flex-col items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors min-w-[56px] ${
                    isSelected
                      ? "bg-primary text-primary-foreground"
                      : isToday
                        ? "border border-primary/40 text-primary hover:bg-secondary"
                        : "text-foreground hover:bg-secondary"
                  }`}
                >
                  <span className="text-xs">{day.slice(0, 3)}</span>
                  <span className={`text-base font-semibold leading-tight ${isSelected ? "" : isToday ? "text-primary" : ""}`}>
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
              className="text-xs text-muted-foreground hidden sm:flex"
              onClick={goToToday}
            >
              Hoje
            </Button>
            <Button variant="outline" size="sm" onClick={nextWeek}>
              <ChevronRight size={16} />
            </Button>
          </div>
        </div>
      </div>

      {/* Daily schedule table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="flex flex-col gap-3 p-4 border-b border-border lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-base font-medium text-foreground">
              Calendario — {WEEK_DAYS[selectedDayIndex]}
            </h3>
            <Badge variant="secondary">{formatDateLong(selectedDate)}</Badge>
            {loadingSchedule && <Loader2 size={14} className="animate-spin text-muted-foreground" />}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
              <input
                type="text"
                value={scheduleSearch}
                onChange={(e) => setScheduleSearch(e.target.value)}
                placeholder="Buscar funcionario..."
                className="w-full sm:w-56 bg-secondary text-sm text-foreground placeholder:text-muted-foreground rounded-md pl-9 pr-3 py-1.5 border border-border focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={`gap-2 ${scheduleStatusFilter !== "all" ? "border-primary text-primary" : ""}`}
                >
                  <Filter size={14} />
                  {scheduleStatusFilter === "working"
                    ? "Com agenda"
                    : scheduleStatusFilter === "free"
                      ? "Sem agenda"
                      : "Filtro"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setScheduleStatusFilter("all")}>
                  Todos
                  {scheduleStatusFilter === "all" && <span className="ml-auto text-primary">✓</span>}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setScheduleStatusFilter("working")}>
                  Com agenda
                  {scheduleStatusFilter === "working" && <span className="ml-auto text-primary">✓</span>}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setScheduleStatusFilter("free")}>
                  Sem agenda
                  {scheduleStatusFilter === "free" && <span className="ml-auto text-primary">✓</span>}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Funcionario</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Primeiro Atend.</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Ultimo Atend.</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Agendamentos</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody>
              {loadingSchedule && barberSchedule.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-2">
                      <Loader2 size={16} className="animate-spin" />
                      Carregando escala...
                    </span>
                  </td>
                </tr>
              ) : filteredBarberSchedule.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    {barberSchedule.length === 0
                      ? "Nenhum funcionario cadastrado."
                      : "Nenhum funcionario encontrado com esses filtros."}
                  </td>
                </tr>
              ) : (
                filteredBarberSchedule.map(({ barber, firstStart, lastEnd, count, isWorking }) => (
                  <tr key={barber.id} className="border-b border-border last:border-b-0 hover:bg-secondary/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="w-10 h-10">
                          <AvatarImage src={barber.photoUrl ?? undefined} alt={barber.displayName} />
                          <AvatarFallback className="bg-primary/10 text-primary text-sm">
                            {barber.displayName.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <span className="text-sm font-medium text-foreground">{barber.displayName}</span>
                          {barber.specialty && (
                            <p className="text-xs text-muted-foreground">{barber.specialty}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 text-sm text-foreground">
                        <Clock size={14} className="text-muted-foreground" />
                        {isWorking ? firstStart : <span className="text-muted-foreground">—</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 text-sm text-foreground">
                        <Clock size={14} className="text-muted-foreground" />
                        {isWorking ? lastEnd : <span className="text-muted-foreground">—</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar size={14} />
                        {count > 0 ? `${count} agendamento${count !== 1 ? "s" : ""}` : "Nenhum"}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant="outline"
                        className={`text-xs capitalize px-2 py-0.5 rounded-full ${
                          isWorking
                            ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                            : "bg-gray-500/10 text-gray-500 border-gray-500/20"
                        }`}
                      >
                        {isWorking ? "com agenda" : "sem agenda"}
                      </Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Blocked dates */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="flex flex-col gap-3 p-4 border-b border-border lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-base font-medium text-foreground">Datas Bloqueadas</h3>
            <p className="text-sm text-muted-foreground">Indisponibilidades da salão ou de funcionarios especificos.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar bloqueios..."
                className="w-full sm:w-64 bg-secondary pl-9"
              />
            </div>
            <Button size="sm" className="gap-2" onClick={openCreateDialog}>
              <Plus size={14} />
              Adicionar Data Bloqueada
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Data</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Motivo</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Tipo</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Funcionario</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Horario</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="w-10 px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {loadingBlockedDates ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-2">
                      <Loader2 size={16} className="animate-spin" />
                      Carregando datas bloqueadas...
                    </span>
                  </td>
                </tr>
              ) : filteredBlockedDates.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    Nenhuma data bloqueada encontrada.
                  </td>
                </tr>
              ) : (
                filteredBlockedDates.map((item) => {
                  const isAllDay = !item.startTime || !item.endTime;
                  return (
                    <tr key={item.id} className="border-b border-border last:border-b-0 hover:bg-secondary/30 transition-colors">
                      <td className="px-4 py-3 text-sm font-medium text-foreground">{formatDate(item.date)}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{item.reason || "Sem motivo informado"}</td>
                      <td className="px-4 py-3 text-sm text-foreground">
                        {item.barberId ? "Funcionario especifico" : "Salão inteira"}
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">{item.barber?.displayName ?? "Todos"}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 text-sm text-foreground">
                          <Clock size={14} className="text-muted-foreground" />
                          {isAllDay ? "Dia inteiro" : `${item.startTime} - ${item.endTime}`}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20 text-xs px-2 py-0.5 rounded-full">
                          Bloqueado
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="p-1 text-muted-foreground hover:text-foreground transition-colors">
                              <MoreHorizontal size={16} />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditDialog(item)}>
                              <Edit size={14} />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem variant="destructive" onClick={() => handleDeleteBlockedDate(item)}>
                              <Trash2 size={14} />
                              Remover
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
      </div>

      {/* Dialog: add/edit blocked date */}
      <Dialog open={blockedDateDialogOpen} onOpenChange={setBlockedDateDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingBlockedDate ? "Editar Data Bloqueada" : "Adicionar Data Bloqueada"}</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleSubmitBlockedDate}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="blocked-date">Data</Label>
                <Input
                  id="blocked-date"
                  type="date"
                  value={form.date}
                  onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo de bloqueio</Label>
                <Select
                  value={form.blockType}
                  onValueChange={(value: "all" | "barber") =>
                    setForm((current) => ({
                      ...current,
                      blockType: value,
                      barberId: value === "all" ? "" : current.barberId,
                    }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Salão inteira</SelectItem>
                    <SelectItem value="barber">Funcionario especifico</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {form.blockType === "barber" && (
              <div className="space-y-2">
                <Label>Funcionario afetado</Label>
                <Select
                  value={form.barberId}
                  onValueChange={(value) => setForm((current) => ({ ...current, barberId: value }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione um funcionario" />
                  </SelectTrigger>
                  <SelectContent>
                    {barbers.map((barber) => (
                      <SelectItem key={barber.id} value={barber.id}>
                        {barber.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="blocked-reason">Motivo</Label>
              <Textarea
                id="blocked-reason"
                value={form.reason}
                onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))}
                placeholder="Ex: feriado, manutencao, folga do funcionario"
                rows={3}
              />
            </div>

            <div className="flex items-center gap-3 rounded-md border border-border bg-secondary/40 px-3 py-2">
              <Checkbox
                id="blocked-all-day"
                checked={form.allDay}
                onCheckedChange={(checked) => setForm((current) => ({ ...current, allDay: checked === true }))}
              />
              <Label htmlFor="blocked-all-day" className="text-sm font-normal">
                Dia inteiro
              </Label>
            </div>

            {!form.allDay && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="blocked-start-time">Hora inicial</Label>
                  <Input
                    id="blocked-start-time"
                    type="time"
                    value={form.startTime}
                    onChange={(event) => setForm((current) => ({ ...current, startTime: event.target.value }))}
                    required={!form.allDay}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="blocked-end-time">Hora final</Label>
                  <Input
                    id="blocked-end-time"
                    type="time"
                    value={form.endTime}
                    onChange={(event) => setForm((current) => ({ ...current, endTime: event.target.value }))}
                    required={!form.allDay}
                  />
                </div>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setBlockedDateDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={savingBlockedDate} className="gap-2">
                {savingBlockedDate && <Loader2 size={14} className="animate-spin" />}
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
