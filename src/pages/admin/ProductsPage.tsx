import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import {
  AlertCircle,
  Archive,
  Edit,
  Filter,
  Loader2,
  MoreHorizontal,
  Package,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
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

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import {
  createProduct,
  deleteProduct,
  listProducts,
  reactivateProduct,
  updateProduct,
  type Product,
} from "@/service/productService";
import { uploadImage } from "@/service/uploadService";

type ProductFilter = "all" | "active" | "inactive" | "low" | "out";

interface ProductFormState {
  name: string;
  description: string;
  category: string;
  price: string;
  subscriberDiscount: string;
  imageUrl: string;
  imagePublicId: string | null;
  active: boolean;
}

const emptyForm: ProductFormState = {
  name: "",
  description: "",
  category: "",
  price: "",
  subscriberDiscount: "0",
  imageUrl: "",
  imagePublicId: null,
  active: true,
};

const statusLabels = {
  in: "Em estoque",
  low: "Estoque baixo",
  out: "Sem estoque",
  inactive: "Inativo",
};

const statusStyles = {
  in: "border-emerald-500/20 bg-emerald-500/10 text-emerald-600",
  low: "border-amber-500/20 bg-amber-500/10 text-amber-600",
  out: "border-red-500/20 bg-red-500/10 text-red-600",
  inactive: "border-muted-foreground/20 bg-muted text-muted-foreground",
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

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value || 0);
}

function parseCurrencyInput(value: string) {
  const normalized = value.replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : NaN;
}

function getStockStatus(product: Product): keyof typeof statusLabels {
  if (!product.active) return "inactive";
  if (product.stock <= 0) return "out";
  if (product.stock <= 10) return "low";
  return "in";
}

function productToForm(product: Product): ProductFormState {
  return {
    name: product.name ?? "",
    description: product.description ?? "",
    category: product.category ?? "",
    price: String(product.price ?? ""),
    subscriberDiscount: String(product.subscriberDiscount ?? product.subscriber_discount ?? 0),
    imageUrl: product.imageUrl ?? product.image_url ?? "",
    imagePublicId: product.imagePublicId ?? product.image_public_id ?? null,
    active: product.active !== false,
  };
}

