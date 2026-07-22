import api from "./api";

export interface SalonProfile {
  id: string;
  name: string;
  businessType: BusinessType;
  email: string;
  phone: string;
  cnpj: string;
  logoUrl: string;
  logoPublicId?: string | null;
  slug: string;
  googleMapsUrl?: string | null;
  pagarmeRecipientId?: string | null;
  pagarmeRecipientStatus?: string | null;
  createdAt?: string | null;
  platformSubscriptionStatus?: string | null;
}

export type BusinessType = 'beauty_salon' | 'aesthetics' | 'manicure_pedicure' | 'spa' | 'other';

export interface UpdateSalonProfilePayload {
  name: string;
  businessType: BusinessType;
  email: string;
  phone: string;
  cnpj: string;
  logoUrl?: string;
  logoPublicId?: string | null;
  googleMapsUrl?: string;
}

export async function getSalonProfile(_salonId?: string): Promise<SalonProfile> {
  void _salonId;
  const response = await api.get<{
    salon: {
      id: string;
      name: string;
      business_type?: BusinessType | null;
      email?: string | null;
      phone?: string | null;
      document?: string | null;
      logo_url?: string | null;
      logo_public_id?: string | null;
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
    businessType: salon.business_type ?? 'beauty_salon',
    email: salon.email ?? "",
    phone: salon.phone ?? "",
    cnpj: salon.document ?? "",
    logoUrl: salon.logo_url ?? "",
    logoPublicId: salon.logo_public_id ?? null,
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
