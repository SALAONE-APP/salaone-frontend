import api from "./api";

export interface BarbershopProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  cnpj: string;
  logoUrl: string;
  slug: string;
  googleMapsUrl?: string | null;
  pagarmeRecipientId?: string | null;
  pagarmeRecipientStatus?: string | null;
  createdAt?: string | null;
  platformSubscriptionStatus?: string | null;
}

export interface UpdateBarbershopProfilePayload {
  name: string;
  email: string;
  phone: string;
  cnpj: string;
  logoUrl?: string;
  googleMapsUrl?: string;
}

export async function getBarbershopProfile(barbershopId?: string) {
  const response = await api.get<BarbershopProfile>("/barbershop/profile", {
    params: barbershopId ? { barbershopId } : undefined,
  });
  return response.data;
}

export async function updateBarbershopProfile(
  data: UpdateBarbershopProfilePayload
) {
  const payload = {
    name: data.name,
    email: data.email,
    phone: data.phone,
    cnpj: data.cnpj,
    ...(data.logoUrl !== undefined ? { logoUrl: data.logoUrl } : {}),
    ...(data.googleMapsUrl !== undefined ? { googleMapsUrl: data.googleMapsUrl } : {}),
  };

  const response = await api.put<BarbershopProfile>("/barbershop/profile", payload);

  return response.data;
}
