import areschatIcon from '../assets/iconeAresChat.png';
import { buildAresChatRedirectUrl } from '@/utils/areschat';

interface AresChatButtonProps {
  barbershopSlug?: string | null;
}

export function AresChatButton({ barbershopSlug }: AresChatButtonProps) {
  const areschatUrl = buildAresChatRedirectUrl(barbershopSlug);

  return (
    <a
      href={areschatUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Suporte via AresChat"
      className="inline-flex h-9 w-9 -translate-y-1 items-center justify-center rounded-full bg-[#1a73e8] p-0 text-sm font-semibold text-white no-underline transition-colors hover:bg-[#1558c0] sm:w-auto sm:translate-y-0 sm:gap-2 sm:px-4"
    >
      <img
        src={areschatIcon}
        alt=""
        className="h-[22px] w-[22px] flex-shrink-0 rounded-full object-cover"
      />
      <span className="hidden sm:inline">AresChat</span>
    </a>
  );
}
