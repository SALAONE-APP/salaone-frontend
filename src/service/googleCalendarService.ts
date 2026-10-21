import api from "./api";

export interface GoogleCalendarConnection {
  connected: boolean;
  googleEmail?: string;
  calendarId?: string;
  connectedAt?: string;
}

export async function getGoogleCalendarConnection() {
  const response = await api.get<GoogleCalendarConnection>("/auth/google-calendar");
  return response.data;
}

export async function startGoogleCalendarConnection() {
  const response = await api.post<{ authorizationUrl: string }>("/auth/google-calendar/connect");
  return response.data.authorizationUrl;
}

export async function disconnectGoogleCalendar() {
  await api.delete("/auth/google-calendar");
}
