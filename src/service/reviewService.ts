import api from "./api";

export interface CustomerReview {
  id: string;
  salonId: string;
  appointmentId?: string | null;
  barberId: string;
  clientId: string;
  rating: number;
  comment?: string | null;
  createdAt: string;
  updatedAt?: string;
  clientName?: string | null;
  barberName?: string | null;
  appointmentStartAt?: string | null;
  services?: string[];
}

export async function listReviews(params: { limit?: number } = {}) {
  const response = await api.get<{ items: CustomerReview[]; total: number }>("/reviews", {
    params,
  });

  return response.data;
}

export async function createReview(data: {
  appointmentId: string;
  rating: number;
  comment?: string | null;
}) {
  const response = await api.post<CustomerReview>("/reviews", data);

  return response.data;
}
