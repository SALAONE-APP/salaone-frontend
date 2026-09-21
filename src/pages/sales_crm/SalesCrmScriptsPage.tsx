import { useCallback, useEffect, useState } from "react";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  SALES_CHANNELS,
  createSalesScript,
  deleteSalesScript,
  listSalesScripts,
  salesChannelLabel,
  updateSalesScript,
  type SalesScript,
} from "@/service/salesCrmService";

function extractErrorMessage(error: unknown, fallback: string) {
  const value = (error as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
  return typeof value === "string" ? value : fallback;
}

interface FormState {
  id: string | null;
  name: string;
  version: string;
  channel: string;
  content: string;
  active: boolean;
}

const EMPTY_FORM: FormState = { id: null, name: "", version: "", channel: "none", content: "", active: true };

export function SalesCrmScriptsPage() {
  const [scripts, setScripts] = useState<SalesScript[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [deletingScript, setDeletingScript] = useState<SalesScript | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listSalesScripts();
      setScripts(result);
    } catch {
      setError("Não foi possível carregar os scripts.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setForm(EMPTY_FORM);
    setFormOpen(true);
  }

  function openEdit(script: SalesScript) {
    setForm({
      id: script.id,
      name: script.name,
      version: script.version,
      channel: script.channel ?? "none",
      content: script.content,
      active: script.active,
    });
    setFormOpen(true);
  }

  async function handleSubmit() {
    if (!form.name.trim()) {
      toast.error("Informe o nome do script.");
      return;
    }
    if (!form.version.trim()) {
      toast.error("Informe a versão do script.");
      return;
    }
    if (!form.content.trim()) {
      toast.error("Informe o conteúdo do script.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: form.name.trim(),
        version: form.version.trim(),
        channel: form.channel === "none" ? null : form.channel,
        content: form.content,
        active: form.active,
      };
      if (form.id) {
        await updateSalesScript(form.id, payload);
        toast.success("Script atualizado.");
      } else {
        await createSalesScript(payload);
        toast.success("Script criado.");
      }
      setFormOpen(false);
      void load();
    } catch (error) {
      toast.error(extractErrorMessage(error, "Não foi possível salvar o script."));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleActive(script: SalesScript) {
    try {
      await updateSalesScript(script.id, { active: !script.active });
      void load();
    } catch (error) {
      toast.error(extractErrorMessage(error, "Não foi possível atualizar o script."));
    }
  }

  async function handleDelete() {
    if (!deletingScript) return;
    try {
      await deleteSalesScript(deletingScript.id);
      toast.success("Script excluído.");
      setDeletingScript(null);
      void load();
    } catch (error) {
      toast.error(extractErrorMessage(error, "Não foi possível excluir o script."));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold text-foreground">Scripts de Abordagem</h1>
          <p className="text-sm text-muted-foreground">Roteiros de abordagem versionados, prontos para usar na prospecção.</p>
        </div>
        <Button size="sm" className="gap-2 self-start" onClick={openCreate}>
          <Plus size={14} />
          Novo script
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center rounded-xl border border-border bg-card p-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">{error}</div>
      ) : scripts.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-16 text-center text-sm text-muted-foreground">
          Nenhum script cadastrado ainda.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {scripts.map((script) => (
            <div key={script.id} className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{script.name}</p>
                  <p className="text-xs text-muted-foreground">Versão {script.version}</p>
                </div>
                <Badge variant={script.active ? "default" : "outline"} className="shrink-0 text-[11px]">
                  {script.active ? "Ativo" : "Inativo"}
                </Badge>
              </div>
              {script.channel && (
                <Badge variant="outline" className="w-fit text-[11px]">
                  {salesChannelLabel(script.channel)}
                </Badge>
              )}
              <p className="line-clamp-3 text-xs text-muted-foreground">{script.content}</p>
              <div className="mt-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Switch checked={script.active} onCheckedChange={() => void handleToggleActive(script)} />
                  <span className="text-xs text-muted-foreground">{script.active ? "Ativo" : "Inativo"}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(script)} title="Editar">
                    <Pencil size={14} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:bg-destructive/10"
                    onClick={() => setDeletingScript(script)}
                    title="Excluir"
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="flex max-h-[90vh] flex-col gap-4 overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar script" : "Novo script"}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label>Nome</Label>
              <Input className="mt-1.5" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <Label>Versão</Label>
              <Input
                className="mt-1.5"
                value={form.version}
                onChange={(e) => setForm((f) => ({ ...f, version: e.target.value }))}
                placeholder="Ex.: v1"
              />
            </div>
          </div>

          <div>
            <Label>Canal</Label>
            <Select value={form.channel} onValueChange={(value) => setForm((f) => ({ ...f, channel: value }))}>
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder="Selecione o canal" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {SALES_CHANNELS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {salesChannelLabel(option)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Conteúdo</Label>
            <Textarea
              className="mt-1.5 min-h-48"
              value={form.content}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
              placeholder="Roteiro completo de abordagem..."
            />
          </div>

          <div className="flex items-center gap-2">
            <Switch checked={form.active} onCheckedChange={(checked) => setForm((f) => ({ ...f, active: checked }))} />
            <Label>Script ativo</Label>
          </div>

          <Button onClick={handleSubmit} disabled={submitting} className="w-fit self-end">
            {submitting ? "Salvando..." : "Salvar"}
          </Button>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deletingScript)} onOpenChange={(open) => !open && setDeletingScript(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir script?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação remove permanentemente o script "{deletingScript?.name}" ({deletingScript?.version}). Não pode ser desfeita.
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
    </div>
  );
}
