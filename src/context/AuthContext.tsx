import { createContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

import { fetchMe, login as loginRequest, logout as logoutRequest } from "../service/authService";

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
}

export interface AuthContextData {
  user: User | null;
  signed: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  updateUser: (user: User) => void;
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

  useEffect(() => {
    if (!localStorage.getItem("token")) return;

    void fetchMe()
      .then((freshUser) => {
        localStorage.setItem("user", JSON.stringify(freshUser));
        setUser(freshUser);
      })
      .catch(() => {
        // Mantém a sessão local em falhas transitórias de rede.
      });
  }, []);

  async function login(email: string, password: string) {
    const response = await loginRequest({ email, password });
    localStorage.setItem("user", JSON.stringify(response.user));
    setUser(response.user);
  }

  function logout() {
    logoutRequest();
    setUser(null);
  }

  function updateUser(updatedUser: User) {
    localStorage.setItem("user", JSON.stringify(updatedUser));
    setUser(updatedUser);
    window.dispatchEvent(new Event("user:updated"));
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        signed: Boolean(user && localStorage.getItem("token")),
        loading: false,
        login,
        logout,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
