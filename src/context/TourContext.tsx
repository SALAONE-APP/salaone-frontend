import { createContext, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { TourProvider as ReactourProvider, useTour } from "@reactour/tour";

import { TourStepPanel } from "@/components/relationship-tour/TourStepPanel";
import { relationshipTourSteps } from "@/lib/relationshipTourSteps";
import { waitForSelector } from "@/lib/waitForSelector";
import type { RelationshipTourControls } from "@/lib/relationshipTourTypes";

const HAS_SEEN_TOUR_KEY = "relationship:hasSeenTour";

interface RelationshipTourContextValue {
  registerControls: (controls: RelationshipTourControls) => void;
  unregisterControls: () => void;
  startTour: () => void;
  hasSeenTour: boolean;
  isTourOpen: boolean;
}

export const RelationshipTourContext = createContext<RelationshipTourContextValue | null>(null);

// @reactour/tour só expõe setIsOpen/isOpen pra quem está DENTRO do
// <TourProvider> (via useTour()) - esse componente existe pra capturar isso
// e entregar pro provider de fora, via ref + callback. Não renderiza nada.
function TourOpenBridge({
  setIsOpenRef,
  onOpenChange,
}: {
  setIsOpenRef: React.MutableRefObject<((open: boolean) => void) | null>;
  onOpenChange: (open: boolean) => void;
}) {
  const { setIsOpen, isOpen } = useTour();
  useEffect(() => {
    setIsOpenRef.current = setIsOpen;
    return () => {
      setIsOpenRef.current = null;
    };
  }, [setIsOpen, setIsOpenRef]);

  useEffect(() => {
    onOpenChange(isOpen);
  }, [isOpen, onOpenChange]);

  // Diálogos Radix (ex.: RelationshipCreateCardDialog) marcam todo mundo fora
  // do modal como aria-hidden="true" (via a lib "aria-hidden", que usa o
  // marcador data-aria-hidden pra saber o que ela mesma escondeu e poder
  // restaurar depois) - inclusive o popover do tour, que é um portal irmão,
  // não filho do modal. Isso não afeta a aparência, mas quem testa/navega
  // via acessibilidade (leitor de tela, e o próprio Playwright) trata esse
  // subtree como inexistente pra interação. Enquanto o tour estiver aberto,
  // desmarca especificamente o que essa lib marcou, sem mexer em nenhum
  // aria-hidden que o próprio app already usa de propósito.
  useEffect(() => {
    if (!isOpen) return;
    function unhide() {
      document.querySelectorAll("[data-aria-hidden]").forEach((el) => {
        el.removeAttribute("aria-hidden");
        el.removeAttribute("data-aria-hidden");
      });
    }
    unhide();
    const observer = new MutationObserver(unhide);
    observer.observe(document.body, { attributes: true, attributeFilter: ["aria-hidden", "data-aria-hidden"], subtree: true });
    return () => observer.disconnect();
  }, [isOpen]);

  return null;
}

export function RelationshipTourProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const controlsRef = useRef<RelationshipTourControls | null>(null);
  const setIsOpenRef = useRef<((open: boolean) => void) | null>(null);
  const runIdRef = useRef(0);

  const [currentStep, setCurrentStep] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isTourOpen, setIsTourOpen] = useState(false);
  const [hasSeenTour, setHasSeenTour] = useState(() => {
    try {
      return localStorage.getItem(HAS_SEEN_TOUR_KEY) === "true";
    } catch {
      return false;
    }
  });

  const markSeen = useCallback(() => {
    try {
      localStorage.setItem(HAS_SEEN_TOUR_KEY, "true");
    } catch {
      /* ambiente sem localStorage (ex.: aba privada bloqueando) - segue sem persistir */
    }
    setHasSeenTour(true);
  }, []);

  const registerControls = useCallback((controls: RelationshipTourControls) => {
    controlsRef.current = controls;
  }, []);
  const unregisterControls = useCallback(() => {
    controlsRef.current = null;
  }, []);

  // Sai do passo atual (fecha diálogo se o passo pedir) e entra no alvo
  // (navega de rota se precisar, abre diálogo se o passo pedir), só então
  // espera o elemento existir de verdade no DOM antes de mover o spotlight.
  // Roda igual pra frente ou pra trás - onExit/onEnter são sempre simétricos.
  const goToStep = useCallback(
    async (targetIndex: number) => {
      if (targetIndex < 0 || targetIndex >= relationshipTourSteps.length) return;
      // Nunca deixa uma segunda transição começar enquanto a anterior ainda
      // está esperando o elemento aparecer (navegação/diálogo tem latência
      // real) - sem isso, cliques rápidos ou rede lenta deixam o passo
      // anterior "órfão" (currentStep nunca chega a atualizar pra ele).
      if (isTransitioning) return;
      const runId = ++runIdRef.current;
      setIsTransitioning(true);

      try {
        relationshipTourSteps[currentStep]?.onExit?.(controlsRef.current);

        const step = relationshipTourSteps[targetIndex];
        if (location.pathname !== step.route) {
          navigate(step.route);
        }
        step.onEnter?.(controlsRef.current);

        const el = await waitForSelector(step.selector, { timeoutMs: 4000 });
        if (runId !== runIdRef.current) return; // outro goToStep começou antes deste terminar

        if (!el) {
          console.warn(`[relationship-tour] selector not found for step "${step.id}": ${step.selector}`);
        } else {
          el.scrollIntoView({ block: "center", behavior: "smooth" });
        }
        setCurrentStep(targetIndex);
      } finally {
        if (runId === runIdRef.current) setIsTransitioning(false);
      }
    },
    [currentStep, isTransitioning, location.pathname, navigate],
  );

  const startTour = useCallback(() => {
    void goToStep(0).then(() => setIsOpenRef.current?.(true));
  }, [goToStep]);

  const reactourSteps = useMemo(
    () => relationshipTourSteps.map((step) => ({ selector: step.selector, content: step.content })),
    [],
  );

  const contextValue = useMemo<RelationshipTourContextValue>(
    () => ({ registerControls, unregisterControls, startTour, hasSeenTour, isTourOpen }),
    [registerControls, unregisterControls, startTour, hasSeenTour, isTourOpen],
  );

  return (
    <RelationshipTourContext.Provider value={contextValue}>
      {/* A máscara do reactour usa um <rect> com pointer-events:auto pra
          suportar "clicar fora fecha o tour" - não usamos isso (onClickMask
          é no-op de propósito), e esse rect às vezes intercepta cliques nos
          próprios botões do painel do tour quando há um diálogo real aberto
          por baixo. Como não precisamos de clique na máscara, desligar
          pointer-events nela resolve sem tocar em nada da biblioteca. */}
      <style>{`.reactour__mask, .reactour__mask * { pointer-events: none !important; }`}</style>
      <ReactourProvider
        steps={reactourSteps}
        currentStep={currentStep}
        setCurrentStep={setCurrentStep}
        defaultOpen={false}
        showBadge={false}
        showCloseButton
        disableInteraction={false}
        onClickMask={() => {
          /* clicar fora do spotlight não fecha o tour, evita perder o lugar sem querer */
        }}
        ContentComponent={(props) => (
          <TourStepPanel
            currentStep={props.currentStep}
            totalSteps={relationshipTourSteps.length}
            content={String(props.steps[props.currentStep]?.content ?? "")}
            disabled={isTransitioning}
            onNext={() => void goToStep(props.currentStep + 1)}
            onPrev={() => void goToStep(props.currentStep - 1)}
            onSkipOrFinish={() => {
              props.setIsOpen(false);
              markSeen();
            }}
          />
        )}
      >
        <TourOpenBridge setIsOpenRef={setIsOpenRef} onOpenChange={setIsTourOpen} />
        {children}
      </ReactourProvider>
    </RelationshipTourContext.Provider>
  );
}
