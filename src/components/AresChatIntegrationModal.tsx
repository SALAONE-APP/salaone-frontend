import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ClipboardCopy, Loader2, RefreshCcw, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import {
  generateAresChatSetupData,
  getAresChatSetupData,
  type AresChatIntegrationFields,
  type AresChatSetupData,
} from "@/service/areschatSetupService";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface AresChatIntegrationModalProps {
  open: boolean;
  onClose: () => void;
  barbershopId?: string | null;
}

const FIELD_LABELS: Record<keyof AresChatIntegrationFields, string> = {
  name: "name",
  partnerName: "partnerName",
  domain: "domain",
  provider: "provider",
  baseUrl: "baseUrl",
  authType: "authType",
  token: "token",
  defaultHeaders: "defaultHeaders",
  timeoutMs: "timeoutMs",
  isActive: "isActive",
  empresa: "empresa",
};

const FIELD_ORDER: Array<keyof AresChatIntegrationFields> = [
  "name",
  "partnerName",
  "domain",
  "provider",
  "baseUrl",
  "authType",
  "token",
  "defaultHeaders",
  "timeoutMs",
  "isActive",
];

function fmtDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("pt-BR");
}

function displayValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}

function getApiErrorMessage(error: unknown) {
  if (typeof error === "object" && error !== null && "response" in error) {
    const data = (error as { response?: { data?: unknown } }).response?.data;
    if (Array.isArray(data) && typeof data[0] === "string") return data[0];
    if (typeof data === "string") return data;
    if (
      typeof data === "object" &&
      data !== null &&
      "message" in data &&
      typeof (data as { message?: unknown }).message === "string"
    ) {
      return (data as { message: string }).message;
    }
  }
  return null;
}

function buildAllDataText(data: AresChatSetupData) {
  const fields = data.areschatIntegrationFields;
  const lines = [
    "Dados de integracao AresChat - SalaOne",
    "",
    "Barbearia",
    `Nome: ${data.barbershop.name}`,
    `Status: ${data.barbershop.status}`,
    "",
    "Credencial ativa",
    `ID: ${data.credential?.id ?? "-"}`,
    `Nome: ${data.credential?.name ?? "-"}`,
    `Prefixo do token: ${data.credential?.tokenPrefix ?? "-"}`,
    `Status: ${data.credential?.active ? "Ativa" : "Inativa"}`,
    "",
    "Campos para preencher no AresChat",
    ...FIELD_ORDER.map((key) => `${FIELD_LABELS[key]}: ${displayValue(fields[key])}`),
  ];

  return lines.join("\n");
}

