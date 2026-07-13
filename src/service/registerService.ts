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

  salon: {
    id: string;
    name: string;
    slug: string;
    status?: string;
    logoUrl?: string;
  };
}

export interface PublicSalon {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
}

export async function listPublicSalons() {
  const response = await api.get<PublicSalon[] | { salons: PublicSalon[] }>("/salons");
  const payload = response.data;

  if (Array.isArray(payload)) return payload;
  return Array.isArray(payload.salons) ? payload.salons : [];
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

  localStorage.setItem("salon", JSON.stringify(response.data.salon));

  return response.data;
}
