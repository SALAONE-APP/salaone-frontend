import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";

interface Props {
  currentStep: number;
  totalSteps: number;
  content: string;
  disabled?: boolean;
  onNext: () => void;
  onPrev: () => void;
  onSkipOrFinish: () => void;
}

// Renderizado via portal direto pro document.body (não dentro do popover do
// reactour) - o popover do reactour fica aninhado sob #root, e em cenários
// com um diálogo Radix aberto por baixo, o overlay escuro do diálogo (que é
// filho direto do body) vence o hit-test mesmo com z-index menor que o do
// popover. Sendo filho direto do body igual o overlay, com z-index máximo,
// o painel do tour nunca fica atrás de nada.
export function TourStepPanel({ currentStep, totalSteps, content, disabled, onNext, onPrev, onSkipOrFinish }: Props) {
  const isFirst = currentStep === 0;
  const isLast = currentStep === totalSteps - 1;

  return createPortal(
    <div
      className="pointer-events-auto fixed bottom-6 left-1/2 z-[2147483647] w-72 -translate-x-1/2 flex flex-col gap-3 rounded-lg border border-border bg-background p-4 text-sm text-foreground shadow-2xl"
    >
      <p className="leading-relaxed">{content}</p>
      <div className="flex items-center justify-between gap-2 pt-1">
        <span className="text-xs text-muted-foreground">
          Passo {currentStep + 1} de {totalSteps}
        </span>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" disabled={disabled} onClick={onSkipOrFinish}>
            {isLast ? "Fechar" : "Pular tour"}
          </Button>
          {!isFirst && (
            <Button variant="outline" size="sm" className="h-7 px-2 text-xs" disabled={disabled} onClick={onPrev}>
              Voltar
            </Button>
          )}
          <Button size="sm" className="h-7 px-3 text-xs" disabled={disabled} onClick={isLast ? onSkipOrFinish : onNext}>
            {isLast ? "Concluir" : "Próximo"}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
