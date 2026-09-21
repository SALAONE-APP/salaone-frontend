import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Loader2 } from "lucide-react";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  getSalesDashboard,
  salesChannelLabel,
  salesLeadStageLabel,
  salesLostReasonLabel,
  type SalesDashboard,
} from "@/service/salesCrmService";

const PALETTE = [
  "hsl(var(--primary))",
  "hsl(var(--secondary))",
  "hsl(var(--info))",
  "hsl(var(--success))",
  "hsl(var(--warning))",
  "hsl(var(--destructive))",
  "hsl(var(--muted-foreground))",
];

function EmptyPanel({ message }: { message: string }) {
  return <div className="flex h-full min-h-[180px] items-center justify-center text-center text-sm text-muted-foreground">{message}</div>;
}

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-base font-medium text-foreground">{title}</h3>
      {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </div>
  );
}

export function SalesCrmDashboardPage() {
  const [months, setMonths] = useState(6);
  const [dashboard, setDashboard] = useState<SalesDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getSalesDashboard({ trendMonths: months })
      .then(setDashboard)
      .catch(() => setError("Não foi possível carregar o dashboard."))
      .finally(() => setLoading(false));
  }, [months]);

  const funnelWithLabel = useMemo(
    () => (dashboard?.funnel ?? []).map((item) => ({ ...item, label: salesLeadStageLabel(item.stage) })),
    [dashboard],
  );

  const channelWithLabel = useMemo(
    () => (dashboard?.byChannel ?? []).map((item) => ({ ...item, label: salesChannelLabel(item.channel) })),
    [dashboard],
  );

  const lostReasonsWithLabel = useMemo(
    () => (dashboard?.lostReasons ?? []).map((item) => ({ ...item, label: item.reason ? salesLostReasonLabel(item.reason) : "Sem motivo" })),
    [dashboard],
  );

  const totalLeads = useMemo(() => (dashboard?.funnel ?? []).reduce((sum, item) => sum + item.count, 0), [dashboard]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold text-foreground">Dashboard Comercial</h1>
          <p className="text-sm text-muted-foreground">Visão consolidada do funil de prospecção de salões.</p>
        </div>
        <Select value={String(months)} onValueChange={(v) => setMonths(Number(v))}>
          <SelectTrigger className="w-40 self-start">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="3">Últimos 3 meses</SelectItem>
            <SelectItem value="6">Últimos 6 meses</SelectItem>
            <SelectItem value="12">Últimos 12 meses</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center rounded-xl border border-border bg-card p-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">{error}</div>
      ) : !dashboard ? null : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-border bg-card p-3">
              <p className="text-xs text-muted-foreground">Total de leads</p>
              <p className="text-lg font-semibold text-foreground">{totalLeads}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-3">
              <p className="text-xs text-muted-foreground">Fechados</p>
              <p className="text-lg font-semibold text-foreground">
                {dashboard.funnel.find((item) => item.stage === "fechado")?.count ?? 0}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-3">
              <p className="text-xs text-muted-foreground">Perdidos</p>
              <p className="text-lg font-semibold text-foreground">
                {dashboard.funnel.find((item) => item.stage === "perdido")?.count ?? 0}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-3">
              <p className="text-xs text-muted-foreground">Canais ativos</p>
              <p className="text-lg font-semibold text-foreground">{dashboard.byChannel.length}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Panel title="Funil por etapa" subtitle="Quantidade de leads em cada etapa do funil">
              {funnelWithLabel.length === 0 ? (
                <EmptyPanel message="Nenhum lead cadastrado ainda." />
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={funnelWithLabel} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} allowDecimals={false} />
                      <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                      <Bar dataKey="count" name="Leads" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={48} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Panel>

            <Panel title="Leads por canal" subtitle="De onde vêm os leads cadastrados">
              {channelWithLabel.length === 0 ? (
                <EmptyPanel message="Nenhum lead cadastrado ainda." />
              ) : (
                <div className="flex items-center gap-4">
                  <div className="h-48 w-48 shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={channelWithLabel} dataKey="count" nameKey="label" innerRadius={45} outerRadius={72} paddingAngle={2}>
                          {channelWithLabel.map((_, i) => (
                            <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <ul className="flex flex-col gap-1.5 text-sm">
                    {channelWithLabel.map((item, i) => (
                      <li key={item.channel} className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} />
                        <span className="text-foreground">{item.label}</span>
                        <span className="text-muted-foreground">({item.count})</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Panel>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Panel title="Motivos de perda" subtitle="Por que os leads foram perdidos">
              {lostReasonsWithLabel.length === 0 ? (
                <EmptyPanel message="Nenhum lead perdido no período." />
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={lostReasonsWithLabel}
                      layout="vertical"
                      margin={{ top: 10, right: 30, left: 10, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                      <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} allowDecimals={false} />
                      <YAxis
                        type="category"
                        dataKey="label"
                        axisLine={false}
                        tickLine={false}
                        width={120}
                        tick={{ fill: "hsl(var(--foreground))", fontSize: 12 }}
                      />
                      <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                      <Bar dataKey="count" name="Leads perdidos" fill="hsl(var(--destructive))" radius={[0, 4, 4, 0]} maxBarSize={28} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Panel>

            <Panel title="Evolução mensal" subtitle="Leads fechados e perdidos, mês a mês">
              {dashboard.monthlyTrend.length === 0 ? (
                <EmptyPanel message="Nenhum lead resolvido no período." />
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dashboard.monthlyTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} allowDecimals={false} />
                      <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                      <Legend
                        wrapperStyle={{ fontSize: 12 }}
                        formatter={(value) => (value === "closed" ? "Fechados" : "Perdidos")}
                      />
                      <Line type="monotone" dataKey="closed" name="closed" stroke="hsl(var(--success))" strokeWidth={2} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="lost" name="lost" stroke="hsl(var(--destructive))" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Panel>
          </div>

          {dashboard.responsiblePerformance && (
            <Panel title="Desempenho por vendedor" subtitle="Leads fechados e tempo médio até o fechamento">
              {dashboard.responsiblePerformance.length === 0 ? (
                <EmptyPanel message="Nenhum lead fechado no período." />
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={dashboard.responsiblePerformance}
                      layout="vertical"
                      margin={{ top: 10, right: 30, left: 10, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                      <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} allowDecimals={false} />
                      <YAxis
                        type="category"
                        dataKey="responsibleName"
                        axisLine={false}
                        tickLine={false}
                        width={110}
                        tick={{ fill: "hsl(var(--foreground))", fontSize: 12 }}
                      />
                      <Tooltip
                        contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                        formatter={(value: number, name: string, item) => {
                          if (name !== "closedCount") return [value, name];
                          const days = item.payload.avgDaysToClose;
                          return [`${value} fechado(s)${days !== null ? ` · ~${Math.round(days)} dias em média` : ""}`, "Fechados"];
                        }}
                      />
                      <Bar dataKey="closedCount" name="closedCount" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} maxBarSize={28} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Panel>
          )}
        </>
      )}
    </div>
  );
}
