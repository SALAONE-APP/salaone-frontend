import { useEffect, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowUp, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  SALES_PIPELINE_TEMPLATES,
  SALES_PRODUCT_LABELS,
  createSalesPipeline,
  deleteSalesPipeline,
  updateSalesPipeline,
  type SalesPipeline,
  type SalesProduct,
  type SalesStageDefinition,
  type SalesTerminalOutcome,
  type StageHasLeadsDetail,
} from "@/service/salesCrmService";

interface Props {
  product: SalesProduct;
  open: boolean;
  onClose: () => void;
  pipelines: SalesPipeline[];
  onChanged: () => void;
}

type ApiError = { response?: { data?: { message?: unknown; code?: unknown; details?: unknown } } };

function extractErrorMessage(error: unknown, fallback: string) {
  const value = (error as ApiError)?.response?.data?.message;
  return typeof value === "string" ? value : fallback;
}

function slugify(label: string) {
  return label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

let tempIdCounter = 0;
function nextTempId() {
  tempIdCounter += 1;
  return `novo-${tempIdCounter}`;
}

type DraftStage = SalesStageDefinition & { draftId: string; isNew: boolean };

function toDraftStages(stages: SalesStageDefinition[], isNew: boolean): DraftStage[] {
  return [...stages]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((stage) => ({ ...stage, draftId: isNew ? nextTempId() : stage.key, isNew }));
}

// A key identifica a etapa para os leads e nunca muda; etapas novas ganham uma
// key derivada do nome, com sufixo quando colidir com outra do mesmo funil.
function assignKeys(stages: DraftStage[]): DraftStage[] {
  const used = new Set(stages.filter((stage) => !stage.isNew).map((stage) => stage.key));
  return stages.map((stage) => {
    if (!stage.isNew) return stage;
    const base = slugify(stage.label) || "etapa";
    let key = base;
    let suffix = 2;
    while (used.has(key)) {
      key = `${base}_${suffix}`;
      suffix += 1;
    }
    used.add(key);
    return { ...stage, key };
  });
}

const OUTCOME_LABELS: Record<SalesTerminalOutcome, string> = {
  ganho: "Venda ganha",
  perdido: "Lead perdido",
};

interface MigrationPrompt {
  pending: StageHasLeadsDetail[];
  targets: SalesStageDefinition[];
  chosen: Record<string, string>;
}

export function SalesPipelineManagerDialog({ product, open, onClose, pipelines, onChanged }: Props) {
  const [mode, setMode] = useState<"list" | "template" | "edit">("list");
  const [editingPipeline, setEditingPipeline] = useState<SalesPipeline | null>(null);
  const [name, setName] = useState("");
  const [stages, setStages] = useState<DraftStage[]>([]);
  const [saving, setSaving] = useState(false);
  const [pipelineToDelete, setPipelineToDelete] = useState<SalesPipeline | null>(null);
  const [migrationPrompt, setMigrationPrompt] = useState<MigrationPrompt | null>(null);

  useEffect(() => {
    if (!open) {
      setMode("list");
      setEditingPipeline(null);
      setPipelineToDelete(null);
      setMigrationPrompt(null);
    }
  }, [open]);

  function selectTemplate(template: (typeof SALES_PIPELINE_TEMPLATES)[number]) {
    setEditingPipeline(null);
    setName("");
    setStages(toDraftStages(template.stages, true));
    setMode("edit");
  }

  function openEdit(pipeline: SalesPipeline) {
    setEditingPipeline(pipeline);
    setName(pipeline.name);
    setStages(toDraftStages(pipeline.stages, false));
    setMode("edit");
  }

  function addStageRow() {
    setStages((prev) => [
      ...prev,
      { draftId: nextTempId(), key: "", label: "", sortOrder: prev.length, isTerminal: false, terminalOutcome: null, isNew: true },
    ]);
  }

  function updateStage(draftId: string, patch: Partial<DraftStage>) {
    setStages((prev) => prev.map((stage) => (stage.draftId === draftId ? { ...stage, ...patch } : stage)));
  }

  function updateStageTerminal(draftId: string, isTerminal: boolean) {
    setStages((prev) =>
      prev.map((stage) =>
        stage.draftId === draftId
          ? { ...stage, isTerminal, terminalOutcome: isTerminal ? stage.terminalOutcome ?? "ganho" : null }
          : stage,
      ),
    );
  }

  function removeStage(draftId: string) {
    setStages((prev) => prev.filter((stage) => stage.draftId !== draftId));
  }

  function moveStage(draftId: string, direction: -1 | 1) {
    setStages((prev) => {
      const index = prev.findIndex((stage) => stage.draftId === draftId);
      const targetIndex = index + direction;
      if (index === -1 || targetIndex < 0 || targetIndex >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
  }

  function validate() {
    if (!name.trim()) return "Dê um nome para o funil.";
    if (stages.length === 0) return "Adicione pelo menos uma etapa.";
    if (stages.some((stage) => !stage.label.trim())) return "Toda etapa precisa de um nome.";
    if (!stages.some((stage) => !stage.isTerminal)) return "O funil precisa de pelo menos uma etapa em andamento.";
    if (!stages.some((stage) => stage.terminalOutcome === "ganho")) return "Marque uma etapa final como venda ganha.";
    if (!stages.some((stage) => stage.terminalOutcome === "perdido")) return "Marque uma etapa final como lead perdido.";
    return null;
  }

  async function save(stageMigrations?: Record<string, string>) {
    const problem = validate();
    if (problem) {
      toast.error(problem);
      return;
    }

    const keyed = assignKeys(stages);
    const payloadStages: SalesStageDefinition[] = keyed.map((stage, index) => ({
      key: stage.key,
      label: stage.label.trim(),
      sortOrder: index,
      isTerminal: stage.isTerminal,
      terminalOutcome: stage.isTerminal ? stage.terminalOutcome : null,
    }));

    setSaving(true);
    try {
      if (editingPipeline) {
        await updateSalesPipeline(editingPipeline.id, { name: name.trim(), stages: payloadStages, stageMigrations });
        toast.success("Funil atualizado.");
      } else {
        await createSalesPipeline(product, { name: name.trim(), stages: payloadStages });
        toast.success("Funil criado.");
      }
      setMigrationPrompt(null);
      onChanged();
      setMode("list");
    } catch (error) {
      const data = (error as ApiError)?.response?.data;
      if (data?.code === "STAGE_HAS_LEADS" && Array.isArray(data.details)) {
        // Etapas removidas ainda tem leads: pede o destino de cada uma e reenvia.
        const pending = data.details as StageHasLeadsDetail[];
        setMigrationPrompt({
          pending,
          targets: payloadStages,
          chosen: Object.fromEntries(pending.map((item) => [item.key, ""])),
        });
      } else {
        toast.error(extractErrorMessage(error, "Não foi possível salvar o funil."));
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleSetDefault(pipeline: SalesPipeline) {
    try {
      await updateSalesPipeline(pipeline.id, { isDefault: true });
      onChanged();
    } catch (error) {
      toast.error(extractErrorMessage(error, "Não foi possível definir como padrão."));
    }
  }

  async function handleDelete() {
    if (!pipelineToDelete) return;
    try {
      await deleteSalesPipeline(pipelineToDelete.id);
      toast.success("Funil excluído.");
      onChanged();
    } catch (error) {
      toast.error(extractErrorMessage(error, "Não foi possível excluir o funil."));
    } finally {
      setPipelineToDelete(null);
    }
  }

  const migrationReady = migrationPrompt ? migrationPrompt.pending.every((item) => migrationPrompt.chosen[item.key]) : false;

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
        <DialogContent className="flex max-h-[85vh] flex-col gap-4 overflow-y-auto sm:max-w-lg">
          {mode === "list" ? (
            <>
              <DialogHeader>
                <DialogTitle>Funis de vendas · {SALES_PRODUCT_LABELS[product]}</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">
                Cada funil é um fluxo independente de prospecção, com as suas próprias etapas.
              </p>

              <div className="flex flex-col gap-2">
                {pipelines.map((pipeline) => (
                  <div key={pipeline.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">{pipeline.name}</span>
                        {pipeline.isDefault && (
                          <Badge variant="secondary" className="text-[10px]">
                            Padrão
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{pipeline.stages.length} etapas</p>
                    </div>
                    <div className="flex items-center gap-1">
                      {!pipeline.isDefault && (
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="Tornar padrão" onClick={() => handleSetDefault(pipeline)}>
                          <Star size={14} />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Editar" onClick={() => openEdit(pipeline)}>
                        <Pencil size={14} />
                      </Button>
                      {pipelines.length > 1 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          title="Excluir"
                          onClick={() => setPipelineToDelete(pipeline)}
                        >
                          <Trash2 size={14} />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <Button variant="outline" className="w-fit gap-2" onClick={() => setMode("template")}>
                <Plus size={14} />
                Novo funil
              </Button>
            </>
          ) : mode === "template" ? (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" className="-ml-1 h-7 w-7" onClick={() => setMode("list")}>
                    <ArrowLeft size={15} />
                  </Button>
                  <DialogTitle>Ponto de partida</DialogTitle>
                </div>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">
                Escolha o modelo mais parecido com o que você precisa — dá para ajustar nome e etapas em seguida.
              </p>
              <div className="flex flex-col gap-2">
                {SALES_PIPELINE_TEMPLATES.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => selectTemplate(template)}
                    className="rounded-lg border border-border p-3 text-left transition-colors hover:border-primary hover:bg-secondary/40"
                  >
                    <span className="block text-sm font-medium text-foreground">{template.name}</span>
                    <span className="block text-xs text-muted-foreground">{template.description}</span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>{editingPipeline ? "Editar funil" : "Novo funil"}</DialogTitle>
              </DialogHeader>

              <div>
                <Label>Nome do funil</Label>
                <Input className="mt-1.5" value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Prospecção ativa" />
              </div>

              <div className="flex flex-col gap-2">
                <Label>Etapas</Label>
                {stages.map((stage, index) => (
                  <div key={stage.draftId} className="flex flex-col gap-2 rounded-lg border border-border p-2.5">
                    <div className="flex items-center gap-1.5">
                      <div className="flex flex-col">
                        <Button variant="ghost" size="icon" className="h-4 w-6" disabled={index === 0} onClick={() => moveStage(stage.draftId, -1)}>
                          <ArrowUp size={12} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-4 w-6"
                          disabled={index === stages.length - 1}
                          onClick={() => moveStage(stage.draftId, 1)}
                        >
                          <ArrowDown size={12} />
                        </Button>
                      </div>
                      <Input
                        value={stage.label}
                        onChange={(event) => updateStage(stage.draftId, { label: event.target.value })}
                        placeholder="Nome da etapa"
                        className="h-8 flex-1 text-sm"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => removeStage(stage.draftId)}
                        title="Remover etapa"
                      >
                        <Trash2 size={13} />
                      </Button>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 pl-8 text-xs">
                      <label className="flex items-center gap-1.5 text-muted-foreground">
                        <Checkbox
                          checked={stage.isTerminal}
                          onCheckedChange={(checked) => updateStageTerminal(stage.draftId, checked === true)}
                        />
                        Etapa final
                      </label>
                      {stage.isTerminal && (
                        <Select
                          value={stage.terminalOutcome ?? undefined}
                          onValueChange={(value) => updateStage(stage.draftId, { terminalOutcome: value as SalesTerminalOutcome })}
                        >
                          <SelectTrigger className="h-7 w-40 text-xs">
                            <SelectValue placeholder="Resultado" />
                          </SelectTrigger>
                          <SelectContent>
                            {(Object.keys(OUTCOME_LABELS) as SalesTerminalOutcome[]).map((outcome) => (
                              <SelectItem key={outcome} value={outcome}>
                                {OUTCOME_LABELS[outcome]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>
                ))}
                <Button variant="outline" size="sm" className="w-fit gap-2" onClick={addStageRow}>
                  <Plus size={13} />
                  Adicionar etapa
                </Button>
                <p className="text-xs text-muted-foreground">
                  O funil precisa de ao menos uma etapa em andamento, uma final de venda ganha e uma final de lead perdido. Se
                  você remover uma etapa que tem leads, vamos pedir para qual etapa movê-los.
                </p>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setMode("list")}>
                  Cancelar
                </Button>
                <Button onClick={() => void save()} disabled={saving}>
                  {saving ? "Salvando..." : "Salvar funil"}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(migrationPrompt)} onOpenChange={(next) => !next && setMigrationPrompt(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mover leads das etapas removidas</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Estas etapas ainda têm leads. Escolha para onde cada grupo deve ir — o histórico do lead registra a mudança.
          </p>
          <div className="flex flex-col gap-3">
            {migrationPrompt?.pending.map((item) => (
              <div key={item.key}>
                <Label>
                  {item.label} · {item.count} lead(s)
                </Label>
                <Select
                  value={migrationPrompt.chosen[item.key] || undefined}
                  onValueChange={(value) =>
                    setMigrationPrompt((prev) => (prev ? { ...prev, chosen: { ...prev.chosen, [item.key]: value } } : prev))
                  }
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Mover para..." />
                  </SelectTrigger>
                  <SelectContent>
                    {migrationPrompt.targets.map((target) => (
                      <SelectItem key={target.key} value={target.key}>
                        {target.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setMigrationPrompt(null)}>
              Cancelar
            </Button>
            <Button disabled={!migrationReady || saving} onClick={() => migrationPrompt && void save(migrationPrompt.chosen)}>
              {saving ? "Salvando..." : "Mover e salvar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(pipelineToDelete)} onOpenChange={(next) => !next && setPipelineToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir funil?</AlertDialogTitle>
            <AlertDialogDescription>
              "{pipelineToDelete?.name}" será removido. Só é possível excluir funis sem nenhum lead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleDelete}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
