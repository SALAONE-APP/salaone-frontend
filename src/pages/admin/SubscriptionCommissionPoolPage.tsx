import { useCallback, useEffect, useMemo, useState } from "react";
import type { DateRange } from "react-day-picker";
import { Loader2, Scissors, Users, FileText } from "lucide-react";
import { toast } from "sonner";

import { AppCalendar } from "@/components/AppCalendar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  getEmployeePayrollSummary,
  type SubscriptionCommissionPool,
} from "@/service/employeePayrollService";
import { getSettings, type SubscriptionBarberRule } from "@/service/settingsService";

function monthRange() {
  const now = new Date();
  return {
    start: toDateInput(new Date(now.getFullYear(), now.getMonth(), 1)),
    end: toDateInput(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  };
}

function toDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateStringToDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return undefined;
  return new Date(year, month - 1, day);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value || 0);
}

function parsePercentInput(value: string) {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return 0;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getApiMessage(error: unknown) {
  const responseData = (error as { response?: { data?: unknown } })?.response?.data;
  if (Array.isArray(responseData)) return responseData.join(" ");
  if (responseData && typeof responseData === "object") {
    const message = (responseData as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  if (error instanceof Error) return error.message;
  return "Nao foi possivel carregar o pote de comissao.";
}

export function SubscriptionCommissionPoolPage() {
  const initialRange = useMemo(monthRange, []);
  const [periodStart, setPeriodStart] = useState(initialRange.start);
  const [periodEnd, setPeriodEnd] = useState(initialRange.end);
  const [subscriptionBarberRule, setSubscriptionBarberRule] =
    useState<SubscriptionBarberRule>("fixed");
  const [pool, setPool] = useState<SubscriptionCommissionPool | null>(null);
  const [loading, setLoading] = useState(true);
  const [customPercentInput, setCustomPercentInput] = useState("50");

  const periodStartDate = dateStringToDate(periodStart);
  const periodEndDate = dateStringToDate(periodEnd);
  const isFreeChoice = subscriptionBarberRule === "free_choice";

  function handlePeriodRangeChange(range?: DateRange) {
    if (range?.from) setPeriodStart(toDateInput(range.from));
    if (range?.to) setPeriodEnd(toDateInput(range.to));
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [settings, summary] = await Promise.all([
        getSettings(),
        getEmployeePayrollSummary({
          periodStart,
          periodEnd,
          role: "barber",
        }),
      ]);

      setSubscriptionBarberRule(settings.subscriptionBarberRule ?? "fixed");
      setPool(summary.subscriptionCommissionPool ?? null);
    } catch (error) {
      toast.error(getApiMessage(error));
    } finally {
      setLoading(false);
    }
  }, [periodEnd, periodStart]);

  useEffect(() => {
    void load();
  }, [load]);

  const distributions = pool?.distributions ?? [];
  const totalRevenue = pool?.revenue ?? 0;
  const customPercent = parsePercentInput(customPercentInput);
  const customPercentLabel = customPercentInput.trim() || "0";
  const customPoolAmount = (totalRevenue * customPercent) / 100;
  const effectivePoolAmount = isFreeChoice ? customPoolAmount : (pool?.commissionPool ?? 0);

  function handleCustomPercentChange(value: string) {
    const normalized = value.replace(/[^\d,.]/g, "");
    const parts = normalized.split(/[,.]/);

    if (parts.length <= 1) {
      setCustomPercentInput(normalized);
      return;
    }

    const decimalSeparator = normalized.includes(",") ? "," : ".";
    setCustomPercentInput(`${parts[0]}${decimalSeparator}${parts.slice(1).join("")}`);
  }

  const handleGenerateReport = useCallback(() => {
    if (!pool) return;
    
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Não foi possível abrir a janela de impressão. Verifique o bloqueador de pop-ups.");
      return;
    }
    
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Relatório - Pote de Comissão de Assinaturas</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
              color: #1a1a1a;
              padding: 40px;
              line-height: 1.5;
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
              border-bottom: 2px solid #eaeaea;
              padding-bottom: 20px;
            }
            .title {
              font-size: 24px;
              font-weight: bold;
              margin: 0;
              color: #111;
            }
            .subtitle {
              font-size: 14px;
              color: #666;
              margin-top: 5px;
            }
            .info-grid {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 20px;
              margin-bottom: 40px;
            }
            .info-card {
              border: 1px solid #eaeaea;
              padding: 15px;
              border-radius: 8px;
              background-color: #fafafa;
            }
            .info-card-label {
              font-size: 12px;
              color: #666;
              text-transform: uppercase;
              font-weight: 500;
            }
            .info-card-value {
              font-size: 20px;
              font-weight: bold;
              margin-top: 5px;
              color: #111;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 20px;
            }
            th, td {
              padding: 12px 15px;
              text-align: left;
              border-bottom: 1px solid #eaeaea;
            }
            th {
              background-color: #f5f5f5;
              font-size: 12px;
              text-transform: uppercase;
              color: #333;
              font-weight: bold;
            }
            td {
              font-size: 14px;
            }
            .text-right {
              text-align: right;
            }
            .font-semibold {
              font-weight: 600;
            }
            .footer {
              margin-top: 50px;
              font-size: 11px;
              color: #999;
              text-align: center;
              border-top: 1px solid #eaeaea;
              padding-top: 20px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 class="title">Relatório de Comissão de Assinaturas</h1>
            <div class="subtitle">Período: ${periodStart.split("-").reverse().join("/")} a ${periodEnd.split("-").reverse().join("/")}</div>
            <div class="subtitle">Regra de Agendamento: ${isFreeChoice ? "Livre Escolha" : "Profissional Fixo"}${isFreeChoice ? ` | Comissão do Pote: ${customPercentLabel}%` : ""}</div>
          </div>
          
          <div class="info-grid">
            <div class="info-card">
              <div class="info-card-label">Faturamento Total</div>
              <div class="info-card-value">${formatCurrency(totalRevenue)}</div>
            </div>
            <div class="info-card">
              <div class="info-card-label">Pote de Comissão (${customPercentLabel}%)</div>
              <div class="info-card-value">${formatCurrency(effectivePoolAmount)}</div>
            </div>
            <div class="info-card">
              <div class="info-card-label">Atendimentos</div>
              <div class="info-card-value">${pool.totalAppointments ?? 0}</div>
            </div>
            <div class="info-card">
              <div class="info-card-label">Pontos Considerados</div>
              <div class="info-card-value">${pool.totalPoints ?? 0}</div>
            </div>
          </div>
          
          <h2>Distribuição por Profissional</h2>
          <table>
            <thead>
              <tr>
                <th>Profissional</th>
                <th class="text-right">Faturamento Individual</th>
                <th class="text-right">Atendimentos</th>
                <th class="text-right">Pontos</th>
                <th class="text-right">Participação</th>
                <th class="text-right">Comissão Final</th>
              </tr>
            </thead>
            <tbody>
              ${distributions.map(item => `
                <tr>
                  <td class="font-semibold">${item.barberName ?? "Profissional"}</td>
                  <td class="text-right">${formatCurrency(item.revenue)}</td>
                  <td class="text-right">${item.appointments}</td>
                  <td class="text-right">${item.points}</td>
                  <td class="text-right">${item.participationPercent.toFixed(2)}%</td>
                  <td class="text-right font-semibold">${formatCurrency(isFreeChoice ? (effectivePoolAmount * item.participationPercent) / 100 : item.commissionAmount)}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
          
          <div class="footer">
            Relatório gerado em ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")} | SalaOne
          </div>
          
          <script>
            window.onload = function() {
              window.print();
            }
          </script>
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  }, [pool, customPercentLabel, effectivePoolAmount, isFreeChoice, periodStart, periodEnd, totalRevenue, distributions]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-foreground">Pote de comissao de assinaturas</h3>
            <Badge variant={isFreeChoice ? "default" : "secondary"}>
              {isFreeChoice ? "Livre escolha" : "Profissional fixo"}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Esta tela mostra apenas comissoes de assinaturas. Servicos avulsos ficam em Pagamento Funcionario.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <AppCalendar
            mode="range"
            rangeValue={{ from: periodStartDate, to: periodEndDate }}
            onRangeChange={handlePeriodRangeChange}
            placeholder="Periodo"
            className="h-9 rounded-md text-sm sm:w-64"
          />
          <Button variant="outline" size="sm" onClick={() => void load()}>
            Atualizar
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center rounded-xl border border-border bg-card py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-1.5">
              <label htmlFor="customPercent" className="text-sm font-medium text-foreground">
                Porcentagem de comissao (%)
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex items-center">
                  <input
                    id="customPercent"
                    type="text"
                    inputMode="decimal"
                    value={customPercentInput}
                    onChange={(e) => handleCustomPercentChange(e.target.value)}
                    className="h-9 w-24 rounded-md border border-input bg-background pl-3 pr-6 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                  <span className="absolute right-2 text-muted-foreground text-sm font-medium pointer-events-none">%</span>
                </div>
                <span className="text-xs text-muted-foreground">do faturamento total acumulado no pote</span>
              </div>
              {!isFreeChoice && (
                <p className="text-xs text-muted-foreground">
                  No modo profissional fixo, a comissao usa o percentual configurado no servico/profissional.
                </p>
              )}
            </div>
            
            <Button
              onClick={handleGenerateReport}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <FileText size={16} />
              Gerar Relatorio
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-border bg-card p-5">
              <p className="text-sm text-muted-foreground">Faturamento de assinaturas</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">
                {formatCurrency(totalRevenue)}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-5">
              <p className="text-sm text-muted-foreground">
                {isFreeChoice ? `Pote de comissao (${customPercentLabel}%)` : "Comissao de assinaturas"}
              </p>
              <p className="mt-1 text-2xl font-semibold text-foreground">
                {formatCurrency(effectivePoolAmount)}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-5">
              <p className="text-sm text-muted-foreground">Atendimentos considerados</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">
                {pool?.totalAppointments ?? 0}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-5">
              <p className="text-sm text-muted-foreground">Pontos considerados</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">
                {pool?.totalPoints ?? 0}
              </p>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="flex items-center gap-2 border-b border-border p-4">
              <Users size={18} className="text-primary" />
              <h3 className="text-base font-medium text-foreground">Distribuicao por profissional</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Profissional
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Faturamento
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Atendimentos
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Pontos
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Participacao
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Comissao final
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {distributions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-muted-foreground">
                        <Scissors className="mx-auto mb-2 h-5 w-5" />
                        Nenhum atendimento coberto por plano encontrado no periodo.
                      </td>
                    </tr>
                  ) : (
                    distributions.map((item) => (
                      <tr key={item.employeeId} className="border-b border-border last:border-b-0">
                        <td className="px-4 py-3 font-medium text-foreground">
                          {item.barberName ?? "Profissional"}
                        </td>
                        <td className="px-4 py-3 text-right text-muted-foreground">
                          {formatCurrency(item.revenue)}
                        </td>
                        <td className="px-4 py-3 text-right text-muted-foreground">
                          {item.appointments}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-foreground">
                          {item.points}
                        </td>
                        <td className="px-4 py-3 text-right text-muted-foreground">
                          {item.participationPercent.toFixed(2)}%
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-foreground">
                          {formatCurrency(isFreeChoice ? (effectivePoolAmount * item.participationPercent) / 100 : item.commissionAmount)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