export function ProductsPage() {
  const { user } = useAuth();
  const { can } = usePermissions();
  const isAdmin = user?.isAdmin === true || user?.role === "admin";
  const canCreate = isAdmin || can("addProducts");
  const canEdit = isAdmin || can("editProducts");
  const canManage = isAdmin || can("manageProducts");
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ProductFilter>("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductFormState>(emptyForm);
  const [productToDeactivate, setProductToDeactivate] = useState<Product | null>(null);
  const [productToReactivate, setProductToReactivate] = useState<Product | null>(null);

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const status = getStockStatus(product);

      if (filter === "active" && !product.active) return false;
      if (filter === "inactive" && product.active) return false;
      if (filter === "low" && status !== "low") return false;
      if (filter === "out" && status !== "out") return false;

      return true;
    });
  }, [filter, products]);



  const stats = useMemo(() => {
    const active = products.filter((product) => product.active).length;
    const inactive = products.filter((product) => !product.active).length;
    const low = products.filter((product) => getStockStatus(product) === "low").length;

    return {
      total: products.length,
      active,
      inactive,
      low,
    };
  }, [products]);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await listProducts({
        q: search.trim() || undefined,
      });
      setProducts(result);
    } catch (err) {
      setError(getApiMessage(err));
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadProducts();
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [loadProducts]);

  function setField<TField extends keyof ProductFormState>(
    field: TField,
    value: ProductFormState[TField],
  ) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function openCreateDialog() {
    setEditingProduct(null);
    setForm(emptyForm);
    if (imageInputRef.current) imageInputRef.current.value = "";
    setDialogOpen(true);
  }

  function openEditDialog(product: Product) {
    setEditingProduct(product);
    setForm(productToForm(product));
    if (imageInputRef.current) imageInputRef.current.value = "";
    setDialogOpen(true);
  }

  async function handleImageFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);

    try {
      const image = await uploadImage(file, "products");
      setForm((current) => ({ ...current, imageUrl: image.secure_url, imagePublicId: image.public_id }));
      toast.success("Imagem do produto enviada.");
    } catch (err) {
      toast.error(getApiMessage(err));
    } finally {
      setUploadingImage(false);
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  }

  function removeProductImage() {
    setForm((current) => ({ ...current, imageUrl: "", imagePublicId: null }));
    if (imageInputRef.current) imageInputRef.current.value = "";
  }

  function validateForm() {
    const price = parseCurrencyInput(form.price);
    const subscriberDiscount = Number(form.subscriberDiscount);

    if (!form.name.trim()) return "Informe o nome do produto.";
    if (!Number.isFinite(price) || price <= 0) return "Informe um preco maior que zero.";
    if (
      !Number.isInteger(subscriberDiscount) ||
      subscriberDiscount < 0 ||
      subscriberDiscount > 100
    ) {
      return "O desconto para assinantes deve estar entre 0 e 100.";
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

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      category: form.category.trim() || null,
      price: parseCurrencyInput(form.price),
      subscriberDiscount: Number(form.subscriberDiscount),
      imageUrl: form.imageUrl || null,
      imagePublicId: form.imagePublicId,
      active: form.active,
    };

    setSaving(true);

    try {
      if (editingProduct) {
        await updateProduct(editingProduct.id, payload);
        toast.success("Produto atualizado.");
      } else {
        await createProduct(payload);
        toast.success("Produto cadastrado.");
      }

      setDialogOpen(false);
      await loadProducts();
    } catch (err) {
      toast.error(getApiMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate() {
    if (!productToDeactivate) return;

    try {
      await deleteProduct(productToDeactivate.id);
      toast.success("Produto desativado.");
      setProductToDeactivate(null);
      await loadProducts();
    } catch (err) {
      toast.error(getApiMessage(err));
    }
  }

  async function handleReactivate() {
    if (!productToReactivate) return;

    try {
      await reactivateProduct(productToReactivate.id);
      toast.success("Produto reativado.");
      setProductToReactivate(null);
      await loadProducts();
    } catch (err) {
      toast.error(getApiMessage(err));
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="mb-1 text-sm text-muted-foreground">Produtos cadastrados</p>
          <h3 className="text-2xl font-semibold text-foreground">{stats.total}</h3>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="mb-1 text-sm text-muted-foreground">Ativos</p>
          <h3 className="text-2xl font-semibold text-foreground">{stats.active}</h3>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="mb-1 text-sm text-muted-foreground">Estoque baixo</p>
          <h3 className="text-2xl font-semibold text-foreground">{stats.low}</h3>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="mb-1 text-sm text-muted-foreground">Inativos</p>
          <h3 className="text-2xl font-semibold text-foreground">{stats.inactive}</h3>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center lg:justify-between">
          <h3 className="text-base font-medium text-foreground">Produtos</h3>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                size={14}
              />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar produtos..."
                className="h-9 w-full bg-secondary pl-9 text-sm sm:w-60"
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Filter size={14} />
                  Filtro
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuRadioGroup
                  value={filter}
                  onValueChange={(value) => setFilter(value as ProductFilter)}
                >
                  <DropdownMenuRadioItem value="all">Todos</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="active">Ativos</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="inactive">Inativos</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="low">Estoque baixo</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="out">Sem estoque</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            {canCreate ? (
              <Button size="sm" className="gap-2" onClick={openCreateDialog}>
                <Plus size={14} />
                Adicionar Produto
              </Button>
            ) : null}
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
                    Produto
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Categoria
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Preco
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Estoque
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Desconto
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Status
                  </th>
                  <th className="w-10 px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-sm text-muted-foreground">
                      <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                      Carregando produtos...
                    </td>
                  </tr>
                ) : filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-sm text-muted-foreground">
                      Nenhum produto encontrado.
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((product) => {
                    const status = getStockStatus(product);
                    const imageUrl = product.imageUrl ?? product.image_url;
                    const discount =
                      product.subscriberDiscount ?? product.subscriber_discount ?? 0;

                    return (
                      <tr
                        key={product.id}
                        className="border-b border-border transition-colors last:border-b-0 hover:bg-secondary/30"
                      >

                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg bg-secondary">
                              {imageUrl ? (
                                <img
                                  src={imageUrl}
                                  alt={product.name}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <Package size={18} className="text-muted-foreground" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-foreground">
                                {product.name}
                              </p>
                              <p className="max-w-xs truncate text-xs text-muted-foreground">
                                {product.description || "Sem descricao"}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="secondary" className="text-xs">
                            {product.category || "Sem categoria"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-foreground">
                          {formatCurrency(product.price)}
                        </td>
                        <td className="px-4 py-3 text-sm text-foreground">
                          {product.stock} un.
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {discount}%
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant="outline"
                            className={`rounded-full px-2 py-0.5 text-xs ${statusStyles[status]}`}
                          >
                            {status === "low" ? <AlertCircle size={12} className="mr-1" /> : null}
                            {statusLabels[status]}
                          </Badge>
                        </td>
                        {canEdit || canManage ? (
                          <td className="px-4 py-3">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button className="p-1 text-muted-foreground transition-colors hover:text-foreground">
                                  <MoreHorizontal size={16} />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {canEdit ? (
                                  <DropdownMenuItem onClick={() => openEditDialog(product)}>
                                    <Edit size={14} />
                                    Editar
                                  </DropdownMenuItem>
                                ) : null}
                                {canEdit && canManage ? <DropdownMenuSeparator /> : null}
                                {canManage && product.active ? (
                                  <DropdownMenuItem
                                    variant="destructive"
                                    onClick={() => setProductToDeactivate(product)}
                                  >
                                    <Trash2 size={14} />
                                    Desativar
                                  </DropdownMenuItem>
                                ) : canManage ? (
                                  <DropdownMenuItem onClick={() => setProductToReactivate(product)}>
                                    <RotateCcw size={14} />
                                    Reativar
                                  </DropdownMenuItem>
                                ) : null}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        ) : null}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <form onSubmit={handleSubmit} className="space-y-5">
            <DialogHeader>
              <DialogTitle>
                {editingProduct ? "Editar Produto" : "Adicionar Produto"}
              </DialogTitle>
              <DialogDescription className="sr-only">
                Cadastre produtos vendidos pela salão e controle estoque.
              </DialogDescription>
              <p className="text-sm text-muted-foreground">
                Cadastre os dados do produto. A quantidade deve ser lançada no Controle de Estoque.
              </p>
            </DialogHeader>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="product-name">Nome</Label>
                <Input
                  id="product-name"
                  value={form.name}
                  onChange={(event) => setField("name", event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="product-description">Descricao</Label>
                <Input
                  id="product-description"
                  value={form.description}
                  onChange={(event) => setField("description", event.target.value)}
                  placeholder="Ex: Pomada modeladora matte"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="product-category">Categoria</Label>
                <Input
                  id="product-category"
                  value={form.category}
                  onChange={(event) => setField("category", event.target.value)}
                  placeholder="Ex: Finalizadores"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="product-price">Preco</Label>
                <Input
                  id="product-price"
                  value={form.price}
                  onChange={(event) => setField("price", event.target.value)}
                  placeholder="35,00"
                  inputMode="decimal"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="product-discount">Desconto assinante (%)</Label>
                <Input
                  id="product-discount"
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={form.subscriberDiscount}
                  onChange={(event) => setField("subscriberDiscount", event.target.value)}
                />
              </div>
              <div className="space-y-3 md:col-span-2">
                <Label htmlFor="product-image-file">Foto do produto</Label>
                <input
                  ref={imageInputRef}
                  id="product-image-file"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageFileChange}
                />
                <div className="flex flex-col gap-3 rounded-md border border-border p-3 sm:flex-row sm:items-center">
                  <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
                    {form.imageUrl ? (
                      <img
                        src={form.imageUrl}
                        alt="Foto do produto"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Package className="h-8 w-8 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="gap-2"
                      onClick={() => imageInputRef.current?.click()}
                      disabled={saving || uploadingImage}
                    >
                      {uploadingImage ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4" />
                      )}
                      {form.imageUrl ? "Substituir foto" : "Enviar foto"}
                    </Button>
                    {form.imageUrl ? (
                      <Button
                        type="button"
                        variant="ghost"
                        className="gap-2 text-muted-foreground"
                        onClick={removeProductImage}
                        disabled={saving || uploadingImage}
                      >
                        <X className="h-4 w-4" />
                        Remover foto
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
              <label className="flex items-center gap-2 rounded-md border border-border p-3 text-sm md:col-span-2">
                <Checkbox
                  checked={form.active}
                  onCheckedChange={(checked) => setField("active", checked === true)}
                />
                Produto ativo
              </label>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={saving || uploadingImage}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={saving || uploadingImage}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando
                  </>
                ) : uploadingImage ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando foto
                  </>
                ) : (
                  "Salvar"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(productToDeactivate)}
        onOpenChange={(open) => {
          if (!open) setProductToDeactivate(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar produto?</AlertDialogTitle>
            <AlertDialogDescription>
              O produto {productToDeactivate?.name} ficara inativo, mas o historico sera
              mantido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeactivate}
            >
              <Archive className="mr-2 h-4 w-4" />
              Desativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(productToReactivate)}
        onOpenChange={(open) => {
          if (!open) setProductToReactivate(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reativar produto?</AlertDialogTitle>
            <AlertDialogDescription>
              O produto {productToReactivate?.name} voltara a aparecer como ativo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleReactivate}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Reativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
