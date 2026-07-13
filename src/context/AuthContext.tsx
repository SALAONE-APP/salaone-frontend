import { createContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

import { fetchMe, googleLogin as googleLoginRequest, login as loginRequest, logout as logoutRequest } from "../service/authService";
import type { AuthResponse } from "../service/authService";

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
  loginWithGoogle: (accessToken: string, profileData?: { phone?: string; cpf?: string; birthDate?: string; password?: string }, slug?: string) => Promise<AuthResponse>;
  logout: () => void;
  updateUser: (user: User) => void;
}

interface Props {
  children: ReactNode;
}

function getStoredUser(): User | null {
  const storedToken = localStorage.getItem("token");
  const storedUser = localStorage.getItem("user");

  if (!storedToken || !storedUser) {
    // Limpa apenas se houver estado parcial (token sem user ou user sem token)
    if (storedToken || storedUser) {
      logoutRequest();
    }
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

export function AuthProvider({ children }: Props) {
  const [user, setUser] = useState<User | null>(() => getStoredUser());

  /* Ao montar, sincroniza permissões com o servidor.
     Garante que mudanças feitas pelo admin tomem efeito sem re-login. */
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    fetchMe()
      .then((fresh) => {
        localStorage.setItem("user", JSON.stringify(fresh));
        setUser(fresh);
      })
      .catch(() => {
        /* Ignora erros de rede — mantém sessão local */
      });
  }, []);

  async function login(email: string, password: string) {
    console.info("[AuthContext] Iniciando loginRequest.", { email });

    const storedBarbershop = localStorage.getItem("barbershop");
    let barbershopId: string | undefined = undefined;
    if (storedBarbershop) {
      try {
        barbershopId = JSON.parse(storedBarbershop).id || undefined;
      } catch {}
    }

    const response = await loginRequest({
      email,
      password,
      barbershopId,
    });

    console.info("[AuthContext] Resposta de login recebida.", {
      userId: response.user?.id,
      userEmail: response.user?.email,
      role: response.user?.role,
      hasUser: Boolean(response.user),
      hasBarbershop: Boolean(response.currentBarbershop || response.barbershop),
    });

    localStorage.setItem("user", JSON.stringify(response.user));

    setUser(response.user);
    console.info("[AuthContext] Estado de usuario atualizado.");
  }

  async function loginWithGoogle(
    accessToken: string,
    profileData?: { phone?: string; cpf?: string; birthDate?: string; password?: string },
    slug?: string
  ): Promise<AuthResponse> {
    const response = await googleLoginRequest(accessToken, profileData, slug);
    localStorage.setItem("user", JSON.stringify(response.user));
    // Não chama setUser aqui — Login.tsx chama updateUser após decidir o fluxo (modal ou navegação)
    // para evitar que PublicRoute redirecione antes do modal ser exibido
    return response;
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

  const signed = Boolean(user && localStorage.getItem("token"));

  return (
    <AuthContext.Provider
      value={{
        user,
        signed,
        loading: false,
        login,
        loginWithGoogle,
        logout,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

