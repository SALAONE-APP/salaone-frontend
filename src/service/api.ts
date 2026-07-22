import axios from "axios";
import { env } from "../config/env";

const api = axios.create({
  baseURL: env.API_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  const method = config.method?.toUpperCase() || "GET";

  console.info("[api] Request", {
    method,
    baseURL: config.baseURL,
    url: config.url,
    hasToken: Boolean(token),
  });

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  const salonJson = localStorage.getItem("salon");
  if (salonJson) {
    try {
      const salon = JSON.parse(salonJson);
      if (salon?.id) {
        config.headers["x-salon-id"] = salon.id;
      }
    } catch {
      // ignore
    }
  }

  return config;
});

api.interceptors.response.use(
  (response) => {
    console.info("[api] Response", {
      method: response.config.method?.toUpperCase(),
      url: response.config.url,
      status: response.status,
    });

    return response;
  },
  (error) => {
    if (error?.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("user");
      localStorage.removeItem("salon");

      if (window.location.pathname !== "/login") {
        window.location.replace("/login");
      }
    }

    console.error("[api] Response error", {
      method: error?.config?.method?.toUpperCase(),
      url: error?.config?.url,
      baseURL: error?.config?.baseURL,
      status: error?.response?.status,
      statusText: error?.response?.statusText,
      responseData: error?.response?.data,
      message: error?.message,
      hasRequestWithoutResponse: Boolean(error?.request && !error?.response),
    });

    return Promise.reject(error);
  }
);

export default api;
