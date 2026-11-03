import { useCallback, useEffect, useState } from "react";
import { Loader2, Pencil, Plus, Upload, UserCheck, UserX } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  createContact,
  importContacts,
  listContacts,
  setContactConsent,
  updateContact,
  whatsappErrorMessage,
  type ContactInput,
  type WhatsAppContact,
} from "@/service/whatsappHubService";

const fmtPhone = (p: string) => (p.length >= 12 ? `(${p.slice(2, 4)}) ${p.slice(4, -4)}-${p.slice(-4)}` : p);
const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "");
const parseTags = (s: string) => s.split(/[,;]/).map((t) => t.trim()).filter(Boolean);

function ConsentBadge({ c }: { c: WhatsAppContact }) {
  if (c.optOutAt) return <Badge variant="outline" className="bg-red-500/10 text-red-600">Descadastrado em {fmtDate(c.optOutAt)}</Badge>;
  if (c.marketingOptIn)
    return (
      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700" title={`Origem: ${c.optInSource ?? "-"}`}>
        Aceitou em {fmtDate(c.optInAt)}
      </Badge>
    );
  return <Badge variant="outline">Sem aceite</Badge>;
}

// Lê CSV simples: telefone, nome, etiquetas (separados por vírgula ou ponto e vírgula; etiquetas com "|").
function parseCsv(text: string): ContactInput[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length && /telefone|phone/i.test(lines[0]!)) lines.shift();
  return lines.map((line) => {
    const [phone = "", name = "", tags = ""] = line.split(/[;,]/).map((c) => c.trim().replace(/^"|"$/g, ""));
    return { phone, name: name || undefined, tags: tags ? tags.split("|").map((t) => t.trim()).filter(Boolean) : undefined };
  });
}

