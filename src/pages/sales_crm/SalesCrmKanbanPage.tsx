import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { AlertTriangle, CircleDot, Filter, Instagram, Loader2, MessageCircle, Plus, Search, Settings2, UserCog } from "lucide-react";
import { toast } from "sonner";

import { SalesLeadCreateDialog } from "@/components/SalesLeadCreateDialog";
import { SalesLeadDetailDialog } from "@/components/SalesLeadDetailDialog";
import { SalesPipelineManagerDialog } from "@/components/SalesPipelineManagerDialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import {
  SALES_CHANNELS,
  SALES_CONTACT_STATUSES,
  SALES_LOST_REASONS,
  listSalesLeads,
  SALES_PRODUCT_BUSINESS_LABELS,
  SALES_PRODUCT_LABELS,
  salesChannelLabel,
  salesContactStatusLabel,
  salesLeadChannelLabel,
  salesLostReasonLabel,
  updateSalesLead,
  type SalesContactStatus,
  type SalesLead,
  type UpdateSalesLeadInput,
} from "@/service/salesCrmService";
import { listSuperAdminUsers, type SuperAdminUser } from "@/service/superAdminService";
import { useSalesPipelines } from "@/hooks/useSalesPipelines";
import { useSalesProduct } from "@/hooks/useSalesProduct";

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function isOverdue(lead: SalesLead) {
  if (!lead.nextActionAt) return false;
  if (lead.resolvedAt) return false;
  return new Date(lead.nextActionAt).getTime() < Date.now();
}

const CONTACT_STATUS_BADGE_CLASSES: Record<SalesContactStatus, string> = {
  aguardando_resposta: "border-transparent bg-[hsl(var(--warning)/0.15)] text-[hsl(var(--warning))]",
  respondeu: "border-transparent bg-[hsl(var(--success)/0.15)] text-[hsl(var(--success))]",
  nao_respondeu: "border-transparent bg-destructive/15 text-destructive",
};

// No toque, o card so vira arraste depois de segurado parado; antes disso o gesto e rolagem da tela.
const TOUCH_DRAG_HOLD_MS = 300;
const TOUCH_SCROLL_TOLERANCE_PX = 8;

interface PendingLostReasonDrag {
  stageKey: string;
  siblingIds: string[];
  cardId: string;
}

// Igual ao teto da API (GET /sales-crm/leads aceita ate 500).
const LEADS_FETCH_LIMIT = 500;

