import api from "./api";

export interface SalonProfile {
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

export interface UpdateSalonProfilePayload {
  name: string;
  email: string;
  phone: string;
  cnpj: string;
  logoUrl?: string;
  googleMapsUrl?: string;
}

export async function getSalonProfile(_salonId?: string): Promise<SalonProfile> {
  void _salonId;
  const response = await api.get<{
    salon: {
      id: string;
      name: string;
      email?: string | null;
      phone?: string | null;
      document?: string | null;
      logo_url?: string | null;
      slug: string;
      created_at?: string;
    };
  }>("/salons/me");
  const salon = response.data.salon;

  return {
    id: salon.id,
    name: salon.name,
    email: salon.email ?? "",
    phone: salon.phone ?? "",
    cnpj: salon.document ?? "",
    logoUrl: salon.logo_url ?? "",
    slug: salon.slug,
    createdAt: salon.created_at ?? null,
  };
}

export async function updateSalonProfile(
  _data: UpdateSalonProfilePayload
): Promise<SalonProfile> {
  void _data;
  throw new Error("O backend atual ainda não oferece atualização de salão.");
}
