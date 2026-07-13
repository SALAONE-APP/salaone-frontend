import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Edit, Loader2, Megaphone, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  createFeatureUpdate,
  deleteFeatureUpdate,
  listFeatureUpdates,
  updateFeatureUpdate,
  type FeatureUpdate,
} from "@/service/featureUpdateService";

const emptyForm = {
  title: "",
  description: "",
  active: true,
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function SuperAdminFeatureUpdatesPage() {
  const [updates, setUpdates] = useState<FeatureUpdate[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const editingUpdate = useMemo(
    () => updates.find((update) => update.id === editingId) ?? null,
    [editingId, updates],
  );

  const loadUpdates = useCallback(async () => {
    setLoading(true);
    try {
      setUpdates(await listFeatureUpdates());
    } catch {
      toast.error("Nao foi possivel carregar as atualizacoes.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUpdates();
  }, [loadUpdates]);

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  function handleEdit(update: FeatureUpdate) {
    setEditingId(update.id);
    setForm({
      title: update.title,
      description: update.description,
      active: update.active,
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.title.trim()) {
      toast.error("Informe o titulo da funcionalidade.");
      return;
    }

    if (!form.description.trim()) {
      toast.error("Informe a descricao da funcionalidade.");
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        await updateFeatureUpdate(editingId, form);
        toast.success("Atualizacao editada.");
      } else {
        await createFeatureUpdate(form);
        toast.success("Atualizacao cadastrada.");
      }

      await loadUpdates();
      resetForm();
    } catch {
      toast.error("Nao foi possivel salvar a atualizacao.");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(update: FeatureUpdate) {
    try {
      await updateFeatureUpdate(update.id, {
        title: update.title,
        description: update.description,
        active: !update.active,
      });
      await loadUpdates();
    } catch {
      toast.error("Nao foi possivel alterar o status.");
    }
  }

  async function handleDelete(update: FeatureUpdate) {
    setRemovingId(update.id);
    try {
      await deleteFeatureUpdate(update.id);
      if (editingId === update.id) resetForm();
      await loadUpdates();
      toast.success("Atualizacao removida.");
    } catch {
      toast.error("Nao foi possivel remover a atualizacao.");
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-primary/20 bg-primary/10 p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Megaphone size={20} />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-foreground">Novas funcionalidades</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Cadastre comunicados que serao exibidos para administradores das barbearias.
            </p>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-[380px_1fr]">
        <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-border bg-card p-5">
          <div>
            <h3 className="text-base font-semibold text-foreground">
              {editingUpdate ? "Editar funcionalidade" : "Cadastrar funcionalidade"}
            </h3>
            <p className="text-sm text-muted-foreground">
              O comunicado ativo aparece no dashboard administrativo.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="feature-title">Titulo</Label>
            <Input
              id="feature-title"
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              placeholder="Ex: Novo painel de lembretes"
              disabled={saving}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="feature-description">Descricao</Label>
            <Textarea
              id="feature-description"
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              placeholder="Explique a novidade de forma objetiva."
              rows={5}
              disabled={saving}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
            <div>
              <Label htmlFor="feature-active">Ativa</Label>
              <p className="text-xs text-muted-foreground">Exibir para administradores.</p>
            </div>
            <Switch
              id="feature-active"
              checked={form.active}
              onCheckedChange={(checked) => setForm((current) => ({ ...current, active: checked }))}
              disabled={saving}
            />
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="submit" className="gap-2" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus size={14} />}
              {saving ? "Salvando" : editingUpdate ? "Salvar alteracoes" : "Cadastrar"}
            </Button>
            {editingUpdate ? (
              <Button type="button" variant="outline" onClick={resetForm} disabled={saving}>
                Cancelar
              </Button>
            ) : null}
          </div>
        </form>

        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <h3 className="text-base font-semibold text-foreground">Atualizacoes cadastradas</h3>
              <p className="text-sm text-muted-foreground">{updates.length} registro(s)</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <th className="px-5 py-3">Funcionalidade</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Criacao</th>
                  <th className="px-5 py-3 text-right">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-muted-foreground">
                      <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                      Carregando...
                    </td>
                  </tr>
                ) : updates.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-muted-foreground">
                      Nenhuma funcionalidade cadastrada.
                    </td>
                  </tr>
                ) : (
                  updates.map((update) => (
                    <tr key={update.id} className="border-b border-border last:border-0 hover:bg-secondary/30">
                      <td className="px-5 py-4">
                        <strong className="block text-foreground">{update.title}</strong>
                        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{update.description}</p>
                      </td>
                      <td className="px-5 py-4">
                        <Badge
                          variant="outline"
                          className={
                            update.active
                              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600"
                              : "border-muted-foreground/20 bg-muted text-muted-foreground"
                          }
                        >
                          {update.active ? "Ativa" : "Inativa"}
                        </Badge>
                      </td>
                      <td className="px-5 py-4 text-muted-foreground">{formatDate(update.createdAt)}</td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <Button type="button" size="sm" variant="outline" onClick={() => void handleToggleActive(update)}>
                            {update.active ? "Inativar" : "Ativar"}
                          </Button>
                          <Button type="button" size="icon" variant="outline" onClick={() => handleEdit(update)}>
                            <Edit size={14} />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            disabled={removingId === update.id}
                            onClick={() => void handleDelete(update)}
                          >
                            {removingId === update.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 size={14} />
                            )}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
