import { createContext, useContext, useState } from "react";
import { Outlet } from "react-router-dom";
import type { ComponentType } from "react";

interface SidebarMobileContextValue {
  open: boolean;
  setOpen: (v: boolean) => void;
}

const SidebarMobileContext = createContext<SidebarMobileContextValue>({
  open: false,
  setOpen: () => {},
});

export function useSidebarMobile() {
  return useContext(SidebarMobileContext);
}

interface ProfileLayoutProps {
  Sidebar: ComponentType;
}

export function ProfileLayout({ Sidebar }: ProfileLayoutProps) {
  const [open, setOpen] = useState(false);

  return (
    <SidebarMobileContext.Provider value={{ open, setOpen }}>
      <div className="flex min-h-screen bg-background">
        <Sidebar />

        {/* Backdrop mobile */}
        {open && (
          <div
            className="fixed inset-0 z-40 bg-black/60 md:hidden"
            onClick={() => setOpen(false)}
          />
        )}

        <main className="min-w-0 flex-1 md:ml-64">
          <Outlet />
        </main>
      </div>
    </SidebarMobileContext.Provider>
  );
}
