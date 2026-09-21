import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import {
  SALES_CHANNELS,
  createSalesLead,
  listSalesScripts,
  salesChannelLabel,
  type SalesLead,
  type SalesScript,
} from "@/service/salesCrmService";
import { listSuperAdminUsers, type SuperAdminUser } from "@/service/superAdminService";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (lead: SalesLead) => void;
}

function extractErrorMessage(error: unknown, fallback: string) {
  const value = (error as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
  return typeof value === "string" ? value : fallback;
}

export function SalesLeadCreateDialog({ open, onClose, onCreated }: Props) {
  const { user } = useAuth();
  const isSalesRep = user?.role === "sales_rep";

  const [contactName, setContactName] = useState("");
  const [salonName, setSalonName] = useState("");
  const [phone, setPhone] = useState("");
  const [instagramHandle, setInstagramHandle] = useState("");
  const [email, setEmail] = useState("");
  const [channel, setChannel] = useState("");
  const [responsibleId, setResponsibleId] = useState("");
  const [scriptId, setScriptId] = useState("none");
  const [notes, setNotes] = useState("");

  const [responsibleOptions, setResponsibleOptions] = useState<SuperAdminUser[]>([]);
  const [scriptOptions, setScriptOptions] = useState<SalesScript[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setContactName("");
      setSalonName("");
      setPhone("");
      setInstagramHandle("");
      setEmail("");
      setChannel("");
      setResponsibleId(isSalesRep && user ? user.id : "");
      setScriptId("none");
      setNotes("");
      return;
    }

    setResponsibleId(isSalesRep && user ? user.id : "");

    listSalesScripts({ active: true })
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
  }, [open, isSalesRep, user]);

  async function handleSubmit() {
    if (!contactName.trim()) {
      toast.error("Informe o nome do contato.");
      return;
    }
    if (!phone.trim()) {
      toast.error("Informe o telefone.");
      return;
    }
    if (!channel) {
      toast.error("Selecione o canal de origem.");
      return;
    }
    if (!responsibleId) {
      toast.error("Selecione o vendedor responsável.");
      return;
    }

    setSubmitting(true);
    try {
      const lead = await createSalesLead({
        contactName: contactName.trim(),
        salonName: salonName.trim() || null,
        phone: phone.trim(),
        instagramHandle: instagramHandle.trim() || null,
        email: email.trim() || null,
        channel,
        responsibleId,
        scriptId: scriptId === "none" ? null : scriptId,
        notes: notes.trim() || null,
      });
      toast.success("Lead criado.");
      onCreated(lead);
      onClose();
    } catch (error) {
      toast.error(extractErrorMessage(error, "Não foi possível criar o lead."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-4 overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo lead</DialogTitle>
        </DialogHeader>

        <div>
          <Label>Nome do contato</Label>
          <Input className="mt-1.5" value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Ex.: Maria Silva" />
        </div>

        <div>
          <Label>Nome do salão</Label>
          <Input className="mt-1.5" value={salonName} onChange={(e) => setSalonName(e.target.value)} placeholder="Opcional" />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label>Telefone</Label>
            <Input className="mt-1.5" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 99999-9999" />
          </div>
          <div>
            <Label>Instagram</Label>
            <Input className="mt-1.5" value={instagramHandle} onChange={(e) => setInstagramHandle(e.target.value)} placeholder="@usuario" />
          </div>
        </div>

        <div>
          <Label>E-mail</Label>
          <Input className="mt-1.5" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Opcional" />
        </div>

        <div>
          <Label>Canal de origem</Label>
          <Select value={channel} onValueChange={setChannel}>
            <SelectTrigger className="mt-1.5">
              <SelectValue placeholder="Selecione o canal" />
            </SelectTrigger>
            <SelectContent>
              {SALES_CHANNELS.map((option) => (
                <SelectItem key={option} value={option}>
                  {salesChannelLabel(option)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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

        <div>
          <Label>Script de abordagem</Label>
          <Select value={scriptId} onValueChange={setScriptId}>
            <SelectTrigger className="mt-1.5">
              <SelectValue placeholder="Selecione um script" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhum</SelectItem>
              {scriptOptions.map((script) => (
                <SelectItem key={script.id} value={script.id}>
                  {script.name} ({script.version})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Observações</Label>
          <Textarea className="mt-1.5 min-h-20" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <Button onClick={handleSubmit} disabled={submitting} className="w-fit self-end">
          {submitting ? "Criando..." : "Criar lead"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
