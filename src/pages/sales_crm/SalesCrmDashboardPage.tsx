import { useEffect, useMemo, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, ArrowDown, ArrowUp, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import {
  getSalesDashboard,
  SALES_CONTACT_STATUS_LABELS,
  SALES_PRODUCT_LABELS,
  salesChannelLabel,
  salesLostReasonLabel,
  type SalesDashboard,
  type SalesDashboardCohortStats,
  type SalesDashboardSummary,
} from "@/service/salesCrmService";
import { listSuperAdminUsers, type SuperAdminUser } from "@/service/superAdminService";
import { useSalesPipelines } from "@/hooks/useSalesPipelines";
import { useSalesProduct } from "@/hooks/useSalesProduct";

// Ordem fixa validada (paleta categórica: primária, info, secundária) - a cor segue a série.
const SERIES = [
  { key: "newLeads", label: "Leads novos", color: "hsl(var(--primary))" },
  { key: "meetingsScheduled", label: "Reuniões marcadas", color: "hsl(var(--info))" },
  { key: "won", label: "Fechamentos", color: "hsl(var(--secondary))" },
] as const;

// Abaixo disso, a taxa de um script/canal ainda é ruído, não sinal.
const SMALL_SAMPLE = 10;

const TOOLTIP_STYLE = { background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 };

function brtMonthKey(offset = 0) {
  const brt = new Date(Date.now() - 3 * 3_600_000);
  const date = new Date(Date.UTC(brt.getUTCFullYear(), brt.getUTCMonth() + offset, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string, style: "long" | "short" = "long") {
  const [year, month] = key.split("-").map(Number);
  const label = new Date(Date.UTC(year, month - 1, 15)).toLocaleDateString("pt-BR", {
    month: style,
    year: style === "long" ? "numeric" : "2-digit",
    timeZone: "UTC",
  });
  return label.charAt(0).toUpperCase() + label.slice(1).replace(" de ", " de ").replace(".", "");
}

function periodLabel(from: string, to: string) {
  return from === to ? monthLabel(from) : `${monthLabel(from, "short")} – ${monthLabel(to, "short")}`;
}

// Presets + os últimos 12 meses avulsos. Valor = "AAAA-MM:AAAA-MM".
function periodOptions() {
  const current = brtMonthKey();
  const presets = [
    { value: `${current}:${current}`, label: "Este mês" },
    { value: `${brtMonthKey(-1)}:${brtMonthKey(-1)}`, label: "Mês passado" },
    { value: `${brtMonthKey(-2)}:${current}`, label: "Últimos 3 meses" },
    { value: `${brtMonthKey(-5)}:${current}`, label: "Últimos 6 meses" },
  ];
  const months = Array.from({ length: 10 }, (_, index) => {
    const key = brtMonthKey(-(index + 2));
    return { value: `${key}:${key}`, label: monthLabel(key) };
  });
  return { presets, months };
}

function rate(part: number, whole: number) {
  return whole > 0 ? part / whole : null;
}

function formatPercent(value: number | null) {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}

function Delta({ current, previous, isRate }: { current: number | null; previous: number | null; isRate?: boolean }) {
  if (current === null || previous === null) return <span className="text-xs text-muted-foreground">sem base anterior</span>;
  const diff = isRate ? Math.round((current - previous) * 100) : current - previous;
  if (diff === 0) return <span className="text-xs text-muted-foreground">igual ao período anterior</span>;
  const up = diff > 0;
  return (
    <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
      {up ? <ArrowUp size={12} className="text-[hsl(var(--success))]" /> : <ArrowDown size={12} className="text-destructive" />}
      {up ? "+" : ""}
      {diff}
      {isRate ? " p.p." : ""} vs anterior
    </span>
  );
}

function StatTile({ label, value, hint, children }: { label: string; value: string; hint?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold tabular-nums text-foreground">{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {children}
    </div>
  );
}

function Panel({ title, subtitle, children, className }: { title: string; subtitle?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-xl border border-border bg-card p-5", className)}>
      <h3 className="text-base font-medium text-foreground">{title}</h3>
      {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </div>
  );
}

function EmptyPanel({ message }: { message: string }) {
  return <div className="flex min-h-[120px] items-center justify-center text-center text-sm text-muted-foreground">{message}</div>;
}

function CountWithRate({ count, total }: { count: number; total: number }) {
  return (
    <span className="tabular-nums">
      {count} <span className="text-muted-foreground">({formatPercent(rate(count, total))})</span>
    </span>
  );
}

// Base das taxas = leads abordados (os "enviados"): é o que mede se a mensagem funciona.
function CohortTable({
  rows,
  nameHeader,
  showMeetings,
}: {
  rows: Array<SalesDashboardCohortStats & { key: string; name: string }>;
  nameHeader: string;
  showMeetings: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th className="py-2 pr-3 font-medium">{nameHeader}</th>
            <th className="py-2 pr-3 text-right font-medium">Leads</th>
            <th className="py-2 pr-3 text-right font-medium">Abordados</th>
            <th className="py-2 pr-3 text-right font-medium">Respostas</th>
            {showMeetings && <th className="py-2 pr-3 text-right font-medium">Reuniões</th>}
            <th className="py-2 text-right font-medium">Fechados</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-b border-border/60 last:border-0">
              <td className="py-2 pr-3 text-foreground">
                <span className="flex flex-wrap items-center gap-1.5">
                  {row.name}
                  {row.approached < SMALL_SAMPLE && (
                    <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground" title="Poucos leads abordados: a taxa ainda não é confiável">
                      amostra pequena
                    </Badge>
                  )}
                </span>
              </td>
              <td className="py-2 pr-3 text-right tabular-nums text-muted-foreground">{row.leads}</td>
              <td className="py-2 pr-3 text-right tabular-nums text-foreground">{row.approached}</td>
              <td className="py-2 pr-3 text-right text-foreground">
                <CountWithRate count={row.responded} total={row.approached} />
              </td>
              {showMeetings && (
                <td className="py-2 pr-3 text-right text-foreground">
                  <CountWithRate count={row.meetingsScheduled} total={row.approached} />
                </td>
              )}
              <td className="py-2 text-right text-foreground">
                <CountWithRate count={row.won} total={row.approached} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SalesCrmDashboardPage() {
  const product = useSalesProduct();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "super_admin";
  const { pipelines, loading: pipelinesLoading } = useSalesPipelines(product);

  const { presets, months } = useMemo(() => periodOptions(), []);
  const [period, setPeriod] = useState(presets[0].value);
  const [pipelineChoice, setPipelineChoice] = useState<string | null>(null);
  const pipelineFilter = pipelineChoice ?? pipelines[0]?.id ?? "all";
  const [responsibleFilter, setResponsibleFilter] = useState("all");
  const [responsibleOptions, setResponsibleOptions] = useState<SuperAdminUser[]>([]);

  // Resultado guardado com a chave da requisição: "carregando" é derivado (chave atual ainda sem resposta)
  // e uma resposta atrasada de filtros antigos nunca sobrescreve a atual.
  const [result, setResult] = useState<{ key: string; dashboard: SalesDashboard | null; error: string | null } | null>(null);

  useEffect(() => {
    if (!isSuperAdmin) return;
    Promise.all([listSuperAdminUsers({ role: "sales_rep", limit: 100 }), listSuperAdminUsers({ role: "super_admin", limit: 100 })])
      .then(([reps, admins]) => setResponsibleOptions([...reps.items, ...admins.items]))
      .catch(() => null);
  }, [isSuperAdmin]);

  const filters = useMemo(() => {
    const [from, to] = period.split(":");
    return {
      product,
      pipelineId: pipelineFilter === "all" ? undefined : pipelineFilter,
      responsibleId: isSuperAdmin && responsibleFilter !== "all" ? responsibleFilter : undefined,
      from,
      to,
    };
  }, [product, period, pipelineFilter, responsibleFilter, isSuperAdmin]);
  const requestKey = pipelinesLoading ? null : JSON.stringify(filters);

  useEffect(() => {
    if (!requestKey) return;
    let active = true;
    getSalesDashboard(filters)
      .then((data) => active && setResult({ key: requestKey, dashboard: data, error: null }))
      .catch(() => active && setResult({ key: requestKey, dashboard: null, error: "Não foi possível carregar o dashboard." }));
    return () => {
      active = false;
    };
  }, [requestKey, filters]);

  const loading = !result || result.key !== requestKey;
  const dashboard = loading ? null : result.dashboard;
  const error = loading ? null : result.error;

  const view = useMemo(() => {
    if (!dashboard) return null;
    const { summary, previousSummary, milestones } = dashboard;
    // Reunião → fechamento usa as realizadas quando o funil marca essa etapa; senão, as marcadas.
    const meetingBase = (s: SalesDashboardSummary) => (milestones.meetingHeld ? s.meetingsHeld : s.meetingsScheduled);
    return {
      responseRate: rate(summary.responded, summary.approached),
      responseRatePrev: rate(previousSummary.responded, previousSummary.approached),
      leadToMeeting: rate(summary.meetingsScheduled, summary.approached),
      meetingToWon: rate(summary.won, meetingBase(summary)),
      meetingToWonPrev: rate(previousSummary.won, meetingBase(previousSummary)),
      attendance: rate(summary.meetingsHeld, summary.meetingsScheduled),
      scripts: dashboard.byScript.map((row) => ({ ...row, key: row.scriptId ?? "none", name: row.scriptName ?? "Sem script" })),
      channels: dashboard.byChannel.map((row) => ({ ...row, key: row.channel, name: salesChannelLabel(row.channel) })),
      trend: dashboard.trend.map((row) => ({ ...row, label: monthLabel(row.month, "short") })),
    };
  }, [dashboard]);

  const funnelSteps = useMemo(() => {
    if (!dashboard) return [];
    const { funnel, milestones } = dashboard;
    return [
      { label: "Leads criados", value: funnel.created },
      { label: "Abordados", value: funnel.approached },
      { label: "Responderam", value: funnel.responded },
      ...(milestones.meetingScheduled ? [{ label: "Reunião marcada", value: funnel.meetingsScheduled }] : []),
      ...(milestones.meetingHeld ? [{ label: "Reunião realizada", value: funnel.meetingsHeld }] : []),
      { label: "Fechado", value: funnel.won },
    ];
  }, [dashboard]);

  const meetingsConfigured = dashboard?.milestones.meetingScheduled ?? false;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold text-foreground">Dashboard Comercial · {SALES_PRODUCT_LABELS[product]}</h1>
          <p className="text-sm text-muted-foreground">
            {dashboard ? periodLabel(dashboard.period.from, dashboard.period.to) : "Carregando..."} · comparado com{" "}
            {dashboard ? periodLabel(dashboard.period.previousFrom, dashboard.period.previousTo).toLowerCase() : "o período anterior"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {presets.map((option) => (
                <SelectItem key={option.label} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
              <SelectSeparator />
              {months.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {pipelines.length > 0 && (
            <Select value={pipelineFilter} onValueChange={setPipelineChoice}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pipelines.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
                <SelectItem value="all">Todos os funis</SelectItem>
              </SelectContent>
            </Select>
          )}
          {isSuperAdmin && (
            <Select value={responsibleFilter} onValueChange={setResponsibleFilter}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os vendedores</SelectItem>
                {responsibleOptions.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center rounded-xl border border-border bg-card p-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">{error}</div>
      ) : !dashboard || !view ? null : (
        <>
          {!meetingsConfigured && (
            <div className="flex items-start gap-2 rounded-xl border border-[hsl(var(--warning)/0.4)] bg-[hsl(var(--warning)/0.1)] p-3 text-sm text-foreground">
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-[hsl(var(--warning))]" />
              <p>
                Para contar reuniões, abra o Funil de Vendas → <strong>Gerenciar funis</strong> e marque qual etapa é a "Reunião marcada" (e a
                "Reunião realizada", se houver). O histórico de movimentações já existente passa a ser contado na hora.
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatTile label="Leads novos" value={String(dashboard.summary.newLeads)}>
              <Delta current={dashboard.summary.newLeads} previous={dashboard.previousSummary.newLeads} />
            </StatTile>
            <StatTile label="Leads abordados" value={String(dashboard.summary.approached)}>
              <Delta current={dashboard.summary.approached} previous={dashboard.previousSummary.approached} />
            </StatTile>
            <StatTile label="Taxa de resposta" value={formatPercent(view.responseRate)} hint={`${dashboard.summary.responded} responderam`}>
              <Delta current={view.responseRate} previous={view.responseRatePrev} isRate />
            </StatTile>
            <StatTile
              label="Reuniões marcadas"
              value={meetingsConfigured ? String(dashboard.summary.meetingsScheduled) : "—"}
              hint={meetingsConfigured ? `${formatPercent(view.leadToMeeting)} dos abordados` : undefined}
            >
              {meetingsConfigured && <Delta current={dashboard.summary.meetingsScheduled} previous={dashboard.previousSummary.meetingsScheduled} />}
            </StatTile>
            <StatTile
              label="Taxa de comparecimento"
              value={dashboard.milestones.meetingHeld ? formatPercent(view.attendance) : "—"}
              hint={
                dashboard.milestones.meetingHeld
                  ? `${dashboard.summary.meetingsHeld} reuniões realizadas`
                  : "Marque a etapa \"Reunião realizada\" no funil"
              }
            />
            <StatTile label="Fechamentos" value={String(dashboard.summary.won)}>
              <Delta current={dashboard.summary.won} previous={dashboard.previousSummary.won} />
            </StatTile>
            <StatTile
              label="Taxa de fechamento"
              value={meetingsConfigured ? formatPercent(view.meetingToWon) : "—"}
              hint={meetingsConfigured ? `Fechamentos ÷ reuniões ${dashboard.milestones.meetingHeld ? "realizadas" : "marcadas"}` : undefined}
            >
              {meetingsConfigured && <Delta current={view.meetingToWon} previous={view.meetingToWonPrev} isRate />}
            </StatTile>
            <StatTile
              label="Tempo médio até a venda"
              value={dashboard.summary.avgDaysToClose !== null ? `${Math.round(dashboard.summary.avgDaysToClose)} dias` : "—"}
              hint={
                dashboard.previousSummary.avgDaysToClose !== null
                  ? `Do cadastro ao fechamento · antes: ${Math.round(dashboard.previousSummary.avgDaysToClose)} dias`
                  : "Do cadastro do lead ao fechamento"
              }
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Panel title="Funil de conversão" subtitle="Leads criados no período e até onde cada um chegou">
              {funnelSteps[0].value === 0 ? (
                <EmptyPanel message="Nenhum lead criado no período." />
              ) : (
                <ol className="flex flex-col gap-3">
                  {funnelSteps.map((step, index) => {
                    const previous = index > 0 ? funnelSteps[index - 1].value : null;
                    return (
                      <li key={step.label} className="flex flex-col gap-1">
                        <div className="flex items-baseline justify-between gap-2 text-sm">
                          <span className="text-foreground">{step.label}</span>
                          <span className="tabular-nums text-foreground">
                            {step.value}
                            {previous !== null && (
                              <span className="ml-1.5 text-xs text-muted-foreground">{formatPercent(rate(step.value, previous))} da etapa anterior</span>
                            )}
                          </span>
                        </div>
                        <div className="h-2.5 rounded-full bg-muted">
                          <div
                            className="h-2.5 rounded-full bg-primary"
                            style={{ width: `${Math.max(step.value > 0 ? 2 : 0, (step.value / funnelSteps[0].value) * 100)}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </Panel>

            <Panel title="Evolução mensal" subtitle="Últimos 6 meses até o fim do período">
              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={view.trend} margin={{ top: 10, right: 10, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} allowDecimals={false} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ stroke: "hsl(var(--border))" }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
                    {SERIES.filter((series) => series.key !== "meetingsScheduled" || meetingsConfigured).map((series) => (
                      <Line
                        key={series.key}
                        type="monotone"
                        dataKey={series.key}
                        name={series.label}
                        stroke={series.color}
                        strokeWidth={2}
                        dot={{ r: 4, strokeWidth: 2, stroke: "hsl(var(--card))", fill: series.color }}
                        activeDot={{ r: 5 }}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Panel title="Efetividade por script" subtitle="Leads criados no período, pelo script usado. Taxas sobre os abordados.">
              {view.scripts.length === 0 ? (
                <EmptyPanel message="Nenhum lead criado no período." />
              ) : (
                <CohortTable rows={view.scripts} nameHeader="Script" showMeetings={meetingsConfigured} />
              )}
            </Panel>
            <Panel title="Resultado por canal" subtitle="De onde vieram os leads do período. Taxas sobre os abordados.">
              {view.channels.length === 0 ? (
                <EmptyPanel message="Nenhum lead criado no período." />
              ) : (
                <CohortTable rows={view.channels} nameHeader="Canal" showMeetings={meetingsConfigured} />
              )}
            </Panel>
          </div>

          {dashboard.byResponsible && (
            <Panel title="Desempenho por vendedor" subtitle="O que cada vendedor produziu no período">
              {dashboard.byResponsible.length === 0 ? (
                <EmptyPanel message="Nenhuma movimentação no período." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[820px] text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs text-muted-foreground">
                        <th className="py-2 pr-3 font-medium">Vendedor</th>
                        <th className="py-2 pr-3 text-right font-medium">Leads novos</th>
                        <th className="py-2 pr-3 text-right font-medium">Abordados</th>
                        <th className="py-2 pr-3 text-right font-medium">Respostas</th>
                        <th className="py-2 pr-3 text-right font-medium">Contatos registrados</th>
                        {meetingsConfigured && <th className="py-2 pr-3 text-right font-medium">Reuniões marcadas</th>}
                        {dashboard.milestones.meetingHeld && <th className="py-2 pr-3 text-right font-medium">Realizadas</th>}
                        <th className="py-2 pr-3 text-right font-medium">Fechamentos</th>
                        <th className="py-2 text-right font-medium">Tempo médio p/ fechar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboard.byResponsible.map((row) => (
                        <tr key={row.responsibleId} className="border-b border-border/60 last:border-0 tabular-nums">
                          <td className="py-2 pr-3 text-foreground">{row.responsibleName}</td>
                          <td className="py-2 pr-3 text-right text-foreground">{row.newLeads}</td>
                          <td className="py-2 pr-3 text-right text-foreground">{row.approached}</td>
                          <td className="py-2 pr-3 text-right text-foreground">
                            <CountWithRate count={row.responded} total={row.approached} />
                          </td>
                          <td className="py-2 pr-3 text-right text-foreground">{row.contacts}</td>
                          {meetingsConfigured && <td className="py-2 pr-3 text-right text-foreground">{row.meetingsScheduled}</td>}
                          {dashboard.milestones.meetingHeld && <td className="py-2 pr-3 text-right text-foreground">{row.meetingsHeld}</td>}
                          <td className="py-2 pr-3 text-right font-medium text-foreground">{row.won}</td>
                          <td className="py-2 text-right text-muted-foreground">
                            {row.avgDaysToClose !== null ? `${Math.round(row.avgDaysToClose)} dias` : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          )}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Panel title="Saúde do pipeline" subtitle="Situação de agora, independente do período">
              <dl className="grid grid-cols-3 gap-3">
                <div>
                  <dt className="text-xs text-muted-foreground">Abertos</dt>
                  <dd className="text-xl font-semibold tabular-nums text-foreground">{dashboard.health.open}</dd>
                </div>
                <div>
                  <dt className="flex items-center gap-1 text-xs text-muted-foreground">
                    <AlertTriangle size={11} className="text-[hsl(var(--warning))]" />
                    Ação atrasada
                  </dt>
                  <dd className="text-xl font-semibold tabular-nums text-foreground">{dashboard.health.overdue}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Parados 7+ dias</dt>
                  <dd className="text-xl font-semibold tabular-nums text-foreground">{dashboard.health.stale}</dd>
                </div>
              </dl>
            </Panel>

            <Panel title="Status dos leads abertos" subtitle="Momento do cliente na conversa">
              <ul className="flex flex-col gap-2 text-sm">
                {(Object.keys(SALES_CONTACT_STATUS_LABELS) as Array<keyof typeof SALES_CONTACT_STATUS_LABELS>).map((status) => (
                  <li key={status} className="flex justify-between">
                    <span className="text-foreground">{SALES_CONTACT_STATUS_LABELS[status]}</span>
                    <span className="tabular-nums text-foreground">{dashboard.health.contactStatus[status]}</span>
                  </li>
                ))}
                <li className="flex justify-between">
                  <span className="text-muted-foreground">Sem status</span>
                  <span className="tabular-nums text-muted-foreground">{dashboard.health.contactStatus.sem_status}</span>
                </li>
              </ul>
            </Panel>

            <Panel title="Motivos de perda" subtitle="Leads perdidos no período">
              {dashboard.lostReasons.length === 0 ? (
                <EmptyPanel message="Nenhum lead perdido no período." />
              ) : (
                <ul className="flex flex-col gap-2 text-sm">
                  {dashboard.lostReasons.map((item) => (
                    <li key={item.reason ?? "none"} className="flex justify-between">
                      <span className="text-foreground">{item.reason ? salesLostReasonLabel(item.reason) : "Sem motivo"}</span>
                      <span className="tabular-nums text-foreground">{item.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}
