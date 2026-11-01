import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Instagram, Loader2, MapPin, Search, XCircle } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  GOOGLE_MAPS_MAX_PLACES_PER_SEARCH,
  GOOGLE_MAPS_MIN_PLACES_PER_SEARCH,
  INSTAGRAM_MAX_PROFILES_PER_SEARCH,
  SALES_PRODUCT_LABELS,
  createInstagramLeadSearch,
  createSalesLeadSearch,
  estimateGoogleMapsSearchCost,
  estimateInstagramSearchCost,
  getSalesLeadSearchBudget,
  importSalesLeadSearch,
  listSalesLeadSearches,
  listSalesScripts,
  parseInstagramUsernamesInput,
  previewSalesLeadSearch,
  type SalesLeadImportResult,
  type SalesLeadSearch,
  type SalesLeadSearchBudget,
  type SalesLeadSearchSource,
  type SalesPipeline,
  type SalesProduct,
  type SalesScript,
} from "@/service/salesCrmService";
import { listSuperAdminUsers, type SuperAdminUser } from "@/service/superAdminService";

const POLL_INTERVAL_MS = 5000;

const SOURCE_LABELS: Record<SalesLeadSearchSource, string> = {
  google_maps: "Google Maps",
  instagram: "Instagram",
};

function formatUsd(value: number) {
  return `US$ ${value.toFixed(2)}`;
}

