import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
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
import { Loader2, Target, TrendingDown, TrendingUp, Users, type LucideIcon } from "lucide-react";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  getRelationshipDashboard,
  listRelationshipPipelines,
  reasonLabel,
  type RelationshipDashboard,
  type RelationshipDashboardFunnelStage,
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

// null quando não há base de comparação (período anterior sem nenhum caso) -
// dividir por zero não tem uma % que faça sentido mostrar.
function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

function EmptyPanel({ message }: { message: string }) {
  return <div className="flex h-full min-h-[180px] items-center justify-center text-center text-sm text-muted-foreground">{message}</div>;
}

function StatTile({
  icon: Icon,
  colorVar,
  label,
  value,
  delta,
  invertDelta,
}: {
  icon: LucideIcon;
  colorVar: string;
  label: string;
  value: string;
  delta?: number | null;
  invertDelta?: boolean;
}) {
  const isGood = delta === null || delta === undefined ? null : invertDelta ? delta <= 0 : delta >= 0;
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
        style={{ background: `hsl(var(${colorVar}) / 0.12)`, color: `hsl(var(${colorVar}))` }}
      >
        <Icon size={18} />
      </div>
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-xs text-muted-foreground">{label}</span>
        <span className="text-lg font-semibold text-foreground">{value}</span>
        {delta !== null && delta !== undefined && (
          <span
            className={cn(
              "flex items-center gap-1 text-xs font-medium",
              isGood ? "text-[hsl(var(--success))]" : "text-destructive",
            )}
          >
            {isGood ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            {delta >= 0 ? "+" : ""}
            {Math.round(delta)}% vs. período anterior
          </span>
        )}
      </div>
    </div>
  );
}

// Funil desenhado à mão com clip-path em vez do componente Funnel do recharts:
// naquela versão da lib os labels só aparecem depois que a animação "termina" e
// o callback correspondente nunca dispara, então os rótulos simplesmente não
// renderizavam. Construir os trapézios manualmente também dá controle total
// sobre a proporção (a versão via recharts ficava desproporcional/"estourada").
function RelationshipFunnel({ stages }: { stages: RelationshipDashboardFunnelStage[] }) {
  const maxCount = Math.max(1, ...stages.map((stage) => stage.count));
  const MIN_WIDTH_PCT = 24;
  const widthFor = (count: number) => Math.max(MIN_WIDTH_PCT, (count / maxCount) * 100);

  const topStage = stages.reduce((best, stage) => (stage.count > best.count ? stage : best), stages[0]);

  // Cards podem ser arrastados pra qualquer etapa, então a contagem nem
  // sempre é decrescente de uma etapa pra próxima (ex.: uma etapa "de trás"
  // com mais cards que uma "da frente"). Sem essa clamp, o funil "ampliava"
  // de novo depois de estreitar, virando uma ampulheta. Forçando a largura a
  // nunca crescer, a forma continua sempre um funil - a legenda ao lado é
  // quem carrega o número exato, a forma é só leitura visual de tendência.
  const clampedWidths: number[] = [];
  stages.forEach((stage, i) => {
    const raw = widthFor(stage.count);
    clampedWidths.push(i === 0 ? raw : Math.min(raw, clampedWidths[i - 1]));
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-8">
        <div className="flex flex-1 flex-col">
          {stages.map((stage, i) => {
            const topWidth = clampedWidths[i];
            const bottomWidth = i < stages.length - 1 ? clampedWidths[i + 1] : clampedWidths[i] * 0.55;
            return (
              <div
                key={stage.stageKey}
                className="h-14"
                style={{
                  background: PALETTE[i % PALETTE.length],
                  clipPath: `polygon(${(100 - topWidth) / 2}% 0%, ${(100 + topWidth) / 2}% 0%, ${(100 + bottomWidth) / 2}% 100%, ${(100 - bottomWidth) / 2}% 100%)`,
                }}
              />
            );
          })}
        </div>
        <ul className="flex w-56 shrink-0 flex-col gap-2.5 text-sm">
          {stages.map((stage, i) => (
            <li key={stage.stageKey} className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} />
              <span className="flex-1 truncate text-foreground">{stage.label}</span>
              <span className="text-muted-foreground">{stage.count}</span>
            </li>
          ))}
        </ul>
      </div>
      {topStage.count > 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-2 text-sm">
          <TrendingUp size={14} className="shrink-0 text-primary" />
          <span className="text-muted-foreground">Maior concentração em</span>
          <span className="font-medium text-foreground">{topStage.label}</span>
        </div>
      )}
    </div>
  );
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

  const summary = useMemo(() => {
    if (!dashboard) return null;
    const activeCount = dashboard.funnel.reduce((sum, stage) => sum + stage.count, 0);
    const { recoveredCount, lostCount } = dashboard.valueImpact;
    const { recoveredCount: prevRecoveredCount, lostCount: prevLostCount } = dashboard.previousValueImpact;
    const rate = recoveredCount + lostCount > 0 ? (recoveredCount / (recoveredCount + lostCount)) * 100 : null;
    const prevRate = prevRecoveredCount + prevLostCount > 0 ? (prevRecoveredCount / (prevRecoveredCount + prevLostCount)) * 100 : null;
    return {
      activeCount,
      recoveredCount,
      lostCount,
      recoveredDelta: pctChange(recoveredCount, prevRecoveredCount),
      lostDelta: pctChange(lostCount, prevLostCount),
      rate,
      rateDelta: rate !== null && prevRate !== null ? rate - prevRate : null,
    };
  }, [dashboard]);

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
      ) : !dashboard || !summary ? null : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile icon={Users} colorVar="--primary" label="Clientes em relacionamento" value={String(summary.activeCount)} />
            <StatTile
              icon={TrendingUp}
              colorVar="--success"
              label="Recuperados"
              value={String(summary.recoveredCount)}
              delta={summary.recoveredDelta}
            />
            <StatTile
              icon={TrendingDown}
              colorVar="--destructive"
              label="Perdidos"
              value={String(summary.lostCount)}
              delta={summary.lostDelta}
              invertDelta
            />
            <StatTile
              icon={Target}
              colorVar="--info"
              label="Taxa de recuperação"
              value={summary.rate === null ? "-" : `${Math.round(summary.rate)}%`}
              delta={summary.rateDelta}
            />
          </div>

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
              <RelationshipFunnel stages={dashboard.funnel} />
            )}
          </Panel>

          <Panel title="Evolução mensal (R$)" subtitle="Valor recuperado, perdido e o saldo, mês a mês">
            {dashboard.monthlyTrend.length === 0 ? (
              <EmptyPanel message="Nenhum card resolvido no período." />
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dashboard.monthlyTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="monthLabel" axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                      tickFormatter={(v: number) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}mil` : String(v))}
                    />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                      formatter={(value: number) => formatCurrency(value)}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: 12 }}
                      formatter={(value) =>
                        value === "recoveredValue" ? "Recuperado" : value === "lostValue" ? "Perdido" : "Saldo"
                      }
                    />
                    <Line type="monotone" dataKey="recoveredValue" name="recoveredValue" stroke="hsl(var(--success))" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="lostValue" name="lostValue" stroke="hsl(var(--destructive))" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="saldo" name="saldo" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
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
