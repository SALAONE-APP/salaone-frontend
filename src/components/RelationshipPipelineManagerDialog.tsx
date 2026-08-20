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
  PIPELINE_TEMPLATES,
  createRelationshipPipeline,
  deleteRelationshipPipeline,
  updateRelationshipPipeline,
  type RelationshipCard,
  type RelationshipPipeline,
  type RelationshipPipelineTemplate,
  type RelationshipStageDefinition,
} from "@/service/relationshipService";

interface Props {
  open: boolean;
  onClose: () => void;
  pipelines: RelationshipPipeline[];
  activePipelineId: string | null;
  cardsInActivePipeline: RelationshipCard[];
  onChanged: () => void;
}

function extractErrorMessage(error: unknown, fallback: string) {
  const value = (error as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
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

type DraftStage = RelationshipStageDefinition & { draftId: string; isNew: boolean };

function toDraftStages(stages: RelationshipStageDefinition[]): DraftStage[] {
  return stages.map((stage) => ({ ...stage, draftId: stage.key, isNew: false }));
}

export function RelationshipPipelineManagerDialog({
  open,
  onClose,
  pipelines,
  activePipelineId,
  cardsInActivePipeline,
  onChanged,
}: Props) {
  const [mode, setMode] = useState<"list" | "template" | "edit">("list");
  const [editingPipeline, setEditingPipeline] = useState<RelationshipPipeline | null>(null);
  const [name, setName] = useState("");
  const [stages, setStages] = useState<DraftStage[]>([]);
  const [saving, setSaving] = useState(false);
  const [pipelineToDelete, setPipelineToDelete] = useState<RelationshipPipeline | null>(null);

  useEffect(() => {
    if (!open) {
      setMode("list");
      setEditingPipeline(null);
      setPipelineToDelete(null);
    }
  }, [open]);

  function selectTemplate(template: RelationshipPipelineTemplate) {
    setEditingPipeline(null);
    setName(template.name === "Padrão" ? "" : template.name);
    setStages(toDraftStages(template.stages).map((stage) => ({ ...stage, isNew: true, draftId: nextTempId() })));
    setMode("edit");
  }

  function openEdit(pipeline: RelationshipPipeline) {
    setEditingPipeline(pipeline);
    setName(pipeline.name);
    setStages(toDraftStages([...pipeline.stages].sort((a, b) => a.sortOrder - b.sortOrder)));
    setMode("edit");
  }

  function addStageRow() {
    setStages((prev) => [
      ...prev,
      {
        draftId: nextTempId(),
        key: "",
        label: "",
        sortOrder: prev.length,
        isTerminal: false,
        terminalOutcome: null,
        isNew: true,
      },
    ]);
  }

  function updateStageLabel(draftId: string, label: string) {
    setStages((prev) =>
      prev.map((stage) => (stage.draftId === draftId ? { ...stage, label, key: stage.isNew ? slugify(label) : stage.key } : stage)),
    );
  }

  function updateStageTerminal(draftId: string, isTerminal: boolean) {
    setStages((prev) =>
      prev.map((stage) =>
        stage.draftId === draftId
          ? { ...stage, isTerminal, terminalOutcome: isTerminal ? stage.terminalOutcome ?? "recuperado" : null }
          : stage,
      ),
    );
  }

  function updateStageOutcome(draftId: string, terminalOutcome: "recuperado" | "encerrado") {
    setStages((prev) => prev.map((stage) => (stage.draftId === draftId ? { ...stage, terminalOutcome } : stage)));
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

  const stageCountInUse = (key: string) => cardsInActivePipeline.filter((card) => card.stage === key).length;

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Dê um nome para o pipeline.");
      return;
    }
    if (stages.length === 0) {
      toast.error("Adicione pelo menos uma etapa.");
      return;
    }
    for (const stage of stages) {
      if (!stage.label.trim()) {
        toast.error("Toda etapa precisa de um nome.");
        return;
      }
      if (stage.isTerminal && !stage.terminalOutcome) {
        toast.error(`Escolha o resultado da etapa "${stage.label}".`);
        return;
      }
    }
    const keys = stages.map((stage) => stage.key);
    if (new Set(keys).size !== keys.length) {
      toast.error("Duas etapas ficaram com o mesmo identificador. Ajuste os nomes para que fiquem diferentes.");
      return;
    }

    const payloadStages: RelationshipStageDefinition[] = stages.map((stage, index) => ({
      key: stage.key,
      label: stage.label.trim(),
      sortOrder: index,
      isTerminal: stage.isTerminal,
      terminalOutcome: stage.isTerminal ? stage.terminalOutcome : null,
    }));

    setSaving(true);
    try {
      if (editingPipeline) {
        await updateRelationshipPipeline(editingPipeline.id, { name: name.trim(), stages: payloadStages });
        toast.success("Pipeline atualizado.");
      } else {
        await createRelationshipPipeline({ name: name.trim(), stages: payloadStages });
        toast.success("Pipeline criado.");
      }
      onChanged();
      setMode("list");
    } catch (error) {
      toast.error(extractErrorMessage(error, "Não foi possível salvar o pipeline."));
    } finally {
      setSaving(false);
    }
  }

  async function handleSetDefault(pipeline: RelationshipPipeline) {
    try {
      await updateRelationshipPipeline(pipeline.id, { isDefault: true });
      onChanged();
    } catch (error) {
      toast.error(extractErrorMessage(error, "Não foi possível definir como padrão."));
    }
  }

  async function handleDelete() {
    if (!pipelineToDelete) return;
    try {
      await deleteRelationshipPipeline(pipelineToDelete.id);
      toast.success("Pipeline excluído.");
      onChanged();
    } catch (error) {
      toast.error(extractErrorMessage(error, "Não foi possível excluir o pipeline."));
    } finally {
      setPipelineToDelete(null);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
        <DialogContent className="flex max-h-[85vh] flex-col gap-4 overflow-y-auto sm:max-w-lg">
          {mode === "list" ? (
            <>
              <DialogHeader>
                <DialogTitle>Pipelines de relacionamento</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">
                Cada pipeline é um fluxo independente de acompanhamento, com suas próprias etapas.
              </p>

              <div className="flex flex-col gap-2">
                {pipelines.map((pipeline) => (
                  <div
                    key={pipeline.id}
                    className="flex items-center justify-between rounded-lg border border-border p-3"
                  >
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
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="Tornar padrão"
                          onClick={() => handleSetDefault(pipeline)}
                        >
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
                Novo pipeline
              </Button>
            </>
          ) : mode === "template" ? (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" className="h-7 w-7 -ml-1" onClick={() => setMode("list")}>
                    <ArrowLeft size={15} />
                  </Button>
                  <DialogTitle>Ponto de partida</DialogTitle>
                </div>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">
                Escolha o modelo mais parecido com o que você precisa — dá pra ajustar nome e etapas depois.
              </p>
              <div className="flex flex-col gap-2">
                {PIPELINE_TEMPLATES.map((template) => (
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
                <DialogTitle>{editingPipeline ? "Editar pipeline" : "Novo pipeline"}</DialogTitle>
              </DialogHeader>

              <div>
                <Label>Nome do pipeline</Label>
                <Input className="mt-1.5" value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Recuperação de clientes" />
              </div>

              <div className="flex flex-col gap-2">
                <Label>Etapas</Label>
                {stages.map((stage, index) => (
                  <div key={stage.draftId} className="flex flex-col gap-2 rounded-lg border border-border p-2.5">
                    <div className="flex items-center gap-1.5">
                      <div className="flex flex-col">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-4 w-6"
                          disabled={index === 0}
                          onClick={() => moveStage(stage.draftId, -1)}
                        >
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
                        onChange={(event) => updateStageLabel(stage.draftId, event.target.value)}
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
                          onValueChange={(value) => updateStageOutcome(stage.draftId, value as "recuperado" | "encerrado")}
                        >
                          <SelectTrigger className="h-7 w-40 text-xs">
                            <SelectValue placeholder="Resultado" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="recuperado">Cliente recuperado</SelectItem>
                            <SelectItem value="encerrado">Caso encerrado</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                      {!stage.isNew && stageCountInUse(stage.key) > 0 && (
                        <span className="text-muted-foreground">{stageCountInUse(stage.key)} card(s) aqui hoje</span>
                      )}
                    </div>
                  </div>
                ))}
                <Button variant="outline" size="sm" className="w-fit gap-2" onClick={addStageRow}>
                  <Plus size={13} />
                  Adicionar etapa
                </Button>
                {editingPipeline && editingPipeline.id !== activePipelineId && (
                  <p className="text-xs text-muted-foreground">
                    Este não é o pipeline aberto agora — se ele já tiver cards, remover uma etapa pode escondê-los até você
                    adicioná-la de volta aqui.
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setMode("list")}>
                  Cancelar
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? "Salvando..." : "Salvar pipeline"}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(pipelineToDelete)} onOpenChange={(next) => !next && setPipelineToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir pipeline?</AlertDialogTitle>
            <AlertDialogDescription>
              "{pipelineToDelete?.name}" será removido. Só é possível excluir pipelines sem nenhum card.
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