function errorMessage(error: unknown, fallback: string) {
  const value = (error as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
  return typeof value === "string" ? value : fallback;
}

// Consumo do credito gratuito do Apify do produto (vale para Google Maps e
// Instagram). Tambem e usado no Kanban como alerta quando o consumo passa de 80%
// ou as buscas estao bloqueadas.
export function SalesLeadSearchBudgetAlert({ budget, compact = false }: { budget: SalesLeadSearchBudget | null; compact?: boolean }) {
  if (!budget) return null;

  if (!budget.configured) {
    return compact ? null : (
      <Alert>
        <AlertTriangle />
        <AlertTitle>Integração com o Apify não configurada</AlertTitle>
        <AlertDescription>Cadastre o token da conta do Apify deste produto no servidor para liberar as buscas de leads.</AlertDescription>
      </Alert>
    );
  }

  if (compact && budget.level === "ok") return null;

  const cycleEnd = budget.cycleEndAt ? new Date(budget.cycleEndAt).toLocaleDateString("pt-BR") : null;
  const title =
    budget.level === "blocked"
      ? "Buscas de leads bloqueadas: crédito gratuito do Apify esgotado"
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
            <span>Restam {formatUsd(budget.availableUsd)} para buscas neste mês.</span>
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

function searchTitle(search: SalesLeadSearch) {
  return search.source === "instagram" ? search.searchTerm : `${search.searchTerm} · ${search.location ?? ""}`;
}

interface Props {
  product: SalesProduct;
  pipeline: SalesPipeline | null;
  source: SalesLeadSearchSource;
  open: boolean;
  onClose: () => void;
  onImported: () => void;
  onBudgetChange?: (budget: SalesLeadSearchBudget) => void;
}

export function SalesLeadSearchDialog({ product, pipeline, source, open, onClose, onImported, onBudgetChange }: Props) {
  const isInstagram = source === "instagram";
  const SourceIcon = isInstagram ? Instagram : MapPin;

  const [budget, setBudget] = useState<SalesLeadSearchBudget | null>(null);
  const [searches, setSearches] = useState<SalesLeadSearch[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [location, setLocation] = useState("");
  const [maxPlaces, setMaxPlaces] = useState(GOOGLE_MAPS_MIN_PLACES_PER_SEARCH);
  const [usernamesText, setUsernamesText] = useState("");
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
      setSearches(nextSearches.filter((search) => search.source === source));
      onBudgetChange?.(nextBudget);
    } catch (error) {
      toast.error(errorMessage(error, `Não foi possível consultar as buscas do ${SOURCE_LABELS[source]}.`));
    }
  }, [product, source, onBudgetChange]);

  useEffect(() => {
    if (!open) {
      setSearchTerm("");
      setLocation("");
      setMaxPlaces(GOOGLE_MAPS_MIN_PLACES_PER_SEARCH);
      setUsernamesText("");
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

  const parsedUsernames = useMemo(() => parseInstagramUsernamesInput(usernamesText), [usernamesText]);
  const itemCount = isInstagram ? parsedUsernames.usernames.length : maxPlaces;
  const estimatedCost = isInstagram ? estimateInstagramSearchCost(itemCount) : estimateGoogleMapsSearchCost(itemCount);
  const blocked = !budget || !budget.configured || budget.level === "blocked";
  const overBudget = budget?.configured ? estimatedCost > budget.availableUsd : true;
  const quantityInvalid = isInstagram
    ? itemCount === 0 || itemCount > INSTAGRAM_MAX_PROFILES_PER_SEARCH || parsedUsernames.invalid.length > 0
    : !Number.isInteger(maxPlaces) || maxPlaces < GOOGLE_MAPS_MIN_PLACES_PER_SEARCH || maxPlaces > GOOGLE_MAPS_MAX_PLACES_PER_SEARCH;

  function validateCommon() {
    if (!responsibleId) {
      toast.error("Selecione o vendedor responsável pelos leads.");
      return false;
    }
    if (scriptId === "none" && scriptOptions.length > 0) {
      toast.error("Selecione o script de abordagem.");
      return false;
    }
    return true;
  }

  async function handleStart() {
    if (!pipeline) return;
    const common = { product, pipelineId: pipeline.id, responsibleId, scriptId: scriptId === "none" ? null : scriptId };

    if (isInstagram) {
      if (parsedUsernames.invalid.length > 0) {
        toast.error(`Perfis inválidos: ${parsedUsernames.invalid.slice(0, 5).join(", ")}. Use o @ ou o link do perfil.`);
        return;
      }
      if (itemCount === 0) {
        toast.error("Informe ao menos um perfil do Instagram.");
        return;
      }
      if (itemCount > INSTAGRAM_MAX_PROFILES_PER_SEARCH) {
        toast.error(`Informe no máximo ${INSTAGRAM_MAX_PROFILES_PER_SEARCH} perfis por busca.`);
        return;
      }
    } else {
      if (searchTerm.trim().length < 2) {
        toast.error("Informe o que buscar (ex.: barbearia).");
        return;
      }
      if (location.trim().length < 2) {
        toast.error("Informe a cidade (ex.: Fortaleza, CE).");
        return;
      }
      if (quantityInvalid) {
        toast.error(`A quantidade deve ficar entre ${GOOGLE_MAPS_MIN_PLACES_PER_SEARCH} e ${GOOGLE_MAPS_MAX_PLACES_PER_SEARCH}.`);
        return;
      }
    }
    if (!validateCommon()) return;

    setSubmitting(true);
    try {
      if (isInstagram) {
        await createInstagramLeadSearch({ ...common, usernames: parsedUsernames.usernames });
        setUsernamesText("");
      } else {
        await createSalesLeadSearch({ ...common, searchTerm: searchTerm.trim(), location: location.trim(), maxPlaces });
        setSearchTerm("");
      }
      toast.success("Busca iniciada. Leva alguns minutos; você pode fechar esta janela e voltar depois.");
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
        `${result.created} ${result.created === 1 ? "lead importado" : "leads importados"} do ${SOURCE_LABELS[source]}` +
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
          <DialogTitle>
            Buscar leads no {SOURCE_LABELS[source]} · {SALES_PRODUCT_LABELS[product]}
          </DialogTitle>
          <DialogDescription>
            {isInstagram
              ? "Busca os dados dos perfis do Instagram informados (nome, link da bio e telefone do WhatsApp, quando houver)"
              : "Busca estabelecimentos no Google Maps (com Instagram e e-mail do site, quando houver)"}{" "}
            e importa como leads no funil {pipeline ? `"${pipeline.name}"` : "ativo"}, com o canal "{isInstagram ? "Instagram" : "Google Meu Negócio"}".
          </DialogDescription>
        </DialogHeader>

        {previewing ? (
          <>
            <p className="text-sm text-muted-foreground">
              Resultado de <strong className="text-foreground">{searchTitle(previewing.search)}</strong> · responsável {previewing.search.responsibleName ?? "—"}.{" "}
              {isInstagram
                ? "Perfis já cadastrados neste produto (pelo @ ou telefone) são ignorados. Perfis sem telefone entram mesmo assim, para você completar o telefone no lead."
                : "Estabelecimentos sem telefone ou já cadastrados neste produto são ignorados."}
            </p>
            <SalesLeadImportPreview result={previewing.result} lineLabel="#" />
            {previewing.result.valid === 0 && <p className="text-sm text-destructive">Nenhum lead novo para importar.</p>}
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
              {isInstagram ? (
                <div>
                  <Label>Perfis do Instagram</Label>
                  <Textarea
                    className="mt-1.5 min-h-28 font-mono text-sm"
                    value={usernamesText}
                    onChange={(e) => setUsernamesText(e.target.value)}
                    placeholder={"@barbearia_exemplo\n@salao.exemplo\nhttps://www.instagram.com/loja_exemplo"}
                  />
                  <p className={cn("mt-1 text-xs", quantityInvalid && itemCount > 0 ? "text-destructive" : "text-muted-foreground")}>
                    Um por linha (@ ou link do perfil), até {INSTAGRAM_MAX_PROFILES_PER_SEARCH}. {itemCount} {itemCount === 1 ? "perfil" : "perfis"}
                    {parsedUsernames.invalid.length > 0 && ` · inválidos: ${parsedUsernames.invalid.slice(0, 3).join(", ")}`}
                    {itemCount > 0 && ` · custo estimado: ${formatUsd(estimatedCost)}`}
                  </p>
                </div>
              ) : (
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
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {!isInstagram && (
                  <div>
                    <Label>Quantidade de estabelecimentos</Label>
                    <Input
                      className="mt-1.5"
                      type="number"
                      min={GOOGLE_MAPS_MIN_PLACES_PER_SEARCH}
                      max={GOOGLE_MAPS_MAX_PLACES_PER_SEARCH}
                      step={10}
                      value={maxPlaces}
                      onChange={(e) => setMaxPlaces(Number(e.target.value))}
                    />
                    <p className={cn("mt-1 text-xs", quantityInvalid || overBudget ? "text-destructive" : "text-muted-foreground")}>
                      De {GOOGLE_MAPS_MIN_PLACES_PER_SEARCH} a {GOOGLE_MAPS_MAX_PLACES_PER_SEARCH} · custo estimado: {formatUsd(estimatedCost)}
                    </p>
                  </div>
                )}
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
              </div>
            </fieldset>

            <DialogFooter>
              <Button variant="outline" onClick={onClose} disabled={submitting}>
                Fechar
              </Button>
              <Button className="gap-2" onClick={() => void handleStart()} disabled={blocked || submitting || overBudget || quantityInvalid || !pipeline}>
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
                            <SourceIcon size={14} className="shrink-0 text-muted-foreground" />
                            <span className="truncate">{searchTitle(search)}</span>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(search.createdAt).toLocaleString("pt-BR")} · {isInstagram ? `${search.maxPlaces} perfis` : `até ${search.maxPlaces} locais`} ·{" "}
                            {search.responsibleName ?? "—"} · {formatUsd(search.costUsd ?? search.estimatedCostUsd)}
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
