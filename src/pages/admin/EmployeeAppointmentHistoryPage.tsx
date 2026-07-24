import { useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  Clock3,
  Loader2,
  Search,
  UserRound,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  listAppointments,
  type Appointment,
  type AppointmentStatus,
} from "@/service/appointmentService";
import {
  listProfessionals,
  type Professional,
} from "@/service/professionalService";

type StatusFilter = "all" | AppointmentStatus;

const statusLabels: Record<AppointmentStatus, string> = {
  scheduled: "Agendado",
  confirmed: "Confirmado",
  in_service: "Em andamento",
  completed: "Finalizado",
  cancelled: "Cancelado",
  no_show: "Não compareceu",
};

const statusStyles: Record<AppointmentStatus, string> = {
  scheduled: "border-amber-500/20 bg-amber-500/10 text-amber-600",
  confirmed: "border-emerald-500/20 bg-emerald-500/10 text-emerald-600",
  in_service: "border-violet-500/20 bg-violet-500/10 text-violet-600",
  completed: "border-blue-500/20 bg-blue-500/10 text-blue-600",
  cancelled: "border-red-500/20 bg-red-500/10 text-red-600",
  no_show: "border-slate-500/20 bg-slate-500/10 text-slate-600",
};

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return {
    date: date.toLocaleDateString("pt-BR"),
    time: date.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
}

function apiMessage(error: unknown) {
  const message = (error as { response?: { data?: { message?: string } } })
    ?.response?.data?.message;
  return message || (error instanceof Error ? error.message : "Não foi possível carregar o histórico.");
}

async function listAllAppointments() {
  const limit = 200;
  const first = await listAppointments({
    allAppointments: true,
    page: 1,
    limit,
  });
  const items = [...first.items];
  const pages = Math.ceil(first.total / limit);

  for (let page = 2; page <= pages; page += 1) {
    const result = await listAppointments({
      allAppointments: true,
      page,
      limit,
    });
    items.push(...result.items);
  }

  return items;
}

export function EmployeeAppointmentHistoryPage() {
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [professionalId, setProfessionalId] = useState("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [professionalResult, appointmentResult] = await Promise.all([
          listProfessionals({ limit: 500 }),
          listAllAppointments(),
        ]);
        setProfessionals(professionalResult.items);
        setAppointments(appointmentResult);
      } catch (error) {
        toast.error(apiMessage(error));
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  const filtered = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase("pt-BR");

    return appointments
      .filter((appointment) => {
        if (
          professionalId !== "all" &&
          appointment.professionalId !== professionalId
        )
          return false;
        if (status !== "all" && appointment.status !== status) return false;

        const appointmentDate = appointment.startAt.slice(0, 10);
        if (dateFrom && appointmentDate < dateFrom) return false;
        if (dateTo && appointmentDate > dateTo) return false;

        if (normalizedSearch) {
          const content = [
            appointment.client?.name,
            appointment.dependent?.name,
            appointment.professional?.displayName,
            ...appointment.services.map((service) => service.serviceName),
          ]
            .filter(Boolean)
            .join(" ")
            .toLocaleLowerCase("pt-BR");
          if (!content.includes(normalizedSearch)) return false;
        }

        return true;
      })
      .sort(
        (a, b) =>
          new Date(b.startAt).getTime() - new Date(a.startAt).getTime(),
      );
  }, [appointments, dateFrom, dateTo, professionalId, search, status]);

  const totals = useMemo(
    () => ({
      scheduled: filtered.filter((item) =>
        ["scheduled", "confirmed"].includes(item.status),
      ).length,
      inService: filtered.filter((item) => item.status === "in_service").length,
      completed: filtered.filter((item) => item.status === "completed").length,
      cancelled: filtered.filter((item) =>
        ["cancelled", "no_show"].includes(item.status),
      ).length,
    }),
    [filtered],
  );

  return (
    <div className="space-y-6 pb-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          Histórico por funcionário
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Consulte atendimentos passados, atuais, futuros e cancelados de cada profissional.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Agendados", value: totals.scheduled, icon: CalendarClock, color: "text-amber-600" },
          { label: "Em andamento", value: totals.inService, icon: Clock3, color: "text-violet-600" },
          { label: "Finalizados", value: totals.completed, icon: CheckCircle2, color: "text-blue-600" },
          { label: "Cancelados/ausentes", value: totals.cancelled, icon: XCircle, color: "text-red-600" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="flex items-center justify-between rounded-xl border bg-card p-4">
            <div>
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-1 text-2xl font-semibold">{value}</p>
            </div>
            <Icon className={color} size={22} />
          </div>
        ))}
      </div>

      <div className="grid gap-3 rounded-xl border bg-card p-4 md:grid-cols-2 xl:grid-cols-5">
        <Select value={professionalId} onValueChange={setProfessionalId}>
          <SelectTrigger>
            <SelectValue placeholder="Funcionário" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os funcionários</SelectItem>
            {professionals.map((professional) => (
              <SelectItem key={professional.id} value={professional.id}>
                {professional.displayName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={status} onValueChange={(value) => setStatus(value as StatusFilter)}>
          <SelectTrigger>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {(Object.keys(statusLabels) as AppointmentStatus[]).map((item) => (
              <SelectItem key={item} value={item}>
                {statusLabels[item]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          type="date"
          aria-label="Data inicial"
          value={dateFrom}
          onChange={(event) => setDateFrom(event.target.value)}
        />
        <Input
          type="date"
          aria-label="Data final"
          value={dateTo}
          onChange={(event) => setDateTo(event.target.value)}
        />
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
          <Input
            className="pl-9"
            placeholder="Cliente ou serviço..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="border-b px-5 py-4">
          <h2 className="font-semibold">Agendamentos e atendimentos</h2>
          <p className="text-xs text-muted-foreground">
            {filtered.length} registro{filtered.length === 1 ? "" : "s"} encontrado{filtered.length === 1 ? "" : "s"}
          </p>
        </div>

        {loading ? (
          <div className="grid place-items-center py-16">
            <Loader2 className="animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            Nenhum agendamento encontrado com os filtros selecionados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="px-4 py-3 text-left font-medium">Funcionário</th>
                  <th className="px-4 py-3 text-left font-medium">Cliente</th>
                  <th className="px-4 py-3 text-left font-medium">Data</th>
                  <th className="px-4 py-3 text-left font-medium">Horário</th>
                  <th className="px-4 py-3 text-left font-medium">Serviços</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((appointment) => {
                  const professionalName =
                    appointment.professional?.displayName || "Funcionário";
                  const { date, time } = formatDateTime(appointment.startAt);
                  return (
                    <tr key={appointment.id} className="hover:bg-muted/40">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs">
                              {initials(professionalName)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{professionalName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <UserRound size={15} className="text-muted-foreground" />
                          {appointment.dependent?.name || appointment.client?.name || "Cliente"}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{date}</td>
                      <td className="px-4 py-3 text-muted-foreground">{time}</td>
                      <td className="max-w-64 px-4 py-3 text-muted-foreground">
                        {appointment.services.map((service) => service.serviceName).join(", ") || "-"}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={statusStyles[appointment.status]}>
                          {statusLabels[appointment.status]}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
