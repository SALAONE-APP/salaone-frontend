import api from './api';

export type ImageCategory = 'profiles' | 'products' | 'services' | 'gallery' | 'logos';

export interface UploadedImage {
  secure_url: string;
  public_id: string;
  width: number;
  height: number;
  format: string;
  bytes: number;
}

export async function uploadImage(file: File, category: ImageCategory): Promise<UploadedImage> {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!allowedTypes.includes(file.type)) throw new Error('Selecione uma imagem JPEG, PNG, WEBP ou GIF.');
  if (file.size > 5 * 1024 * 1024) throw new Error('A imagem deve ter no maximo 5MB.');

  const formData = new FormData();
  formData.append('file', file);
  formData.append('category', category);
  const response = await api.post<UploadedImage>('/uploads/images', formData);
  return response.data;
}

export async function uploadHeroImage(file: File) { return uploadImage(file, 'gallery'); }
export async function uploadBusinessLogo(file: File) { return uploadImage(file, 'logos'); }
export async function uploadProfilePhoto(file: File) { return uploadImage(file, 'profiles'); }

export async function uploadPdf(_file: File): Promise<string> {
  throw new Error('Upload de PDF nao faz parte do gerenciamento de imagens. Configure um endpoint de documentos no backend.');
}