export function AresChatIntegrationModal({
  open,
  onClose,
  barbershopId,
}: AresChatIntegrationModalProps) {
  const [data, setData] = useState<AresChatSetupData | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      setData(null);
      setLoading(false);
      setGenerating(false);
      setConfirmOpen(false);
      return;
    }

    let ignore = false;
    async function load() {
      setLoading(true);
      try {
        const result = await getAresChatSetupData(barbershopId);
        if (!ignore) setData(result);
      } catch (error) {
        toast.error(getApiErrorMessage(error) || "Nao foi possivel carregar os dados AresChat.");
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    void load();
    return () => {
      ignore = true;
    };
  }, [barbershopId, open]);

  const jsonText = useMemo(() => {
    if (!data) return "";
    return JSON.stringify(data.areschatIntegrationFields, null, 2);
  }, [data]);

  async function copyText(text: string, message = "Copiado.") {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(message);
    } catch {
      toast.error("Nao foi possivel copiar.");
    }
  }

  async function handleGenerate() {
    if (!data?.barbershop) return;

    setGenerating(true);
    try {
      const result = await generateAresChatSetupData({
        barbershopId,
        name: `AresChat - ${data.barbershop.name}`,
      });
      setData(result);
      toast.success("Nova credencial AresChat gerada.");
    } catch (error) {
      toast.error(getApiErrorMessage(error) || "Nao foi possivel gerar a credencial AresChat.");
    } finally {
      setGenerating(false);
      setConfirmOpen(false);
    }
  }

  const fields = data?.areschatIntegrationFields;
  const hasToken = Boolean(data?.credential?.token || fields?.token);

  return (
    <>
      <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
        <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Integracao AresChat</DialogTitle>
            <DialogDescription>
              Dados para configurar a barbearia no painel do AresChat.
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="flex min-h-64 items-center justify-center text-muted-foreground">
              <Loader2 className="mr-2 animate-spin" size={20} />
              Carregando dados da integracao...
            </div>
          ) : !data ? (
            <div className="rounded-lg border border-border bg-secondary/40 p-4 text-sm text-muted-foreground">
              Nenhum dado carregado.
            </div>
          ) : (
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
              <section className="rounded-lg border border-border p-4">
                <h3 className="mb-3 text-sm font-semibold text-foreground">Dados da barbearia</h3>
                <div className="grid gap-3 text-sm md:grid-cols-2">
                  <InfoRow label="Nome" value={data.barbershop.name} />
                  <InfoRow label="Status" value={data.barbershop.status} />
                  <InfoRow label="Slug" value={data.barbershop.slug} />
                  <InfoRow label="ID" value={data.barbershop.id} canCopy onCopy={copyText} />
                </div>
              </section>

              <section className="rounded-lg border border-border p-4">
                <h3 className="mb-3 text-sm font-semibold text-foreground">Credencial ativa</h3>
                <div className="grid gap-3 text-sm md:grid-cols-2">
                  <InfoRow label="ID da credencial ativa" value={data.credential?.id ?? "-"} canCopy={Boolean(data.credential?.id)} onCopy={copyText} />
                  <InfoRow label="Nome da credencial" value={data.credential?.name ?? "-"} canCopy={Boolean(data.credential?.name)} onCopy={copyText} />
                  <InfoRow label="Prefixo do token" value={data.credential?.tokenPrefix ?? "-"} canCopy={Boolean(data.credential?.tokenPrefix)} onCopy={copyText} />
                  <InfoRow label="Status da credencial" value={data.credential?.active ? "Ativa" : "Inativa"} />
                  <InfoRow label="Ultimo uso" value={fmtDate(data.credential?.lastUsedAt)} />
                  <InfoRow label="Data de criacao" value={fmtDate(data.credential?.createdAt)} />
                  {data.credential?.token && (
                    <InfoRow label="Token completo" value={data.credential.token} canCopy onCopy={copyText} />
                  )}
                </div>
                <div className="mt-4 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700">
                  {hasToken ? (
                    <div className="flex gap-2">
                      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>Copie este token agora. Por seguranca ele nao sera exibido novamente.</span>
                    </div>
                  ) : (
                    "Token nao disponivel. Gere uma nova credencial para visualizar o token completo."
                  )}
                </div>
              </section>

              <section className="rounded-lg border border-border p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-foreground">Campos para preencher no AresChat</h3>
                  <Button type="button" variant="outline" size="sm" onClick={() => void copyText(jsonText, "JSON copiado.")}>
                    <ClipboardCopy size={14} />
                    Copiar JSON
                  </Button>
                </div>
                <div className="space-y-2">
                  {fields && FIELD_ORDER.map((key) => (
                    <CopyField
                      key={key}
                      label={FIELD_LABELS[key]}
                      value={key === "token" && !fields[key]
                        ? "Token nao disponivel. Gere uma nova credencial para visualizar o token completo."
                        : displayValue(fields[key])}
                      copyValue={fields[key] == null ? "" : displayValue(fields[key])}
                      canCopy={fields[key] != null}
                      onCopy={copyText}
                      highlight={key === "token" && hasToken}
                    />
                  ))}
                </div>
              </section>

              {data.testRequests && Object.keys(data.testRequests).length > 0 && (
                <section className="rounded-lg border border-border p-4">
                  <h3 className="mb-3 text-sm font-semibold text-foreground">Testes da API</h3>
                  <div className="space-y-3">
                    {Object.entries(data.testRequests).map(([key, request]) => (
                      <div key={key} className="rounded-md border border-border bg-secondary/30 p-3 text-sm">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <span className="font-medium text-foreground">{key}</span>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => void copyText(JSON.stringify(request, null, 2), "Teste copiado.")}
                          >
                            <ClipboardCopy size={14} />
                            Copiar
                          </Button>
                        </div>
                        <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded bg-background p-2 text-xs text-muted-foreground">
                          {JSON.stringify(request, null, 2)}
                        </pre>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}

          <DialogFooter className="border-t border-border pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Fechar
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!data}
              onClick={() => data && void copyText(buildAllDataText(data), "Todos os dados foram copiados.")}
            >
              <ClipboardCopy size={14} />
              Copiar todos
            </Button>
            <Button
              type="button"
              disabled={!data || generating}
              onClick={() => setConfirmOpen(true)}
            >
              {generating ? <Loader2 className="animate-spin" size={14} /> : <RefreshCcw size={14} />}
              Gerar nova credencial AresChat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Gerar nova credencial?</AlertDialogTitle>
            <AlertDialogDescription>
              Gerar uma nova credencial ira revogar a credencial ativa anterior. Se ela ja estiver configurada no AresChat, sera necessario atualizar o token no painel. Deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={generating}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={generating} onClick={(event) => { event.preventDefault(); void handleGenerate(); }}>
              {generating ? "Gerando..." : "Continuar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function InfoRow({
  label,
  value,
  canCopy,
  onCopy,
}: {
  label: string;
  value: string;
  canCopy?: boolean;
  onCopy?: (value: string) => Promise<void>;
}) {
  return (
    <div className="rounded-md bg-secondary/40 p-3">
      <div className="mb-1 text-xs font-medium text-muted-foreground">{label}</div>
      <div className="flex items-center justify-between gap-2">
        <span className="break-all text-foreground">{value}</span>
        {canCopy && onCopy && (
          <button
            type="button"
            onClick={() => void onCopy(value)}
            className="rounded border border-border p-1 text-muted-foreground hover:bg-background hover:text-foreground"
            aria-label={`Copiar ${label}`}
          >
            <ClipboardCopy size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

function CopyField({
  label,
  value,
  copyValue,
  canCopy,
  onCopy,
  highlight,
}: {
  label: string;
  value: string;
  copyValue: string;
  canCopy: boolean;
  onCopy: (value: string) => Promise<void>;
  highlight?: boolean;
}) {
  return (
    <div className={`grid gap-2 rounded-md border p-3 md:grid-cols-[160px_1fr_auto] md:items-center ${
      highlight ? "border-emerald-500/30 bg-emerald-500/10" : "border-border bg-secondary/30"
    }`}>
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      <pre className="min-w-0 whitespace-pre-wrap break-all text-sm text-foreground">{value}</pre>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!canCopy}
        onClick={() => void onCopy(copyValue)}
      >
        {highlight ? <CheckCircle2 size={14} /> : <ClipboardCopy size={14} />}
        Copiar
      </Button>
    </div>
  );
}
