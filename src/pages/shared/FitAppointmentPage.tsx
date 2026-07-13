import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Calendar,
  CalendarCheck,
  Copy,
  Loader2,
  Scissors,
  Users,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import AdminAppointmentsCalendar from "@/components/AdminAppointmentsCalendar";
import { AppCalendar } from "@/components/AppCalendar";
import { ClientPickerModal } from "@/components/ClientPickerModal";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import {
  createAppointment,
  listAppointments,
  type Appointment,
} from "@/service/appointmentService";
import { listBarbers, type Barber } from "@/service/barberService";
import { getSalonProfile, type SalonProfile } from "@/service/salonProfileService";
import { listServices, type Service } from "@/service/serviceService";
import {
  buildCalendarAppointmentsByBarber,
  buildCalendarFreeSlotsByBarber,
  buildCalendarTimeSlots,
  APPOINTMENT_CLIENT_STATUS_CONFIG,
  CALENDAR_END_MINUTES,
  CALENDAR_FIT_SLOT_MAX_MINUTES,
  CALENDAR_MINUTES_PER_SLOT,
  CALENDAR_SLOT_HEIGHT,
  CALENDAR_START_MINUTES,
  getLocalDateKey,
  getStableCalendarColor,
  minutesToTime,
  type CalendarColor,
  type FreeSlot,
} from "@/utils/adminCalendar";
import { buildFitNotes } from "@/utils/fitAppointment";
import { openWhatsAppShare } from "@/utils/whatsapp";

/* ── helpers ── */

function getApiMessage(error: unknown): string {
  const data = (error as { response?: { data?: unknown } })?.response?.data;
  if (Array.isArray(data)) return data.join(" ");
  if (data && typeof data === "object") {
    const msg = (data as { message?: unknown }).message;
    if (typeof msg === "string") return msg;
  }
  if (error instanceof Error) return error.message;
  return "Nao foi possivel concluir a operacao.";
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);
}

