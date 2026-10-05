import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, Pencil, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { SalesDocAttachments } from "@/components/docs/SalesDocAttachments";
import { SalesDocContent } from "@/components/docs/SalesDocContent";
import { SalesDocEditor } from "@/components/docs/SalesDocEditor";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/useAuth";
import { useSalesProduct } from "@/hooks/useSalesProduct";
import {
  deleteSalesDoc,
  getSalesDocBySlug,
  SALES_DOC_CATEGORIES,
  SALES_DOC_CATEGORY_LABELS,
  salesDocCategoryLabel,
  updateSalesDoc,
  type SalesDoc,
  type SalesDocAttachment,
  type SalesDocCategory,
} from "@/service/salesDocService";

const dateTimeFormat = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });

function errorMessage(error: unknown, fallback: string) {
  return (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback;
}

export function SalesDocPage() {
  const product = useSalesProduct();
  const { slug = "" } = useParams<{ slug: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "super_admin";
  const listHref = `/documentacoes/${product}`;

  const [doc, setDoc] = useState<SalesDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Anexo ja e salvo na hora no servidor; aqui so refletimos na tela, sem mexer no estado de edicao.
  const setAttachments = useCallback((attachments: SalesDocAttachment[]) => setDoc((current) => (current ? { ...current, attachments } : current)), []);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<SalesDocCategory>("outros");
  const [active, setActive] = useState(true);
  const [content, setContent] = useState("");

  const startEditing = useCallback((current: SalesDoc) => {
    setTitle(current.title);
    setCategory(current.category);
    setActive(current.active);
    setContent(current.content);
    setEditing(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    getSalesDocBySlug(product, slug)
      .then((loaded) => {
        if (cancelled) return;
        setDoc(loaded);
        // Documento recem-criado abre direto no editor.
        if (isSuperAdmin && (location.state as { edit?: boolean } | null)?.edit) startEditing(loaded);
      })
      .catch(() => !cancelled && setNotFound(true))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // location.state so importa na primeira carga.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product, slug]);

  const dirty = editing && doc !== null && (title !== doc.title || category !== doc.category || active !== doc.active || content !== doc.content);

  async function handleSave() {
    if (!doc || !title.trim()) return;
    setSaving(true);
    try {
      const updated = await updateSalesDoc(doc.id, { title: title.trim(), category, active, content });
      setDoc(updated);
      setEditing(false);
      toast.success("Documento salvo.");
    } catch (error) {
      toast.error(errorMessage(error, "Não foi possível salvar o documento."));
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    if (dirty && !window.confirm("Descartar as alterações não salvas?")) return;
    setEditing(false);
  }

  async function handleDelete() {
    if (!doc) return;
    try {
      await deleteSalesDoc(doc.id);
      toast.success("Documento excluído.");
      navigate(listHref, { replace: true });
    } catch (error) {
      toast.error(errorMessage(error, "Não foi possível excluir o documento."));
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-border bg-card p-16">
        <Loader2 className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (notFound || !doc) {
    return (
      <div className="space-y-4 rounded-xl border border-dashed border-border bg-card p-12 text-center">
        <p className="text-sm text-muted-foreground">Documento não encontrado.</p>
        <Button asChild variant="outline" size="sm">
          <Link to={listHref}>Voltar para as documentações</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link to={listHref} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft size={14} />
        Documentações
      </Link>

      {editing ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-[1fr_14rem]">
            <div className="space-y-2">
              <Label htmlFor="doc-edit-title">Título</Label>
              <Input id="doc-edit-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={150} />
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={category} onValueChange={(value) => setCategory(value as SalesDocCategory)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SALES_DOC_CATEGORIES.map((item) => (
                    <SelectItem key={item} value={item}>
                      {SALES_DOC_CATEGORY_LABELS[item]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Switch id="doc-active" checked={active} onCheckedChange={setActive} />
            <Label htmlFor="doc-active" className="text-sm">
              {active ? "Publicado: o time comercial consegue ler" : "Rascunho: só você vê"}
            </Label>
          </div>

          <SalesDocEditor initialContent={doc.content} onChange={setContent} />

          <SalesDocAttachments docId={doc.id} attachments={doc.attachments ?? []} editable onChange={setAttachments} />

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleCancel} disabled={saving}>
              Cancelar
            </Button>
            <Button className="gap-2" onClick={() => void handleSave()} disabled={saving || !title.trim() || !dirty}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Salvar
            </Button>
          </div>
        </div>
      ) : (
        <>
          <header className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{salesDocCategoryLabel(doc.category)}</Badge>
                {!doc.active && <Badge variant="outline">Rascunho</Badge>}
              </div>
              <h1 className="text-2xl font-semibold text-foreground">{doc.title}</h1>
              <p className="text-xs text-muted-foreground">
                Atualizado em {dateTimeFormat.format(new Date(doc.updatedAt))}
                {doc.updatedBy ? ` por ${doc.updatedBy.name}` : ""}
              </p>
            </div>
            {isSuperAdmin && (
              <div className="flex gap-2 self-start">
                <Button size="sm" className="gap-2" onClick={() => startEditing(doc)}>
                  <Pencil size={14} />
                  Editar
                </Button>
                <Button size="sm" variant="outline" className="gap-2 text-destructive" onClick={() => setConfirmDelete(true)}>
                  <Trash2 size={14} />
                  Excluir
                </Button>
              </div>
            )}
          </header>
          <SalesDocContent html={doc.content} />
          <SalesDocAttachments docId={doc.id} attachments={doc.attachments ?? []} editable={false} onChange={setAttachments} />
        </>
      )}

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir “{doc.title}”?</AlertDialogTitle>
            <AlertDialogDescription>O documento some para todo o time e não dá para desfazer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleDelete()}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
