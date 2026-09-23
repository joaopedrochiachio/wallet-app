/**
 * Utilitário Central de Segurança e Sanitização de Dados
 * Proteção contra injeção de scripts (XSS), validação estrita de tipos e limites numéricos.
 */

/**
 * Remove caracteres de controle perigosos e tags HTML para evitar injeção e XSS.
 * Trunca o texto no tamanho máximo especificado.
 */
export function sanitizeTextInput(input: unknown, maxLength = 255): string {
  if (typeof input !== "string") return "";

  const sanitized = input
    // Remove tags HTML
    .replace(/<[^>]*>/g, "")
    // Remove caracteres de controle (exceto quebras de linha e tabs normais)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    // Substitui caracteres especiais de injeção potencialmente perigosos
    .replace(/[<>'"`;]/g, "")
    .trim();

  return sanitized.slice(0, maxLength);
}

/**
 * Valida se um valor numérico monetário é seguro, finito, não negativo e dentro de limites razoáveis.
 * Retorna o número válido ou lança/rejeita com fallback.
 */
export function validateCurrency(
  value: unknown,
  options?: { min?: number; max?: number; fallback?: number }
): { isValid: boolean; value: number; error?: string } {
  const min = options?.min ?? 0.01;
  const max = options?.max ?? 100_000_000.0; // Teto de segurança: 100 milhões
  const fallback = options?.fallback ?? 0;

  let num: number;

  if (typeof value === "number") {
    num = value;
  } else if (typeof value === "string") {
    const cleanStr = value
      .replace(/\s+/g, "")
      .replace(/\./g, "")
      .replace(",", ".");
    num = parseFloat(cleanStr);
  } else {
    return {
      isValid: false,
      value: fallback,
      error: "Valor monetário não fornecido ou em formato inválido.",
    };
  }

  if (!Number.isFinite(num) || Number.isNaN(num)) {
    return {
      isValid: false,
      value: fallback,
      error: "O valor informado não é um número válido.",
    };
  }

  if (num < min) {
    return {
      isValid: false,
      value: fallback,
      error: `O valor deve ser maior ou igual a R$ ${min.toFixed(2)}.`,
    };
  }

  if (num > max) {
    return {
      isValid: false,
      value: fallback,
      error: `O valor não pode exceder R$ ${max.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}.`,
    };
  }

  // Arredonda para 2 casas decimais
  const rounded = Math.round(num * 100) / 100;
  return { isValid: true, value: rounded };
}

/**
 * Valida o dia do mês (1 a 31).
 */
export function validateDayOfMonth(day: unknown): { isValid: boolean; value: number } {
  const parsed = typeof day === "number" ? day : parseInt(String(day || ""), 10);
  if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 31) {
    return { isValid: true, value: parsed };
  }
  return { isValid: false, value: 1 };
}

/**
 * Valida número de parcelas (1 a 360).
 */
export function validateInstallmentsCount(count: unknown): { isValid: boolean; value: number } {
  const parsed = typeof count === "number" ? count : parseInt(String(count || ""), 10);
  if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 360) {
    return { isValid: true, value: parsed };
  }
  return { isValid: false, value: 1 };
}

/**
 * Valida endereço de e-mail de forma estrita.
 */
export function validateEmail(email: unknown): boolean {
  if (typeof email !== "string") return false;
  const trimmed = email.trim();
  if (trimmed.length < 5 || trimmed.length > 254) return false;
  // RFC 5322 simplificado seguro contra ReDoS
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  return emailRegex.test(trimmed);
}

/**
 * Validação de comprimento de senha para evitar DoS por strings excessivas no PBKDF2/scrypt.
 */
export function validatePassword(password: unknown): { isValid: boolean; error?: string } {
  if (typeof password !== "string") {
    return { isValid: false, error: "A senha deve ser um texto válido." };
  }
  if (password.length < 6) {
    return { isValid: false, error: "A senha deve conter no mínimo 6 caracteres." };
  }
  if (password.length > 128) {
    return { isValid: false, error: "A senha não pode ultrapassar 128 caracteres." };
  }
  return { isValid: true };
}
