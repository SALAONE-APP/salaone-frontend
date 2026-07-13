import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { Menu } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getProfileConfig } from "../../config/profileConfig";
import { useAuth } from "../../hooks/useAuth";
import { useSidebarMobile } from "../../layouts/ProfileLayout";
import { AresChatButton } from "../AresChatButton";

interface AppHeaderProps {
  title: string;
  breadcrumbs: string[];
  actionLabel: string;
  actionHref: string;
}

type StoredBarbershop = {
  name?: string;
  slug?: string;
  logoUrl?: string;
};

function getStoredBarbershop() {
  const storedBarbershop = localStorage.getItem("barbershop");

  if (!storedBarbershop) {
    return null;
  }

  try {
    return JSON.parse(storedBarbershop) as StoredBarbershop;
  } catch {
    return null;
  }
}

export function AppHeader({
  title,
  breadcrumbs,
  actionLabel,
  actionHref,
}: AppHeaderProps) {
  const { user } = useAuth();
  const { setOpen: setSidebarOpen } = useSidebarMobile();
  const [barbershop, setBarbershop] = useState<StoredBarbershop | null>(() =>
    getStoredBarbershop()
  );
  const profileConfig = getProfileConfig(user?.role);
  const userName = user?.name?.trim() || "Usuario";
  const barbershopName = barbershop?.name?.trim() || "SalaOne";
  const logoUrl = barbershop?.logoUrl?.trim() || "";
  const barbershopInitial = barbershopName[0]?.toUpperCase() || "B";
  const initials = userName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((item) => item[0]?.toUpperCase())
    .join("");
  const profilePhotoUrl = user?.photoUrl?.trim() || "";
  const hideActionOnMobile = actionLabel === "Resumo";

  useEffect(() => {
    function refreshBarbershop() {
      setBarbershop(getStoredBarbershop());
    }

    window.addEventListener("storage", refreshBarbershop);
    window.addEventListener("barbershop:updated", refreshBarbershop);

    return () => {
      window.removeEventListener("storage", refreshBarbershop);
      window.removeEventListener("barbershop:updated", refreshBarbershop);
    };
  }, []);

  return (
    <header className="flex items-start justify-between px-4 py-4 md:items-center md:px-6">
      <div className="flex min-w-0 items-center gap-3">
        {/* Hamburger — apenas mobile */}
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="flex-shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground md:hidden"
          aria-label="Abrir menu"
        >
          <Menu size={22} />
        </button>
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary">
          {logoUrl ? (
            <img src={logoUrl} alt={barbershopName} className="h-full w-full object-cover" />
          ) : (
            <span className="text-sm font-bold text-primary-foreground">
              {barbershopInitial}
            </span>
          )}
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold text-foreground">{title}</h1>
          <nav className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            {breadcrumbs.map((crumb, index) => (
              <span key={`${crumb}-${index}`}>
                {index > 0 && <span className="mr-2">/</span>}
                <span className={index === breadcrumbs.length - 1 ? "text-foreground" : ""}>
                  {crumb}
                </span>
              </span>
            ))}
          </nav>
        </div>
      </div>

      <div className="flex flex-shrink-0 items-center gap-3 pt-0.5 md:pt-0">
        <Button
          asChild
          variant="outline"
          className={cn(
            "border-border bg-card text-foreground hover:bg-secondary",
            hideActionOnMobile && "hidden sm:inline-flex",
          )}
        >
          <Link to={actionHref}>{actionLabel}</Link>
        </Button>

        {user?.role === "admin" && <AresChatButton barbershopSlug={barbershop?.slug} />}

        <div className="flex items-center gap-3 border-l border-border pl-3">
          <Avatar className="h-9 w-9">
            <AvatarImage
              src={profilePhotoUrl}
              alt={userName}
            />
            <AvatarFallback className="bg-primary/10 text-sm text-primary">
              {initials || "U"}
            </AvatarFallback>
          </Avatar>
          <div className="hidden md:block">
            <p className="text-sm font-medium text-foreground">{userName}</p>
            <p className="text-xs text-muted-foreground">{profileConfig.label}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
