import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Eye, Loader2, ReceiptText, Search } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listServiceTabs, type ServiceTab } from "@/service/serviceTabService";

function money(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function dateTime(value?: string | null) {
  return value
    ? new Date(value).toLocaleString("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
      })
    : "Não informado";
}

function dateKey(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function errorMessage(error: unknown) {
  const apiMessage = (error as { response?: { data?: { message?: string } } })
    ?.response?.data?.message;
  return apiMessage || "Não foi possível carregar o histórico de comandas.";
}

export function ServiceTabHistoryPage() {
  const [tabs, setTabs] = useState<ServiceTab[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedTab, setSelectedTab] = useState<ServiceTab | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        setTabs(await listServiceTabs("paid"));
      } catch (error) {
        toast.error(errorMessage(error));
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  const filteredTabs = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase("pt-BR");

    return tabs.filter((tab) => {
      const closedDate = dateKey(tab.closedAt);
      const matchesSearch =
        !normalizedSearch ||
        tab.appointment.client.name.toLocaleLowerCase("pt-BR").includes(normalizedSearch) ||
        tab.appointment.professional.displayName
          .toLocaleLowerCase("pt-BR")
          .includes(normalizedSearch) ||
        tab.id.toLocaleLowerCase("pt-BR").includes(normalizedSearch);
      const matchesStart = !startDate || closedDate >= startDate;
      const matchesEnd = !endDate || closedDate <= endDate;
      return matchesSearch && matchesStart && matchesEnd;
    });
  }, [endDate, search, startDate, tabs]);

  const total = filteredTabs.reduce((sum, tab) => sum + tab.total, 0);
  const average = filteredTabs.length ? total / filteredTabs.length : 0;

  return (
    <div className="space-y-6 pb-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Histórico de comandas</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Consulte todas as comandas pagas e fechadas do salão.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-5">
          <p className="text-sm text-muted-foreground">Comandas encontradas</p>
          <strong className="text-2xl">{filteredTabs.length}</strong>
        </div>
        <div className="rounded-xl border bg-card p-5">
          <p className="text-sm text-muted-foreground">Total recebido</p>
          <strong className="text-2xl">{money(total)}</strong>
        </div>
        <div className="rounded-xl border bg-card p-5">
          <p className="text-sm text-muted-foreground">Valor médio</p>
          <strong className="text-2xl">{money(average)}</strong>
        </div>
      </div>

      <div className="space-y-4 rounded-xl border bg-card p-4">
        <div className="grid gap-3 lg:grid-cols-[1fr_190px_190px_auto]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por cliente, profissional ou código"
              className="pl-9"
            />
          </div>
          <div className="relative">
            <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="date"
              aria-label="Data inicial"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="pl-9"
            />
          </div>
          <div className="relative">
            <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="date"
              aria-label="Data final"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              className="pl-9"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={!search && !startDate && !endDate}
            onClick={() => {
              setSearch("");
              setStartDate("");
              setEndDate("");
            }}
          >
            Limpar
          </Button>
        </div>

        {loading ? (
          <div className="grid place-items-center py-16">
            <Loader2 className="animate-spin text-muted-foreground" />
          </div>
        ) : filteredTabs.length === 0 ? (
          <div className="py-16 text-center">
            <ReceiptText className="mx-auto mb-3 h-9 w-9 text-muted-foreground" />
            <p className="font-medium">Nenhuma comanda fechada encontrada</p>
            <p className="text-sm text-muted-foreground">
              Ajuste os filtros ou aguarde o fechamento de uma comanda.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fechamento</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Profissional</TableHead>
                  <TableHead>Itens</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="w-20 text-right">Detalhes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTabs.map((tab) => (
                  <TableRow key={tab.id}>
                    <TableCell className="whitespace-nowrap">{dateTime(tab.closedAt)}</TableCell>
                    <TableCell className="font-medium">{tab.appointment.client.name}</TableCell>
                    <TableCell>{tab.appointment.professional.displayName}</TableCell>
                    <TableCell>{tab.items.reduce((sum, item) => sum + item.quantity, 0)}</TableCell>
                    <TableCell className="text-right font-semibold">{money(tab.total)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label={`Ver comanda de ${tab.appointment.client.name}`}
                        onClick={() => setSelectedTab(tab)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Dialog open={Boolean(selectedTab)} onOpenChange={(open) => !open && setSelectedTab(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes da comanda</DialogTitle>
          </DialogHeader>
          {selectedTab && (
            <div className="space-y-5">
              <div className="grid gap-3 rounded-lg border bg-muted/30 p-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">Cliente</p>
                  <p className="font-medium">{selectedTab.appointment.client.name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Profissional</p>
                  <p className="font-medium">{selectedTab.appointment.professional.displayName}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Aberta em</p>
                  <p className="font-medium">{dateTime(selectedTab.openedAt)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Fechada em</p>
                  <p className="font-medium">{dateTime(selectedTab.closedAt)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Código</p>
                  <p className="font-mono text-sm">{selectedTab.id.slice(0, 8).toUpperCase()}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Badge variant="outline">Paga e fechada</Badge>
                </div>
              </div>

              <div className="overflow-hidden rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead className="text-center">Qtd.</TableHead>
                      <TableHead className="text-right">Unitário</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedTab.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell className="text-center">{item.quantity}</TableCell>
                        <TableCell className="text-right">{money(item.unitPrice)}</TableCell>
                        <TableCell className="text-right">{money(item.total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-primary/5 p-4">
                <span className="font-medium">Total da comanda</span>
                <strong className="text-2xl">{money(selectedTab.total)}</strong>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
