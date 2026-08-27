import { useEffect, useMemo, useState } from "react";
import { Loader2, PackagePlus, Search, ShoppingCart } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createWalkInProductSale, listProducts, type Product } from "@/service/productService";

type SaleLine = { product: Product; quantity: number; unitPrice: string };

const methodLabels = { dinheiro: "Dinheiro", pix: "PIX", debito: "Debito", credito: "Credito" } as const;
type WalkInMethod = keyof typeof methodLabels;

function toLocalValue(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function apiMessage(error: unknown) {
  const data = (error as { response?: { data?: { message?: unknown } } })?.response?.data;
  return typeof data?.message === "string" ? data.message : "Nao foi possivel registrar a venda.";
}

function money(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export function WalkInProductSaleDialog({ open, onOpenChange, onSuccess }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void | Promise<void>;
}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [lines, setLines] = useState<SaleLine[]>([]);
  const [search, setSearch] = useState("");
  const [method, setMethod] = useState<WalkInMethod>("dinheiro");
  const [paidAt, setPaidAt] = useState(() => toLocalValue(new Date()));
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    void listProducts({ active: true })
      .then(setProducts)
      .catch((error) => toast.error(apiMessage(error)))
      .finally(() => setLoading(false));
  }, [open]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products.filter((product) => !lines.some((line) => line.product.id === product.id) && (
      !term || product.name.toLowerCase().includes(term) || (product.category || "").toLowerCase().includes(term)
    ));
  }, [lines, products, search]);
  const total = lines.reduce((sum, line) => sum + line.quantity * (Number(line.unitPrice.replace(",", ".")) || 0), 0);

  function addProduct(product: Product) {
    setLines((current) => [...current, { product, quantity: 1, unitPrice: String(product.price) }]);
    setSearch("");
  }

  async function submit() {
    if (!lines.length) return toast.error("Adicione ao menos um produto.");
    if (lines.some((line) => line.quantity < 1 || line.quantity > line.product.stock)) {
      return toast.error("Revise as quantidades: um produto esta sem estoque suficiente.");
    }
    const items = lines.map((line) => ({
      productId: line.product.id,
      quantity: line.quantity,
      unitPrice: Number(line.unitPrice.replace(",", ".")),
    }));
    if (items.some((item) => !Number.isFinite(item.unitPrice) || item.unitPrice < 0)) return toast.error("Revise os valores de venda.");

    setSaving(true);
    try {
      await createWalkInProductSale({ items, method, paidAt: new Date(paidAt).toISOString(), note: note.trim() || undefined });
      toast.success("Venda avulsa registrada no estoque e no caixa.");
      setLines([]); setSearch(""); setMethod("dinheiro"); setNote(""); setPaidAt(toLocalValue(new Date()));
      onOpenChange(false);
      await onSuccess();
    } catch (error) {
      toast.error(apiMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>Registrar venda avulsa</DialogTitle>
        <DialogDescription>Venda para pessoa sem agendamento, com baixa de estoque e entrada imediata no caixa.</DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="walk-in-product">Adicionar produto</Label>
          <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input id="walk-in-product" className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nome ou categoria..." /></div>
          {search && <div className="max-h-40 overflow-y-auto rounded-md border">
            {loading ? <p className="p-3 text-sm text-muted-foreground">Carregando...</p> : filtered.length ? filtered.slice(0, 10).map((product) =>
              <button type="button" key={product.id} onClick={() => addProduct(product)} disabled={product.stock < 1} className="flex w-full items-center justify-between border-b px-3 py-2 text-left text-sm last:border-0 hover:bg-muted disabled:opacity-50">
                <span>{product.name}</span><span className="text-muted-foreground">{money(product.price)} · estoque {product.stock}</span>
              </button>) : <p className="p-3 text-sm text-muted-foreground">Nenhum produto encontrado.</p>}
          </div>}
        </div>
        <div className="space-y-2">
          {lines.length === 0 ? <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground"><ShoppingCart className="mx-auto mb-2 h-5 w-5" />Nenhum produto adicionado.</div> : lines.map((line, index) =>
            <div key={line.product.id} className="grid items-end gap-2 rounded-md border p-3 sm:grid-cols-[1fr_90px_120px_auto]">
              <div><p className="text-sm font-medium">{line.product.name}</p><p className="text-xs text-muted-foreground">Disponivel: {line.product.stock}</p></div>
              <div><Label className="text-xs">Quantidade</Label><Input type="number" min={1} max={line.product.stock} value={line.quantity} onChange={(event) => setLines((current) => current.map((item, i) => i === index ? { ...item, quantity: Number(event.target.value) } : item))} /></div>
              <div><Label className="text-xs">Valor unitario</Label><Input inputMode="decimal" value={line.unitPrice} onChange={(event) => setLines((current) => current.map((item, i) => i === index ? { ...item, unitPrice: event.target.value } : item))} /></div>
              <Button type="button" variant="ghost" onClick={() => setLines((current) => current.filter((_, i) => i !== index))}>Remover</Button>
            </div>)}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2"><Label htmlFor="walk-in-method">Forma de pagamento</Label><select id="walk-in-method" value={method} onChange={(event) => setMethod(event.target.value as WalkInMethod)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">{Object.entries(methodLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
          <div className="space-y-2"><Label htmlFor="walk-in-paid-at">Recebido em</Label><Input id="walk-in-paid-at" type="datetime-local" value={paidAt} onChange={(event) => setPaidAt(event.target.value)} /></div>
        </div>
        <div className="space-y-2"><Label htmlFor="walk-in-note">Observacao</Label><Textarea id="walk-in-note" value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} placeholder="Opcional" /></div>
        <div className="flex justify-between rounded-md bg-muted p-3"><span className="font-medium">Total da venda</span><span className="text-lg font-semibold">{money(total)}</span></div>
      </div>
      <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button><Button type="button" onClick={submit} disabled={saving || loading || !lines.length} className="gap-2">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackagePlus className="h-4 w-4" />}Registrar venda</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
