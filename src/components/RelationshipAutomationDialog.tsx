import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  getPostServiceAutomation,
  savePostServiceAutomation,
  type PostServiceAutomationConfig,
  type RelationshipPipeline,
} from "@/service/relationshipService";
import { listServices } from "@/service/serviceService";

interface Props {
  open: boolean;
  onClose: () => void;
  pipelines: RelationshipPipeline[];
}

function extractErrorMessage(error: unknown, fallback: string) {
  const value = (error as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
  return typeof value === "string" ? value : fallback;
}

const NO_MAPPING = "__none__";

export function RelationshipAutomationDialog({ open, onClose, pipelines }: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [genericPipelineId, setGenericPipelineId] = useState<string | null>(null);
  const [categoryPipelines, setCategoryPipelines] = useState<Record<string, string>>({});
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    Promise.all([getPostServiceAutomation(), listServices({ includeInactive: true, limit: 500 })])
      .then(([automation, servicesResponse]) => {
        setEnabled(automation.enabled);
        setGenericPipelineId(automation.genericPipelineId);
        setCategoryPipelines(automation.categoryPipelines);
        const distinct = Array.from(
          new Set(
            servicesResponse.items
              .map((service) => service.category?.trim())
              .filter((category): category is string => Boolean(category)),
          ),
        ).sort((a, b) => a.localeCompare(b));
        setCategories(distinct);
      })
      .catch((error) => toast.error(extractErrorMessage(error, "Não foi possível carregar a automação.")))
      .finally(() => setLoading(false));
  }, [open]);

  const pipelineById = useMemo(() => new Map(pipelines.map((pipeline) => [pipeline.id, pipeline])), [pipelines]);

  const staleGenericPipeline = genericPipelineId != null && !pipelineById.has(genericPipelineId);
  const staleCategoryMappings = Object.entries(categoryPipelines).filter(([, pipelineId]) => !pipelineById.has(pipelineId));

  function handleCategoryChange(category: string, value: string) {
    setCategoryPipelines((prev) => {
      const next = { ...prev };
      if (value === NO_MAPPING) {
        delete next[category];
      } else {
        next[category] = value;
      }
      return next;
    });
  }

  async function handleSave() {
    if (enabled && !genericPipelineId) {
      toast.error("Selecione um pipeline padrão antes de ativar a automação.");
      return;
    }
    const config: PostServiceAutomationConfig = {
      enabled,
      genericPipelineId,
      categoryPipelines,
    };
    setSaving(true);
    try {
      await savePostServiceAutomation(config);
      toast.success("Automação salva.");
      onClose();
    } catch (error) {
      toast.error(extractErrorMessage(error, "Não foi possível salvar a automação."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-4 overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Automação de pós-atendimento</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Toda vez que um atendimento for concluído, cria automaticamente um card de pós-venda no pipeline configurado
          abaixo — sem isso ligado, nada muda no board hoje.
        </p>

        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : (
          <>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-medium text-foreground">Ativar criação automática</p>
                <p className="text-xs text-muted-foreground">Desligada por padrão.</p>
              </div>
              <Switch checked={enabled} onCheckedChange={setEnabled} disabled={pipelines.length === 0} />
            </div>

            {pipelines.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Crie pelo menos um pipeline em "Gerenciar pipelines" antes de configurar a automação.
              </p>
            )}

            <div>
              <Label>Pipeline padrão (fallback)</Label>
              <p className="mb-1.5 text-xs text-muted-foreground">
                Usado quando o atendimento tem mais de um serviço, ou quando o serviço não tem categoria mapeada.
              </p>
              <Select value={genericPipelineId ?? undefined} onValueChange={setGenericPipelineId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um pipeline" />
                </SelectTrigger>
                <SelectContent>
                  {pipelines.map((pipeline) => (
                    <SelectItem key={pipeline.id} value={pipeline.id}>
                      {pipeline.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {staleGenericPipeline && (
                <p className="mt-1 text-xs text-destructive">
                  O pipeline configurado aqui não existe mais — escolha outro.
                </p>
              )}
            </div>

            {categories.length > 0 && (
              <div className="flex flex-col gap-2">
                <Label>Categorias de serviço</Label>
                {categories.map((category) => {
                  const isStale = categoryPipelines[category] && !pipelineById.has(categoryPipelines[category]);
                  return (
                    <div key={category} className="flex items-center justify-between gap-3 rounded-lg border border-border p-2.5">
                      <span className="text-sm text-foreground">{category}</span>
                      <div className="flex flex-col items-end">
                        <Select
                          value={categoryPipelines[category] ?? NO_MAPPING}
                          onValueChange={(value) => handleCategoryChange(category, value)}
                        >
                          <SelectTrigger className="h-8 w-56 text-xs">
                            <SelectValue placeholder="Sem mapeamento" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NO_MAPPING}>Sem mapeamento (usa o padrão)</SelectItem>
                            {pipelines.map((pipeline) => (
                              <SelectItem key={pipeline.id} value={pipeline.id}>
                                {pipeline.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {isStale && (
                          <span className="mt-1 text-[10px] text-destructive">Pipeline não existe mais</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {staleCategoryMappings.length > 0 && (
              <p className="text-xs text-destructive">
                Alguns mapeamentos apontam para pipelines que não existem mais — ajuste antes de salvar.
              </p>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Salvando..." : "Salvar automação"}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
