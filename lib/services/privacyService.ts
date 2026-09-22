import { normalizeFinancialCategory } from "./financialContextService.ts";

export interface FinancialTextPrivacyInput {
  userProfile?: {
    name?: string;
    email?: string;
    uid?: string;
    primaryFocus?: string;
  } | null;
  cards?: Array<{
    name?: string;
    brand?: string;
    type?: "checking" | "credit";
  }>;
  transactions?: Array<{
    title?: string;
    account?: string;
    category?: string;
  }>;
  recurringItems?: Array<{
    title?: string;
    account?: string;
    category?: string;
  }>;
  goals?: Array<{
    title?: string;
    category?: string;
  }>;
  simulationDescription?: string;
}

function hasValidLuhnChecksum(value: string): boolean {
  let sum = 0;
  let shouldDouble = false;

  for (let index = value.length - 1; index >= 0; index -= 1) {
    let digit = Number(value[index]);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }

  return sum % 10 === 0;
}

function hasValidCpfChecksum(value: string): boolean {
  if (!/^\d{11}$/.test(value) || /^(\d)\1{10}$/.test(value)) return false;

  const calculateDigit = (length: number): number => {
    let sum = 0;
    for (let index = 0; index < length; index += 1) {
      sum += Number(value[index]) * (length + 1 - index);
    }
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };

  return calculateDigit(9) === Number(value[9]) && calculateDigit(10) === Number(value[10]);
}

