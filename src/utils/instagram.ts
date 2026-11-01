// Extrai o usuario de "@usuario", "usuario" ou de um link do perfil
// (instagram.com/usuario/?hl=pt) e monta a URL do perfil. Null se nao parecer um usuario valido.
export function instagramUsername(handle: string | null | undefined): string | null {
  const value = (handle ?? "")
    .trim()
    .replace(/^(https?:\/\/)?(www\.)?instagram\.com\//i, "")
    .replace(/^@/, "")
    .split(/[/?#]/)[0];
  return /^[A-Za-z0-9._]{1,30}$/.test(value) ? value : null;
}

export function buildInstagramProfileUrl(handle: string | null | undefined): string | null {
  const username = instagramUsername(handle);
  return username ? `https://www.instagram.com/${username}/` : null;
}