export function WhatsAppContactsPanel() {
  const [contacts, setContacts] = useState<WhatsAppContact[]>([]);
  const [filter, setFilter] = useState<"all" | "optin" | "none">("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [consentFor, setConsentFor] = useState<WhatsAppContact | null>(null);

  async function editTags(c: WhatsAppContact) {
    const value = window.prompt(`Etiquetas de ${c.name ?? fmtPhone(c.phone)} (separadas por vírgula):`, c.tags.join(", "));
    if (value === null) return;
    try {
      await updateContact(c.id, { tags: parseTags(value) });
      toast.success("Etiquetas atualizadas");
      void load();
    } catch (error) {
      toast.error(whatsappErrorMessage(error));
    }
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setContacts(await listContacts({ optIn: filter === "all" ? undefined : filter === "optin", search: search || undefined }));
    } catch (error) {
      toast.error(whatsappErrorMessage(error, "Não foi possível carregar os contatos"));
    } finally {
      setLoading(false);
    }
  }, [filter, search]);

  useEffect(() => {
    const t = window.setTimeout(load, 300);
    return () => window.clearTimeout(t);
  }, [load]);

  async function optOut(c: WhatsAppContact) {
    if (!window.confirm(`Descadastrar ${c.name ?? fmtPhone(c.phone)} das promoções?`)) return;
    try {
      await setContactConsent(c.id, "opt-out", "descadastrado pelo salão");
      toast.success("Contato descadastrado");
      void load();
    } catch (error) {
      toast.error(whatsappErrorMessage(error));
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Só recebem campanhas os clientes que <b>aceitaram receber promoções</b>. Registre de onde veio o aceite (ex.: "cadastro no app", "ficha de balcão").
        Quem responder SAIR é descadastrado automaticamente.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Input className="max-w-xs" placeholder="Buscar por nome ou telefone" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="h-9 rounded-md border border-border bg-background px-2 text-sm" value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
          <option value="all">Todos</option>
          <option value="optin">Com aceite</option>
          <option value="none">Sem aceite / descadastrados</option>
        </select>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setImporting(true)}>
            <Upload className="size-4" /> Importar
          </Button>
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus className="size-4" /> Novo contato
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Telefone</th>
              <th className="px-4 py-3">Etiquetas</th>
              <th className="px-4 py-3">Promoções</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                  <Loader2 className="mx-auto size-4 animate-spin" />
                </td>
              </tr>
            ) : contacts.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                  Nenhum contato.
                </td>
              </tr>
            ) : (
              contacts.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3 font-medium">{c.name ?? "—"}</td>
                  <td className="px-4 py-3">{fmtPhone(c.phone)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-1">
                      {c.tags.map((t) => (
                        <Badge key={t} variant="secondary">
                          {t}
                        </Badge>
                      ))}
                      <button type="button" className="rounded p-1 text-muted-foreground hover:bg-muted" onClick={() => editTags(c)} aria-label="Editar etiquetas" title="Editar etiquetas">
                        <Pencil className="size-3.5" />
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <ConsentBadge c={c} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    {c.marketingOptIn && !c.optOutAt ? (
                      <Button size="sm" variant="ghost" onClick={() => optOut(c)}>
                        <UserX className="size-4" /> Descadastrar
                      </Button>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => setConsentFor(c)}>
                        <UserCheck className="size-4" /> Registrar aceite
                      </Button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <AddContactDialog open={adding} onClose={() => setAdding(false)} onSaved={load} />
      <ImportDialog open={importing} onClose={() => setImporting(false)} onSaved={load} />
      <ConsentDialog contact={consentFor} onClose={() => setConsentFor(null)} onSaved={load} />
    </div>
  );
}

function AddContactDialog({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [tags, setTags] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [source, setSource] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await createContact({ phone, name: name || undefined, tags: parseTags(tags), optInSource: accepted ? source : undefined });
      toast.success("Contato salvo");
      setPhone("");
      setName("");
      setTags("");
      setAccepted(false);
      setSource("");
      onSaved();
      onClose();
    } catch (error) {
      toast.error(whatsappErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo contato</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>WhatsApp</Label>
            <Input inputMode="tel" placeholder="(85) 99999-9999" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Etiquetas (separadas por vírgula)</Label>
            <Input placeholder="vip, barba" value={tags} onChange={(e) => setTags(e.target.value)} />
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
            O cliente aceitou receber promoções pelo WhatsApp
          </label>
          {accepted && (
            <div className="space-y-1.5">
              <Label>Como o cliente aceitou?</Label>
              <Input placeholder="Ex.: pediu no balcão em 01/11/2026" value={source} onChange={(e) => setSource(e.target.value)} />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={busy || phone.replace(/\D/g, "").length < 10 || (accepted && source.trim().length < 3)}>
            {busy && <Loader2 className="size-4 animate-spin" />} Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ImportDialog({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const [text, setText] = useState("");
  const [allAccepted, setAllAccepted] = useState(false);
  const [source, setSource] = useState("");
  const [busy, setBusy] = useState(false);
  const rows = parseCsv(text);

  async function run() {
    setBusy(true);
    try {
      const r = await importContacts(rows.map((r) => ({ ...r, optInSource: allAccepted ? source : undefined })));
      toast.success(`${r.created} novos, ${r.updated} atualizados, ${r.optIns} aceites${r.invalid.length ? `, ${r.invalid.length} inválidos` : ""}`);
      if (r.invalid.length) toast.warning(`Linhas inválidas: ${r.invalid.map((i) => i.line).join(", ")}`);
      setText("");
      onSaved();
      onClose();
    } catch (error) {
      toast.error(whatsappErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Importar contatos</DialogTitle>
          <DialogDescription>Cole as linhas da planilha: telefone, nome, etiquetas (etiquetas separadas por |). Até 1000 por vez.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Textarea rows={8} placeholder={"telefone,nome,etiquetas\n85999990000,João,vip|barba"} value={text} onChange={(e) => setText(e.target.value)} />
          <input
            type="file"
            accept=".csv,text/csv,text/plain"
            className="text-sm"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) setText(await f.text());
            }}
          />
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={allAccepted} onChange={(e) => setAllAccepted(e.target.checked)} />
            Todos estes clientes aceitaram receber promoções
          </label>
          {allAccepted && <Input placeholder="Origem do aceite (ex.: fichas de cadastro 2026)" value={source} onChange={(e) => setSource(e.target.value)} />}
          <p className="text-xs text-muted-foreground">{rows.length} linha(s) encontradas.</p>
        </div>
        <DialogFooter>
          <Button onClick={run} disabled={busy || !rows.length || rows.length > 1000 || (allAccepted && source.trim().length < 3)}>
            {busy && <Loader2 className="size-4 animate-spin" />} Importar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConsentDialog({ contact, onClose, onSaved }: { contact: WhatsAppContact | null; onClose: () => void; onSaved: () => void }) {
  const [source, setSource] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={!!contact} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar aceite</DialogTitle>
          <DialogDescription>
            {contact?.optOutAt
              ? "Este cliente se descadastrou. Só registre um novo aceite se ele pediu de novo para receber promoções."
              : "Informe como o cliente aceitou receber promoções."}
          </DialogDescription>
        </DialogHeader>
        <Input placeholder="Ex.: pediu pelo WhatsApp em 01/11/2026" value={source} onChange={(e) => setSource(e.target.value)} />
        <DialogFooter>
          <Button
            disabled={busy || source.trim().length < 3}
            onClick={async () => {
              if (!contact) return;
              setBusy(true);
              try {
                await setContactConsent(contact.id, "opt-in", source);
                toast.success("Aceite registrado");
                setSource("");
                onSaved();
                onClose();
              } catch (error) {
                toast.error(whatsappErrorMessage(error));
              } finally {
                setBusy(false);
              }
            }}
          >
            Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
