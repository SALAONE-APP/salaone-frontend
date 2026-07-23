import { useEffect, useMemo, useState } from "react";
import { Loader2, Package, Search, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listProducts, purchaseProduct, type Product } from "@/service/productService";

function currency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function apiMessage(error: unknown) {
  const message = (error as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
  return typeof message === "string" ? message : "Nao foi possivel concluir a compra.";
}

export function ClientProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [buyingId, setBuyingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      setProducts(await listProducts({ active: true }));
    } catch (error) {
      toast.error(apiMessage(error));
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const visible = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("pt-BR");
    return query
      ? products.filter((product) => [product.name, product.category, product.description]
          .some((value) => String(value ?? "").toLocaleLowerCase("pt-BR").includes(query)))
      : products;
  }, [products, search]);

  async function buy(product: Product) {
    if (product.stock <= 0 || buyingId) return;
    setBuyingId(product.id);
    try {
      const result = await purchaseProduct(product.id, 1);
      setProducts((current) => current.map((item) =>
        item.id === product.id ? { ...item, stock: result.stock } : item));
      toast.success(`Pedido realizado. Pague ${currency(result.total)} no salao.`);
    } catch (error) {
      toast.error(apiMessage(error));
      await load();
    } finally {
      setBuyingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-card p-6">
        <h2 className="text-xl font-semibold">Produtos</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Escolha seus produtos e retire no salão após o pagamento.
        </p>
        <div className="relative mt-4 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder="Buscar produto" />
        </div>
      </div>

      {loading ? (
        <div className="grid min-h-52 place-items-center"><Loader2 className="animate-spin text-primary" /></div>
      ) : visible.length === 0 ? (
        <div className="grid min-h-52 place-items-center rounded-xl border border-dashed bg-card text-center">
          <div><Package className="mx-auto text-muted-foreground" /><p className="mt-2 text-sm text-muted-foreground">Nenhum produto ativo encontrado.</p></div>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((product) => (
            <article key={product.id} className="overflow-hidden rounded-xl border bg-card">
              <div className="aspect-[4/3] bg-muted">
                {product.imageUrl || product.image_url ? (
                  <img src={product.imageUrl ?? product.image_url ?? ""} alt={product.name} className="h-full w-full object-cover" />
                ) : <div className="grid h-full place-items-center"><Package size={40} className="text-muted-foreground/50" /></div>}
              </div>
              <div className="space-y-3 p-5">
                <div><p className="text-xs text-muted-foreground">{product.category || "Produto"}</p><h3 className="font-semibold">{product.name}</h3></div>
                {product.description ? <p className="line-clamp-2 text-sm text-muted-foreground">{product.description}</p> : null}
                <div className="flex items-end justify-between gap-3">
                  <div><p className="text-lg font-semibold text-primary">{currency(product.price)}</p><p className="text-xs text-muted-foreground">{product.stock > 0 ? `${product.stock} disponível(is)` : "Sem estoque"}</p></div>
                  <Button onClick={() => void buy(product)} disabled={product.stock <= 0 || buyingId !== null} className="gap-2">
                    {buyingId === product.id ? <Loader2 size={15} className="animate-spin" /> : <ShoppingBag size={15} />}
                    Comprar
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