export function SalesCrmKanbanPage() {
  const product = useSalesProduct();
  const business = SALES_PRODUCT_BUSINESS_LABELS[product];
  const [searchParams, setSearchParams] = useSearchParams();
  const { pipelines, loading: pipelinesLoading, reload: reloadPipelines } = useSalesPipelines(product);
  const [managerOpen, setManagerOpen] = useState(false);
  // Funil aberto: o da URL (?pipeline=) se existir neste produto, senao o padrao.
  const activePipeline = useMemo(
    () => pipelines.find((item) => item.id === searchParams.get("pipeline")) ?? pipelines[0] ?? null,
    [pipelines, searchParams],
  );
  const activePipelineId = activePipeline?.id ?? null;
  const lostStageKeys = useMemo(
    () => new Set((activePipeline?.stages ?? []).filter((stage) => stage.terminalOutcome === "perdido").map((stage) => stage.key)),
    [activePipeline],
  );
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "super_admin";

  const [leads, setLeads] = useState<SalesLead[]>([]);
  const [totalLeads, setTotalLeads] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [channelFilter, setChannelFilter] = useState("all");
  const [contactStatusFilter, setContactStatusFilter] = useState("all");
  const [responsibleFilter, setResponsibleFilter] = useState("all");
  const [responsibleOptions, setResponsibleOptions] = useState<SuperAdminUser[]>([]);

  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const [dragOverCardId, setDragOverCardId] = useState<string | null>(null);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const [pendingLostReasonDrag, setPendingLostReasonDrag] = useState<PendingLostReasonDrag | null>(null);
  const [pendingLostReason, setPendingLostReason] = useState("");

  const leadsRef = useRef<SalesLead[]>([]);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    if (!silent) setError(null);
    try {
      if (!activePipelineId) return;
      const result = await listSalesLeads({ product, pipelineId: activePipelineId, limit: LEADS_FETCH_LIMIT });
      setLeads(result.items);
      setTotalLeads(result.total);
    } catch {
      if (!silent) setError("Não foi possível carregar o funil de vendas.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [product, activePipelineId]);

  useEffect(() => {
    void load();
    if (isSuperAdmin) {
      Promise.all([
        listSuperAdminUsers({ role: "sales_rep", limit: 100 }),
        listSuperAdminUsers({ role: "super_admin", limit: 100 }),
      ])
        .then(([reps, admins]) => setResponsibleOptions([...reps.items, ...admins.items]))
        .catch(() => null);
    }
  }, [load, isSuperAdmin]);

  useEffect(() => {
    leadsRef.current = leads;
  }, [leads]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void load(true);
    }, 15000);
    return () => window.clearInterval(timer);
  }, [load]);

  const visibleLeads = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("pt-BR");
    return leads.filter((lead) => {
      if (query) {
        const haystack = [lead.contactName, lead.salonName ?? "", lead.phone, lead.instagramHandle ?? "", lead.responsibleName ?? "", lead.channelOther ?? ""]
          .join(" ")
          .toLocaleLowerCase("pt-BR");
        if (!haystack.includes(query)) return false;
      }
      if (channelFilter !== "all" && lead.channel !== channelFilter) return false;
      if (contactStatusFilter === "none" && lead.contactStatus) return false;
      if (contactStatusFilter !== "all" && contactStatusFilter !== "none" && lead.contactStatus !== contactStatusFilter) return false;
      if (isSuperAdmin && responsibleFilter !== "all" && lead.responsibleId !== responsibleFilter) return false;
      return true;
    });
  }, [leads, search, channelFilter, contactStatusFilter, responsibleFilter, isSuperAdmin]);

  const columns = useMemo(
    () =>
      (activePipeline?.stages ?? []).map((stage) => {
        // Empate de sortOrder: mais antigo primeiro (lead novo entra no fim da coluna, como sempre foi).
        const stageCards = visibleLeads
          .filter((lead) => lead.stage === stage.key)
          .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt));
        return { key: stage.key, label: stage.label, cards: stageCards };
      }),
    [visibleLeads, activePipeline],
  );

  async function reorderColumn(stageKey: string, orderedIds: string[], draggedCardId: string, lostReason?: string) {
    const previousLeads = leadsRef.current;
    const draggedLead = previousLeads.find((item) => item.id === draggedCardId);
    const stageChanged = Boolean(draggedLead && draggedLead.stage !== stageKey);
    const nextSortOrderById = new Map(orderedIds.map((id, index) => [id, (index + 1) * 10]));

    setLeads((prev) =>
      prev.map((item) => {
        if (!nextSortOrderById.has(item.id)) return item;
        const isDragged = item.id === draggedCardId;
        return {
          ...item,
          stage: isDragged ? stageKey : item.stage,
          sortOrder: nextSortOrderById.get(item.id)!,
          lostReason: isDragged && stageChanged && lostStageKeys.has(stageKey) ? lostReason ?? item.lostReason : item.lostReason,
        };
      }),
    );

    const changed = previousLeads.filter(
      (item) => nextSortOrderById.has(item.id) && (item.id === draggedCardId || item.sortOrder !== nextSortOrderById.get(item.id)),
    );

    try {
      await Promise.all(
        changed.map((item) => {
          const payload: UpdateSalesLeadInput = { sortOrder: nextSortOrderById.get(item.id)! };
          if (item.id === draggedCardId && stageChanged) {
            payload.stage = stageKey;
            if (lostStageKeys.has(stageKey)) payload.lostReason = lostReason;
          }
          return updateSalesLead(item.id, payload);
        }),
      );
    } catch {
      setLeads(previousLeads);
      toast.error("Não foi possível mover o lead. Tente novamente.");
    }
  }

  const dragStateRef = useRef<{
    cardId: string;
    pointerId: number;
    startX: number;
    startY: number;
    moved: boolean;
    // Mouse/caneta: armado de cara. Toque: so depois de segurar TOUCH_DRAG_HOLD_MS sem mexer.
    armed: boolean;
    holdTimer: number | null;
    ghost: HTMLDivElement | null;
  } | null>(null);
  const justDraggedRef = useRef(false);
  const [armedCardId, setArmedCardId] = useState<string | null>(null);

  // Com o card armado, bloqueia a rolagem nativa para o dedo arrastar o card em vez da tela.
  // Precisa ser listener nao-passivo: preventDefault em pointermove nao impede o scroll.
  useEffect(() => {
    function blockScrollWhileDragging(event: TouchEvent) {
      if (dragStateRef.current?.armed) event.preventDefault();
    }
    document.addEventListener("touchmove", blockScrollWhileDragging, { passive: false });
    return () => document.removeEventListener("touchmove", blockScrollWhileDragging);
  }, []);

  function clearDragState() {
    const state = dragStateRef.current;
    if (state?.holdTimer) window.clearTimeout(state.holdTimer);
    state?.ghost?.remove();
    dragStateRef.current = null;
    setArmedCardId(null);
    setDragOverStage(null);
    setDragOverCardId(null);
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>, lead: SalesLead) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const isTouch = event.pointerType === "touch";
    if (!isTouch) event.currentTarget.setPointerCapture(event.pointerId);
    const state = {
      cardId: lead.id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
      armed: !isTouch,
      holdTimer: null as number | null,
      ghost: null,
    };
    if (isTouch) {
      state.holdTimer = window.setTimeout(() => {
        if (dragStateRef.current !== state) return;
        state.armed = true;
        state.holdTimer = null;
        setArmedCardId(lead.id);
        navigator.vibrate?.(15);
      }, TOUCH_DRAG_HOLD_MS);
    }
    dragStateRef.current = state;
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const state = dragStateRef.current;
    if (!state || event.pointerId !== state.pointerId) return;

    const dx = event.clientX - state.startX;
    const dy = event.clientY - state.startY;

    if (!state.armed) {
      // Dedo andou antes de completar o "segurar": e rolagem, larga o card.
      if (Math.hypot(dx, dy) > TOUCH_SCROLL_TOLERANCE_PX) clearDragState();
      return;
    }

    if (!state.moved) {
      if (Math.hypot(dx, dy) < 6) return;
      state.moved = true;
      const draggedLead = leadsRef.current.find((item) => item.id === state.cardId);
      const ghost = document.createElement("div");
      ghost.textContent = draggedLead?.contactName ?? "";
      ghost.style.cssText =
        "position:fixed;top:0;left:0;z-index:9999;pointer-events:none;padding:6px 12px;border-radius:9999px;background:hsl(var(--primary));color:hsl(var(--primary-foreground));font-size:12px;font-weight:500;box-shadow:0 8px 20px rgba(0,0,0,0.25);";
      document.body.appendChild(ghost);
      state.ghost = ghost;
    }

    event.preventDefault();
    if (state.ghost) {
      state.ghost.style.transform = `translate3d(${event.clientX + 14}px, ${event.clientY + 14}px, 0)`;
    }

    const hovered = document.elementFromPoint(event.clientX, event.clientY);
    const columnKey = hovered?.closest<HTMLElement>("[data-column-key]")?.dataset.columnKey ?? null;
    const hoveredCardId = hovered?.closest<HTMLElement>("[data-card-id]")?.dataset.cardId ?? null;

    setDragOverStage(columnKey);
    setDragOverCardId(hoveredCardId && hoveredCardId !== state.cardId ? hoveredCardId : null);
  }

  async function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const state = dragStateRef.current;
    if (!state || event.pointerId !== state.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    const stageKey = dragOverStage;
    const targetCardId = dragOverCardId;
    clearDragState();

    if (!state.moved || !stageKey) return;
    justDraggedRef.current = true;

    const columnCards = leadsRef.current.filter((item) => item.stage === stageKey).sort((a, b) => a.sortOrder - b.sortOrder);
    const targetCard = targetCardId ? columnCards.find((item) => item.id === targetCardId) : undefined;
    const siblingIds = columnCards.filter((item) => item.id !== state.cardId).map((item) => item.id);

    if (targetCard) {
      siblingIds.splice(siblingIds.indexOf(targetCard.id), 0, state.cardId);
    } else {
      siblingIds.push(state.cardId);
    }

    const draggedLead = leadsRef.current.find((item) => item.id === state.cardId);
    if (draggedLead && draggedLead.stage !== stageKey && lostStageKeys.has(stageKey)) {
      setPendingLostReason("");
      setPendingLostReasonDrag({ stageKey, siblingIds, cardId: state.cardId });
      return;
    }

    await reorderColumn(stageKey, siblingIds, state.cardId);
  }

  function handlePointerCancel(event: ReactPointerEvent<HTMLDivElement>) {
    const state = dragStateRef.current;
    if (!state || event.pointerId !== state.pointerId) return;
    clearDragState();
  }

  function handleCardClick(leadId: string) {
    if (justDraggedRef.current) {
      justDraggedRef.current = false;
      return;
    }
    setSelectedLeadId(leadId);
  }

  async function confirmLostReasonDrag() {
    if (!pendingLostReasonDrag) return;
    if (!pendingLostReason) {
      toast.error("Selecione o motivo da perda.");
      return;
    }
    const { stageKey, siblingIds, cardId } = pendingLostReasonDrag;
    setPendingLostReasonDrag(null);
    await reorderColumn(stageKey, siblingIds, cardId, pendingLostReason);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold text-foreground">Funil de Vendas · {SALES_PRODUCT_LABELS[product]}</h1>
          <p className="text-sm text-muted-foreground">
            Acompanhe a prospecção de novos clientes do {SALES_PRODUCT_LABELS[product]} ({business.plural}), do primeiro contato ao fechamento.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start">
          {isSuperAdmin && (
            <Button size="sm" variant="outline" className="gap-2" onClick={() => setManagerOpen(true)}>
              <Settings2 size={14} />
              Gerenciar funis
            </Button>
          )}
          <Button size="sm" className="gap-2" onClick={() => setCreateOpen(true)} disabled={!activePipeline}>
            <Plus size={14} />
            Novo Lead
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={`Buscar contato, ${business.singular}, telefone ou instagram...`}
            className="h-9 w-full bg-secondary pl-9 text-sm sm:w-72"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {pipelines.length > 1 && activePipeline && (
            <Select value={activePipeline.id} onValueChange={(value) => setSearchParams({ pipeline: value }, { replace: true })}>
              <SelectTrigger className="h-8 w-48 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pipelines.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Filter size={14} />
                Canal
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuRadioGroup value={channelFilter} onValueChange={setChannelFilter}>
                <DropdownMenuRadioItem value="all">Todos</DropdownMenuRadioItem>
                {SALES_CHANNELS.map((option) => (
                  <DropdownMenuRadioItem key={option} value={option}>
                    {salesChannelLabel(option)}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <CircleDot size={14} />
                Status
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuRadioGroup value={contactStatusFilter} onValueChange={setContactStatusFilter}>
                <DropdownMenuRadioItem value="all">Todos</DropdownMenuRadioItem>
                {SALES_CONTACT_STATUSES.map((option) => (
                  <DropdownMenuRadioItem key={option} value={option}>
                    {salesContactStatusLabel(option)}
                  </DropdownMenuRadioItem>
                ))}
                <DropdownMenuRadioItem value="none">Sem status</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          {isSuperAdmin && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <UserCog size={14} />
                  Vendedor
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuRadioGroup value={responsibleFilter} onValueChange={setResponsibleFilter}>
                  <DropdownMenuRadioItem value="all">Todos</DropdownMenuRadioItem>
                  {responsibleOptions.map((option) => (
                    <DropdownMenuRadioItem key={option.id} value={option.id}>
                      {option.name}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {!loading && totalLeads > leads.length && (
        <div className="flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm text-foreground">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-warning" />
          <p>
            Mostrando os {leads.length} leads mais recentes de {totalLeads}. Os mais antigos não aparecem no quadro; fale com o suporte para arquivar os
            que já foram resolvidos.
          </p>
        </div>
      )}

      {loading || pipelinesLoading ? (
        <div className="flex items-center justify-center rounded-xl border border-border bg-card p-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">{error}</div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {columns.map((column) => (
            <div
              key={column.key}
              data-column-key={column.key}
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
                    Nenhum lead aqui
                  </div>
                ) : (
                  column.cards.map((lead) => {
                    const overdue = isOverdue(lead);
                    return (
                      <div
                        key={lead.id}
                        data-card-id={lead.id}
                        onPointerDown={(event) => handlePointerDown(event, lead)}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onPointerCancel={handlePointerCancel}
                        onContextMenu={(event) => event.preventDefault()}
                        onClick={() => handleCardClick(lead.id)}
                        className={cn(
                          "cursor-grab select-none rounded-xl border border-border bg-card p-3 shadow-card transition-shadow [-webkit-touch-callout:none] hover:shadow-card-hover active:cursor-grabbing",
                          dragOverCardId === lead.id && "border-t-2 border-t-primary",
                          armedCardId === lead.id && "scale-[1.02] shadow-card-hover ring-2 ring-primary",
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-2">
                            <Avatar className="h-7 w-7">
                              <AvatarFallback className="text-[11px]">{getInitials(lead.contactName)}</AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-foreground">{lead.contactName}</p>
                              {lead.salonName && <p className="truncate text-xs text-muted-foreground">{lead.salonName}</p>}
                            </div>
                          </div>
                          {overdue && (
                            <span title="Próxima ação atrasada" className="shrink-0 text-[hsl(var(--warning))]">
                              <AlertTriangle size={14} />
                            </span>
                          )}
                        </div>

                        <div className="mt-2 flex flex-wrap gap-1">
                          <Badge className="text-[11px]">{salesLeadChannelLabel(lead)}</Badge>
                          {lead.contactStatus && (
                            <Badge variant="outline" className={cn("text-[11px]", CONTACT_STATUS_BADGE_CLASSES[lead.contactStatus])}>
                              {salesContactStatusLabel(lead.contactStatus)}
                            </Badge>
                          )}
                          {lead.lostReason && (
                            <Badge variant="outline" className="text-[11px]">
                              {salesLostReasonLabel(lead.lostReason)}
                            </Badge>
                          )}
                        </div>

                        <div className="mt-3 flex flex-col gap-1.5 text-xs text-muted-foreground">
                          {lead.instagramHandle && (
                            <div className="flex items-center gap-1.5">
                              <Instagram size={12} />
                              <span className="truncate">{lead.instagramHandle}</span>
                            </div>
                          )}
                          {lead.nextAction && (
                            <div className="flex items-start gap-1.5 text-foreground">
                              <MessageCircle size={12} className="mt-0.5 shrink-0" />
                              <span className="truncate">{lead.nextAction}</span>
                            </div>
                          )}
                          {isSuperAdmin && lead.responsibleName && (
                            <div className="flex items-center gap-1.5">
                              <UserCog size={12} />
                              <span className="truncate">{lead.responsibleName}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <SalesLeadDetailDialog leadId={selectedLeadId} onClose={() => setSelectedLeadId(null)} onChanged={() => void load()} />
      <SalesLeadCreateDialog
        product={product}
        pipelineId={activePipelineId ?? undefined}
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => void load()}
      />

      <SalesPipelineManagerDialog
        product={product}
        open={managerOpen}
        onClose={() => setManagerOpen(false)}
        pipelines={pipelines}
        onChanged={() => {
          void reloadPipelines().then((updated) => {
            // Se o funil aberto foi excluido, volta para o padrao; senao recarrega os leads dele.
            if (!updated.some((item) => item.id === activePipelineId)) setSearchParams({}, { replace: true });
            void load();
          });
        }}
      />

      <Dialog open={Boolean(pendingLostReasonDrag)} onOpenChange={(open) => !open && setPendingLostReasonDrag(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Motivo da perda</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Informe por que este lead foi perdido antes de mover para a coluna Perdido.</p>
          <Select value={pendingLostReason} onValueChange={setPendingLostReason}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o motivo" />
            </SelectTrigger>
            <SelectContent>
              {SALES_LOST_REASONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {salesLostReasonLabel(option)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingLostReasonDrag(null)}>
              Cancelar
            </Button>
            <Button onClick={confirmLostReasonDrag}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
