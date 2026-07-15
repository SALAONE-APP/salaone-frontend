import api from "./api";

export interface HomeInfo {
  id?: string;
  salon_id?: string;
  hero_title?: string | null;
  hero_subtitle?: string | null;
  hero_image?: string | null;
  hero_images?: string[];
  about_title?: string | null;
  about_text1?: string | null;
  about_text2?: string | null;
  about_text3?: string | null;
  schedule_title?: string | null;
  schedule_line1?: string | null;
  schedule_line2?: string | null;
  schedule_line3?: string | null;
  whatsapp_number?: string | null;
  location_title?: string | null;
  location_address?: string | null;
  location_city?: string | null;
  professional_payment_frequency?: string | null;
  employee_payment_frequency?: string | null;
}

export async function getHomeInfo() {
  const response = await api.get<HomeInfo>("/home-info");
  return response.data;
}

export async function updateHomeInfo(data: HomeInfo) {
  const response = await api.put<HomeInfo>("/home-info", data);
  return response.data;
}