function redactCardNumbers(text: string): string {
  let redacted = text.replace(
    /\b(?:\d{4}[ -]){3}\d{4}\b|\b\d{4}[ -]\d{6}[ -]\d{5}\b/g,
    "[CARTÃO REMOVIDO]"
  );

  redacted = redacted.replace(
    /\b(?:cart[aã]o|n[uú]mero do cart[aã]o|card)\s*(?:n[º°o.]\s*)?(?:é\s*)?[:#-]?\s*(?:\d[ -]?){13,19}\b/giu,
    "[CARTÃO REMOVIDO]"
  );

  return redacted.replace(/\b\d{13,19}\b/g, (candidate) =>
    hasValidLuhnChecksum(candidate) ? "[CARTÃO REMOVIDO]" : candidate
  );
}

/** Remove identificadores pessoais sem apagar valores, datas ou quantidades comuns. */
export function redactPersonalData(text: string): string {
  if (typeof text !== "string") return "";

  let redacted = text;

  redacted = redacted.replace(
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
    "[E-MAIL REMOVIDO]"
  );

  redacted = redacted.replace(
    /\b\d{3}[.]\d{3}[.]\d{3}-\d{2}\b/g,
    "[CPF REMOVIDO]"
  );
  redacted = redacted.replace(
    /\bcpf\s*(?:é\s*)?[:#-]?\s*\d{11}\b/gi,
    "[CPF REMOVIDO]"
  );
  redacted = redacted.replace(/\b\d{11}\b/g, (candidate) =>
    hasValidCpfChecksum(candidate) ? "[CPF REMOVIDO]" : candidate
  );

  redacted = redacted.replace(
    /(?:\+?55[\s.-]*)?\([1-9]\d\)[\s.-]*(?:9\d{4}|[2-8]\d{3})[\s.-]*\d{4}\b/g,
    "[TELEFONE REMOVIDO]"
  );
  redacted = redacted.replace(
    /\+55[\s.-]*[1-9]\d[\s.-]*(?:9\d{4}|[2-8]\d{3})[\s.-]*\d{4}\b/g,
    "[TELEFONE REMOVIDO]"
  );
  redacted = redacted.replace(
    /\b[1-9]\d[\s.-]+(?:9\d{4}|[2-8]\d{3})[\s.-]*\d{4}\b/g,
    "[TELEFONE REMOVIDO]"
  );
  redacted = redacted.replace(
    /\b(?:telefone|celular|whats(?:app)?)\s*(?:é\s*)?[:#-]?\s*(?:\+?55[\s.-]*)?[1-9]\d[\s.-]*\d{4,5}[\s.-]*\d{4}\b/gi,
    "[TELEFONE REMOVIDO]"
  );

  redacted = redacted.replace(/\b\d{5}-\d{3}\b/g, "[CEP REMOVIDO]");
  redacted = redacted.replace(
    /\bcep\s*(?:é\s*)?[:#-]?\s*\d{8}\b/gi,
    "[CEP REMOVIDO]"
  );

  redacted = redactCardNumbers(redacted);

  redacted = redacted.replace(
    /\b(?:cvv|cvc|c[oó]digo de seguran[cç]a)\s*(?:é\s*)?[:#-]?\s*\d{3,4}\b/gi,
    "[DADO REMOVIDO]"
  );

  return redacted.replace(/\s+/g, " ").trim();
}

function escapeRegularExpression(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const COMMON_COMMERCIAL_TERMS = new Set([
  "ifood",
  "uber",
  "99",
  "rappi",
  "delivery",
  "mcdonalds",
  "mc donalds",
  "mcdonald's",
  "mcdonald",
  "cantina",
  "burger king",
  "bk",
  "subway",
  "starbucks",
  "habibs",
  "habib's",
  "pizzaria",
  "pizza",
  "churrascaria",
  "hamburgueria",
  "bar",
  "boteco",
  "mercado",
  "supermercado",
  "restaurante",
  "padaria",
  "lanchonete",
  "cafeteria",
  "cafe",
  "café",
  "lanche",
  "almoco",
  "almoço",
  "farmacia",
  "farmácia",
  "drogaria",
  "netflix",
  "spotify",
  "amazon",
  "prime",
  "apple",
  "google",
  "gympass",
  "smartfit",
  "combustivel",
  "combustível",
  "gasolina",
  "posto",
  "estacionamento",
  "cinema",
  "shopping",
  "steam",
  "magalu",
  "shopee",
  "mercado livre",
  "shein",
  "aliexpress",
  "sem parar",
  "veloe",
  "conectcar",
  "pedagio",
  "pedágio",
]);

export function isCommonCommercialTerm(title?: string): boolean {
  if (!title) return false;
  const clean = title
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, ""); // Remove acentos

  if (COMMON_COMMERCIAL_TERMS.has(clean)) return true;

  // Verifica termos e palavras-chave comerciais
  for (const term of COMMON_COMMERCIAL_TERMS) {
    const cleanTerm = term
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    if (clean.includes(cleanTerm)) return true;
  }
  return false;
}

/**
 * Remove do texto livre os rótulos financeiros conhecidos na própria requisição.
 * Isso cobre nomes que não podem ser identificados com segurança por expressão regular.
 */
export function redactKnownFinancialText(
  text: string,
  input: FinancialTextPrivacyInput
): string {
  const replacements = new Map<string, string>();
  const addReplacement = (value: unknown, replacement: string) => {
    if (typeof value !== "string") return;
    const trimmed = value.trim();
    if (trimmed.length < 3) return;
    const key = trimmed.toLocaleLowerCase("pt-BR");
    if (!replacements.has(key)) replacements.set(key, replacement);
  };

  addReplacement(input.userProfile?.name, "Usuário");
  for (const namePart of input.userProfile?.name?.split(/\s+/) ?? []) {
    addReplacement(namePart, "Usuário");
  }
  addReplacement(input.userProfile?.email, "[E-MAIL REMOVIDO]");
  addReplacement(input.userProfile?.uid, "[DADO REMOVIDO]");
  addReplacement(input.userProfile?.primaryFocus, "objetivo financeiro");

  let creditCardIndex = 0;
  for (const card of input.cards ?? []) {
    const replacement =
      card.type === "credit" ? `Cartão ${++creditCardIndex}` : "Conta corrente";
    addReplacement(card.name, replacement);
    addReplacement(card.brand, "[DADO REMOVIDO]");
  }

  for (const transaction of input.transactions ?? []) {
    if (transaction.title) {
      const isSensitivePersonal =
        input.userProfile?.name &&
        transaction.title.toLowerCase().includes(input.userProfile.name.toLowerCase());
      if (isSensitivePersonal) {
        addReplacement(transaction.title, "Transferência Própria");
      }
    }
    addReplacement(transaction.account, "Outro meio");
    if (typeof transaction.category === "string") {
      addReplacement(transaction.category, normalizeFinancialCategory(transaction.category));
    }
  }

  (input.recurringItems ?? []).forEach((recurring, index) => {
    addReplacement(recurring.title, `Recorrência ${index + 1}`);
    addReplacement(recurring.account, "Outro meio");
    if (typeof recurring.category === "string") {
      addReplacement(recurring.category, normalizeFinancialCategory(recurring.category));
    }
  });

  (input.goals ?? []).forEach((goal, index) => {
    addReplacement(goal.title, `Meta ${index + 1}`);
    if (typeof goal.category === "string") {
      addReplacement(goal.category, normalizeFinancialCategory(goal.category));
    }
  });

  addReplacement(input.simulationDescription, "compra simulada");

  let redacted = redactPersonalData(text);
  const orderedReplacements = Array.from(replacements.entries()).sort(
    ([first], [second]) => second.length - first.length
  );

  for (const [sensitiveValue, replacement] of orderedReplacements) {
    const pattern = new RegExp(
      `(?<![\\p{L}\\p{N}])${escapeRegularExpression(sensitiveValue)}(?![\\p{L}\\p{N}])`,
      "giu"
    );
    redacted = redacted.replace(pattern, replacement);
  }

  return redacted.replace(/\s+/g, " ").trim();
}