function formatDateShort(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

function formatDateLong(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function buildAvailableSlotsMessage({
  barbers,
  salon,
  date,
  freeSlotsByBarber,
}: {
  barbers: Barber[];
  salon: SalonProfile | null;
  date: Date;
  freeSlotsByBarber: Map<string, FreeSlot[]>;
}): string {
  const lines: string[] = [
    `*Horarios disponiveis${salon?.name ? ` - ${salon.name}` : ""}*`,
    `Data: ${formatDateLong(date)}`,
    "",
  ];

  let hasAnySlot = false;

  barbers.forEach((barber) => {
    const slots = freeSlotsByBarber.get(barber.id) ?? [];
    const times = slots
      .flatMap((slot) => {
        const result: string[] = [];
        const endMinutes = slot.startMinutes + slot.durationMinutes;

        for (let minutes = slot.startMinutes; minutes < endMinutes; minutes += CALENDAR_MINUTES_PER_SLOT) {
          result.push(minutesToTime(minutes));
        }

        return result;
      })
      .join(", ");

    if (times) {
      hasAnySlot = true;
      lines.push(`*${barber.displayName}:* ${times}`);
      return;
    }

    lines.push(`*${barber.displayName}:* sem horarios disponiveis`);
  });

  if (barbers.length === 0) {
    lines.push("Nenhum profissional cadastrado.");
  } else if (!hasAnySlot) {
    lines.push("No momento nao temos horarios disponiveis para essa data.");
  }

  lines.push("", "Responda esta mensagem para reservar seu horario.");

  return lines.join("\n");
}

function getTodaySaoPaulo(): Date {
  const now = new Date();
  const sp = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const [y, m, d] = sp.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
}

function getCurrentSaoPauloMinutes(): number {
  const now = new Date();
  const formatted = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);
  const [h, m] = formatted.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/* ── FitBookingDialog ── */

interface FitSlotInfo {
  barberId: string;
  barberName: string;
  date: Date;
  startMinutes: number;
  durationMinutes: number;
}

interface FitBookingDialogProps {
  slotInfo: FitSlotInfo;
  onClose: () => void;
  onSuccess: () => void;
}

function FitBookingDialog({ slotInfo, onClose, onSuccess }: FitBookingDialogProps) {
  const [services, setServices] = useState<Service[]>([]);
  const [clientId, setClientId] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientPickerOpen, setClientPickerOpen] = useState(false);
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [time, setTime] = useState(minutesToTime(slotInfo.startMinutes));
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const sr = await listServices({ includeInactive: false, page: 1, limit: 100 });
        setServices(sr.items.filter((s) => s.active));
      } catch (err) {
        toast.error(getApiMessage(err));
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  const selectedServices = useMemo(
    () => services.filter((s) => serviceIds.includes(s.id)),
    [services, serviceIds],
  );
  const totalDuration = useMemo(
    () => selectedServices.reduce((sum, s) => sum + Number(s.durationMinutes ?? 30), 0),
    [selectedServices],
  );
  const durationExceeds = totalDuration > 0 && totalDuration > slotInfo.durationMinutes;
  const dateKey = getLocalDateKey(slotInfo.date);

  function toggleService(id: string, checked: boolean) {
    setServiceIds((prev) => (checked ? [...prev, id] : prev.filter((x) => x !== id)));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!clientId) { toast.error("Selecione o cliente."); return; }
    if (serviceIds.length === 0) { toast.error("Selecione pelo menos um servico."); return; }
    if (!time || !/^\d{2}:\d{2}$/.test(time)) { toast.error("Informe o horario no formato HH:MM."); return; }

    setSaving(true);
    try {
      await createAppointment({
        barberId: slotInfo.barberId,
        clientId,
        date: dateKey,
        time,
        notes: buildFitNotes(notes),
        allowOutsideBusinessHours: false,
        services: selectedServices.map((s) => ({
          id: s.id,
          name: s.name,
          basePrice: s.basePrice,
          durationMinutes: s.durationMinutes,
          quantity: 1,
        })),
        products: [],
      });
      toast.success("Agenda criada com sucesso.");
      onSuccess();
    } catch (err) {
      toast.error(getApiMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
  <>
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-5">
          <DialogHeader>
            <DialogTitle>Criar Agenda</DialogTitle>
            <DialogDescription>
              {slotInfo.barberName}
              {" · "}
              {slotInfo.date.toLocaleDateString("pt-BR", {
                weekday: "short",
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              })}
              {" · "}
              {minutesToTime(slotInfo.startMinutes)} — {minutesToTime(slotInfo.startMinutes + slotInfo.durationMinutes)}
              {" "}({slotInfo.durationMinutes} min disponíveis)
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="fit-time">
                Horario de inicio
                <span className="ml-1 text-xs text-muted-foreground">
                  (ate {minutesToTime(slotInfo.startMinutes + slotInfo.durationMinutes)})
                </span>
              </Label>
              <Input
                id="fit-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="h-9"
              />
            </div>

            <div className="space-y-2">
              <Label>Cliente</Label>
              <Button
                type="button"
                variant="outline"
                className="w-full justify-start font-normal"
                onClick={() => setClientPickerOpen(true)}
              >
                {clientName || "Selecionar cliente"}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>
              Servicos
              {totalDuration > 0 && (
                <span
                  className={`ml-2 text-xs ${
                    durationExceeds ? "font-medium text-amber-500" : "text-muted-foreground"
                  }`}
                >
                  {totalDuration} min{durationExceeds ? " — excede o intervalo" : ""}
                </span>
              )}
            </Label>
            <div className="max-h-48 overflow-y-auto rounded-md border border-border p-3 space-y-1">
              {loading ? (
                <p className="text-sm text-muted-foreground">Carregando servicos...</p>
              ) : services.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum servico ativo.</p>
              ) : (
                services.map((service) => (
                  <label
                    key={service.id}
                    className="flex cursor-pointer items-start gap-3 rounded-md p-2 text-sm hover:bg-secondary/60"
                  >
                    <Checkbox
                      checked={serviceIds.includes(service.id)}
                      onCheckedChange={(checked) => toggleService(service.id, checked === true)}
                    />
                    <span className="min-w-0">
                      <span className="block font-medium text-foreground">{service.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {Number(service.durationMinutes ?? 30)} min — {formatCurrency(service.basePrice)}
                      </span>
                    </span>
                  </label>
                ))
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="fit-notes">Observacoes</Label>
            <Textarea
              id="fit-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Opcional"
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving} className="gap-2">
              {saving ? (
                <><Loader2 className="h-4 w-4 animate-spin" />Salvando</>
              ) : (
                "Criar Agenda"
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
        setClientId(client.id);
        setClientName(client.name);
      }}
    />
  </>
  );
}

/* ── FitAppointmentPage ── */

export function FitAppointmentPage() {
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(getTodaySaoPaulo);
  const [loadingBarbers, setLoadingBarbers] = useState(true);
  const [loadingAppointments, setLoadingAppointments] = useState(false);
  const [fitSlot, setFitSlot] = useState<FitSlotInfo | null>(null);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [salonProfile, setSalonProfile] = useState<SalonProfile | null>(null);

  const activeDateKey = getLocalDateKey(selectedDate);
  const isToday = activeDateKey === getLocalDateKey(getTodaySaoPaulo());

  /* Horário atual em minutos — atualiza a cada minuto quando é hoje */
  const [nowMinutes, setNowMinutes] = useState<number | null>(
    () => (activeDateKey === getLocalDateKey(getTodaySaoPaulo()) ? getCurrentSaoPauloMinutes() : null),
  );

  useEffect(() => {
    if (!isToday) {
      setNowMinutes(null);
      return;
    }
    setNowMinutes(getCurrentSaoPauloMinutes());
    const interval = setInterval(() => {
      setNowMinutes(getCurrentSaoPauloMinutes());
    }, 60_000);
    return () => clearInterval(interval);
  }, [isToday]);

  /* Load barbers once */
  useEffect(() => {
    listBarbers({ page: 1, limit: 100 })
      .then((r) => setBarbers(r.items))
      .catch((err) => toast.error(getApiMessage(err)))
      .finally(() => setLoadingBarbers(false));
  }, []);

  useEffect(() => {
    getSalonProfile().then(setSalonProfile).catch(() => null);
  }, []);

  /* Load appointments when date changes */
  const loadAppointments = useCallback(async () => {
    setLoadingAppointments(true);
    try {
      const result = await listAppointments({
        allAppointments: true,
        dateFrom: activeDateKey,
        dateTo: activeDateKey,
        limit: 100,
        page: 1,
      });
      setAppointments(result.items);
    } catch (err) {
      toast.error(getApiMessage(err));
    } finally {
      setLoadingAppointments(false);
    }
  }, [activeDateKey]);

  useEffect(() => { void loadAppointments(); }, [loadAppointments]);

  const barberColors = useMemo(() => {
    const map = new Map<string, CalendarColor>();
    barbers.forEach((b, i) => map.set(b.id, getStableCalendarColor(b, i)));
    return map;
  }, [barbers]);

  const getAppointmentStartDate = useCallback((apt: Appointment): Date | null => {
    const raw = (apt as any).startAt || (apt as any).start_at;
    if (!raw) return null;
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  }, []);

  const appointmentsByBarber = useMemo(
    () => buildCalendarAppointmentsByBarber({
      appointments, barbers, activeDateKey, getAppointmentStartDate,
    }),
    [appointments, barbers, activeDateKey, getAppointmentStartDate],
  );

  const freeSlotsByBarber = useMemo(
    () => buildCalendarFreeSlotsByBarber({
      barbers, appointmentsByBarber,
      startMinutes: CALENDAR_START_MINUTES, endMinutes: CALENDAR_END_MINUTES,
      minutesPerSlot: CALENDAR_MINUTES_PER_SLOT, fitSlotMaxMinutes: CALENDAR_FIT_SLOT_MAX_MINUTES,
      nowMinutes,
    }),
    [barbers, appointmentsByBarber, nowMinutes],
  );

  const shareFreeSlotsByBarber = useMemo(
    () => buildCalendarFreeSlotsByBarber({
      barbers, appointmentsByBarber,
      startMinutes: CALENDAR_START_MINUTES, endMinutes: CALENDAR_END_MINUTES,
      minutesPerSlot: CALENDAR_MINUTES_PER_SLOT,
      fitSlotMaxMinutes: CALENDAR_END_MINUTES - CALENDAR_START_MINUTES,
      nowMinutes,
    }),
    [barbers, appointmentsByBarber, nowMinutes],
  );

  const timeSlots = useMemo(() => buildCalendarTimeSlots(), []);
  const bodyHeight =
    ((CALENDAR_END_MINUTES - CALENDAR_START_MINUTES) / CALENDAR_MINUTES_PER_SLOT) *
    CALENDAR_SLOT_HEIGHT;

  const totalFreeSlots = useMemo(() => {
    let n = 0;
    freeSlotsByBarber.forEach((s) => { n += s.length; });
    return n;
  }, [freeSlotsByBarber]);

  const availableSlotsMessage = useMemo(
    () =>
      buildAvailableSlotsMessage({
        barbers,
        salon: salonProfile,
        date: selectedDate,
        freeSlotsByBarber: shareFreeSlotsByBarber,
      }),
    [barbers, salonProfile, selectedDate, shareFreeSlotsByBarber],
  );

  const totalShareableSlots = useMemo(() => {
    let total = 0;

    shareFreeSlotsByBarber.forEach((slots) => {
      slots.forEach((slot) => {
        total += Math.ceil(slot.durationMinutes / CALENDAR_MINUTES_PER_SLOT);
      });
    });

    return total;
  }, [shareFreeSlotsByBarber]);

  const activeAptCount = useMemo(
    () => appointments.filter((a) => a.status === "scheduled" || a.status === "confirmed").length,
    [appointments],
  );

  const confirmedCount = useMemo(
    () => appointments.filter((a) => a.status === "confirmed").length,
    [appointments],
  );

  function handleFreeFitBooking(barberId: string, date: Date, startMins: number, durationMins: number) {
    const barber = barbers.find((b) => b.id === barberId);
    setFitSlot({
      barberId,
      barberName: barber?.displayName ?? "Profissional",
      date,
      startMinutes: startMins,
      durationMinutes: durationMins,
    });
  }

  async function copyAvailableSlotsMessage() {
    try {
      await navigator.clipboard.writeText(availableSlotsMessage);
      toast.success("Horarios copiados.");
    } catch {
      toast.error("Nao foi possivel copiar os horarios.");
    }
  }

  const activeDateLabel = selectedDate.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return (
    <div className="space-y-6">

      {/* ── Stats ── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-card rounded-xl p-5 border border-border flex items-start gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Calendar size={18} className="text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Agendamentos</p>
            <h3 className="text-2xl font-semibold text-foreground">
              {loadingAppointments ? <Loader2 size={18} className="animate-spin" /> : activeAptCount}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isToday ? "hoje" : formatDateShort(selectedDate)}
            </p>
          </div>
        </div>

        <div className="bg-card rounded-xl p-5 border border-border flex items-start gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/10">
            <Zap size={18} className="text-emerald-500" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Horarios livres</p>
            <h3 className="text-2xl font-semibold text-foreground">
              {loadingAppointments ? <Loader2 size={18} className="animate-spin" /> : totalFreeSlots}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isToday ? "hoje" : formatDateShort(selectedDate)}
            </p>
          </div>
        </div>

        <div className="bg-card rounded-xl p-5 border border-border flex items-start gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10">
            <CalendarCheck size={18} className="text-blue-500" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Confirmados</p>
            <h3 className="text-2xl font-semibold text-foreground">
              {loadingAppointments ? <Loader2 size={18} className="animate-spin" /> : confirmedCount}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isToday ? "hoje" : formatDateShort(selectedDate)}
            </p>
          </div>
        </div>

        <div className="bg-card rounded-xl p-5 border border-border flex items-start gap-3">
          <div className="p-2 rounded-lg bg-purple-500/10">
            <Users size={18} className="text-purple-500" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Profissionais</p>
            <h3 className="text-2xl font-semibold text-foreground">
              {loadingBarbers ? <Loader2 size={18} className="animate-spin" /> : barbers.length}
            </h3>
          </div>
        </div>
      </div>

      {/* ── Calendar card ── */}
      {/*
        overflow-visible no wrapper para não clipar o Popover do AppCalendar.
        overflow-hidden é aplicado apenas no body (abaixo do header).
      */}
      <div className="bg-card rounded-xl border border-border">
        {/* Header */}
        <div className="flex flex-col gap-3 p-4 border-b border-border lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <h3 className="text-base font-medium text-foreground">Agenda</h3>
            {loadingAppointments && (
              <Loader2 size={14} className="animate-spin text-muted-foreground" />
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Legenda */}
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <div
                  className="h-3 w-5 shrink-0 rounded"
                  style={{
                    border: '1.5px dashed rgba(16,185,129,0.6)',
                    background: 'rgba(16,185,129,0.07)',
                  }}
                />
                <span className="text-emerald-500">Horario livre</span>
              </div>
              <details className="relative">
                <summary className="cursor-pointer select-none rounded-md border border-border px-2 py-1 text-foreground hover:bg-muted">
                  Cores
                </summary>
                <div className="absolute right-0 z-30 mt-2 w-72 rounded-lg border border-border bg-card p-3 shadow-xl">
                  {[
                    APPOINTMENT_CLIENT_STATUS_CONFIG.no_show,
                    APPOINTMENT_CLIENT_STATUS_CONFIG.no_plan,
                    APPOINTMENT_CLIENT_STATUS_CONFIG.with_plan,
                    APPOINTMENT_CLIENT_STATUS_CONFIG.overdue,
                    APPOINTMENT_CLIENT_STATUS_CONFIG.in_progress,
                    APPOINTMENT_CLIENT_STATUS_CONFIG.completed,
                  ].map((item) => (
                    <div key={item.key} className="mb-2 last:mb-0">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-3 w-5 shrink-0 rounded border border-l-4"
                          style={{
                            background: item.color.cardBg,
                            borderColor: item.color.border,
                            borderLeftColor: item.color.accent,
                          }}
                        />
                        <span className="font-medium text-foreground">{item.label}</span>
                      </div>
                      <p className="ml-7 mt-0.5 text-[11px] leading-snug text-muted-foreground">
                        {item.description}
                      </p>
                    </div>
                  ))}
                </div>
              </details>
            </div>

            {/* Seletor de data */}
            <AppCalendar
              value={selectedDate}
              onChange={(d) => d && setSelectedDate(d)}
              fromYear={new Date().getFullYear()}
              toYear={new Date().getFullYear() + 1}
              className="h-9 w-auto min-w-[160px] rounded-lg"
            />

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={loadingBarbers || loadingAppointments}
              onClick={() => setShareDialogOpen(true)}
            >
              <WhatsAppIcon size={14} />
              Compartilhar horarios
            </Button>
          </div>
        </div>

        {/* Body — overflow-hidden aqui para conter o scroll do grid sem clipar o header */}
        <div className="overflow-hidden rounded-b-xl">

        {/* Loading */}
        {(loadingBarbers || loadingAppointments) && (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-2">
              <Loader2 size={16} className="animate-spin" />
              Carregando agenda...
            </span>
          </div>
        )}

        {/* Empty: no barbers */}
        {!loadingBarbers && !loadingAppointments && barbers.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            <div className="inline-flex flex-col items-center gap-3">
              <Scissors size={36} className="opacity-20" />
              <span>Nenhum profissional cadastrado.</span>
            </div>
          </div>
        )}

        {/* Calendar grid */}
        {!loadingBarbers && !loadingAppointments && barbers.length > 0 && (
          <AdminAppointmentsCalendar
            activeDateLabel={activeDateLabel}
            activeDateKey={activeDateKey}
            appointmentDateFilter={selectedDate}
            barbers={barbers}
            barberColors={barberColors}
            timeSlots={timeSlots}
            appointmentsByBarber={appointmentsByBarber}
            freeSlotsByBarber={freeSlotsByBarber}
            bodyHeight={bodyHeight}
            slotHeight={CALENDAR_SLOT_HEIGHT}
            minutesPerSlot={CALENDAR_MINUTES_PER_SLOT}
            startMinutes={CALENDAR_START_MINUTES}
            nowMinutes={nowMinutes}
            onFreeFitBooking={handleFreeFitBooking}
            getAppointmentStartDate={getAppointmentStartDate}
          />
        )}

        </div>{/* fim overflow-hidden rounded-b-xl */}
      </div>

      {/* Fit booking dialog */}
      {fitSlot && (
        <FitBookingDialog
          slotInfo={fitSlot}
          onClose={() => setFitSlot(null)}
          onSuccess={async () => {
            setFitSlot(null);
            await loadAppointments();
          }}
        />
      )}

      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Compartilhar horarios disponiveis</DialogTitle>
            <DialogDescription>
              Envie a lista de horarios livres do dia selecionado para seus clientes.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <Textarea
              value={availableSlotsMessage}
              readOnly
              rows={10}
              className="resize-none font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              {totalShareableSlots} horarios disponiveis em {formatDateShort(selectedDate)}.
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={copyAvailableSlotsMessage}>
              <Copy size={14} />
              Copiar
            </Button>
            <Button type="button" onClick={() => openWhatsAppShare(availableSlotsMessage)}>
              <WhatsAppIcon size={14} />
              Enviar no WhatsApp
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
