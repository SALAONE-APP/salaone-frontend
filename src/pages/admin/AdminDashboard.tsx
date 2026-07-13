import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  Cake,
  Calendar,
  CreditCard,
  Loader2,
  Megaphone,
  UserCog,
  Users,
  Wallet,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RevenueChart } from "@/components/RevenueChart";
import { StaffPerformance } from "@/components/StaffPerformance";
import { StatCard } from "@/components/StatCard";
import { useAuth } from "../../hooks/useAuth";
import { fetchDashboardStats, type DashboardStats } from "@/service/dashboardService";
import { getCashClosingPreview, type CashClosingSummary } from "@/service/cashClosingService";
import { listUsers, type UserProfile } from "@/service/userService";
import { listActiveFeatureUpdates, type FeatureUpdate } from "@/service/featureUpdateService";
import { getHomeInfo, type HomeInfo } from "@/service/homeInfoService";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

const shortcuts = [
  {
    label: "Dashboard",
    description: "Indicadores da barbearia.",
    href: "/overview",
    icon: BarChart3,
  },
  {
    label: "Funcionarios",
    description: "Equipe e barbeiros.",
    href: "/users",
    icon: UserCog,
  },
  {
    label: "Pagamentos",
    description: "Recebimentos e planos.",
    href: "/payments",
    icon: CreditCard,
  },
];

const urgentReminderStoragePrefix = "adminDashboard:urgentReminder";
const birthdayLookaheadDays = 7;
const reminderRefreshMs = 60000;
const defaultBusinessClosingHour = 18;

type ReminderModal = "cash" | "birthdays" | "features";
type CashReminderPhase = "morning" | "closing";

interface BirthdayReminder {
  id: string;
  name: string;
  phone?: string | null;
  birthDate: string;
  daysUntil: number;
}

interface OpenCashSession {
  openedAt: string;
  openedBy: string;
  openedByName: string;
}

function StatSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-border bg-card p-5">
      <div className="mb-2 h-3 w-24 rounded bg-muted" />
      <div className="h-7 w-20 rounded bg-muted" />
    </div>
  );
}

function getTodayKey() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getReminderStorageKey(type: string, userId: string, detail: string) {
  return `${urgentReminderStoragePrefix}:${type}:${userId}:${detail}`;
}

function getBirthdayReminderSignature(birthdays: BirthdayReminder[]) {
  return birthdays
    .map((birthday) => `${birthday.id}:${birthday.daysUntil}`)
    .sort()
    .join(",");
}

function getFeatureUpdateSignature(updates: FeatureUpdate[]) {
  return updates.map((update) => update.id).sort().join(",");
}

