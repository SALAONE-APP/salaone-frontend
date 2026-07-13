import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Boxes,
  Loader2,
  PackageSearch,
  Search,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  createProductStockMovement,
  listProductStockMovements,
  listProducts,
  type Product,
  type ProductStockMovement,
  type ProductStockMovementType,
} from "@/service/productService";

interface StockFormState {
  productId: string;
  type: ProductStockMovementType;
  quantity: string;
  purchasePrice: string;
  salePrice: string;
  occurredAt: string;
  note: string;
}

const emptyForm: StockFormState = {
  productId: "",
  type: "entry",
  quantity: "1",
  purchasePrice: "",
  salePrice: "",
  occurredAt: toLocalDatetimeInputValue(new Date()),
  note: "",
};

function getApiMessage(error: unknown) {
  const responseData = (error as { response?: { data?: unknown } })?.response?.data;

  if (Array.isArray(responseData)) return responseData.join(" ");

  if (responseData && typeof responseData === "object") {
    const message = (responseData as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }

  if (error instanceof Error) return error.message;

  return "Nao foi possivel concluir a operacao.";
}

function formatCurrency(value?: number | null) {
  if (value == null) return "-";

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function parseCurrencyInput(value: string) {
  if (!value.trim()) return null;

  const normalized = value.replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : NaN;
}

function toLocalDatetimeInputValue(date: Date) {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60 * 1000);

  return local.toISOString().slice(0, 16);
}

function getProductCode(product: Product) {
  return product.id.slice(0, 8).toUpperCase();
}

export function StockPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<ProductStockMovement[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [movementSearch, setMovementSearch] = useState("");
  const [movementTypeFilter, setMovementTypeFilter] = useState<"all" | ProductStockMovementType>(
    "all",
  );
  const [form, setForm] = useState<StockFormState>(emptyForm);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingMovements, setLoadingMovements] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === form.productId) ?? null,
    [form.productId, products],
  );

  const filteredProducts = useMemo(() => {
    const search = productSearch.trim().toLowerCase();
    if (!search) return products;

    return products.filter((product) => {
      return (
        product.name.toLowerCase().includes(search) ||
        (product.category ?? "").toLowerCase().includes(search) ||
        getProductCode(product).toLowerCase().includes(search)
      );
    });
  }, [productSearch, products]);

  const stats = useMemo(() => {
    const entries = movements
      .filter((movement) => movement.type === "entry")
      .reduce((sum, movement) => sum + movement.quantity, 0);
    const exits = movements
      .filter((movement) => movement.type === "exit")
      .reduce((sum, movement) => sum + movement.quantity, 0);
    const lowStock = products.filter((product) => product.active && product.stock <= 10).length;

    return {
      totalProducts: products.length,
      lowStock,
      entries,
      exits,
    };
  }, [movements, products]);

  const loadProducts = useCallback(async () => {
    setLoadingProducts(true);

    try {
      const result = await listProducts({ active: true });
      setProducts(result);
      setForm((current) => ({
        ...current,
        productId: current.productId || result[0]?.id || "",
      }));
    } catch (err) {
      setError(getApiMessage(err));
    } finally {
      setLoadingProducts(false);
    }
  }, []);

  const loadMovements = useCallback(async () => {
    setLoadingMovements(true);
    setError(null);

    try {
      const result = await listProductStockMovements({
        q: movementSearch.trim() || undefined,
        type: movementTypeFilter === "all" ? undefined : movementTypeFilter,
        limit: 80,
      });
      setMovements(result);
    } catch (err) {
      setError(getApiMessage(err));
    } finally {
      setLoadingMovements(false);
    }
  }, [movementSearch, movementTypeFilter]);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadMovements();
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [loadMovements]);

  function setField<TField extends keyof StockFormState>(
    field: TField,
    value: StockFormState[TField],
  ) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function validateForm() {
    const quantity = Number(form.quantity);
    const purchasePrice = parseCurrencyInput(form.purchasePrice);
    const salePrice = parseCurrencyInput(form.salePrice);

    if (!form.productId) return "Selecione um produto.";
    if (!Number.isInteger(quantity) || quantity <= 0) {
      return "Informe uma quantidade maior que zero.";
    }
    if (Number.isNaN(purchasePrice)) return "Informe um valor de compra valido.";
    if (Number.isNaN(salePrice)) return "Informe um valor de venda valido.";
    if (!form.occurredAt || Number.isNaN(new Date(form.occurredAt).getTime())) {
      return "Informe data e horario validos.";
    }

    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validationMessage = validateForm();
    if (validationMessage) {
      toast.error(validationMessage);
      return;
    }

    setSaving(true);

    try {
      await createProductStockMovement({
        productId: form.productId,
        type: form.type,
        quantity: Number(form.quantity),
        purchasePrice: parseCurrencyInput(form.purchasePrice),
        salePrice: parseCurrencyInput(form.salePrice),
        occurredAt: new Date(form.occurredAt).toISOString(),
        note: form.note.trim() || null,
      });

      toast.success(form.type === "entry" ? "Entrada registrada." : "Saida registrada.");
      setForm((current) => ({
        ...emptyForm,
        productId: current.productId,
        type: current.type,
        occurredAt: toLocalDatetimeInputValue(new Date()),
      }));
      await Promise.all([loadProducts(), loadMovements()]);
    } catch (err) {
      toast.error(getApiMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="mb-1 text-sm text-muted-foreground">Produtos ativos</p>
          <h3 className="text-2xl font-semibold text-foreground">{stats.totalProducts}</h3>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="mb-1 text-sm text-muted-foreground">Estoque baixo</p>
          <h3 className="text-2xl font-semibold text-foreground">{stats.lowStock}</h3>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="mb-1 text-sm text-muted-foreground">Entradas recentes</p>
          <h3 className="text-2xl font-semibold text-foreground">{stats.entries}</h3>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="mb-1 text-sm text-muted-foreground">Saidas recentes</p>
          <h3 className="text-2xl font-semibold text-foreground">{stats.exits}</h3>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,420px)_1fr]">
        <form
          onSubmit={handleSubmit}
          className="space-y-5 rounded-xl border border-border bg-card p-5"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-medium text-foreground">Registrar movimentacao</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Controle entradas e saidas com data, horario e valores.
              </p>
            </div>
            <Boxes className="h-5 w-5 text-muted-foreground" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="stock-product-search">Produto</Label>
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                size={14}
              />
              <Input
                id="stock-product-search"
                value={productSearch}
                onChange={(event) => setProductSearch(event.target.value)}
                placeholder="Pesquisar por nome, categoria ou codigo..."
                className="pl-9"
              />
            </div>
            <select
              value={form.productId}
              onChange={(event) => setField("productId", event.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
              disabled={loadingProducts || products.length === 0}
            >
              {loadingProducts ? <option>Carregando produtos...</option> : null}
              {!loadingProducts && filteredProducts.length === 0 ? (
                <option value="">Nenhum produto encontrado</option>
              ) : null}
              {filteredProducts.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} - {getProductCode(product)} - estoque {product.stock}
                </option>
              ))}
            </select>
            {selectedProduct ? (
              <div className="rounded-md border border-border bg-secondary/40 p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-foreground">{selectedProduct.name}</span>
                  <Badge variant="secondary">{getProductCode(selectedProduct)}</Badge>
                </div>
                <p className="mt-1 text-muted-foreground">
                  Estoque atual: {selectedProduct.stock} un. | Venda:{" "}
                  {formatCurrency(selectedProduct.price)}
                </p>
              </div>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setField("type", "entry")}
              className={`flex h-10 items-center justify-center gap-2 rounded-md border text-sm font-medium transition-colors ${
                form.type === "entry"
                  ? "border-emerald-500 bg-emerald-500/10 text-emerald-700"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              <ArrowDownToLine className="h-4 w-4" />
              Entrada
            </button>
            <button
              type="button"
              onClick={() => setField("type", "exit")}
              className={`flex h-10 items-center justify-center gap-2 rounded-md border text-sm font-medium transition-colors ${
                form.type === "exit"
                  ? "border-red-500 bg-red-500/10 text-red-700"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              <ArrowUpFromLine className="h-4 w-4" />
              Saida
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="stock-quantity">Quantidade</Label>
              <Input
                id="stock-quantity"
                type="number"
                min={1}
                step={1}
                value={form.quantity}
                onChange={(event) => setField("quantity", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="stock-occurred-at">Data e horario</Label>
              <Input
                id="stock-occurred-at"
                type="datetime-local"
                value={form.occurredAt}
                onChange={(event) => setField("occurredAt", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="stock-purchase-price">Valor de compra</Label>
              <Input
                id="stock-purchase-price"
                value={form.purchasePrice}
                onChange={(event) => setField("purchasePrice", event.target.value)}
                placeholder="0,00"
                inputMode="decimal"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="stock-sale-price">Valor de venda</Label>
              <Input
                id="stock-sale-price"
                value={form.salePrice}
                onChange={(event) => setField("salePrice", event.target.value)}
                placeholder="0,00"
                inputMode="decimal"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="stock-note">Observacao</Label>
            <Textarea
              id="stock-note"
              value={form.note}
              onChange={(event) => setField("note", event.target.value)}
              placeholder="Ex: compra de fornecedor, venda avulsa, ajuste de inventario"
              rows={3}
            />
          </div>

          <Button type="submit" className="w-full gap-2" disabled={saving || loadingProducts}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Boxes className="h-4 w-4" />}
            Registrar
          </Button>
        </form>

        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center lg:justify-between">
            <h3 className="text-base font-medium text-foreground">Historico de estoque</h3>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  size={14}
                />
                <Input
                  value={movementSearch}
                  onChange={(event) => setMovementSearch(event.target.value)}
                  placeholder="Buscar produto..."
                  className="h-9 w-full bg-secondary pl-9 text-sm sm:w-56"
                />
              </div>
              <select
                value={movementTypeFilter}
                onChange={(event) =>
                  setMovementTypeFilter(event.target.value as "all" | ProductStockMovementType)
                }
                className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
              >
                <option value="all">Todos</option>
                <option value="entry">Entradas</option>
                <option value="exit">Saidas</option>
              </select>
            </div>
          </div>

          {error ? (
            <div className="p-6 text-sm text-destructive">{error}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Data
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Produto
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Tipo
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Qtd.
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Compra
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Venda
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Saldo
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loadingMovements ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-sm text-muted-foreground">
                        <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                        Carregando movimentacoes...
                      </td>
                    </tr>
                  ) : movements.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-sm text-muted-foreground">
                        <PackageSearch className="mx-auto mb-2 h-5 w-5" />
                        Nenhuma movimentacao registrada.
                      </td>
                    </tr>
                  ) : (
                    movements.map((movement) => (
                      <tr
                        key={movement.id}
                        className="border-b border-border transition-colors last:border-b-0 hover:bg-secondary/30"
                      >
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-muted-foreground">
                          {formatDateTime(movement.occurredAt)}
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium text-foreground">
                            {movement.productName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            ID {movement.productCode}
                            {movement.note ? ` | ${movement.note}` : ""}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant="outline"
                            className={
                              movement.type === "entry"
                                ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700"
                                : "border-red-500/20 bg-red-500/10 text-red-700"
                            }
                          >
                            {movement.type === "entry" ? "Entrada" : "Saida"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-foreground">
                          {movement.quantity}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {formatCurrency(movement.purchasePrice)}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {formatCurrency(movement.salePrice)}
                        </td>
                        <td className="px-4 py-3 text-sm text-foreground">
                          {movement.stockAfter} un.
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
