import { useEffect, useRef, useState } from "react";
import { Download, FileUp, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { SalesLeadImportPreview } from "@/components/SalesLeadImportPreview";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import {
  SALES_CHANNELS,
  SALES_PRODUCT_LABELS,
  buildSalesLeadCsvTemplate,
  importSalesLeadsCsv,
  listSalesScripts,
  salesChannelLabel,
  type SalesChannel,
  type SalesLeadImportResult,
  type SalesPipeline,
  type SalesProduct,
  type SalesScript,
} from "@/service/salesCrmService";
import { listSuperAdminUsers, type SuperAdminUser } from "@/service/superAdminService";

interface Props {
  product: SalesProduct;
  pipeline: SalesPipeline | null;
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}

const MAX_FILE_BYTES = 2 * 1024 * 1024;

// "Outro" exigiria descrever o canal em cada linha; quem precisa disso usa a coluna canal_outro.
const DEFAULT_CHANNEL_OPTIONS = SALES_CHANNELS.filter((channel) => channel !== "outro");

function importErrorMessage(error: unknown) {
  const response = (error as { response?: { status?: number; data?: { message?: unknown } } })?.response;
  const message = typeof response?.data?.message === "string" ? response.data.message : null;
  switch (response?.status) {
    case 413:
      return "O arquivo deve ter no máximo 2 MB.";
    case 415:
      return message ?? "Formato inválido. Envie um arquivo .csv.";
    case 403:
      return message ?? "Você não tem permissão para importar leads com esses parâmetros.";
    case 400:
      return message ?? "Não foi possível ler o arquivo. Confira se ele segue o modelo CSV.";
    default:
      return message ?? "Não foi possível importar os leads. Tente novamente.";
  }
}

export function SalesLeadImportDialog({ product, pipeline, open, onClose, onImported }: Props) {
  const { user } = useAuth();
  const isSalesRep = user?.role === "sales_rep";
  const userId = user?.id;

  const [file, setFile] = useState<File | null>(null);
  const [responsibleId, setResponsibleId] = useState("");
  const [scriptId, setScriptId] = useState("none");
  const [defaultChannel, setDefaultChannel] = useState<SalesChannel | "">("");
  const [responsibleOptions, setResponsibleOptions] = useState<SuperAdminUser[]>([]);
  const [scriptOptions, setScriptOptions] = useState<SalesScript[]>([]);
  const [preview, setPreview] = useState<SalesLeadImportResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setFile(null);
      setScriptId("none");
      setDefaultChannel("");
      setPreview(null);
      setResponsibleId(isSalesRep && userId ? userId : "");
      return;
    }

    setResponsibleId(isSalesRep && userId ? userId : "");

    listSalesScripts({ product, active: true })
      .then(setScriptOptions)
      .catch(() => null);

    if (!isSalesRep) {
      Promise.all([
        listSuperAdminUsers({ role: "sales_rep", limit: 100 }),
        listSuperAdminUsers({ role: "super_admin", limit: 100 }),
      ])
        .then(([reps, admins]) => setResponsibleOptions([...reps.items, ...admins.items]))
        .catch(() => null);
    }
  }, [open, isSalesRep, userId, product]);

  function handleDownloadTemplate() {
    const url = URL.createObjectURL(buildSalesLeadCsvTemplate(product));
    const link = document.createElement("a");
    link.href = url;
    link.download = `modelo-leads-${product}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function handleFileChange(next: File | null) {
    setPreview(null);
    if (!next) {
      setFile(null);
      return;
    }
    if (!/\.csv$/i.test(next.name)) {
      toast.error("Envie um arquivo .csv.");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    if (next.size > MAX_FILE_BYTES) {
      toast.error("O arquivo deve ter no máximo 2 MB.");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setFile(next);
  }

  function buildParams() {
    return {
      product,
      pipelineId: pipeline?.id,
      responsibleId,
      scriptId: scriptId === "none" ? null : scriptId,
      defaultChannel: defaultChannel as SalesChannel,
    };
  }

  async function handlePreview() {
    if (!pipeline) return;
    if (!file) {
      toast.error("Selecione o arquivo .csv.");
      return;
    }
    if (!responsibleId) {
      toast.error("Selecione o vendedor responsável.");
      return;
    }
    if (scriptId === "none" && scriptOptions.length > 0) {
      toast.error("Selecione o script de abordagem.");
      return;
    }
    if (!defaultChannel) {
      toast.error("Selecione o canal padrão.");
      return;
    }

    setSubmitting(true);
    try {
      setPreview(await importSalesLeadsCsv(buildParams(), file, true));
    } catch (error) {
      toast.error(importErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleImport() {
    if (!file || !preview || preview.valid === 0) return;
    setSubmitting(true);
    try {
      const result = await importSalesLeadsCsv(buildParams(), file, false);
      const skipped = result.duplicates.length + result.invalid.length;
      toast.success(
        `${result.created} ${result.created === 1 ? "lead importado" : "leads importados"}` +
          (skipped > 0 ? ` · ${skipped} ${skipped === 1 ? "linha ignorada" : "linhas ignoradas"}` : "") +
          ".",
      );
      onImported();
      onClose();
    } catch (error) {
      toast.error(importErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !submitting && onClose()}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-4 overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar leads · {SALES_PRODUCT_LABELS[product]}</DialogTitle>
          <DialogDescription>
            Os leads entram na primeira etapa do funil {pipeline ? `"${pipeline.name}"` : "ativo"}. Telefones já cadastrados neste produto ou repetidos no arquivo são ignorados.
          </DialogDescription>
        </DialogHeader>

        {!preview ? (
          <>
            <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label htmlFor="sales-lead-csv">Arquivo .csv</Label>
                <Button type="button" variant="link" size="sm" className="h-auto gap-1 p-0" onClick={handleDownloadTemplate}>
                  <Download size={14} />
                  Baixar modelo CSV
                </Button>
              </div>
              <Input
                id="sales-lead-csv"
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={(event) => handleFileChange(event.target.files?.[0] ?? null)}
              />
              <p className="text-xs text-muted-foreground">
                Colunas obrigatórias: nome_contato e telefone. Até 1000 linhas e 2 MB. No Excel, salve como "CSV UTF-8" ou "CSV (separado por ponto e vírgula)".
              </p>
            </div>

            <div>
              <Label>Vendedor responsável</Label>
              {isSalesRep ? (
                <Input className="mt-1.5" value={user?.name ?? ""} disabled />
              ) : (
                <Select value={responsibleId} onValueChange={setResponsibleId}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Selecione o vendedor" />
                  </SelectTrigger>
                  <SelectContent>
                    {responsibleOptions.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label>Script de abordagem</Label>
                <Select value={scriptId === "none" && scriptOptions.length > 0 ? "" : scriptId} onValueChange={setScriptId}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Selecione um script" />
                  </SelectTrigger>
                  <SelectContent>
                    {scriptOptions.length === 0 && <SelectItem value="none">Nenhum</SelectItem>}
                    {scriptOptions.map((script) => (
                      <SelectItem key={script.id} value={script.id}>
                        {script.name} ({script.version})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Canal padrão</Label>
                <Select value={defaultChannel} onValueChange={(value) => setDefaultChannel(value as SalesChannel)}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Selecione o canal" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEFAULT_CHANNEL_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {salesChannelLabel(option)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-1 text-xs text-muted-foreground">Usado quando a coluna "canal" vier vazia.</p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={onClose} disabled={submitting}>
                Cancelar
              </Button>
              <Button className="gap-2" onClick={() => void handlePreview()} disabled={submitting || !pipeline || !file}>
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <FileUp size={14} />}
                Pré-visualizar
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <SalesLeadImportPreview result={preview} />

            {preview.valid === 0 && (
              <p className="text-sm text-destructive">Nenhuma linha válida para importar. Corrija o arquivo e tente de novo.</p>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setPreview(null)} disabled={submitting}>
                Voltar
              </Button>
              <Button className="gap-2" onClick={() => void handleImport()} disabled={submitting || preview.valid === 0}>
                {submitting && <Loader2 size={14} className="animate-spin" />}
                Importar {preview.valid} {preview.valid === 1 ? "lead" : "leads"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
