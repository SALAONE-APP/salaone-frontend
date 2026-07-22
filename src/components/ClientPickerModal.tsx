import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, Search, User } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { listClientOptions, type UserProfile } from "@/service/userService";

interface ClientPickerModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (client: UserProfile) => void;
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
    }
  }, [open]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Selecionar Cliente</DialogTitle>
        </DialogHeader>

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

        <div className="min-h-0 flex-1 overflow-y-auto rounded-md border border-border">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 size={20} className="animate-spin text-muted-foreground" />
            </div>
          ) : clients.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-sm text-muted-foreground">
              <User size={32} className="opacity-20" />
              <span>Nenhum cliente encontrado.</span>
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
      </DialogContent>
    </Dialog>
  );
}
