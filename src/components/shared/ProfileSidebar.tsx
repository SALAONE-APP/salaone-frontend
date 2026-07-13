import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { ChevronLeft, ChevronRight, LogOut, Search, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { useAuth } from "../../hooks/useAuth";
import { usePermissions } from "../../hooks/usePermissions";
import type { PermissionKey } from "../../hooks/usePermissions";
import { useSidebarMobile } from "../../layouts/ProfileLayout";

export interface SidebarItem {
  icon: LucideIcon;
  label: string;
  href?: string;
  requiredPermission?: PermissionKey;
  children?: SidebarItem[];
}

export interface SidebarSection {
  title?: string;
  items: SidebarItem[];
}

interface ProfileSidebarProps {
  title: string;
  homeHref: string;
  sections: SidebarSection[];
}

type StoredBarbershop = {
  name?: string;
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

export function ProfileSidebar({ title, homeHref, sections }: ProfileSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [barbershop, setBarbershop] = useState<StoredBarbershop | null>(() =>
    getStoredBarbershop()
  );
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { open: mobileOpen, setOpen: setMobileOpen } = useSidebarMobile();
  const { can } = usePermissions();

  const sidebarTitle = barbershop?.name?.trim() || title;
  const logoUrl = barbershop?.logoUrl?.trim() || "";
  const fallbackInitial = sidebarTitle.trim()[0]?.toUpperCase() || "B";

  const filterItems = (items: SidebarItem[]): SidebarItem[] =>
    items
      .filter((item) => !item.requiredPermission || can(item.requiredPermission))
      .map((item) => {
        const children = item.children ? filterItems(item.children) : undefined;
        return {
          ...item,
          children,
        };
      })
      .filter((item) => item.href || (item.children && item.children.length > 0));

  const menuSections = [
    ...sections,
    { items: [{ icon: LogOut, label: "Sair", href: "/logout" }] },
  ].map((section) => ({
    ...section,
    items: filterItems(section.items),
  })).filter((section) => section.items.length > 0);

  const isActive = (href: string) => location.pathname === href;
  const isItemActive = (item: SidebarItem): boolean =>
    Boolean(item.href && isActive(item.href)) ||
    Boolean(item.children?.some((child) => isItemActive(child)));

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const closeMobile = () => setMobileOpen(false);

  const toggleGroup = (item: SidebarItem) => {
    if (collapsed) {
      setCollapsed(false);
    }

    setOpenGroups((current) => ({
      ...current,
      [item.label]: !(current[item.label] ?? isItemActive(item)),
    }));
  };

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

  /* Fecha o drawer quando a rota muda (navegação mobile) */
  useEffect(() => {
    setMobileOpen(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  useEffect(() => {
    const activeGroups = menuSections.reduce<Record<string, boolean>>((groups, section) => {
      section.items.forEach((item) => {
        if (item.children?.length && isItemActive(item)) {
          groups[item.label] = true;
        }
      });

      return groups;
    }, {});

    if (Object.keys(activeGroups).length > 0) {
      setOpenGroups((current) => ({ ...current, ...activeGroups }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-50 flex h-screen flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300",
        /* Largura: mobile sempre w-64; desktop respeita collapsed */
        collapsed ? "w-64 md:w-16" : "w-64",
        /* Visibilidade: mobile desliza; desktop sempre visível */
        mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}
    >
      <div className="flex items-center justify-between border-b border-sidebar-border p-4">
        <Link to={homeHref} className="flex items-center gap-3" onClick={closeMobile}>
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary">
            {logoUrl ? (
              <img src={logoUrl} alt={sidebarTitle} className="h-full w-full object-cover" />
            ) : (
              <span className="text-sm font-bold text-primary-foreground">
                {fallbackInitial}
              </span>
            )}
          </div>
          {!collapsed && (
            <span className="truncate font-semibold text-sidebar-foreground">
              {sidebarTitle}
            </span>
          )}
        </Link>

        {/* Botão fechar — apenas mobile */}
        <button
          type="button"
          onClick={closeMobile}
          className="rounded-md p-1 text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground md:hidden"
          aria-label="Fechar menu"
        >
          <X size={16} />
        </button>

        {/* Botão colapsar — apenas desktop */}
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="hidden rounded-md p-1 text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground md:flex"
          aria-label={collapsed ? "Expandir sidebar" : "Colapsar sidebar"}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {!collapsed && (
        <div className="p-3">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              size={14}
            />
            <input
              type="text"
              placeholder="Buscar"
              className="w-full rounded-md border border-border bg-secondary py-2 pl-9 pr-8 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>
      )}

      <nav className="flex-1 overflow-y-auto py-2">
        {menuSections.map((section, sectionIndex) => (
          <div key={sectionIndex} className="mb-2">
            {section.title && !collapsed && (
              <h3 className="px-4 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {section.title}
              </h3>
            )}
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const isLogout = item.href === "/logout";
                const hasChildren = Boolean(item.children?.length);
                const active = isItemActive(item);
                const open = openGroups[item.label] ?? active;

                return (
                  <li key={`${item.href ?? item.label}-${item.label}`}>
                    {isLogout ? (
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="mx-2 flex w-[calc(100%-1rem)] items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
                      >
                        <item.icon size={18} className="flex-shrink-0" />
                        {!collapsed && <span>{item.label}</span>}
                      </button>
                    ) : hasChildren ? (
                      <>
                        <button
                          type="button"
                          onClick={() => toggleGroup(item)}
                          className={cn(
                            "mx-2 flex w-[calc(100%-1rem)] items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors",
                            active
                              ? "bg-sidebar-accent text-sidebar-foreground"
                              : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
                          )}
                        >
                          <item.icon size={18} className="flex-shrink-0" />
                          {!collapsed && (
                            <>
                              <span className="flex-1">{item.label}</span>
                              <ChevronRight
                                size={14}
                                className={cn(
                                  "flex-shrink-0 transition-transform",
                                  open && "rotate-90"
                                )}
                              />
                            </>
                          )}
                        </button>

                        {!collapsed && open && (
                          <ul className="mt-0.5 space-y-0.5">
                            {item.children?.map((child) => (
                              <li key={`${child.href ?? child.label}-${child.label}`}>
                                {child.href && (
                                  <Link
                                    to={child.href}
                                    onClick={closeMobile}
                                    className={cn(
                                      "ml-7 mr-2 flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                                      isItemActive(child)
                                        ? "bg-primary text-primary-foreground"
                                        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
                                    )}
                                  >
                                    <child.icon size={16} className="flex-shrink-0" />
                                    <span>{child.label}</span>
                                  </Link>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                      </>
                    ) : (
                      item.href && (
                        <Link
                          to={item.href}
                          onClick={closeMobile}
                          className={cn(
                            "mx-2 flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                            isActive(item.href)
                              ? "bg-primary text-primary-foreground"
                              : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
                          )}
                        >
                          <item.icon size={18} className="flex-shrink-0" />
                          {!collapsed && <span>{item.label}</span>}
                        </Link>
                      )
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
