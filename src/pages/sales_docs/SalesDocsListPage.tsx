import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowDown, ArrowUp, FileText, Loader2, Paperclip, Plus, Search } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useSalesProduct } from "@/hooks/useSalesProduct";
import { SALES_PRODUCT_LABELS } from "@/service/salesCrmService";
import {
  createSalesDoc,
  listSalesDocs,
  reorderSalesDocs,
  SALES_DOC_CATEGORIES,
  SALES_DOC_CATEGORY_LABELS,
  salesDocCategoryLabel,
  type SalesDocCategory,
  type SalesDocSummary,
} from "@/service/salesDocService";

const dateFormat = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

function errorMessage(error: unknown, fallback: string) {
  return (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback;
}

export function SalesDocsListPage() {
  const product = useSalesProduct();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "super_admin";

  const [docs, setDocs] = useState<SalesDocSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<SalesDocCategory | "all">("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState<SalesDocCategory>("comercial");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      setDocs(await listSalesDocs({ product }));
    } catch (error) {
      toast.error(errorMessage(error, "Não foi possível carregar as documentações."));
    } finally {
      setLoading(false);
    }
  }, [product]);

  useEffect(() => {
    void load();
  }, [load]);

  const groups = useMemo(() => {
    const term = search.trim().toLowerCase();
    return SALES_DOC_CATEGORIES.filter((category) => categoryFilter === "all" || categoryFilter === category)
      .map((category) => ({
        category,
        docs: docs
          .filter((doc) => doc.category === category && (!term || doc.title.toLowerCase().includes(term)))
          .sort((a, b) => a.sortOrder - b.sortOrder),
      }))
      .filter((group) => group.docs.length > 0);
  }, [docs, search, categoryFilter]);

  async function handleCreate() {
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      const doc = await createSalesDoc({ product, title: newTitle.trim(), category: newCategory, active: false });
      navigate(`/documentacoes/${product}/${doc.slug}`, { state: { edit: true } });
    } catch (error) {
      toast.error(errorMessage(error, "Não foi possível criar o documento."));
      setCreating(false);
    }
  }

  async function move(category: SalesDocCategory, index: number, direction: -1 | 1) {
    const ordered = docs.filter((doc) => doc.category === category).sort((a, b) => a.sortOrder - b.sortOrder);
    const target = index + direction;
    if (target < 0 || target >= ordered.length) return;
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    const items = ordered.map((doc, position) => ({ id: doc.id, sortOrder: position }));
    const previous = docs;
    setDocs((current) => current.map((doc) => items.find((item) => item.id === doc.id) ? { ...doc, sortOrder: items.find((item) => item.id === doc.id)!.sortOrder } : doc));
    try {
      await reorderSalesDocs(items);
    } catch (error) {
      setDocs(previous);
      toast.error(errorMessage(error, "Não foi possível reordenar."));
    }
  }

  const filtering = search.trim() !== "" || categoryFilter !== "all";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Documentações · {SALES_PRODUCT_LABELS[product]}</h1>
          <p className="text-sm text-muted-foreground">Processos e padrões de execução do time. Consulte antes de executar uma tarefa.</p>
        </div>
        {isSuperAdmin && (
          <Button size="sm" className="gap-2 self-start" onClick={() => setCreateOpen(true)}>
            <Plus size={14} />
            Novo documento
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar documento pelo título" className="pl-9" />
        </div>
        <Select value={categoryFilter} onValueChange={(value) => setCategoryFilter(value as SalesDocCategory | "all")}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            {SALES_DOC_CATEGORIES.map((category) => (
              <SelectItem key={category} value={category}>
                {SALES_DOC_CATEGORY_LABELS[category]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center rounded-xl border border-border bg-card p-16">
          <Loader2 className="animate-spin text-muted-foreground" />
        </div>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-card p-12 text-center">
          <FileText className="text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {filtering ? "Nenhum documento encontrado com esse filtro." : isSuperAdmin ? "Nenhum documento ainda. Crie o primeiro em “Novo documento”." : "Nenhum documento publicado ainda."}
          </p>
        </div>
      ) : (
        groups.map((group) => (
          <section key={group.category} className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{salesDocCategoryLabel(group.category)}</h2>
            <ul className="divide-y divide-border rounded-xl border border-border bg-card">
              {group.docs.map((doc, index) => (
                <li key={doc.id} className="flex items-center gap-2 pr-2">
                  <Link to={`/documentacoes/${product}/${doc.slug}`} className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 hover:bg-muted/50">
                    <FileText size={16} className="shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{doc.title}</span>
                    {doc.attachmentCount > 0 && (
                      <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground" title={`${doc.attachmentCount} anexo(s)`}>
                        <Paperclip size={12} />
                        {doc.attachmentCount}
                      </span>
                    )}
                    {!doc.active && <Badge variant="outline">Rascunho</Badge>}
                    <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">Atualizado em {dateFormat.format(new Date(doc.updatedAt))}</span>
                  </Link>
                  {isSuperAdmin && !filtering && (
                    <div className="flex shrink-0">
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Mover para cima" disabled={index === 0} onClick={() => void move(group.category, index, -1)}>
                        <ArrowUp size={14} />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Mover para baixo" disabled={index === group.docs.length - 1} onClick={() => void move(group.category, index, 1)}>
                        <ArrowDown size={14} />
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      <Dialog open={createOpen} onOpenChange={(open) => !creating && setCreateOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo documento · {SALES_PRODUCT_LABELS[product]}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="doc-title">Título</Label>
              <Input id="doc-title" value={newTitle} onChange={(event) => setNewTitle(event.target.value)} placeholder="Ex.: Processo de Onboarding" maxLength={150} />
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={newCategory} onValueChange={(value) => setNewCategory(value as SalesDocCategory)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SALES_DOC_CATEGORIES.map((category) => (
                    <SelectItem key={category} value={category}>
                      {SALES_DOC_CATEGORY_LABELS[category]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">O documento nasce como rascunho: só você vê até publicar.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>
              Cancelar
            </Button>
            <Button onClick={() => void handleCreate()} disabled={!newTitle.trim() || creating}>
              {creating && <Loader2 size={14} className="mr-2 animate-spin" />}
              Criar e editar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
