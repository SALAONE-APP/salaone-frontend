import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Calendar,
  Clock,
  Filter,
  Info,
  Lock,
  Loader2,
  MoreHorizontal,
  Plus,
  Search,
  Scissors,
  Star,
  XCircle,
  Zap,
  User as UserIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { listDependents, type Dependent } from "@/service/dependentService";
import { toast } from "sonner";

import { AppCalendar } from "@/components/AppCalendar";
import { PaymentChoiceModal, type PaymentChoice } from "@/components/PaymentChoiceModal";
import { PaymentModal } from "@/components/PaymentModal";
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
import {
  cancelAppointment,
  createAppointment,
  getAvailableSlots,
  listAppointments,
  type Appointment,
  type AppointmentStatus,
} from "@/service/appointmentService";
import { listProfessionals, type Professional } from "@/service/professionalService";
import {
  getMyActiveSubscription,
  type Subscription,
} from "@/service/subscriptionService";
import { getSalonProfile, type SalonProfile } from "@/service/salonProfileService";
import { getSettings, type BookingPaymentMethod, type SubscriptionProfessionalRule } from "@/service/settingsService";
import { createAppointmentPayment } from "@/service/paymentService";
import { createReview } from "@/service/reviewService";
import { listServices, type Service } from "@/service/serviceService";
import { isFitAppointment } from "@/utils/fitAppointment";
import { buildWhatsAppMessage, openWhatsApp, type WhatsAppMessageData } from "@/utils/whatsapp";

type StatusFilter = "all" | "active" | AppointmentStatus;

interface BookingFormState {
  professionalId: string;
  date: string;
  time: string;
  serviceIds: string[];
  notes: string;
}

const emptyForm: BookingFormState = {
  professionalId: "",
  date: dateToDateString(new Date()),
  time: "",
  serviceIds: [],
  notes: "",
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
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function dateStringToDate(value: string) {
  if (!value) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return undefined;
  return new Date(year, month - 1, day);
}

function formatDateBR(value: string) {
  const d = dateStringToDate(value);
  if (!d) return value;
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
}

function getInitials(name?: string | null) {
  return String(name || "?").split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { date: "-", time: "-" };
  return {
    date: new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date),
    time: new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(date),
  };
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);
}

function getApiMessage(error: unknown) {
  const d = (error as { response?: { data?: unknown } })?.response?.data;
  if (Array.isArray(d)) return d.join(" ");
  if (d && typeof d === "object") {
    const m = (d as { message?: unknown }).message;
    if (typeof m === "string") return m;
  }
  if (error instanceof Error) return error.message;
  return "Nao foi possivel concluir a operacao.";
}

function isConflictError(error: unknown) {
  const msg = getApiMessage(error).toLowerCase();
  return msg.includes("conflito") || msg.includes("ja possui agendamento") || msg.includes("já possui agendamento");
}

