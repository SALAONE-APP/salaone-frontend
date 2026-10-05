import { useRef, useState, type ChangeEvent } from "react";
import { File, FileAudio, FileSpreadsheet, FileText, Image as ImageIcon, Loader2, Paperclip, Presentation, Video, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  deleteSalesDocAttachment,
  SALES_DOC_ATTACHMENT_ACCEPT,
  SALES_DOC_MAX_ATTACHMENT_BYTES,
  SALES_DOC_MAX_ATTACHMENTS,
  uploadSalesDocAttachment,
  type SalesDocAttachment,
} from "@/service/salesDocService";

interface Props {
  docId: string;
  attachments: SalesDocAttachment[];
  editable: boolean;
  onChange: (attachments: SalesDocAttachment[]) => void;
}

function iconFor(attachment: SalesDocAttachment): LucideIcon {
  if (attachment.type === "image") return ImageIcon;
  if (attachment.type === "video") return Video;
  if (attachment.type === "audio") return FileAudio;
  if (attachment.type === "pdf") return FileText;
  const extension = attachment.name.split(".").pop()?.toLowerCase() ?? "";
  if (["xls", "xlsx", "csv"].includes(extension)) return FileSpreadsheet;
  if (["ppt", "pptx"].includes(extension)) return Presentation;
  if (["doc", "docx", "txt"].includes(extension)) return FileText;
  return File;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function errorMessage(error: unknown, fallback: string) {
  return (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback;
}

export function SalesDocAttachments({ docId, attachments, editable, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  if (!editable && attachments.length === 0) return null;

  async function handleSelected(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;

    setUploading(true);
    // Um por vez: cada um ja fica salvo no documento, entao uma falha no meio nao perde os anteriores.
    let current = attachments;
    for (const file of files) {
      if (current.length >= SALES_DOC_MAX_ATTACHMENTS) {
        toast.error(`Limite de ${SALES_DOC_MAX_ATTACHMENTS} anexos por documento.`);
        break;
      }
      if (file.size > SALES_DOC_MAX_ATTACHMENT_BYTES) {
        toast.error(`“${file.name}” passa de 25 MB.`);
        continue;
      }
      try {
        const attachment = await uploadSalesDocAttachment(docId, file);
        current = [...current, attachment];
        onChange(current);
      } catch (error) {
        toast.error(`“${file.name}”: ${errorMessage(error, "não foi possível enviar.")}`);
      }
    }
    setUploading(false);
  }

  async function handleRemove(attachment: SalesDocAttachment) {
    if (!window.confirm(`Remover o anexo “${attachment.name}”?`)) return;
    setRemovingId(attachment.id);
    try {
      await deleteSalesDocAttachment(docId, attachment.id);
      onChange(attachments.filter((item) => item.id !== attachment.id));
    } catch (error) {
      toast.error(errorMessage(error, "Não foi possível remover o anexo."));
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Paperclip size={14} />
          Anexos{attachments.length > 0 ? ` (${attachments.length})` : ""}
        </h2>
        {editable && (
          <>
            <input ref={inputRef} type="file" multiple accept={SALES_DOC_ATTACHMENT_ACCEPT} className="hidden" onChange={(event) => void handleSelected(event)} />
            <Button type="button" size="sm" variant="outline" className="gap-2" disabled={uploading || attachments.length >= SALES_DOC_MAX_ATTACHMENTS} onClick={() => inputRef.current?.click()}>
              {uploading ? <Loader2 size={14} className="animate-spin" /> : <Paperclip size={14} />}
              {uploading ? "Enviando…" : "Anexar arquivo"}
            </Button>
          </>
        )}
      </div>

      {attachments.length === 0 ? (
        <p className="text-xs text-muted-foreground">PDF, Word, Excel, PowerPoint, CSV, TXT, imagem, áudio ou vídeo, até 25 MB cada. Os anexos são salvos na hora, sem precisar clicar em Salvar.</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {attachments.map((attachment) => {
            const Icon = iconFor(attachment);
            return (
              <li key={attachment.id} className="flex items-center gap-3 px-3 py-2">
                <Icon size={16} className="shrink-0 text-muted-foreground" />
                <a href={attachment.url} target="_blank" rel="noopener noreferrer" download={attachment.name} className="min-w-0 flex-1 truncate text-sm font-medium text-foreground hover:text-primary hover:underline">
                  {attachment.name}
                </a>
                <span className="shrink-0 text-xs text-muted-foreground">{formatBytes(attachment.bytes)}</span>
                {editable && (
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" title="Remover anexo" disabled={removingId === attachment.id} onClick={() => void handleRemove(attachment)}>
                    {removingId === attachment.id ? <Loader2 size={13} className="animate-spin" /> : <X size={14} />}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