function parseTimeParts(value: string) {
  const matches = Array.from(value.matchAll(/(\d{1,2})[:h](\d{2})/gi));
  const lastMatch = matches.at(-1);
  if (!lastMatch) return null;

  const hour = Number(lastMatch[1]);
  const minute = Number(lastMatch[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;

  return { hour, minute };
}

function normalizeScheduleLine(line: string) {
  return line
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function lineAppliesToWeekday(line: string, day: number) {
  const normalized = normalizeScheduleLine(line);
  if (day >= 1 && day <= 5 && normalized.includes("segunda") && normalized.includes("sexta")) return true;
  if (day === 6 && normalized.includes("sabado")) return true;
  if (day === 0 && normalized.includes("domingo")) return true;

  const dayNames = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"];
  return normalized.includes(dayNames[day]);
}

function getBusinessClosingDate(homeInfo: HomeInfo | null, now = new Date()) {
  const scheduleLines = [
    homeInfo?.schedule_line1,
    homeInfo?.schedule_line2,
    homeInfo?.schedule_line3,
  ].filter(Boolean) as string[];
  const todayLine = scheduleLines.find((line) => lineAppliesToWeekday(line, now.getDay()));
  if (todayLine && normalizeScheduleLine(todayLine).includes("fechado")) return null;

  const closingTime = todayLine ? parseTimeParts(todayLine) : null;

  const closingDate = new Date(now);
  closingDate.setHours(
    closingTime?.hour ?? defaultBusinessClosingHour,
    closingTime?.minute ?? 0,
    0,
    0,
  );

  return closingDate;
}

function getCashReminderPhase(openCashSession: OpenCashSession | null, homeInfo: HomeInfo | null) {
  if (!openCashSession) return null;

  const now = new Date();
  if (now.getHours() < 12) return "morning";

  const closingDate = getBusinessClosingDate(homeInfo, now);
  if (!closingDate) return null;

  const minutesUntilClosing = (closingDate.getTime() - now.getTime()) / 60000;
  if (minutesUntilClosing <= 30) return "closing";

  return null;
}

function parseLocalDate(value?: string | null) {
  if (!value) return null;

  const [datePart] = value.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  if (!year || !month || !day) return null;

  return new Date(year, month - 1, day);
}

function getBirthdayDistance(birthDate?: string | null) {
  const birth = parseLocalDate(birthDate);
  if (!birth) return null;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const nextBirthday = new Date(today.getFullYear(), birth.getMonth(), birth.getDate());

  if (nextBirthday.getTime() < today.getTime()) {
    nextBirthday.setFullYear(today.getFullYear() + 1);
  }

  return Math.round((nextBirthday.getTime() - today.getTime()) / 86400000);
}

function formatBirthdayDate(value: string) {
  const date = parseLocalDate(value);
  if (!date) return "";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

function formatCashPeriod(value?: string | null) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getStoredOpenCashSession() {
  const storedSession = localStorage.getItem("cashClosing:openSession");

  if (!storedSession) return null;

  try {
    return JSON.parse(storedSession) as OpenCashSession;
  } catch {
    localStorage.removeItem("cashClosing:openSession");
    return null;
  }
}

function buildBirthdayReminders(customers: UserProfile[]): BirthdayReminder[] {
  const reminders: BirthdayReminder[] = [];

  for (const customer of customers) {
    const birthDate = customer.birthDate ?? customer.birth_date;
    const daysUntil = getBirthdayDistance(birthDate);

    if (!birthDate || daysUntil == null || daysUntil > birthdayLookaheadDays) {
      continue;
    }

    reminders.push({
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      birthDate,
      daysUntil,
    });
  }

  return reminders.sort((a, b) => a.daysUntil - b.daysUntil || a.name.localeCompare(b.name));
}

function CashClosingReminderDialog({
  open,
  onOpenChange,
  cashPreview,
  openCashSession,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cashPreview: CashClosingSummary | null;
  openCashSession: OpenCashSession | null;
}) {
  const hasCashPending = Boolean(cashPreview && cashPreview.paymentCount > 0);
  const cashIsNotClosed = Boolean(openCashSession);
  const cashBadgeClass = cashIsNotClosed
    ? "border-red-500/20 bg-red-500/10 text-red-600"
    : hasCashPending
      ? "border-amber-500/20 bg-amber-500/10 text-amber-600"
      : "border-emerald-500/20 bg-emerald-500/10 text-emerald-600";
  const cashBadgeLabel = cashIsNotClosed ? "Nao fechado" : hasCashPending ? "Pendente" : "Sem pendencias";
  const cashMessage = cashIsNotClosed
    ? `Caixa aberto por ${openCashSession?.openedByName || "Usuario nao identificado"} e ainda nao fechado.`
    : hasCashPending
      ? `${formatCurrency(cashPreview?.totalAmount ?? 0)} em ${cashPreview?.paymentCount ?? 0} movimentacao(oes) aguardando conferencia.`
      : "Nenhuma movimentacao pendente encontrada para fechamento.";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Fechamento de caixa</DialogTitle>
          <DialogDescription>
            Existe uma pendencia relacionada ao caixa da barbearia.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-start gap-3 rounded-lg border border-border p-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
            <Wallet size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">Status do caixa</h3>
              <Badge variant="outline" className={cashBadgeClass}>
                {cashBadgeLabel}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{cashMessage}</p>
            {openCashSession?.openedAt ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Aberto em {formatCashPeriod(openCashSession.openedAt)}
              </p>
            ) : null}
            {cashPreview?.periodStart ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Desde {formatCashPeriod(cashPreview.periodStart)}
              </p>
            ) : null}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="outline" asChild>
            <Link to="/cash-closing">Ir para fechamento</Link>
          </Button>
          <Button onClick={() => onOpenChange(false)}>Entendi</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BirthdayReminderDialog({
  open,
  onOpenChange,
  birthdays,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  birthdays: BirthdayReminder[];
}) {
  const todayBirthdays = birthdays.filter((birthday) => birthday.daysUntil === 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Aniversariantes</DialogTitle>
          <DialogDescription>
            Clientes com aniversario hoje ou nos proximos {birthdayLookaheadDays} dias.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-border p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-pink-500/10 text-pink-600">
              <Cake size={18} />
            </div>
            <h3 className="text-sm font-semibold text-foreground">Lista de aniversariantes</h3>
            <Badge variant="outline" className="border-pink-500/20 bg-pink-500/10 text-pink-600">
              {todayBirthdays.length} hoje
            </Badge>
          </div>

          <div className="space-y-2">
            {birthdays.map((birthday) => (
              <div
                key={birthday.id}
                className="flex flex-col gap-1 rounded-md bg-muted/40 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{birthday.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatBirthdayDate(birthday.birthDate)}
                    {birthday.phone ? ` - ${birthday.phone}` : ""}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className={
                    birthday.daysUntil === 0
                      ? "border-pink-500/20 bg-pink-500/10 text-pink-600"
                      : "border-blue-500/20 bg-blue-500/10 text-blue-600"
                  }
                >
                  {birthday.daysUntil === 0
                    ? "Hoje"
                    : `Em ${birthday.daysUntil} dia${birthday.daysUntil > 1 ? "s" : ""}`}
                </Badge>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Entendi</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FeatureUpdatesDialog({
  open,
  onOpenChange,
  updates,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  updates: FeatureUpdate[];
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Novas funcionalidades</DialogTitle>
          <DialogDescription>
            Atualizacoes recentes implementadas no sistema.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {updates.map((update) => (
            <div key={update.id} className="flex gap-3 rounded-lg border border-border p-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600">
                <Megaphone size={18} />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-foreground">{update.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{update.description}</p>
              </div>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Entendi</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AdminDashboard() {
  const { user } = useAuth();
  const userName = user?.name?.trim() || "Usuario";
  const isAdmin = user?.role === "admin" || user?.isAdmin === true;

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [cashPreview, setCashPreview] = useState<CashClosingSummary | null>(null);
  const [openCashSession, setOpenCashSession] = useState<OpenCashSession | null>(null);
  const [cashReminderPhase, setCashReminderPhase] = useState<CashReminderPhase | null>(null);
  const [birthdays, setBirthdays] = useState<BirthdayReminder[]>([]);
  const [featureUpdates, setFeatureUpdates] = useState<FeatureUpdate[]>([]);
  const [activeReminderModal, setActiveReminderModal] = useState<ReminderModal | null>(null);
  const [pendingReminderModals, setPendingReminderModals] = useState<ReminderModal[]>([]);

  useEffect(() => {
    fetchDashboardStats()
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, []);

  const enqueueReminderModals = useCallback((nextQueue: ReminderModal[]) => {
    if (nextQueue.length === 0) return;

    const uniqueQueue = nextQueue.filter(
      (modal, index) => nextQueue.indexOf(modal) === index && modal !== activeReminderModal,
    );

    if (!activeReminderModal) {
      const [nextModal, ...remainingModals] = uniqueQueue;
      setActiveReminderModal(nextModal ?? null);
      setPendingReminderModals((current) =>
        [...current, ...remainingModals].filter(
          (modal, index, list) => list.indexOf(modal) === index,
        ),
      );
      return;
    }

    setPendingReminderModals((current) =>
      [...current, ...uniqueQueue].filter((modal, index, list) => list.indexOf(modal) === index),
    );
  }, [activeReminderModal]);

  const loadUrgentReminders = useCallback(async () => {
    if (!isAdmin || !user?.id) return;

    const [cashResult, customersResult, featureUpdatesResult, homeInfoResult] = await Promise.allSettled([
      getCashClosingPreview(),
      listUsers({ role: "client", page: 1, limit: 200 }),
      listActiveFeatureUpdates(),
      getHomeInfo(),
    ]);

    const loadedCashPreview = cashResult.status === "fulfilled" ? cashResult.value : null;
    const loadedOpenCashSession = getStoredOpenCashSession();
    const loadedHomeInfo = homeInfoResult.status === "fulfilled" ? homeInfoResult.value : null;
    const loadedCashReminderPhase = getCashReminderPhase(loadedOpenCashSession, loadedHomeInfo);
    const loadedBirthdays =
      customersResult.status === "fulfilled"
        ? buildBirthdayReminders(customersResult.value.items)
        : [];
    const loadedFeatureUpdates =
      featureUpdatesResult.status === "fulfilled" ? featureUpdatesResult.value : [];
    const nextQueue: ReminderModal[] = [];

    setCashPreview(loadedCashPreview);
    setOpenCashSession(loadedOpenCashSession);
    setCashReminderPhase(loadedCashReminderPhase);
    setBirthdays(loadedBirthdays);
    setFeatureUpdates(loadedFeatureUpdates);

    if (
      loadedCashReminderPhase &&
      sessionStorage.getItem(getReminderStorageKey("cash", user.id, `${getTodayKey()}:${loadedCashReminderPhase}`)) !== "dismissed"
    ) {
      nextQueue.push("cash");
    }

    const birthdaySignature = getBirthdayReminderSignature(loadedBirthdays);
    if (
      loadedBirthdays.length > 0 &&
      sessionStorage.getItem(getReminderStorageKey("birthdays", user.id, `${getTodayKey()}:${birthdaySignature}`)) !== "dismissed"
    ) {
      nextQueue.push("birthdays");
    }

    const featureSignature = getFeatureUpdateSignature(loadedFeatureUpdates);
    if (
      loadedFeatureUpdates.length > 0 &&
      sessionStorage.getItem(getReminderStorageKey("features", user.id, featureSignature)) !== "dismissed"
    ) {
      nextQueue.push("features");
    }

    enqueueReminderModals(nextQueue);
  }, [enqueueReminderModals, isAdmin, user?.id]);

  useEffect(() => {
    if (!isAdmin || !user?.id) return;

    void loadUrgentReminders();

    const timer = window.setInterval(() => {
      void loadUrgentReminders();
    }, reminderRefreshMs);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void loadUrgentReminders();
      }
    };

    window.addEventListener("focus", loadUrgentReminders);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", loadUrgentReminders);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isAdmin, loadUrgentReminders, user?.id]);

  function dismissReminderModal(modal: ReminderModal) {
    if (!user?.id) return;

    if (modal === "features") {
      const featureSignature = getFeatureUpdateSignature(featureUpdates);
      sessionStorage.setItem(getReminderStorageKey("features", user.id, featureSignature), "dismissed");
    } else if (modal === "birthdays") {
      const birthdaySignature = getBirthdayReminderSignature(birthdays);
      sessionStorage.setItem(
        getReminderStorageKey("birthdays", user.id, `${getTodayKey()}:${birthdaySignature}`),
        "dismissed",
      );
    } else if (cashReminderPhase) {
      sessionStorage.setItem(
        getReminderStorageKey("cash", user.id, `${getTodayKey()}:${cashReminderPhase}`),
        "dismissed",
      );
    } else {
      sessionStorage.setItem(getReminderStorageKey("cash", user.id, `${getTodayKey()}:unknown`), "dismissed");
    }

    const [nextModal, ...remainingModals] = pendingReminderModals;
    setActiveReminderModal(nextModal ?? null);
    setPendingReminderModals(remainingModals);
  }

  function handleReminderOpenChange(modal: ReminderModal, open: boolean) {
    if (!open && activeReminderModal === modal) {
      dismissReminderModal(modal);
    }
  }

  return (
    <div className="space-y-6">
      {isAdmin ? (
        <>
          <CashClosingReminderDialog
            open={activeReminderModal === "cash"}
            onOpenChange={(open) => handleReminderOpenChange("cash", open)}
            cashPreview={cashPreview}
            openCashSession={openCashSession}
          />
          <BirthdayReminderDialog
            open={activeReminderModal === "birthdays"}
            onOpenChange={(open) => handleReminderOpenChange("birthdays", open)}
            birthdays={birthdays}
          />
          <FeatureUpdatesDialog
            open={activeReminderModal === "features"}
            onOpenChange={(open) => handleReminderOpenChange("features", open)}
            updates={featureUpdates}
          />
        </>
      ) : null}

      {/* Welcome */}
      <section className="rounded-xl border border-primary/20 bg-primary/10 p-6">
        <p className="mb-2 text-sm font-medium text-primary">Administrador</p>
        <h2 className="mb-2 text-2xl font-semibold text-foreground">
          Bem-vindo, {userName}
        </h2>
        <p className="max-w-3xl text-muted-foreground">
          Acompanhe operacao, funcionarios, pagamentos, servicos e configuracoes do salao.
        </p>
      </section>

      {/* KPI Cards */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => <StatSkeleton key={i} />)
        ) : (
          <>
            <StatCard
              title="Receita do mes"
              value={formatCurrency(stats?.revenueThisMonth ?? 0)}
              icon={Wallet}
              iconBg="bg-primary/10"
            />
            <StatCard
              title="Agendamentos hoje"
              value={String(stats?.appointmentsToday ?? 0)}
              icon={Calendar}
              iconBg="bg-blue-500/10"
            />
            <StatCard
              title="Clientes cadastrados"
              value={String(stats?.totalClients ?? 0)}
              change={stats?.newClientsThisMonth ? `+${stats.newClientsThisMonth} este mes` : undefined}
              changeType="positive"
              icon={Users}
              iconBg="bg-purple-500/10"
            />
          </>
        )}
      </section>

      {/* Shortcuts */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {shortcuts.map((shortcut) => (
          <Link
            key={shortcut.label}
            to={shortcut.href}
            className="group rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/60"
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <shortcut.icon size={20} />
              </div>
              <ArrowRight
                size={18}
                className="text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary"
              />
            </div>
            <h3 className="text-base font-semibold text-foreground">{shortcut.label}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{shortcut.description}</p>
          </Link>
        ))}
      </section>

      {/* Chart + Staff */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {loading ? (
            <div className="flex h-80 animate-pulse items-center justify-center rounded-xl border border-border bg-card">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <RevenueChart
              data={stats?.revenueByDay ?? []}
              totalRevenue={stats?.revenueThisMonth ?? 0}
            />
          )}
        </div>
        <div>
          {loading ? (
            <div className="flex h-80 animate-pulse items-center justify-center rounded-xl border border-border bg-card">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <StaffPerformance staff={stats?.staff ?? []} />
          )}
        </div>
      </section>
    </div>
  );
}
