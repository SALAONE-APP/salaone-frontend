export const onlyDigits = (value: string) => value.replace(/\D/g, "");

export function maskPhone(value: string) {
  const digits = onlyDigits(value).slice(0, 11);
  if (digits.length <= 2) return digits.replace(/^(\d{1,2})/, "($1");
  if (digits.length <= 6) return digits.replace(/^(\d{2})(\d+)/, "($1) $2");
  const split = digits.length === 11 ? 7 : 6;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, split)}-${digits.slice(split)}`;
}

export function maskCnpj(value: string) {
  return onlyDigits(value).slice(0, 14)
    .replace(/^(\d{2})(\d)/, "$1.$2").replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2").replace(/(\d{4})(\d)/, "$1-$2");
}

export function isValidEmail(value: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()); }
export function isValidPhone(value: string) { const size = onlyDigits(value).length; return size === 10 || size === 11; }
export function isValidCnpj(value: string) {
  const cnpj = onlyDigits(value);
  if (cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) return false;
  const digit = (length: number) => { let sum = 0; let weight = length - 7; for (let index = 0; index < length; index += 1) { sum += Number(cnpj[index]) * weight--; if (weight < 2) weight = 9; } const result = 11 - (sum % 11); return result > 9 ? 0 : result; };
  return digit(12) === Number(cnpj[12]) && digit(13) === Number(cnpj[13]);
}
