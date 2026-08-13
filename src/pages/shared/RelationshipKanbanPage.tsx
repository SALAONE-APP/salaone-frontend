import { useCallback, useEffect, useMemo, useState, type DragEvent } from "react";
import {
  ArrowUpDown,
  Clock,
  Filter,
  Loader2,
  MessageCircle,
  Repeat,
  Scissors,
  Search,
  UserCog,
  UserRound,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  listRelationshipCards,
  updateRelationshipCard,
  type RelationshipCard,
  type RelationshipStage,
} from "@/service/relationshipService";

const STAGE_META: { key: RelationshipStage; label: string }[] = [
  { key: "contato_pendente", label: "Contato pendente" },
  { key: "em_contato", label: "Em contato" },
  { key: "aguardando_cliente", label: "Aguardando cliente" },
  { key: "retorno_agendado", label: "Retorno agendado" },
  { key: "recuperado", label: "Recuperado" },
  { key: "encerrado", label: "Encerrado" },
];

const REASON_LABELS: Record<string, string> = {
  retorno_atrasado: "Retorno atrasado",
  primeiro_atendimento_sem_retorno: "1º atendimento sem retorno",
  aniversario: "Aniversário",
  pos_atendimento: "Pós-atendimento",
  avaliacao_baixa: "Avaliação baixa",
  tratamento_em_continuidade: "Tratamento em continuidade",
  oportunidade_manual: "Oportunidade identificada",
};

type SortMode = "default" | "days" | "ticket";

function reasonLabel(reason: string) {
  return REASON_LABELS[reason] ?? reason;
}

function formatCurrency(value: number | null) {
  if (value === null) return "-";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value);
}

function formatDaysSince(value: number | null) {
  if (value === null) return "Sem visitas";
  if (value === 0) return "Hoje";
  return `${value} dia${value === 1 ? "" : "s"}`;
}

