import api from "./api";

export interface GalleryImage {
  id: string;
  salonId?: string;
  url: string;
  publicId?: string | null;
  alt?: string | null;
  sortOrder: number;
  createdAt?: string;
}

export interface GalleryImagePayload {
  url: string;
  publicId?: string | null;
  alt?: string | null;
  sortOrder?: number;
}

export async function listGalleryImages() {
  const response = await api.get<GalleryImage[]>("/gallery");

  return response.data;
}

export async function createGalleryImage(data: GalleryImagePayload) {
  const response = await api.post<GalleryImage>("/gallery", data);

  return response.data;
}

export async function updateGalleryImage(imageId: string, data: GalleryImagePayload) {
  const response = await api.put<GalleryImage>(`/gallery/${imageId}`, data);

  return response.data;
}

export async function deleteGalleryImage(imageId: string) {
  const response = await api.delete<{ message: string }>(`/gallery/${imageId}`);

  return response.data;
}
