import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  Funnel,
  FunnelChart,
  LabelList,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Loader2, TrendingDown, TrendingUp } from "lucide-react";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getRelationshipDashboard,
  listRelationshipPipelines,
  reasonLabel,
  type RelationshipDashboard,
  type RelationshipPipeline,
} from "@/service/relationshipService";

const PALETTE = [
  "hsl(var(--primary))",
  "hsl(var(--secondary))",
  "hsl(var(--info))",
  "hsl(var(--success))",
  "hsl(var(--warning))",
  "hsl(var(--destructive))",
  "hsl(var(--muted-foreground))",
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value);
}

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

export function RelationshipDashboardPage() {
  const [pipelines, setPipelines] = useState<RelationshipPipeline[]>([]);
  const [activePipelineId, setActivePipelineId] = useState<string | null>(null);
  const [months, setMonths] = useState(6);
  const [dashboard, setDashboard] = useState<RelationshipDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listRelationshipPipelines()
      .then((result) => {
        setPipelines(result);
        setActivePipelineId((current) => {
          if (current && result.some((pipeline) => pipeline.id === current)) return current;
          return result.find((pipeline) => pipeline.isDefault)?.id ?? result[0]?.id ?? null;
        });
      })
      .catch(() => setError("Não foi possível carregar os pipelines."));
  }, []);

  const load = useCallback(async (pipelineId: string, windowMonths: number) => {
    setLoading(true);
    setError(null);
    try {
      setDashboard(await getRelationshipDashboard({ pipelineId, months: windowMonths }));
    } catch {
      setError("Não foi possível carregar o dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!activePipelineId) return;
    void load(activePipelineId, months);
  }, [activePipelineId, months, load]);

  const reasonsWithLabel = useMemo(
    () => (dashboard?.reasons ?? []).map((item) => ({ ...item, label: reasonLabel(item.reason) })),
    [dashboard],
  );

  const netImpact = dashboard ? dashboard.valueImpact.recoveredValue - dashboard.valueImpact.lostValue : 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold text-foreground">Dashboard de Relacionamento</h1>
          <p className="text-sm text-muted-foreground">
            Visão consolidada do funil, motivos e resultado do trabalho de relacionamento com clientes.
          </p>
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

      {pipelines.length > 1 && activePipelineId && (
        <Tabs value={activePipelineId} onValueChange={setActivePipelineId}>
          <TabsList>
            {pipelines.map((pipeline) => (
              <TabsTrigger key={pipeline.id} value={pipeline.id}>
                {pipeline.name}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}

      {loading ? (
        <div className="flex items-center justify-center rounded-xl border border-border bg-card p-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">{error}</div>
      ) : !dashboard ? null : (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Panel title="Recuperado x em risco" subtitle={`Valor histórico de clientes resolvidos nos últimos ${dashboard.windowMonths} meses`}>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">Recuperado ({dashboard.valueImpact.recoveredCount})</p>
                  <p className="text-xl font-semibold text-[hsl(var(--success))]">{formatCurrency(dashboard.valueImpact.recoveredValue)}</p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">Perdido ({dashboard.valueImpact.lostCount})</p>
                  <p className="text-xl font-semibold text-destructive">{formatCurrency(dashboard.valueImpact.lostValue)}</p>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2 text-sm">
                {netImpact >= 0 ? (
                  <TrendingUp size={14} className="text-[hsl(var(--success))]" />
                ) : (
                  <TrendingDown size={14} className="text-destructive" />
                )}
                <span className={netImpact >= 0 ? "text-[hsl(var(--success))]" : "text-destructive"}>
                  {formatCurrency(Math.abs(netImpact))} {netImpact >= 0 ? "de saldo positivo" : "de saldo negativo"}
                </span>
                <span className="text-muted-foreground">no período</span>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Valor histórico total (LTV) dos clientes marcados como recuperados vs. encerrados — mostra o impacto financeiro do trabalho, não só a contagem de casos.
              </p>
            </Panel>

            <Panel title="Motivos mais frequentes" subtitle="Por que os clientes entraram no relacionamento">
              {reasonsWithLabel.length === 0 ? (
                <EmptyPanel message="Nenhum card criado no período." />
              ) : (
                <div className="flex items-center gap-4">
                  <div className="h-48 w-48 shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={reasonsWithLabel} dataKey="count" nameKey="label" innerRadius={45} outerRadius={72} paddingAngle={2}>
                          {reasonsWithLabel.map((_, i) => (
                            <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <ul className="flex flex-col gap-1.5 text-sm">
                    {reasonsWithLabel.map((item, i) => (
                      <li key={item.reason} className="flex items-center gap-2">
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

          <Panel title="Cards ativos por etapa" subtitle="Onde os casos em aberto estão parados agora, no funil do pipeline">
            {dashboard.funnel.length === 0 ? (
              <EmptyPanel message="Nenhum card ativo neste pipeline." />
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <FunnelChart margin={{ top: 10, right: 140, bottom: 10, left: 10 }}>
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                    />
                    <Funnel
                      data={dashboard.funnel.map((stage) => ({ ...stage, displayLabel: `${stage.label} (${stage.count})` }))}
                      dataKey="count"
                      nameKey="label"
                      isAnimationActive={false}
                    >
                      {dashboard.funnel.map((_, i) => (
                        <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                      ))}
                      <LabelList dataKey="displayLabel" position="right" fill="hsl(var(--foreground))" stroke="none" fontSize={13} />
                    </Funnel>
                  </FunnelChart>
                </ResponsiveContainer>
              </div>
            )}
          </Panel>

          <Panel title="Recuperados x encerrados por mês" subtitle="Tendência de resolução ao longo do tempo">
            {dashboard.monthlyTrend.length === 0 ? (
              <EmptyPanel message="Nenhum card resolvido no período." />
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dashboard.monthlyTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="monthLabel" axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="recovered" name="Recuperados" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} maxBarSize={40} />
                    <Bar dataKey="closed" name="Encerrados" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Panel>

          <Panel title="Desempenho por responsável" subtitle="Casos resolvidos e tempo médio até a resolução">
            {dashboard.responsiblePerformance.length === 0 ? (
              <EmptyPanel message="Nenhum card resolvido no período." />
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
                        if (name !== "resolvedCount") return [value, name];
                        const days = item.payload.avgResolutionDays;
                        return [`${value} caso(s)${days !== null ? ` · ~${Math.round(days)} dias em média` : ""}`, "Resolvidos"];
                      }}
                    />
                    <Bar dataKey="resolvedCount" name="resolvedCount" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} maxBarSize={28} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}