function normalizeText(v: string) {
  return v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function normalizePlanFeatureText(raw: unknown) {
  if (typeof raw !== "string") return null;
  const text = raw.trim();
  if (!text) return null;
  if (text.includes("::")) {
    const parts = text.split("::");
    const label = parts[parts.length - 1]?.trim();
    return label ? normalizeText(label) : null;
  }
  if (UUID_RE.test(text)) return null;
  return normalizeText(text);
}

function getServiceDuration(s: Service) {
  return Number(s.durationMinutes ?? 30);
}

function getServicePrice(s: Service) {
  return s.promotionalPrice && s.promotionalPrice > 0 ? s.promotionalPrice : (s.basePrice ?? 0);
}

function getStoredSalonId(): string {
  try {
    const raw = localStorage.getItem("salon");
    if (!raw) return "";
    return (JSON.parse(raw) as { id?: string }).id ?? "";
  } catch {
    return "";
  }
}

export function ClientBookingsPage() {
  const { user } = useAuth();

  // Assinatura do cliente
  const [mySubscription, setMySubscription] = useState<Subscription | null | undefined>(undefined);
  const isSubscriptionExpired = mySubscription !== undefined && (
    mySubscription === null
      ? false
      : mySubscription.status === "expired" || mySubscription.status === "cancelled"
  );

  // Lista de agendamentos
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Passo 1 — formulário
  const [bookingOpen, setBookingOpen] = useState(false);
  const [form, setForm] = useState<BookingFormState>(emptyForm);
  const [userDependents, setUserDependents] = useState<Dependent[]>([]);
  const [bookingForDependent, setBookingForDependent] = useState<Dependent | null>(null);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [slots, setSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);


  // Passo 2 — escolha do método de pagamento
  const [choiceOpen, setChoiceOpen] = useState(false);

  // Passo 3 — pagamento online (cartão ou PIX)
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [onlineMethod, setOnlineMethod] = useState<"cartao" | "pix">("cartao");
  const [pendingPaymentData, setPendingPaymentData] = useState<{
    appointmentId: string;
    paymentId: string;
  } | null>(null);

  // Regra de profissional por assinatura
  const [subscriptionProfessionalRule, setSubscriptionProfessionalRule] = useState<SubscriptionProfessionalRule>("fixed");
  const [hiddenPaymentMethods, setHiddenPaymentMethods] = useState<BookingPaymentMethod[]>([]);

  // Perfil da salão (para WhatsApp)
  const [salonProfile, setSalonProfile] = useState<SalonProfile | null>(null);

  // Modal de sucesso com botão WhatsApp
  const [whatsAppData, setWhatsAppData] = useState<WhatsAppMessageData | null>(null);

  // Local: salvar direto
  const [savingLocal, setSavingLocal] = useState(false);
  const [reviewAppointment, setReviewAppointment] = useState<Appointment | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [savingReview, setSavingReview] = useState(false);

  const limit = 20;

  const loadAppointments = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const result = await listAppointments({
        clientId: user.id,
        status: statusFilter === "all" ? undefined : statusFilter,
        page,
        limit,
      });
      result.items.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
      setAppointments(result.items);
      setTotal(result.total);
    } catch (err) {
      setError(getApiMessage(err));
    } finally {
      setLoading(false);
    }
  }, [user?.id, page, statusFilter]);

  useEffect(() => { void loadAppointments(); }, [loadAppointments]);

  useEffect(() => {
    getMyActiveSubscription()
      .then((sub) => setMySubscription(sub))
      .catch(() => setMySubscription(null));
  }, []);

  useEffect(() => {
    if (!bookingOpen) return;
    async function load() {
      try {
        const salonId = getStoredSalonId();
        const [b, s, profile] = await Promise.all([
          listProfessionals({ page: 1, limit: 100, salonId }),
          listServices({ includeInactive: false, page: 1, limit: 100, salonId }),
          getSalonProfile(salonId),
        ]);
        setProfessionals(b.items);
        setServices(s.items.filter((sv) => sv.active));
        setSalonProfile(profile);
      } catch (err) { toast.error(getApiMessage(err)); }

      try {
        const settings = await getSettings();
        setSubscriptionProfessionalRule(settings.subscriptionProfessionalRule ?? "fixed");
        setHiddenPaymentMethods(settings.hiddenBookingPaymentMethods ?? []);
      } catch {
        // fallback para "fixed" se o endpoint não estiver acessível para o usuário
      }

      if (user?.id) {
        try {
          const deps = await listDependents(user.id);
          setUserDependents(deps);
        } catch {
          setUserDependents([]);
        }
      }
    }
    void load();
  }, [bookingOpen, user?.id]);

  const selectedServices = useMemo(() => services.filter((s) => form.serviceIds.includes(s.id)), [form.serviceIds, services]);
  const totalDuration = useMemo(() => selectedServices.reduce((sum, s) => sum + getServiceDuration(s), 0), [selectedServices]);
  const totalPrice = useMemo(() => selectedServices.reduce((sum, s) => sum + getServicePrice(s), 0), [selectedServices]);

  const isFixedRule = subscriptionProfessionalRule === "fixed";
  const hasActiveSubscription =
    mySubscription?.status === "active" || mySubscription?.status === "paused";
  const isBookingForDependentWithoutPlan = Boolean(bookingForDependent);
  const hasActiveSubscriptionForBooking =
    hasActiveSubscription && !isBookingForDependentWithoutPlan;
  const lockedProfessionalId =
    isFixedRule && hasActiveSubscriptionForBooking ? (mySubscription?.monthlyProfessionalId ?? null) : null;
  const activeLockedProfessionalId = (lockedProfessionalId && professionals.some((b) => b.id === lockedProfessionalId)) ? lockedProfessionalId : null;
  const hasLockedProfessional = Boolean(activeLockedProfessionalId);
  useEffect(() => {
    if (!bookingOpen || !activeLockedProfessionalId) return;

    setForm((prev) => (
      prev.professionalId === activeLockedProfessionalId
        ? prev
        : { ...prev, professionalId: activeLockedProfessionalId, time: "" }
    ));
  }, [activeLockedProfessionalId, bookingOpen]);

  const isServiceCoveredByPlan = useCallback(
    (s: Service) => {
      if (!hasActiveSubscriptionForBooking || !mySubscription?.plan?.features) return false;

      const normServiceName = normalizeText(s.name || "");
      return mySubscription.plan.features.some((feature: string) => {
        const normFeature = normalizePlanFeatureText(feature);
        return normFeature === normServiceName;
      });
    },
    [hasActiveSubscriptionForBooking, mySubscription],
  );

  const allSelectedServicesCoveredByPlan = useMemo(
    () =>
      selectedServices.length > 0 &&
      hasActiveSubscriptionForBooking &&
      selectedServices.every((s) => isServiceCoveredByPlan(s)),
    [hasActiveSubscriptionForBooking, isServiceCoveredByPlan, selectedServices],
  );

  useEffect(() => {
    if (!bookingOpen || !form.professionalId || !form.date || totalDuration <= 0) { setSlots([]); return; }
    let active = true;
    setSlotsLoading(true);
    getAvailableSlots({ professionalId: form.professionalId, date: form.date, duration: totalDuration })
      .then((s) => { if (active) setSlots(s); })
      .catch((err) => { if (active) toast.error(getApiMessage(err)); })
      .finally(() => { if (active) setSlotsLoading(false); });
    return () => { active = false; };
  }, [bookingOpen, form.professionalId, form.date, totalDuration]);

  const filteredAppointments = useMemo(() => {
    const term = normalizeText(search.trim());
    if (!term) return appointments;
    return appointments.filter((a) => {
      const haystack = normalizeText([a.professional?.displayName, ...a.services.map((s) => s.serviceName), a.notes].filter(Boolean).join(" "));
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

  function setField<K extends keyof BookingFormState>(key: K, value: BookingFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleService(id: string, checked: boolean) {
    const service = services.find((s) => s.id === id);
    if (checked && hasActiveSubscriptionForBooking && service && !isServiceCoveredByPlan(service)) {
      toast.error("Este servico nao esta coberto pelo seu plano.");
      return;
    }

    setForm((prev) => ({
      ...prev,
      serviceIds: checked ? [...prev.serviceIds, id] : prev.serviceIds.filter((s) => s !== id),
      time: "",
    }));
  }

  function validateForm(): string | null {
    if (!form.professionalId) return "Selecione o profissional.";
    if (!form.date) return "Selecione a data.";
    if (form.serviceIds.length === 0) return "Selecione pelo menos um servico.";
    if (!form.time) return "Selecione o horario.";
    return null;
  }

  // Clique em "Confirmar agendamento" → abre escolha de pagamento
  async function handleBookingSubmit(e: FormEvent) {
    e.preventDefault();
    const err = validateForm();
    if (err) { toast.error(err); return; }
    if (allSelectedServicesCoveredByPlan) {
      await handleSubscriptionPayment();
      return;
    }
    setChoiceOpen(true);
  }

  // Escolheu "local" → cria agendamento + pagamento direto
  async function handleLocalPayment() {
    if (!user?.id) return;
    setSavingLocal(true);
    try {
      const appt = await createAppointment({
        clientId: user.id,
        dependentId: bookingForDependent?.id || null,
        professionalId: form.professionalId,
        date: form.date,
        time: form.time,
        notes: form.notes.trim() || null,
        services: selectedServices.map((s) => ({ id: s.id, name: s.name, basePrice: s.basePrice, durationMinutes: s.durationMinutes, quantity: 1 })),
        products: [],
      });

      // Registro de pagamento é secundário — agendamento já confirmado
      try {
        await createAppointmentPayment({
          appointmentId: appt.id,
          userId: user.id,
          amount: totalPrice,
          method: "local",
          status: "pending",
        });
      } catch {
        // ignora falha no registro de pagamento; agendamento continua válido
      }

      setWhatsAppData({
        clientName: bookingForDependent ? `${bookingForDependent.name} (Dependente de ${user?.name})` : (user?.name ?? ""),
        salonName: salonProfile?.name || "Salão",
        professionalName: professionals.find((b) => b.id === form.professionalId)?.displayName ?? "",
        date: formatDateBR(form.date),
        time: form.time,
        services: selectedServices.map((s) => s.name),
        total: totalPrice,
        notes: form.notes?.trim(),
        googleMapsUrl: salonProfile?.googleMapsUrl,
      });
      setBookingOpen(false);
      setBookingForDependent(null);
      setForm({ ...emptyForm, date: dateToDateString(new Date()) });
      await loadAppointments();
    } catch (err) {
      if (isConflictError(err)) {
        toast.error("Voce ja possui um agendamento neste horario. Confira seus agendamentos abaixo.");
        await loadAppointments();
      } else {
        toast.error(getApiMessage(err));
      }
    } finally {
      setSavingLocal(false);
    }
  }

  // Escolheu "subscription" → cria agendamento com pagamento via assinatura
  async function handleSubscriptionPayment() {
    if (!user?.id) return;
    setSavingLocal(true);
    try {
      const appt = await createAppointment({
        clientId: user.id,
        dependentId: bookingForDependent?.id || null,
        professionalId: form.professionalId,
        date: form.date,
        time: form.time,
        notes: form.notes.trim() || null,
        services: selectedServices.map((s) => ({ id: s.id, name: s.name, basePrice: s.basePrice, durationMinutes: s.durationMinutes, quantity: 1 })),
        products: [],
      });

      try {
        await createAppointmentPayment({
          appointmentId: appt.id,
          userId: user.id,
          amount: totalPrice,
          method: "subscription",
          status: "covered",
        });
      } catch {
        // ignore duplicate upsert errors
      }

      setWhatsAppData({
        clientName: bookingForDependent ? `${bookingForDependent.name} (Dependente de ${user?.name})` : (user?.name ?? ""),
        salonName: salonProfile?.name || "Salão",
        professionalName: professionals.find((b) => b.id === form.professionalId)?.displayName ?? "",
        date: formatDateBR(form.date),
        time: form.time,
        services: selectedServices.map((s) => s.name),
        total: 0, // 0 custo extra
        notes: form.notes?.trim(),
        googleMapsUrl: salonProfile?.googleMapsUrl,
      });
      setBookingOpen(false);
      setBookingForDependent(null);
      setForm({ ...emptyForm, date: dateToDateString(new Date()) });
      await loadAppointments();
    } catch (err) {
      if (isConflictError(err)) {
        toast.error("Voce ja possui um agendamento neste horario. Confira seus agendamentos abaixo.");
        await loadAppointments();
      } else {
        toast.error(getApiMessage(err));
      }
    } finally {
      setSavingLocal(false);
    }
  }

  // Escolheu cartão ou PIX → cria agendamento + payment record "pending" → abre PaymentModal
  async function handleOnlinePayment(method: "cartao" | "pix") {
    if (!user?.id) return;
    setSavingLocal(true);
    try {
      const appt = await createAppointment({
        clientId: user.id,
        dependentId: bookingForDependent?.id || null,
        professionalId: form.professionalId,
        date: form.date,
        time: form.time,
        notes: form.notes.trim() || null,
        services: selectedServices.map((s) => ({ id: s.id, name: s.name, basePrice: s.basePrice, durationMinutes: s.durationMinutes, quantity: 1 })),
        products: [],
      });

      let paymentId = "";
      try {
        const payment = await createAppointmentPayment({
          appointmentId: appt.id,
          userId: user.id,
          amount: totalPrice,
          method: method === "cartao" ? "credito" : "pix",
          status: "pending",
        });
        paymentId = payment.id;
      } catch {
        // Se falhar o registro de pagamento, confirma como agendamento sem pagamento online
        setWhatsAppData({
          clientName: bookingForDependent ? `${bookingForDependent.name} (Dependente de ${user?.name})` : (user?.name ?? ""),
          salonName: salonProfile?.name || "Salão",
          professionalName: professionals.find((b) => b.id === form.professionalId)?.displayName ?? "",
          date: formatDateBR(form.date),
          time: form.time,
          services: selectedServices.map((s) => s.name),
          total: totalPrice,
          notes: form.notes?.trim(),
          googleMapsUrl: salonProfile?.googleMapsUrl,
        });
        setBookingOpen(false);
        setBookingForDependent(null);
        setForm({ ...emptyForm, date: dateToDateString(new Date()) });
        await loadAppointments();
        return;
      }

      setPendingPaymentData({ appointmentId: appt.id, paymentId });
      setOnlineMethod(method);
      setPaymentOpen(true);
    } catch (err) {
      if (isConflictError(err)) {
        toast.error("Voce ja possui um agendamento neste horario. Confira seus agendamentos abaixo.");
        await loadAppointments();
      } else {
        toast.error(getApiMessage(err));
      }
    } finally {
      setSavingLocal(false);
    }
  }

  // Roteamento de escolha do método
  async function handlePaymentChoice(method: PaymentChoice) {
    if (method === "subscription") {
      await handleSubscriptionPayment();
    } else if (method === "local") {
      await handleLocalPayment();
    } else {
      await handleOnlinePayment(method as "cartao" | "pix");
    }
  }

  // Callback de sucesso do PaymentModal
  async function handlePaymentSuccess() {
    setWhatsAppData({
      clientName: user?.name ?? "",
      salonName: salonProfile?.name || "Salão",
      professionalName: professionals.find((b) => b.id === form.professionalId)?.displayName ?? "",
      date: formatDateBR(form.date),
      time: form.time,
      services: selectedServices.map((s) => s.name),
      total: totalPrice,
      notes: form.notes?.trim(),
      googleMapsUrl: salonProfile?.googleMapsUrl,
    });
    setPaymentOpen(false);
    setBookingOpen(false);
    setPendingPaymentData(null);
    setForm({ ...emptyForm, date: dateToDateString(new Date()) });
    await loadAppointments();
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

  function openReviewDialog(appointment: Appointment) {
    setReviewAppointment(appointment);
    setReviewRating(5);
    setReviewComment("");
  }

  async function handleReviewSubmit() {
    if (!reviewAppointment) return;
    setSavingReview(true);

    try {
      await createReview({
        appointmentId: reviewAppointment.id,
        rating: reviewRating,
        comment: reviewComment.trim() || null,
      });
      toast.success("Avaliacao registrada.");
      setReviewAppointment(null);
      setReviewRating(5);
      setReviewComment("");
    } catch (err) {
      toast.error(getApiMessage(err));
    } finally {
      setSavingReview(false);
    }
  }

  const choiceSummary = {
    professionalName: professionals.find((b) => b.id === form.professionalId)?.displayName ?? "—",
    date: formatDateBR(form.date),
    time: form.time,
    serviceName: selectedServices.map((s) => s.name).join(", ") || "—",
    totalAmount: totalPrice,
  };

  return (
    <div className="space-y-6">
      {isSubscriptionExpired && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
          <p className="text-sm font-medium text-red-600">
            Sua assinatura expirou. Renove seu plano para continuar agendando.
          </p>
        </div>
      )}

      {/* Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {[
          { label: "Total", value: total },
          { label: "Hoje", value: stats.today },
          { label: "Agendados", value: stats.scheduled },
          { label: "Confirmados", value: stats.confirmed },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-5">
            <p className="mb-1 text-sm text-muted-foreground">{s.label}</p>
            <h3 className="text-2xl font-semibold text-foreground">{s.value}</h3>
          </div>
        ))}
      </div>

      {/* Tabela */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center lg:justify-between">
          <h3 className="text-base font-medium text-foreground">
            {statusFilter === "active" ? "Meus Agendamentos Ativos" : statusFilter === "all" ? "Todos Meus Agendamentos" : `Meus Agendamentos — ${statusLabels[statusFilter as AppointmentStatus] ?? statusFilter}`}
          </h3>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar..." className="h-9 w-full bg-secondary pl-9 text-sm sm:w-56" />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2"><Filter size={14} /> Status</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuRadioGroup value={statusFilter} onValueChange={(v) => { setStatusFilter(v as StatusFilter); setPage(1); }}>
                  <DropdownMenuRadioItem value="active">Ativos</DropdownMenuRadioItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuRadioItem value="completed">Finalizados</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="cancelled">Cancelados</DropdownMenuRadioItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuRadioItem value="all">Todos</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button size="sm" className="gap-2" onClick={() => { setForm({ ...emptyForm, date: dateToDateString(new Date()), professionalId: activeLockedProfessionalId ?? "" }); setBookingOpen(true); }}>
              <Plus size={14} /> Marcar Horario
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
                  {["Servico", "Data e Hora", "Profissional", "Valor", "Status"].map((col) => (
                    <th key={col} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">{col}</th>
                  ))}
                  <th className="w-10 px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="p-8 text-center text-sm text-muted-foreground"><Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />Carregando agendamentos...</td></tr>
                ) : filteredAppointments.length === 0 ? (
                  <tr><td colSpan={6} className="p-8 text-center text-sm text-muted-foreground">Nenhum agendamento encontrado.</td></tr>
                ) : (
                  filteredAppointments.map((appt) => {
                    const start = formatDateTime(appt.startAt);
                    const serviceText = appt.services.map((s) => s.serviceName).join(", ") || "Sem servico";
                    const professionalName = appt.professional?.displayName || "Sem profissional";
                    const canCancel = appt.status === "scheduled" || appt.status === "confirmed";
                    const canReview = appt.status === "completed";

                    return (
                      <tr key={appt.id} className="border-b border-border transition-colors last:border-b-0 hover:bg-secondary/30">
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2 text-sm text-foreground">
                              <Scissors size={14} className="text-muted-foreground" />
                              <span className="max-w-56 truncate">{serviceText}</span>
                            </div>
                            {appt.dependent && (
                              <div className="flex items-center gap-1.5 text-xs text-primary font-medium">
                                <UserIcon size={12} className="text-primary" />
                                <span className="truncate max-w-[200px]">Atendimento para: {appt.dependent.name}</span>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-sm text-foreground"><Calendar size={14} className="text-muted-foreground" />{start.date}</div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Clock size={14} />{start.time}</div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 text-sm text-foreground">
                            <Avatar className="h-7 w-7"><AvatarFallback className="bg-primary/10 text-xs text-primary">{getInitials(professionalName)}</AvatarFallback></Avatar>
                            {professionalName}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-foreground">{formatCurrency(appt.totalAmount)}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge variant="outline" className={`rounded-full px-2 py-0.5 text-xs ${statusStyles[appt.status]}`}>{statusLabels[appt.status]}</Badge>
                            {isFitAppointment(appt.notes) && (
                              <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-xs bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                                <Zap size={10} className="mr-1" />Encaixe
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {(canCancel || canReview) && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button className="p-1 text-muted-foreground transition-colors hover:text-foreground"><MoreHorizontal size={16} /></button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {canReview && (
                                  <DropdownMenuItem onClick={() => openReviewDialog(appt)}>
                                    <Star size={14} />Avaliar atendimento
                                  </DropdownMenuItem>
                                )}
                                {canCancel && (
                                  <>
                                    {canReview && <DropdownMenuSeparator />}
                                    <DropdownMenuItem variant="destructive" onClick={() => handleCancel(appt)}>
                                      <XCircle size={14} />Cancelar agendamento
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
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
          <span>Pagina {page} de {totalPages} - {total} agendamentos</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))}>Anterior</Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages || loading} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Proxima</Button>
          </div>
        </div>
      </div>

      {/* Passo 1 — Formulário */}
      <Dialog open={bookingOpen} onOpenChange={(open) => { if (!open && !savingLocal) { setBookingOpen(false); setBookingForDependent(null); } }}>
        <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-2xl">
          <form onSubmit={handleBookingSubmit} className="flex min-h-0 flex-1 flex-col gap-5">
            <DialogHeader className="flex-shrink-0">
              <DialogTitle>Marcar Horario</DialogTitle>
              <DialogDescription>
                Escolha o profissional, servico e um horario disponivel.
              </DialogDescription>
            </DialogHeader>

            <div className="grid flex-1 gap-4 overflow-y-auto md:grid-cols-2">
              {/* Para quem é o agendamento? */}
              {userDependents.length > 0 && (
                <div className="space-y-2 md:col-span-2">
                  <Label>Para quem é o agendamento?</Label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setBookingForDependent(null);
                        setField("time", "");
                      }}
                      className={cn(
                        "flex-1 min-w-[140px] px-4 py-2 text-sm font-medium rounded-lg border transition-all text-center",
                        !bookingForDependent
                           ? "bg-primary/10 border-primary text-primary"
                           : "bg-secondary/40 border-border text-foreground hover:bg-secondary"
                      )}
                    >
                      Para mim ({user?.name})
                    </button>
                    {userDependents.map((dep) => (
                      <button
                        key={dep.id}
                        type="button"
                        onClick={() => {
                          setBookingForDependent(dep);
                          setField("time", "");
                        }}
                        className={cn(
                          "flex-1 min-w-[140px] px-4 py-2 text-sm font-medium rounded-lg border transition-all text-center truncate",
                          bookingForDependent?.id === dep.id
                            ? "bg-primary/10 border-primary text-primary"
                            : "bg-secondary/40 border-border text-foreground hover:bg-secondary"
                        )}
                      >
                        {dep.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Profissional</Label>
                <Select
                  value={form.professionalId}
                  onValueChange={(v) => { setField("professionalId", v); setField("time", ""); }}
                  disabled={hasLockedProfessional}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecionar profissional" />
                  </SelectTrigger>
                  <SelectContent>
                    {professionals.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {hasLockedProfessional ? (
                  <p className="flex items-center gap-1.5 text-xs text-amber-600">
                    <Lock size={11} />
                    Profissional fixo do seu plano.
                  </p>
                ) : isFixedRule && hasActiveSubscriptionForBooking ? (
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Info size={11} />
                    O profissional escolhido será vinculado ao seu plano após o agendamento.
                  </p>
                ) : null}
              </div>

              <>
              <div className="space-y-2">
                <Label>Data</Label>
                <AppCalendar value={dateStringToDate(form.date)} onChange={(d) => { setField("date", dateToDateString(d)); setField("time", ""); }} fromYear={new Date().getFullYear()} toYear={new Date().getFullYear() + 1} className="h-9 rounded-md" />
              </div>

              <div className="space-y-3 md:col-span-2">
                <Label>Servicos</Label>
                <div className="grid max-h-52 gap-2 overflow-y-auto rounded-md border border-border p-3 md:grid-cols-2">
                  {services.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum servico disponivel.</p>
                  ) : (
                    services.map((s) => {
                      const isCovered = isServiceCoveredByPlan(s);
                      const isOutOfPlanForSubscriber = hasActiveSubscriptionForBooking && !isCovered;

                      return (
                        <label
                          key={s.id}
                          className={cn(
                            "flex items-start gap-3 rounded-md p-2 text-sm",
                            isOutOfPlanForSubscriber
                              ? "cursor-not-allowed opacity-50"
                              : "cursor-pointer hover:bg-secondary/60",
                          )}
                        >
                          <Checkbox
                            checked={form.serviceIds.includes(s.id)}
                            disabled={isOutOfPlanForSubscriber}
                            onCheckedChange={(c) => toggleService(s.id, c === true)}
                          />
                          <span className="min-w-0">
                            <span className="flex flex-wrap items-center gap-2 font-medium text-foreground">
                              {s.name}
                              {isCovered && (
                                <Badge className="border-emerald-500/20 bg-emerald-500/10 px-2 py-0 text-[11px] text-emerald-600 hover:bg-emerald-500/10">
                                  Coberto pelo seu plano
                                </Badge>
                              )}
                              {isOutOfPlanForSubscriber && (
                                <Badge variant="outline" className="px-2 py-0 text-[11px]">
                                  Fora do seu plano
                                </Badge>
                              )}
                            </span>
                            <span className="block text-xs text-muted-foreground">{getServiceDuration(s)} min — {formatCurrency(getServicePrice(s))}</span>
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
                {selectedServices.length > 0 && (
                  <p className="text-xs text-muted-foreground text-right">
                    Total: <span className="font-medium text-foreground">{formatCurrency(totalPrice)}</span>
                  </p>
                )}
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>Horario</Label>
                <Select value={form.time} onValueChange={(v) => setField("time", v)} disabled={!form.professionalId || !form.date || totalDuration <= 0 || slotsLoading}>
                  <SelectTrigger className="w-full"><SelectValue placeholder={slotsLoading ? "Carregando horarios..." : "Selecionar horario"} /></SelectTrigger>
                  <SelectContent>{slots.map((slot) => <SelectItem key={slot} value={slot}>{slot}</SelectItem>)}</SelectContent>
                </Select>
                {!slotsLoading && totalDuration > 0 && slots.length === 0 && form.professionalId && form.date ? (
                  <p className="text-xs text-muted-foreground">Nenhum horario disponivel. Tente outra data.</p>
                ) : !slotsLoading && slots.length > 0 ? (
                  <p className="text-xs text-muted-foreground">{slots.length} horarios disponiveis para {totalDuration} min.</p>
                ) : null}
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="booking-notes">Observacoes</Label>
                <Textarea id="booking-notes" value={form.notes} onChange={(e) => setField("notes", e.target.value)} placeholder="Opcional — Ex: preferencia de estilo, etc." />
              </div>
              </>
            </div>

            <DialogFooter className="flex-shrink-0">
              <Button type="button" variant="outline" onClick={() => setBookingOpen(false)}>Cancelar</Button>
              <Button type="submit">Confirmar agendamento</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!reviewAppointment} onOpenChange={(open) => { if (!open && !savingReview) setReviewAppointment(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Avaliar atendimento</DialogTitle>
            <DialogDescription>
              Sua avaliacao sera enviada para a salão.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nota</Label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((rating) => (
                  <button
                    key={rating}
                    type="button"
                    onClick={() => setReviewRating(rating)}
                    className="rounded-md p-1 text-muted-foreground transition hover:bg-secondary hover:text-amber-500"
                    aria-label={`Nota ${rating}`}
                  >
                    <Star
                      size={24}
                      className={rating <= reviewRating ? "fill-amber-500 text-amber-500" : ""}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="review-comment">Comentario</Label>
              <Textarea
                id="review-comment"
                value={reviewComment}
                onChange={(event) => setReviewComment(event.target.value)}
                placeholder="Conte como foi sua experiencia."
                maxLength={1000}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setReviewAppointment(null)} disabled={savingReview}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleReviewSubmit} disabled={savingReview}>
              {savingReview ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Enviar avaliacao
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PaymentChoiceModal
        isOpen={choiceOpen}
        onClose={() => setChoiceOpen(false)}
        onChoose={handlePaymentChoice}
        summary={choiceSummary}
        canPayCard={!allSelectedServicesCoveredByPlan && !hiddenPaymentMethods.includes("cartao")}
        canPayPix={!allSelectedServicesCoveredByPlan && !hiddenPaymentMethods.includes("pix")}
        canPayLocal={!allSelectedServicesCoveredByPlan && !hiddenPaymentMethods.includes("local")}
        canPaySubscription={allSelectedServicesCoveredByPlan}
      />

      {/* Loading — processando agendamento */}
      {savingLocal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-card px-10 py-8 shadow-2xl">
            <Loader2 className="animate-spin text-primary" size={40} />
            <div className="text-center">
              <p className="text-base font-semibold text-foreground">Processando agendamento</p>
              <p className="mt-1 text-sm text-muted-foreground">Aguarde enquanto confirmamos seu horario</p>
            </div>
          </div>
        </div>
      )}

      {/* Passo 3 — Pagamento online */}
      {pendingPaymentData && (
        <PaymentModal
          isOpen={paymentOpen}
          onClose={() => {
            setPaymentOpen(false);
            setPendingPaymentData(null);
          }}
          onAbort={() => {
            setPaymentOpen(false);
            setPendingPaymentData(null);
            setBookingOpen(false);
            setForm({ ...emptyForm, date: dateToDateString(new Date()) });
            toast.info("Agendamento confirmado! O pagamento nao foi concluido. Realize o pagamento no local.");
            void loadAppointments();
          }}
          data={{
            appointmentId: pendingPaymentData.appointmentId,
            paymentId: pendingPaymentData.paymentId,
            amount: totalPrice,
            serviceName: selectedServices.map((s) => s.name).join(", "),
            paymentMethod: onlineMethod,
            userId: user?.id ?? "",
            userEmail: user?.email ?? "",
            userName: user?.name ?? "",
            salonId: getStoredSalonId(),
          }}
          onSuccess={handlePaymentSuccess}
        />
      )}

      {/* Modal de sucesso com botão WhatsApp */}
      <Dialog open={!!whatsAppData} onOpenChange={(open) => { if (!open) setWhatsAppData(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-600">
              ✅ Agendamento Confirmado!
            </DialogTitle>
            <DialogDescription>
              Seu agendamento foi realizado com sucesso.
            </DialogDescription>
          </DialogHeader>

          {whatsAppData && (
            <div className="space-y-1 rounded-md border border-border bg-secondary/40 p-4 text-sm">
              <p><span className="font-medium">Profissional:</span> {whatsAppData.professionalName}</p>
              <p><span className="font-medium">Data:</span> {whatsAppData.date}</p>
              <p><span className="font-medium">Horário:</span> {whatsAppData.time}</p>
              <p><span className="font-medium">Serviços:</span> {whatsAppData.services.join(", ")}</p>
            </div>
          )}

          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              className="w-full bg-[#25D366] text-white hover:bg-[#1ebe5a]"
              onClick={() => {
                if (whatsAppData) {
                  openWhatsApp(salonProfile?.phone, buildWhatsAppMessage(whatsAppData));
                }
                setWhatsAppData(null);
              }}
            >
              Enviar comprovante no WhatsApp
            </Button>
            <Button variant="outline" className="w-full" onClick={() => setWhatsAppData(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
