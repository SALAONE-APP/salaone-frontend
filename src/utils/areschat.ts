const DEFAULT_ARESCHAT_URL_TEMPLATE = "https://{slug}.areschat.com.br/";

function getAresChatUrlTemplate() {
  return (
    import.meta.env.VITE_ARESCHAT_BASE_URL?.trim() ||
    DEFAULT_ARESCHAT_URL_TEMPLATE
  );
}

function normalizeSlug(value?: string | null) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "");
}

export function buildAresChatRedirectUrl(barbershopSlug?: string | null) {
  const template = getAresChatUrlTemplate();
  const slug = normalizeSlug(
    barbershopSlug || import.meta.env.VITE_BARBERSHOP_SLUG
  );

  if (!slug) {
    return template.includes("{slug}")
      ? template.replace("{slug}", "app")
      : template;
  }

  if (template.includes("{slug}")) {
    return template.replace("{slug}", slug);
  }

  try {
    const url = new URL(template);
    url.hostname = `${slug}.${url.hostname.replace(/^www\./, "")}`;
    return url.toString();
  } catch {
    return DEFAULT_ARESCHAT_URL_TEMPLATE.replace("{slug}", slug);
  }
}
