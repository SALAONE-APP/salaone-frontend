import { Calendar } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { DashboardStaffMember } from "@/service/dashboardService";

interface Props {
  staff: DashboardStaffMember[];
}

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? "")
    .join("");
}

export function StaffPerformance({ staff }: Props) {
  const sorted = [...staff].sort((a, b) => b.appointmentsThisMonth - a.appointmentsThisMonth);

  return (
    <div className="h-full rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-medium text-foreground">Profissionais</h3>
        <span className="text-xs text-muted-foreground">este mês</span>
      </div>

      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum profissional cadastrado.</p>
      ) : (
        <div className="space-y-3">
          {sorted.map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between rounded-lg p-2 transition-colors hover:bg-secondary/50"
            >
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={member.photo ?? undefined} alt={member.name} />
                  <AvatarFallback className="bg-primary/10 text-sm text-primary">
                    {initials(member.name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium text-foreground">{member.name}</p>
                  <p className="text-xs text-muted-foreground">{member.specialty ?? "Profissional"}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Calendar size={13} />
                <span className="text-sm font-medium text-foreground">
                  {member.appointmentsThisMonth}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
