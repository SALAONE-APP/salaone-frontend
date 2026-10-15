import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { subscriptionPriceChanges as api, type PriceChange, type PriceScope, type PriceTarget } from "@/service/subscriptionPriceChangeService";

const money = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const labels: Record<string, string> = { pending_preview: "A consultar", ready: "Elegível", excluded: "Não elegível", preview_failed: "Falha na consulta", success: "Atualizada", unchanged: "Conciliada / já estava no valor", failed: "Falha", uncertain: "Resultado incerto" };

export function SubscriptionPriceChangeDialog({ scope, target, onClose, onUpdated }: {
  scope: PriceScope; target: PriceTarget; onClose: () => void; onUpdated?: () => void;
}) {
  const [change, setChange] = useState<PriceChange | null>(null);
  const [history, setHistory] = useState<PriceChange[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [catalogSaved, setCatalogSaved] = useState(false);
  const saved = useRef(false);
  const stopped = useRef(false);
  useEffect(() => {
    stopped.current = false;
    void api.list(scope, target.planId).then(setHistory).catch(() => setError("Não foi possível consultar operações anteriores."));
    return () => { stopped.current = true; };
  }, [scope, target.planId]);
  async function run(work: () => Promise<void>) {
    setBusy(true); setError(""); stopped.current = false;
    try { await work(); }
    catch (failure) {
      setError((failure as { response?: { data?: { message?: string } } }).response?.data?.message || "A operação foi interrompida. Consulte/retome o resultado salvo; não é necessário refazer os sucessos.");
    } finally { setBusy(false); }
  }
  async function advance(initial: PriceChange, action: "preview" | "apply") {
    let current = initial;
    setChange(current);
    while (!stopped.current && current.items.some(item => item.status === (action === "preview" ? "pending_preview" : "ready"))) {
      current = await api.step(scope, current.id, action);
      setChange(current);
      // Bounded, sequential work; leave room for other traffic and provider rate limits.
      await new Promise(resolve => window.setTimeout(resolve, 1200));
    }
    if (action === "apply") onUpdated?.();
  }
  const counts = (status: string) => change?.items.filter(item => item.status === status).length ?? 0;
  const previewsPending = counts("pending_preview") + counts("preview_failed");
  const failures = counts("failed") + counts("uncertain");
  const ready = counts("ready");
  async function confirm() {
    if (!change) return;
    await saveCatalog();
    const confirmed = await api.confirm(scope, change.id);
    await advance(confirmed, "apply");
  }
  async function saveCatalog() {
    if (target.saveCatalog && !saved.current) {
      await target.saveCatalog(); saved.current = true; setCatalogSaved(true);
    }
  }
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}>
    <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Atualizar preço {target.subscriptionId ? "desta assinatura" : "das assinaturas existentes"}</DialogTitle>
        <DialogDescription>Esta operação é separada da edição do catálogo. Não cancela nem recria assinaturas e não solicita cobranças ou estornos.</DialogDescription>
      </DialogHeader>
      <p className="text-sm">Novo preço unitário: <strong>{money(change?.target_cents ?? Math.round(target.price * 100))}</strong>. A quantidade de cada item será preservada.</p>
      {catalogSaved && <p role="status" className="text-sm">Catálogo salvo. A atualização das assinaturas é independente; consulte os resultados abaixo.</p>}
      {!change && <div className="space-y-3">
        <Button disabled={busy} onClick={() => void run(async () => advance(await api.create(scope, target), "preview"))}>Consultar prévia no Pagar.me</Button>
        {!target.subscriptionId && !target.saveCatalog && history.length > 0 && <div className="space-y-2">
          <p className="text-sm font-medium">Operações anteriores (retomar ou consultar)</p>
          {history.map(item => <Button key={item.id} variant="outline" className="mr-2" disabled={busy} onClick={() => void run(async () => { setChange(await api.get(scope, item.id)); setAccepted(false); })}>
            {new Date(item.created_at).toLocaleString("pt-BR")} · {money(item.target_cents)}
          </Button>)}
        </div>}
      </div>}
      {change && <>
        <p className="text-sm">Catálogo na prévia: {money(change.catalog_cents)} → destino: {money(change.target_cents)} por unidade.</p>
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">{change.timing}</p>
        <p role="status" className="text-sm">Lote de {change.items.length}: {ready} elegíveis · {counts("success")} atualizadas · {counts("unchanged")} conciliadas · {counts("excluded")} excluídas · {failures + counts("preview_failed")} falhas/incertas · {counts("pending_preview")} a consultar.</p>
        <div className="max-h-72 overflow-auto rounded border border-border">
          <table className="w-full text-left text-xs"><thead><tr className="border-b"><th className="p-2">Assinatura</th><th>Anterior → novo (total)</th><th>Próxima data informada</th><th>Resultado</th></tr></thead>
            <tbody>{change.items.map(item => <tr key={item.id} className="border-b">
              <td className="p-2">{item.label}<br/><span className="text-muted-foreground">{item.remote_id || "Sem assinatura remota"}</span></td>
              <td>{item.snapshot ? <>{money(item.snapshot.oldCents * item.snapshot.quantity)} → {money(change.target_cents * item.snapshot.quantity)}<br/>{item.snapshot.quantity} unidade(s)</> : "—"}</td>
              <td>{item.snapshot?.nextBillingAt ? new Date(item.snapshot.nextBillingAt).toLocaleDateString("pt-BR") : "Não informada"}</td>
              <td className="p-2 max-w-xs">{labels[item.status] || item.status}<br/>{item.message}
                {["failed", "uncertain", "preview_failed"].includes(item.status) && <Button size="sm" variant="outline" disabled={busy} onClick={() => void run(async () => {
                  setChange(await api.step(scope, change.id, item.status === "preview_failed" ? "preview" : "retry", item.id)); onUpdated?.();
                })}>{item.status === "uncertain" ? "Conciliar" : "Tentar esta falha"}</Button>}
              </td>
            </tr>)}</tbody></table>
        </div>
        {!change.confirmed_at && <>
          <label className="flex gap-2 text-sm"><input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)} disabled={busy}/>
            Confirmo a alteração das {ready} assinaturas elegíveis desta prévia. Estou ciente das exclusões e da limitação sobre faturas já emitidas.</label>
          <Button disabled={busy || !accepted || previewsPending > 0 || ready === 0} onClick={() => void run(confirm)}>
            {target.saveCatalog ? "Salvar catálogo e confirmar atualização das elegíveis" : "Confirmar atualização das elegíveis"}
          </Button>
        </>}
        {target.saveCatalog && !catalogSaved && ready === 0 && previewsPending === 0 && <Button disabled={busy} onClick={() => void run(saveCatalog)}>Salvar somente o catálogo — nenhuma assinatura elegível neste lote</Button>}
        <div className="flex flex-wrap gap-2">
          {!change.confirmed_at && counts("pending_preview") > 0 && <Button disabled={busy} onClick={() => void run(() => advance(change, "preview"))}>Continuar prévia</Button>}
          {change.confirmed_at && ready > 0 && <Button disabled={busy} onClick={() => void run(() => advance(change, "apply"))}>Continuar lote confirmado</Button>}
          <Button variant="outline" disabled={busy} onClick={() => void run(async () => setChange(await api.get(scope, change.id)))}>Consultar resultado salvo</Button>
          {change.next_cursor && !busy && ready === 0 && previewsPending === 0 && <Button variant="outline" onClick={() => void run(async () => {
            setAccepted(false); await advance(await api.create(scope, { ...target, price: change.target_cents / 100 }, change.next_cursor!), "preview");
          })}>Consultar próximo lote (até 200)</Button>}
          {!target.saveCatalog && <Button variant="outline" disabled={busy} onClick={() => { setChange(null); setAccepted(false); }}>Nova prévia / histórico</Button>}
        </div>
        <p className="text-xs text-muted-foreground">Operação {change.id}. O resultado fica salvo no servidor. Falhas não desfazem os sucessos; nenhuma falha é apresentada como atualização concluída.</p>
      </>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex justify-end gap-2">
        {busy && <Button variant="outline" onClick={() => { stopped.current = true; }}>Pausar após a assinatura atual</Button>}
        <Button variant="outline" disabled={busy} onClick={onClose}>{busy ? "Processando…" : "Fechar"}</Button>
      </div>
    </DialogContent>
  </Dialog>;
}
