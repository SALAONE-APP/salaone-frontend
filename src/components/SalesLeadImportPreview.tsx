import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { SalesLeadImportResult } from "@/service/salesCrmService";

// Pre-visualizacao de uma importacao de leads (CSV ou busca no Google Maps):
// totais e tabela linha a linha com o que sera criado, duplicado ou com erro.

type PreviewRow = {
  line: number;
  contactName: string | null;
  phone: string | null;
  status: "ok" | "duplicate" | "invalid";
  reason: string;
};

const STATUS_LABELS: Record<PreviewRow["status"], string> = {
  ok: "Será criado",
  duplicate: "Duplicado",
  invalid: "Com erro",
};

const STATUS_CLASSES: Record<PreviewRow["status"], string> = {
  ok: "border-transparent bg-[hsl(var(--success)/0.15)] text-[hsl(var(--success))]",
  duplicate: "border-transparent bg-[hsl(var(--warning)/0.15)] text-[hsl(var(--warning))]",
  invalid: "border-transparent bg-destructive/15 text-destructive",
};

interface Props {
  result: SalesLeadImportResult;
  // "Linha" no CSV; "#" na busca do Google Maps (posicao no resultado).
  lineLabel?: string;
}

export function SalesLeadImportPreview({ result, lineLabel = "Linha" }: Props) {
  const rows = useMemo<PreviewRow[]>(
    () =>
      [
        ...result.preview.map((item) => ({ ...item, status: "ok" as const, reason: "" })),
        ...result.duplicates.map((item) => ({ ...item, status: "duplicate" as const })),
        ...result.invalid.map((item) => ({ line: item.line, contactName: item.contactName, phone: item.phone, status: "invalid" as const, reason: item.errors.join("; ") })),
      ].sort((a, b) => a.line - b.line),
    [result],
  );

  return (
    <>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg border border-border p-3">
          <p className="text-2xl font-semibold text-[hsl(var(--success))]">{result.valid}</p>
          <p className="text-xs text-muted-foreground">Serão criados</p>
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="text-2xl font-semibold text-[hsl(var(--warning))]">{result.duplicates.length}</p>
          <p className="text-xs text-muted-foreground">Duplicados (ignorados)</p>
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="text-2xl font-semibold text-destructive">{result.invalid.length}</p>
          <p className="text-xs text-muted-foreground">Com erro</p>
        </div>
      </div>

      <div className="max-h-80 overflow-auto rounded-lg border border-border">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-card text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">{lineLabel}</th>
              <th className="px-3 py-2 font-medium">Nome</th>
              <th className="px-3 py-2 font-medium">Telefone</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Motivo</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-xs text-muted-foreground">
                  Nenhum resultado.
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={`${row.status}-${row.line}`} className="border-t border-border align-top">
                <td className="px-3 py-2 tabular-nums text-muted-foreground">{row.line}</td>
                <td className="px-3 py-2">{row.contactName || "—"}</td>
                <td className="whitespace-nowrap px-3 py-2">{row.phone || "—"}</td>
                <td className="px-3 py-2">
                  <Badge variant="outline" className={cn("whitespace-nowrap", STATUS_CLASSES[row.status])}>
                    {STATUS_LABELS[row.status]}
                  </Badge>
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{row.reason || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
