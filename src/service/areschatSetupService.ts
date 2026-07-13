import api from "./api";

export interface AresChatSalon {
  id: string;
  name: string;
  slug: string;
  status: string;
  email?: string | null;
  phone?: string | null;
}

export interface AresChatCredential {
  id: string;
  name: string;
  tokenPrefix: string;
  active: boolean;
  lastUsedAt?: string | null;
  revokedAt?: string | null;
  createdAt: string;
  updatedAt?: string | null;
  token?: string;
  authorizationHeader?: string;
}

export interface AresChatIntegrationFields {
  name: string;
  partnerName: string;
  domain: string;
  provider: string;
  baseUrl: string;
  authType: string;
  token: string | null;
  defaultHeaders: Record<string, string>;
  timeoutMs: number;
  isActive: boolean;
  empresa?: string;
}

export type AresChatTestRequests = Record<
  string,
  {
    method?: string;
    url?: string;
    headers?: Record<string, string>;
    body?: unknown;
    curl?: string;
  }
>;

export interface AresChatSetupData {
  tokenAvailable: boolean;
  tokenMessage: string;
  salon: AresChatSalon;
  credential: AresChatCredential | null;
  areschatIntegrationFields: AresChatIntegrationFields;
  testRequests?: AresChatTestRequests;
}

export async function getAresChatSetupData(salonId?: string | null) {
  const { data } = await api.get<AresChatSetupData>("/integrations/areschat/setup-data", {
    params: salonId ? { salonId } : undefined,
  });

  return data;
}

export async function generateAresChatSetupData(payload: {
  name?: string;
  salonId?: string | null;
}) {
  const { data } = await api.post<AresChatSetupData>(
    "/integrations/areschat/setup-data/generate",
    payload
  );

  return data;
}
