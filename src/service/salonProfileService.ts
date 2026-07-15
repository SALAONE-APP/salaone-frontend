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
      pagarme_recipient_id?: string | null;
      pagarme_recipient_status?: string | null;
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
    pagarmeRecipientId: salon.pagarme_recipient_id ?? null,
    pagarmeRecipientStatus: salon.pagarme_recipient_status ?? null,
  };
}

export async function updateSalonProfile(
  data: UpdateSalonProfilePayload
): Promise<SalonProfile> {
  const response = await api.put<SalonProfile>("/salons/me", data);
  return response.data;
}
