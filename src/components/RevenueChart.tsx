import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { TrendingUp, TrendingDown } from "lucide-react";
import type { DashboardRevenueDay } from "@/service/dashboardService";

interface Props {
  data: DashboardRevenueDay[];
  totalRevenue: number;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: any[] }) => {
  if (active && payload && payload.length) {
    const item = payload[0].payload as DashboardRevenueDay;
    return (
      <div className="rounded-lg border border-border bg-popover p-3 shadow-lg">
        <p className="text-sm font-medium text-foreground">{formatCurrency(item.total)}</p>
        <p className="text-xs text-muted-foreground">{item.date}</p>
      </div>
    );
  }
  return null;
};

export function RevenueChart({ data, totalRevenue }: Props) {
  const maxDay = data.reduce((best, d) => (d.total > best.total ? d : best), data[0] ?? { total: 0, day: "", date: "" });

  // Variação: compara primeira metade com segunda metade dos 7 dias
  const half = Math.floor(data.length / 2);
  const firstHalf = data.slice(0, half).reduce((s, d) => s + d.total, 0);
  const secondHalf = data.slice(half).reduce((s, d) => s + d.total, 0);
  const changePositive = secondHalf >= firstHalf;
  const changePct = firstHalf > 0 ? Math.abs(((secondHalf - firstHalf) / firstHalf) * 100).toFixed(1) : null;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-6 flex items-center justify-between">
        <h3 className="text-base font-medium text-foreground">Receita — últimos 7 dias</h3>
      </div>

      <div className="mb-6 flex items-center gap-4">
        <h2 className="text-2xl font-semibold text-foreground">{formatCurrency(totalRevenue)}</h2>
        {changePct !== null && (
          <div className={`flex items-center gap-1 ${changePositive ? "text-emerald-500" : "text-red-500"}`}>
            {changePositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            <span className="text-sm font-medium">{changePct}%</span>
          </div>
        )}
        <span className="text-xs text-muted-foreground">este mês</span>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis
              dataKey="day"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
              tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v))}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }} />
            <Bar dataKey="total" radius={[4, 4, 0, 0]} maxBarSize={50}>
              {data.map((entry, i) => (
                <Cell
                  key={`cell-${i}`}
                  fill={entry.date === maxDay.date ? "hsl(var(--primary))" : "hsl(var(--primary) / 0.5)"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
