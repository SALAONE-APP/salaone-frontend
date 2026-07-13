import api from "./api";

export interface RegisterClientPayload {
  slug: string;
  name: string;
  email: string;
  cpf?: string;
  phone?: string;
  birthDate?: string;
  password: string;
}

export interface RegisterClientResponse {
  token: string;
  refreshToken: string;

  user: {
    id: string;
    name: string;
    email: string;
    phone?: string;
    role: string;
    isAdmin: boolean;
  };

  barbershop: {
    id: string;
    name: string;
    slug: string;
    status?: string;
    logoUrl?: string;
  };
}

export interface PublicBarbershop {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
}

export async function listPublicBarbershops() {
  const response = await api.get<PublicBarbershop[]>("/barbershops/public");
  return response.data;
}

export async function registerClient(
  data: RegisterClientPayload
) {
  console.log("[registerService] Criando conta:", data);

  const response = await api.post<RegisterClientResponse>(
    "/auth/register/client",
    data
  );

  console.log(
    "[registerService] Conta criada com sucesso:",
    response.data
  );

  localStorage.setItem("token", response.data.token);

  localStorage.setItem(
    "refreshToken",
    response.data.refreshToken
  );

  localStorage.setItem(
    "user",
    JSON.stringify(response.data.user)
  );

  localStorage.setItem(
    "barbershop",
    JSON.stringify(response.data.barbershop)
  );

  return response.data;
}
