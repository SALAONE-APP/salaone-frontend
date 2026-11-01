import type { MouseEvent, PointerEvent } from "react";
import { Instagram, MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { buildInstagramProfileUrl } from "@/utils/instagram";
import { buildWhatsAppChatUrl } from "@/utils/whatsapp";

interface Props {
  value: string | null | undefined;
  // "card": botao menor, para o card do Kanban.
  size?: "default" | "card";
  className?: string;
}

// No card do Kanban o clique abriria o detalhe e o pointerdown iniciaria o arraste.
function stopCardEvents(event: MouseEvent | PointerEvent) {
  event.stopPropagation();
}

function ContactLinkButton({
  url,
  label,
  disabledLabel,
  size = "default",
  className,
  children,
}: {
  url: string | null;
  label: string;
  disabledLabel: string;
  size?: Props["size"];
  className?: string;
  children: React.ReactNode;
}) {
  const buttonSize = size === "card" ? "icon-sm" : "icon";
  const sizeClass = size === "card" ? "size-6 [&_svg]:size-3.5" : undefined;

  if (!url) {
    return (
      <Button type="button" variant="outline" size={buttonSize} className={cn("shrink-0", sizeClass, className)} disabled title={disabledLabel} aria-label={disabledLabel}>
        {children}
      </Button>
    );
  }

  return (
    <Button asChild variant="outline" size={buttonSize} className={cn("shrink-0", sizeClass, className)}>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        title={label}
        aria-label={label}
        onClick={stopCardEvents}
        onPointerDown={stopCardEvents}
      >
        {children}
      </a>
    </Button>
  );
}

export function WhatsAppLinkButton({ value, size, className }: Props) {
  return (
    <ContactLinkButton
      url={buildWhatsAppChatUrl(value)}
      label="Abrir conversa no WhatsApp"
      disabledLabel="Informe um telefone válido para abrir o WhatsApp"
      size={size}
      className={cn("text-[#25D366] hover:text-[#25D366]", className)}
    >
      <MessageCircle />
    </ContactLinkButton>
  );
}

export function InstagramLinkButton({ value, size, className }: Props) {
  return (
    <ContactLinkButton
      url={buildInstagramProfileUrl(value)}
      label="Abrir perfil no Instagram"
      disabledLabel="Informe um @usuario válido para abrir o Instagram"
      size={size}
      className={cn("text-[#E1306C] hover:text-[#E1306C]", className)}
    >
      <Instagram />
    </ContactLinkButton>
  );
}
