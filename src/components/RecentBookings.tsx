import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { DashboardAppointment } from "@/service/dashboardService";

interface Props {
  appointments: DashboardAppointment[];
}

type AppointmentStatus = "scheduled" | "confirmed" | "in_service" | "completed" | "cancelled" | "no_show";

const statusConfig: Record<AppointmentStatus, { label: string; className: string }> = {
  scheduled:  { label: "Agendado",   className: "bg-amber-500/10  text-amber-500  border-amber-500/20"  },
  confirmed:  { label: "Confirmado", className: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" },
  in_service: { label: "Em andamento", className: "bg-violet-500/10 text-violet-500 border-violet-500/20" },
  completed:  { label: "Concluído",  className: "bg-blue-500/10   text-blue-500   border-blue-500/20"   },
  cancelled:  { label: "Cancelado",  className: "bg-red-500/10    text-red-500    border-red-500/20"    },
  no_show:    { label: "Não veio",   className: "bg-zinc-500/10   text-zinc-400   border-zinc-500/20"   },
};

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function RecentBookings({ appointments }: Props) {
  const cfg = (status: string) =>
    statusConfig[status as AppointmentStatus] ?? { label: status, className: "" };

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border p-4">
        <h3 className="text-base font-medium text-foreground">Agendamentos Recentes</h3>
        <span className="text-xs text-muted-foreground">últimos 8</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Cliente
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Serviço
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Data
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Profissional
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {appointments.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-sm text-muted-foreground">
                  Nenhum agendamento encontrado.
                </td>
              </tr>
            ) : (
              appointments.map((booking) => {
                const s = cfg(booking.status);
                return (
                  <tr
                    key={booking.id}
                    className="border-b border-border transition-colors last:border-b-0 hover:bg-secondary/30"
                  >
                    <td className="px-4 py-3 text-sm font-medium text-foreground">
                      {booking.clientName}
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground">
                      {booking.serviceLabel}
                      {booking.serviceCount > 1 && (
                        <span className="ml-1 text-xs text-muted-foreground">
                          +{booking.serviceCount - 1}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {formatDateTime(booking.startAt)}
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground">{booking.professionalName}</td>
                    <td className="px-4 py-3">
                      <Badge
                        variant="outline"
                        className={cn("rounded-full px-2 py-0.5 text-xs capitalize", s.className)}
                      >
                        {s.label}
                      </Badge>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
