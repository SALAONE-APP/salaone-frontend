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
  Edit,
  Image as ImageIcon,
  Loader2,
  MoreHorizontal,
  Plus,
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
import { Button } from "@/components/ui/button";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createGalleryImage,
  deleteGalleryImage,
  listGalleryImages,
  updateGalleryImage,
  type GalleryImage,
} from "@/service/galleryService";
import { uploadImage } from "@/service/uploadService";

interface GalleryFormState {
  url: string;
  alt: string;
  sortOrder: string;
}

const emptyForm: GalleryFormState = {
  url: "",
  alt: "",
  sortOrder: "0",
};

function getApiMessage(error: unknown) {
  const responseData = (error as { response?: { data?: unknown } })?.response?.data;

  if (Array.isArray(responseData)) return responseData.join(" ");

  if (responseData && typeof responseData === "object") {
    const message = (responseData as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }

  if (typeof responseData === "string") return responseData;
  if (error instanceof Error) return error.message;

  return "Nao foi possivel concluir a operacao.";
}

function imageToForm(image: GalleryImage): GalleryFormState {
  return {
    url: image.url,
    alt: image.alt ?? "",
    sortOrder: String(image.sortOrder ?? 0),
  };
}

export function GalleryPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingImage, setEditingImage] = useState<GalleryImage | null>(null);
  const [imageToDelete, setImageToDelete] = useState<GalleryImage | null>(null);
  const [form, setForm] = useState<GalleryFormState>(emptyForm);

  const orderedImages = useMemo(() => {
    return [...images].sort((a, b) => {
      const orderDiff = (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
      if (orderDiff !== 0) return orderDiff;
      return a.id.localeCompare(b.id);
    });
  }, [images]);

  const nextSortOrder = useMemo(() => {
    if (images.length === 0) return 0;
    return Math.max(...images.map((image) => image.sortOrder ?? 0)) + 1;
  }, [images]);

  const loadImages = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await listGalleryImages();
      setImages(result);
    } catch (err) {
      setError(getApiMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadImages();
  }, [loadImages]);

  function setField<TField extends keyof GalleryFormState>(
    field: TField,
    value: GalleryFormState[TField],
  ) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function resetFileInput() {
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function openCreateDialog() {
    setEditingImage(null);
    setForm({ ...emptyForm, sortOrder: String(nextSortOrder) });
    resetFileInput();
    setDialogOpen(true);
  }

  function openEditDialog(image: GalleryImage) {
    setEditingImage(image);
    setForm(imageToForm(image));
    resetFileInput();
    setDialogOpen(true);
  }

  async function handleImageUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);

    try {
      const url = await uploadImage(file);
      setField("url", url);
      toast.success("Foto enviada.");
    } catch (err) {
      toast.error(getApiMessage(err));
    } finally {
      setUploading(false);
      resetFileInput();
    }
  }

  function removeSelectedImage() {
    setField("url", "");
    resetFileInput();
  }

  function validateForm() {
    const sortOrder = Number(form.sortOrder);

    if (!form.url) return "Envie uma foto para a galeria.";
    if (!Number.isInteger(sortOrder) || sortOrder < 0) return "Informe uma ordem valida.";

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
      url: form.url,
      alt: form.alt.trim() || null,
      sortOrder: Number(form.sortOrder),
    };

    setSaving(true);

    try {
      if (editingImage) {
        await updateGalleryImage(editingImage.id, payload);
        toast.success("Foto atualizada.");
      } else {
        await createGalleryImage(payload);
        toast.success("Foto adicionada.");
      }

      setDialogOpen(false);
      await loadImages();
    } catch (err) {
      toast.error(getApiMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!imageToDelete) return;

    try {
      await deleteGalleryImage(imageToDelete.id);
      toast.success("Foto removida.");
      setImageToDelete(null);
      await loadImages();
    } catch (err) {
      toast.error(getApiMessage(err));
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="mb-1 text-sm text-muted-foreground">Fotos cadastradas</p>
          <h3 className="text-2xl font-semibold text-foreground">{images.length}</h3>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 md:col-span-2">
          <p className="mb-1 text-sm text-muted-foreground">Uso</p>
          <h3 className="text-base font-medium text-foreground">
            Gerencie as fotos exibidas na galeria da pagina inicial.
          </h3>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-medium text-foreground">Galeria</h3>
            <p className="text-sm text-muted-foreground">
              Ordene as fotos pelo campo de ordem para controlar a exibicao.
            </p>
          </div>
          <Button size="sm" className="gap-2" onClick={openCreateDialog}>
            <Plus size={14} />
            Adicionar foto
          </Button>
        </div>

        {error ? (
          <div className="p-6 text-sm text-destructive">{error}</div>
        ) : loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
            Carregando galeria...
          </div>
        ) : orderedImages.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 p-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <ImageIcon className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Nenhuma foto cadastrada</p>
              <p className="text-sm text-muted-foreground">
                Adicione imagens para aparecerem na pagina inicial.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {orderedImages.map((image) => (
              <div
                key={image.id}
                className="overflow-hidden rounded-lg border border-border bg-background"
              >
                <div className="aspect-[4/3] bg-muted">
                  <img
                    src={image.url}
                    alt={image.alt || "Foto da galeria"}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="flex items-start justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {image.alt || "Sem descricao"}
                    </p>
                    <p className="text-xs text-muted-foreground">Ordem {image.sortOrder}</p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="p-1 text-muted-foreground transition-colors hover:text-foreground">
                        <MoreHorizontal size={16} />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEditDialog(image)}>
                        <Edit size={14} />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => setImageToDelete(image)}
                      >
                        <Trash2 size={14} />
                        Remover
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <form onSubmit={handleSubmit} className="space-y-5">
            <DialogHeader>
              <DialogTitle>{editingImage ? "Editar foto" : "Adicionar foto"}</DialogTitle>
              <DialogDescription>
                A foto enviada sera exibida na galeria da pagina inicial.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <Label htmlFor="gallery-image-file">Foto</Label>
              <input
                ref={fileInputRef}
                id="gallery-image-file"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
              />
              <div className="flex flex-col gap-3 rounded-md border border-border p-3 sm:flex-row sm:items-center">
                <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
                  {form.url ? (
                    <img
                      src={form.url}
                      alt="Preview da foto"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <ImageIcon className="h-8 w-8 text-muted-foreground" />
                  )}
                </div>
                <div className="flex min-w-0 flex-1 flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={saving || uploading}
                  >
                    {uploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    {form.url ? "Substituir foto" : "Enviar foto"}
                  </Button>
                  {form.url ? (
                    <Button
                      type="button"
                      variant="ghost"
                      className="gap-2 text-muted-foreground"
                      onClick={removeSelectedImage}
                      disabled={saving || uploading}
                    >
                      <X className="h-4 w-4" />
                      Remover foto
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
              <div className="space-y-2">
                <Label htmlFor="gallery-alt">Descricao da foto</Label>
                <Input
                  id="gallery-alt"
                  value={form.alt}
                  onChange={(event) => setField("alt", event.target.value)}
                  placeholder="Ex: Ambiente da barbearia"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gallery-sort-order">Ordem</Label>
                <Input
                  id="gallery-sort-order"
                  type="number"
                  min={0}
                  step={1}
                  value={form.sortOrder}
                  onChange={(event) => setField("sortOrder", event.target.value)}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={saving || uploading}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={saving || uploading}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando
                  </>
                ) : uploading ? (
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
        open={Boolean(imageToDelete)}
        onOpenChange={(open) => {
          if (!open) setImageToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover foto?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta foto deixara de aparecer na galeria da pagina inicial.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
