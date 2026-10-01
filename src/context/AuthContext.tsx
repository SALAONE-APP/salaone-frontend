import { createContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

import {
  SUPER_ADMIN_ACCESS_STORAGE_KEY,
  fetchMe,
  login as loginRequest,
  logout as logoutRequest,
  switchSalon as switchSalonRequest,
  type StoredSalon,
} from "../service/authService";

export interface User {
  id: string;
  name: string;
  email: string;
  role?: string;
  isAdmin?: boolean;
  photoUrl?: string | null;
  permissions?: Record<string, boolean> | null;
  phone?: string | null;
  cpf?: string | null;
  birthDate?: string | null;
  birth_date?: string | null;
  salonUserId?: string | null;
}

export interface AuthContextData {
  user: User | null;
  signed: boolean;
  loading: boolean;
  salonAccess: StoredSalon | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  updateUser: (user: User) => void;
  enterSalonAccess: (salonId: string) => Promise<StoredSalon>;
  exitSalonAccess: () => Promise<void>;
}

function getStoredSalonAccess(user: User | null): StoredSalon | null {
  if (user?.role !== "super_admin") {
    localStorage.removeItem(SUPER_ADMIN_ACCESS_STORAGE_KEY);
    return null;
  }
  try {
    const access = JSON.parse(localStorage.getItem(SUPER_ADMIN_ACCESS_STORAGE_KEY) || "null") as StoredSalon | null;
    return access?.id ? access : null;
  } catch {
    localStorage.removeItem(SUPER_ADMIN_ACCESS_STORAGE_KEY);
    return null;
  }
}

function getStoredUser(): User | null {
  const token = localStorage.getItem("token");
  const storedUser = localStorage.getItem("user");

  if (!token || !storedUser) {
    if (token || storedUser) logoutRequest();
    return null;
  }

  try {
    return JSON.parse(storedUser) as User;
  } catch {
    logoutRequest();
    return null;
  }
}

export const AuthContext = createContext<AuthContextData | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => getStoredUser());
  const [salonAccess, setSalonAccess] = useState<StoredSalon | null>(() => getStoredSalonAccess(getStoredUser()));

  useEffect(() => {
    if (!localStorage.getItem("token")) return;

    let active = true;
    const refreshUser = () => {
      if (!localStorage.getItem("token")) return;
      void fetchMe()
      .then((freshUser) => {
        if (!active) return;
        const { activeSalonId, ...userData } = freshUser;
        localStorage.setItem("user", JSON.stringify(userData));
        setUser(userData);
        if (userData.role !== "super_admin" || (salonAccess && activeSalonId !== salonAccess.id)) {
          localStorage.removeItem(SUPER_ADMIN_ACCESS_STORAGE_KEY);
          setSalonAccess(null);
        }
      })
      .catch(() => {
        // Mantém a sessão local em falhas transitórias de rede.
      });
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") refreshUser();
    };

    refreshUser();
    window.addEventListener("focus", refreshUser);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      active = false;
      window.removeEventListener("focus", refreshUser);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [salonAccess]);

  async function login(email: string, password: string) {
    const response = await loginRequest({ email, password });
    localStorage.setItem("user", JSON.stringify(response.user));
    localStorage.removeItem(SUPER_ADMIN_ACCESS_STORAGE_KEY);
    setSalonAccess(null);
    setUser(response.user);
  }

  function logout() {
    logoutRequest();
    setSalonAccess(null);
    setUser(null);
  }

  function updateUser(updatedUser: User) {
    localStorage.setItem("user", JSON.stringify(updatedUser));
    setUser(updatedUser);
    window.dispatchEvent(new Event("user:updated"));
  }

  async function enterSalonAccess(salonId: string) {
    if (user?.role !== "super_admin") throw new Error("Apenas o superadmin pode acessar qualquer salão.");
    const response = await switchSalonRequest(salonId);
    if (!response.salon) throw new Error("O salão selecionado não foi retornado pelo servidor.");
    localStorage.setItem(SUPER_ADMIN_ACCESS_STORAGE_KEY, JSON.stringify(response.salon));
    setSalonAccess(response.salon);
    setUser(response.user);
    window.dispatchEvent(new Event("user:updated"));
    return response.salon;
  }

  async function exitSalonAccess() {
    if (user?.role !== "super_admin") return;
    const response = await switchSalonRequest(null);
    localStorage.removeItem(SUPER_ADMIN_ACCESS_STORAGE_KEY);
    setSalonAccess(null);
    setUser(response.user);
    window.dispatchEvent(new Event("user:updated"));
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        signed: Boolean(user && localStorage.getItem("token")),
        loading: false,
        salonAccess,
        login,
        logout,
        updateUser,
        enterSalonAccess,
        exitSalonAccess,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
