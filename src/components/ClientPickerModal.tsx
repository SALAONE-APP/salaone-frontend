import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, Search, UserPlus, User } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createAdminClient } from "@/service/adminClientService";
import { listClientOptions, type UserProfile } from "@/service/userService";

interface ClientPickerModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (client: UserProfile) => void;
}

function extractErrorMessage(error: unknown, fallback: string) {
  const value = (error as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
  return typeof value === "string" ? value : fallback;
}

const PAGE_SIZE = 15;

export function ClientPickerModal({ open, onClose, onSelect }: ClientPickerModalProps) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<UserProfile[]>([]);
  const [total, setTotal] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [submittingNew, setSubmittingNew] = useState(false);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    listClientOptions({
      q: debouncedSearch || undefined,
      page,
      limit: PAGE_SIZE,
    })
      .then((r) => { setClients(r.items); setTotal(r.total); })
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [open, debouncedSearch, page]);

  useEffect(() => {
    if (!open) {
      setSearch("");
      setDebouncedSearch("");
      setPage(1);
      setClients([]);
      setTotal(0);
      setCreating(false);
      setNewName("");
      setNewPhone("");
    }
  }, [open]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  async function handleCreateClient() {
    if (!newName.trim() || !newPhone.trim()) {
      toast.error("Preencha nome e telefone.");
      return;
    }
    setSubmittingNew(true);
    try {
      const client = await createAdminClient({ name: newName.trim(), phone: newPhone.trim() });
      toast.success("Cliente cadastrado.");
      onSelect(client);
      onClose();
    } catch (error) {
      toast.error(extractErrorMessage(error, "Não foi possível cadastrar o cliente."));
    } finally {
      setSubmittingNew(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Selecionar Cliente</DialogTitle>
        </DialogHeader>

        {creating ? (
          <div className="flex flex-col gap-3 rounded-md border border-border p-4">
            <div>
              <Label>Nome</Label>
              <Input className="mt-1.5" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nome completo" autoFocus />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input className="mt-1.5" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="(00) 00000-0000" />
            </div>
            <p className="text-xs text-muted-foreground">
              Cadastro rápido, só o essencial — dá pra completar o resto do cadastro depois em Clientes.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setCreating(false)}>
                Cancelar
              </Button>
              <Button size="sm" onClick={handleCreateClient} disabled={submittingNew}>
                {submittingNew ? "Cadastrando..." : "Cadastrar e selecionar"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, e-mail ou telefone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              autoFocus
            />
          </div>
        )}

        {!creating && (
          <div className="min-h-0 flex-1 overflow-y-auto rounded-md border border-border">
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 size={20} className="animate-spin text-muted-foreground" />
              </div>
            ) : clients.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-10 text-sm text-muted-foreground">
                <User size={32} className="opacity-20" />
                <span>Nenhum cliente encontrado.</span>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => { setNewName(search.trim()); setCreating(true); }}
                >
                  <UserPlus size={14} />
                  Cadastrar novo cliente
                </Button>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {clients.map((client) => (
                  <li key={client.id}>
                    <button
                      type="button"
                      className="w-full px-4 py-3 text-left transition-colors hover:bg-secondary/60"
                      onClick={() => { onSelect(client); onClose(); }}
                    >
                      <span className="block font-medium text-foreground">{client.name}</span>
                      {client.email && (
                        <span className="block text-xs text-muted-foreground">{client.email}</span>
                      )}
                      {client.phone && (
                        <span className="block text-xs text-muted-foreground">{client.phone}</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {!creating && clients.length > 0 && (
          <button
            type="button"
            onClick={() => { setNewName(search.trim()); setCreating(true); }}
            className="self-start text-xs font-medium text-primary hover:underline"
          >
            + Não encontrou? Cadastrar novo cliente
          </button>
        )}

        {!creating && (
          <div className="flex items-center justify-between border-t border-border pt-3 text-sm text-muted-foreground">
            <span>{total} cliente{total !== 1 ? "s" : ""}</span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft size={14} />
              </Button>
              <span className="text-xs">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight size={14} />
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