function formatFrequency(value: number | null) {
  if (value === null) return "-";
  return `~${Math.round(value)} dias`;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function RelationshipKanbanPage() {
  const [cards, setCards] = useState<RelationshipCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [responsibleFilter, setResponsibleFilter] = useState("all");
  const [sortBy, setSortBy] = useState<SortMode>("default");
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listRelationshipCards();
      setCards(result);
    } catch {
      setError("Não foi possível carregar o Kanban de relacionamento.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const responsibleOptions = useMemo(() => {
    const map = new Map<string, string>();
    cards.forEach((card) => {
      if (card.responsibleSalonUserId && card.responsibleName) {
        map.set(card.responsibleSalonUserId, card.responsibleName);
      }
    });
    return Array.from(map.entries());
  }, [cards]);

  const visibleCards = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("pt-BR");
    let list = cards.filter((card) => {
      if (query && !card.clientName.toLocaleLowerCase("pt-BR").includes(query)) return false;
      if (responsibleFilter !== "all" && card.responsibleSalonUserId !== responsibleFilter) return false;
      return true;
    });
    if (sortBy === "days") {
      list = [...list].sort((a, b) => (b.stats.daysSinceLastVisit ?? -1) - (a.stats.daysSinceLastVisit ?? -1));
    } else if (sortBy === "ticket") {
      list = [...list].sort((a, b) => (b.stats.averageTicket ?? 0) - (a.stats.averageTicket ?? 0));
    }
    return list;
  }, [cards, search, responsibleFilter, sortBy]);

  const columns = useMemo(
    () =>
      STAGE_META.map((meta) => {
        const stageCards = visibleCards.filter((card) => card.stage === meta.key);
        const ordered = sortBy === "default" ? [...stageCards].sort((a, b) => a.sortOrder - b.sortOrder) : stageCards;
        return { ...meta, cards: ordered };
      }),
    [visibleCards, sortBy],
  );

  function handleDragStart(event: DragEvent<HTMLDivElement>, cardId: string) {
    event.dataTransfer.setData("text/plain", cardId);
    event.dataTransfer.effectAllowed = "move";
  }

  function handleDragOverColumn(event: DragEvent<HTMLDivElement>, stageKey: string) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDragOverStage(stageKey);
  }

  function handleDragLeaveColumn() {
    setDragOverStage(null);
  }

  async function handleDropColumn(event: DragEvent<HTMLDivElement>, stageKey: RelationshipStage) {
    event.preventDefault();
    const cardId = event.dataTransfer.getData("text/plain");
    setDragOverStage(null);
    if (!cardId) return;

    const card = cards.find((item) => item.id === cardId);
    if (!card || card.stage === stageKey) return;

    const targetColumnCount = cards.filter((item) => item.stage === stageKey).length;
    const newSortOrder = (targetColumnCount + 1) * 10;
    const previousCards = cards;

    setCards((prev) => prev.map((item) => (item.id === cardId ? { ...item, stage: stageKey, sortOrder: newSortOrder } : item)));

    try {
      await updateRelationshipCard(cardId, { stage: stageKey, sortOrder: newSortOrder });
    } catch {
      setCards(previousCards);
      toast.error("Não foi possível mover o card. Tente novamente.");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-foreground">Kanban de Relacionamento</h1>
        <p className="text-sm text-muted-foreground">
          Acompanhe clientes em risco, retornos e oportunidades identificadas na operação do salão.
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar cliente..."
            className="h-9 w-full bg-secondary pl-9 text-sm sm:w-64"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Filter size={14} />
                Responsável
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuRadioGroup value={responsibleFilter} onValueChange={setResponsibleFilter}>
                <DropdownMenuRadioItem value="all">Todos</DropdownMenuRadioItem>
                {responsibleOptions.map(([id, name]) => (
                  <DropdownMenuRadioItem key={id} value={id}>
                    {name}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <ArrowUpDown size={14} />
                Ordenar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuRadioGroup value={sortBy} onValueChange={(value) => setSortBy(value as SortMode)}>
                <DropdownMenuRadioItem value="default">Padrão</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="days">Mais dias sem retornar</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="ticket">Maior ticket médio</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center rounded-xl border border-border bg-card p-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">{error}</div>
      ) : visibleCards.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-16 text-center text-sm text-muted-foreground">
          Nenhum card encontrado com os filtros atuais.
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {columns.map((column) => (
            <div
              key={column.key}
              onDragOver={(event) => handleDragOverColumn(event, column.key)}
              onDragLeave={handleDragLeaveColumn}
              onDrop={(event) => handleDropColumn(event, column.key)}
              className={cn(
                "flex w-72 shrink-0 flex-col gap-3 rounded-xl border bg-muted/60 p-3 transition-colors",
                dragOverStage === column.key ? "border-primary bg-primary/5" : "border-border",
              )}
            >
              <div className="flex items-center justify-between px-1">
                <span className="text-sm font-medium text-foreground">{column.label}</span>
                <Badge variant="secondary" className="rounded-full">
                  {column.cards.length}
                </Badge>
              </div>

              <div className="flex flex-col gap-2">
                {column.cards.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                    Nenhum card aqui
                  </div>
                ) : (
                  column.cards.map((card) => {
                    const primaryTrigger = card.triggers.find((trigger) => trigger.isPrimary) ?? null;
                    const secondaryTriggers = card.triggers.filter((trigger) => !trigger.isPrimary);

                    return (
                      <div
                        key={card.id}
                        draggable
                        onDragStart={(event) => handleDragStart(event, card.id)}
                        className="cursor-grab rounded-xl border border-border bg-card p-3 shadow-card transition-shadow hover:shadow-card-hover active:cursor-grabbing"
                      >
                        <div className="flex items-center gap-2">
                          <Avatar className="h-7 w-7">
                            <AvatarFallback className="text-[11px]">{getInitials(card.clientName)}</AvatarFallback>
                          </Avatar>
                          <span className="truncate text-sm font-medium text-foreground">{card.clientName}</span>
                        </div>

                        <div className="mt-2 flex flex-wrap gap-1">
                          {primaryTrigger && (
                            <Badge className="text-[11px]">{reasonLabel(primaryTrigger.reason)}</Badge>
                          )}
                          {secondaryTriggers.map((trigger) => (
                            <Badge key={trigger.id} variant="outline" className="text-[11px]">
                              {reasonLabel(trigger.reason)}
                            </Badge>
                          ))}
                        </div>

                        <div className="mt-3 flex flex-col gap-1.5 text-xs text-muted-foreground">
                          {card.stats.favoriteService && (
                            <div className="flex items-center gap-1.5">
                              <Scissors size={12} />
                              <span className="truncate">{card.stats.favoriteService}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1.5">
                            <Clock size={12} />
                            <span>Última visita: {formatDaysSince(card.stats.daysSinceLastVisit)}</span>
                          </div>
                          {card.stats.averageFrequencyDays !== null && (
                            <div className="flex items-center gap-1.5">
                              <Repeat size={12} />
                              <span>Frequência média: {formatFrequency(card.stats.averageFrequencyDays)}</span>
                            </div>
                          )}
                          {card.stats.favoriteProfessional && (
                            <div className="flex items-center gap-1.5">
                              <UserRound size={12} />
                              <span className="truncate">{card.stats.favoriteProfessional}</span>
                            </div>
                          )}
                          {card.stats.averageTicket !== null && (
                            <div className="flex items-center gap-1.5">
                              <Wallet size={12} />
                              <span>Ticket médio: {formatCurrency(card.stats.averageTicket)}</span>
                            </div>
                          )}
                        </div>

                        {(card.nextAction || card.responsibleName) && (
                          <div className="mt-3 flex flex-col gap-1 border-t border-border pt-2 text-xs">
                            {card.nextAction && (
                              <div className="flex items-start gap-1.5 text-foreground">
                                <MessageCircle size={12} className="mt-0.5 shrink-0" />
                                <span className="truncate">{card.nextAction}</span>
                              </div>
                            )}
                            {card.responsibleName && (
                              <div className="flex items-center gap-1.5 text-muted-foreground">
                                <UserCog size={12} />
                                <span>{card.responsibleName}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
