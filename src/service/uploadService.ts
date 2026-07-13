import axios from 'axios';

interface CloudinaryUploadResponse {
  secure_url?: string;
}

function getCloudinaryConfig() {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !uploadPreset) {
    throw new Error('Configuracao do Cloudinary nao encontrada.');
  }

  return { cloudName, uploadPreset };
}

async function uploadCloudinaryFile(file: File, resourceType: 'image' | 'raw') {
  const { cloudName, uploadPreset } = getCloudinaryConfig();
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', uploadPreset);

  const response = await axios.post<CloudinaryUploadResponse>(
    `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`,
    formData
  );

  if (!response.data.secure_url) {
    throw new Error('Cloudinary nao retornou a URL segura da imagem.');
  }

  return response.data.secure_url;
}

export async function uploadImage(file: File) {
  if (!file.type.startsWith('image/')) {
    throw new Error('Selecione apenas arquivos de imagem.');
  }

  return uploadCloudinaryFile(file, 'image');
}

export async function uploadPdf(file: File) {
  const isPdf =
    file.type === 'application/pdf' ||
    file.name.toLowerCase().endsWith('.pdf');

  if (!isPdf) {
    throw new Error('Selecione apenas arquivos PDF.');
  }

  return uploadCloudinaryFile(file, 'raw');
}

export async function uploadHeroImage(file: File) {
  return uploadImage(file);
}

export async function uploadBusinessLogo(file: File) {
  return uploadImage(file);
}

export async function uploadProfilePhoto(file: File) {
  return uploadImage(file);
}
