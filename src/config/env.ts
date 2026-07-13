function normalizeRequiredUrl(value: string | undefined, variableName: string) {
  const rawValue = value?.trim();

  if (!rawValue) {
    throw new Error(`[config] ${variableName} não está configurada.`);
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rawValue);
  } catch {
    throw new Error(`[config] ${variableName} deve ser uma URL absoluta válida.`);
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new Error(`[config] ${variableName} deve usar o protocolo HTTP ou HTTPS.`);
  }

  return parsedUrl.toString().replace(/\/$/, '');
}

export const env = Object.freeze({
  API_URL: normalizeRequiredUrl(import.meta.env.VITE_API_URL, 'VITE_API_URL'),
});
