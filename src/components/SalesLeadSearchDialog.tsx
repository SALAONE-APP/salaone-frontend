import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, MapPin, Search, XCircle } from "lucide-react";
import { toast } from "sonner";

import { SalesLeadImportPreview } from "@/components/SalesLeadImportPreview";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  GOOGLE_MAPS_MAX_PLACES_PER_SEARCH,
  SALES_PRODUCT_LABELS,
  createSalesLeadSearch,
  estimateGoogleMapsSearchCost,
  getSalesLeadSearchBudget,
  importSalesLeadSearch,
  listSalesLeadSearches,
  listSalesScripts,
  previewSalesLeadSearch,
  type SalesLeadImportResult,
  type SalesLeadSearch,
  type SalesLeadSearchBudget,
  type SalesPipeline,
  type SalesProduct,
  type SalesScript,
} from "@/service/salesCrmService";
import { listSuperAdminUsers, type SuperAdminUser } from "@/service/superAdminService";

const POLL_INTERVAL_MS = 5000;
const MIN_PLACES = 10;

function formatUsd(value: number) {
  return `US$ ${value.toFixed(2)}`;
}

function errorMessage(error: unknown, fallback: string) {
  const value = (error as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
  return typeof value === "string" ? value : fallback;
}

// Consumo do credito gratuito do Apify do produto. Tambem e usado no Kanban
// como alerta quando o consumo passa de 80% ou as buscas estao bloqueadas.
export function SalesLeadSearchBudgetAlert({ budget, compact = false }: { budget: SalesLeadSearchBudget | null; compact?: boolean }) {
  if (!budget) return null;

  if (!budget.configured) {
    return compact ? null : (
      <Alert>
        <AlertTriangle />
        <AlertTitle>Integração com o Apify não configurada</AlertTitle>
        <AlertDescription>Cadastre o token da conta do Apify deste produto no servidor para liberar a busca no Google Maps.</AlertDescription>
      </Alert>
    );
  }

  if (compact && budget.level === "ok") return null;

  const cycleEnd = budget.cycleEndAt ? new Date(budget.cycleEndAt).toLocaleDateString("pt-BR") : null;
  const title =
    budget.level === "blocked"
      ? "Buscas no Google Maps bloqueadas: crédito gratuito do Apify esgotado"
      : budget.level === "warning"
        ? "Crédito gratuito do Apify acabando"
        : "Crédito do Apify no mês";

  return (
    <Alert variant={budget.level === "blocked" ? "destructive" : "default"} className={cn(budget.level === "warning" && "border-[hsl(var(--warning))]")}>
      <AlertTriangle className={cn(budget.level === "warning" && "text-[hsl(var(--warning))]")} />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>
        <div className="flex w-full flex-col gap-1.5">
          <Progress value={budget.percent} className="h-2" />
          <span>
            {formatUsd(budget.usedUsd + budget.reservedUsd)} de {formatUsd(budget.limitUsd)} usados ({budget.percent}%)
            {budget.reservedUsd > 0 && ` · ${formatUsd(budget.reservedUsd)} reservados para buscas em andamento`}
            {cycleEnd && ` · renova em ${cycleEnd}`}
          </span>
          {budget.level === "blocked" ? (
            <span>Novas buscas ficam bloqueadas até a renovação do ciclo.</span>
          ) : (
            <span>Cabem até {budget.maxPlacesAffordable} estabelecimentos na próxima busca.</span>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}

const STATUS_BADGES: Record<SalesLeadSearch["status"], { label: string; className: string }> = {
  running: { label: "Buscando…", className: "bg-primary/10 text-primary" },
  succeeded: { label: "Pronta para importar", className: "bg-[hsl(var(--success)/0.15)] text-[hsl(var(--success))]" },
  importing: { label: "Importando…", className: "bg-primary/10 text-primary" },
  imported: { label: "Importada", className: "bg-secondary text-muted-foreground" },
  failed: { label: "Falhou", className: "bg-destructive/15 text-destructive" },
};

interface Props {
  product: SalesProduct;
  pipeline: SalesPipeline | null;
  open: boolean;
  onClose: () => void;
  onImported: () => void;
  onBudgetChange?: (budget: SalesLeadSearchBudget) => void;
}

export function SalesLeadSearchDialog({ product, pipeline, open, onClose, onImported, onBudgetChange }: Props) {
  const [budget, setBudget] = useState<SalesLeadSearchBudget | null>(null);
  const [searches, setSearches] = useState<SalesLeadSearch[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [location, setLocation] = useState("");
  const [maxPlaces, setMaxPlaces] = useState(50);
  const [responsibleId, setResponsibleId] = useState("");
  const [scriptId, setScriptId] = useState("none");
  const [responsibleOptions, setResponsibleOptions] = useState<SuperAdminUser[]>([]);
  const [scriptOptions, setScriptOptions] = useState<SalesScript[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [previewing, setPreviewing] = useState<{ search: SalesLeadSearch; result: SalesLeadImportResult } | null>(null);
  const [loadingPreviewId, setLoadingPreviewId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [nextBudget, nextSearches] = await Promise.all([getSalesLeadSearchBudget(product), listSalesLeadSearches(product)]);
      setBudget(nextBudget);
      setSearches(nextSearches);
      onBudgetChange?.(nextBudget);
    } catch (error) {
      toast.error(errorMessage(error, "Não foi possível consultar as buscas do Google Maps."));
    }
  }, [product, onBudgetChange]);

  useEffect(() => {
    if (!open) {
      setSearchTerm("");
      setLocation("");
      setMaxPlaces(50);
      setResponsibleId("");
      setScriptId("none");
      setPreviewing(null);
      return;
    }
    void refresh();
    listSalesScripts({ product, active: true })
      .then(setScriptOptions)
      .catch(() => null);
    Promise.all([listSuperAdminUsers({ role: "sales_rep", limit: 100 }), listSuperAdminUsers({ role: "super_admin", limit: 100 })])
      .then(([reps, admins]) => setResponsibleOptions([...reps.items, ...admins.items]))
      .catch(() => null);
  }, [open, product, refresh]);

  // Enquanto houver busca rodando, consulta o andamento periodicamente.
  const hasRunning = searches.some((search) => search.status === "running" || search.status === "importing");
  useEffect(() => {
    if (!open || !hasRunning) return;
    const timer = window.setInterval(() => void refresh(), POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [open, hasRunning, refresh]);

  const blocked = !budget || !budget.configured || budget.level === "blocked";
  const maxAllowed = budget?.configured ? budget.maxPlacesAffordable : 0;
  const estimatedCost = estimateGoogleMapsSearchCost(maxPlaces);
  const overBudget = budget?.configured ? maxPlaces > budget.maxPlacesAffordable : true;

  async function handleStart() {
    if (!pipeline) return;
    if (searchTerm.trim().length < 2) {
      toast.error("Informe o que buscar (ex.: barbearia).");
      return;
    }
    if (location.trim().length < 2) {
      toast.error("Informe a cidade (ex.: Fortaleza, CE).");
      return;
    }
    if (!responsibleId) {
      toast.error("Selecione o vendedor responsável pelos leads.");
      return;
    }
    if (scriptId === "none" && scriptOptions.length > 0) {
      toast.error("Selecione o script de abordagem.");
      return;
    }
    if (maxPlaces < MIN_PLACES || maxPlaces > GOOGLE_MAPS_MAX_PLACES_PER_SEARCH) {
      toast.error(`A quantidade deve ficar entre ${MIN_PLACES} e ${GOOGLE_MAPS_MAX_PLACES_PER_SEARCH}.`);
      return;
    }

    setSubmitting(true);
    try {
      await createSalesLeadSearch({
        product,
        pipelineId: pipeline.id,
        responsibleId,
        scriptId: scriptId === "none" ? null : scriptId,
        searchTerm: searchTerm.trim(),
        location: location.trim(),
        maxPlaces,
      });
      toast.success("Busca iniciada. Leva alguns minutos; você pode fechar esta janela e voltar depois.");
      setSearchTerm("");
      await refresh();
    } catch (error) {
      toast.error(errorMessage(error, "Não foi possível iniciar a busca."));
      await refresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePreview(search: SalesLeadSearch) {
    setLoadingPreviewId(search.id);
    try {
      setPreviewing({ search, result: await previewSalesLeadSearch(search.id) });
    } catch (error) {
      toast.error(errorMessage(error, "Não foi possível carregar o resultado da busca."));
    } finally {
      setLoadingPreviewId(null);
    }
  }

  async function handleImport() {
    if (!previewing) return;
    setSubmitting(true);
    try {
      const result = await importSalesLeadSearch(previewing.search.id);
      const skipped = result.duplicates.length + result.invalid.length;
      toast.success(
        `${result.created} ${result.created === 1 ? "lead importado" : "leads importados"} do Google Maps` +
          (skipped > 0 ? ` · ${skipped} ignorados` : "") +
          ".",
      );
      setPreviewing(null);
      onImported();
      await refresh();
    } catch (error) {
      toast.error(errorMessage(error, "Não foi possível importar os leads."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !submitting && onClose()}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-4 overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Buscar leads no Google Maps · {SALES_PRODUCT_LABELS[product]}</DialogTitle>
          <DialogDescription>
            Busca estabelecimentos no Google Maps (com Instagram e e-mail do site, quando houver) e importa como leads no funil{" "}
            {pipeline ? `"${pipeline.name}"` : "ativo"}, com o canal "Google Meu Negócio".
          </DialogDescription>
        </DialogHeader>

        {previewing ? (
          <>
            <p className="text-sm text-muted-foreground">
              Resultado de <strong className="text-foreground">"{previewing.search.searchTerm}"</strong> em {previewing.search.location} · responsável{" "}
              {previewing.search.responsibleName ?? "—"}. Estabelecimentos sem telefone ou já cadastrados neste produto são ignorados.
            </p>
            <SalesLeadImportPreview result={previewing.result} lineLabel="#" />
            {previewing.result.valid === 0 && <p className="text-sm text-destructive">Nenhum estabelecimento novo para importar.</p>}
            <DialogFooter>
              <Button variant="outline" onClick={() => setPreviewing(null)} disabled={submitting}>
                Voltar
              </Button>
              <Button className="gap-2" onClick={() => void handleImport()} disabled={submitting || previewing.result.valid === 0}>
                {submitting && <Loader2 size={14} className="animate-spin" />}
                Importar {previewing.result.valid} {previewing.result.valid === 1 ? "lead" : "leads"}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            {budget ? (
              <SalesLeadSearchBudgetAlert budget={budget} />
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 size={14} className="animate-spin" /> Consultando o crédito do Apify…
              </div>
            )}

            <fieldset disabled={blocked || submitting} className="flex flex-col gap-3 disabled:opacity-60">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <Label>O que buscar</Label>
                  <Input className="mt-1.5" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Ex.: barbearia" maxLength={100} />
                </div>
                <div>
                  <Label>Cidade</Label>
                  <Input className="mt-1.5" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Ex.: Fortaleza, CE" maxLength={150} />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <Label>Quantidade de estabelecimentos</Label>
                  <Input
                    className="mt-1.5"
                    type="number"
                    min={MIN_PLACES}
                    max={Math.max(MIN_PLACES, Math.min(GOOGLE_MAPS_MAX_PLACES_PER_SEARCH, maxAllowed))}
                    step={10}
                    value={maxPlaces}
                    onChange={(e) => setMaxPlaces(Number(e.target.value))}
                  />
                  <p className={cn("mt-1 text-xs", overBudget ? "text-destructive" : "text-muted-foreground")}>
                    Custo estimado: {formatUsd(estimatedCost)}
                    {overBudget && budget?.configured && ` · máximo agora: ${budget.maxPlacesAffordable}`}
                  </p>
                </div>
                <div>
                  <Label>Vendedor responsável</Label>
                  <Select value={responsibleId} onValueChange={setResponsibleId}>
                    <SelectTrigger className="mt-1.5">
                      <SelectValue placeholder="Selecione o vendedor" />
                    </SelectTrigger>
                    <SelectContent>
                      {responsibleOptions.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Script de abordagem</Label>
                <Select value={scriptId === "none" && scriptOptions.length > 0 ? "" : scriptId} onValueChange={setScriptId}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Selecione um script" />
                  </SelectTrigger>
                  <SelectContent>
                    {scriptOptions.length === 0 && <SelectItem value="none">Nenhum</SelectItem>}
                    {scriptOptions.map((script) => (
                      <SelectItem key={script.id} value={script.id}>
                        {script.name} ({script.version})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </fieldset>

            <DialogFooter>
              <Button variant="outline" onClick={onClose} disabled={submitting}>
                Fechar
              </Button>
              <Button className="gap-2" onClick={() => void handleStart()} disabled={blocked || submitting || overBudget || !pipeline}>
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                Buscar
              </Button>
            </DialogFooter>

            {searches.length > 0 && (
              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-medium text-foreground">Buscas recentes</h3>
                <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
                  {searches.map((search) => {
                    const badge = STATUS_BADGES[search.status];
                    return (
                      <li key={search.id} className="flex flex-col gap-2 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="flex items-center gap-1.5 font-medium text-foreground">
                            <MapPin size={14} className="shrink-0 text-muted-foreground" />
                            <span className="truncate">
                              {search.searchTerm} · {search.location}
                            </span>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(search.createdAt).toLocaleString("pt-BR")} · até {search.maxPlaces} locais · {search.responsibleName ?? "—"} ·{" "}
                            {formatUsd(search.costUsd ?? search.estimatedCostUsd)}
                            {search.costUsd === null && " (estimado)"}
                          </p>
                          {search.status === "failed" && search.errorMessage && <p className="text-xs text-destructive">{search.errorMessage}</p>}
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <Badge variant="outline" className={cn("gap-1 border-transparent", badge.className)}>
                            {(search.status === "running" || search.status === "importing") && <Loader2 size={12} className="animate-spin" />}
                            {search.status === "imported" && <CheckCircle2 size={12} />}
                            {search.status === "failed" && <XCircle size={12} />}
                            {search.status === "imported" && search.createdCount !== null ? `${search.createdCount} importados` : badge.label}
                          </Badge>
                          {search.status === "succeeded" && (
                            <Button size="sm" variant="outline" onClick={() => void handlePreview(search)} disabled={loadingPreviewId !== null}>
                              {loadingPreviewId === search.id && <Loader2 size={14} className="animate-spin" />}
                              Ver resultado
                            </Button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
