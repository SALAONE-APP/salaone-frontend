export interface RelationshipTourControls {
  openCreateDialog: () => void;
  closeCreateDialog: () => void;
  openManagerDialog: () => void;
  closeManagerDialog: () => void;
  openAutomationDialog: () => void;
  closeAutomationDialog: () => void;
  // Sem argumento, abre o detalhe do último card criado no tour.
  openCardDetail: (cardId?: string) => void;
  closeCardDetail: () => void;
}

export type RelationshipTourRoute = "/relationship-kanban" | "/relationship-dashboard";

export interface RelationshipTourStepConfig {
  id: string;
  route: RelationshipTourRoute;
  selector: string;
  content: string;
  onEnter?: (controls: RelationshipTourControls | null) => void;
  onExit?: (controls: RelationshipTourControls | null) => void;
}
