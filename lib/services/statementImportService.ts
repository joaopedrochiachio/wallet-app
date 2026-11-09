/**
 * Serviço Inteligente de Importação e Análise de Extratos Bancários e Faturas (PDF, OFX, CSV, TXT)
 *
 * Responsabilidades:
 * 1. Extração nativa de texto de arquivos PDF binários (suporte a /FlateDecode, /ToUnicode CMap,
 *    blocos BT..ET, operadores Tj/TJ/Td/TD/Tm/T*, UTF-16BE, octal e WinAnsi/Latin-1).
 * 2. Suporte complementar a arquivos OFX/QFX, CSV e texto colado do Internet Banking.
 * 3. Detecção automática da instituição financeira (Nubank, Itaú, Inter, Bradesco, Santander,
 *    C6 Bank, BTG Pactual, XP, Banco do Brasil, Caixa, Sicredi, PicPay, Mercado Pago, etc.)
 *    com paleta metálica Apple HIG correspondente.
 * 4. Identificação e classificação determinística de:
 *    - Contas Correntes (saldo em conta, entradas, saídas)
 *    - Cartões de Crédito (limite, dia de fechamento, dia de vencimento, fatura)
 *    - Transações realizadas (receitas e despesas categorizadas)
 *    - Contas Fixas, Assinaturas, Salários e Compras Parceladas (X/Y) para o Planejamento Mensal
 * 5. Deduplicação inteligente contra contas, cartões, recorrências e transações já existentes.
 */

import type { CardItem, RecurringItem, RecurrenceType } from "../../types/index.ts";
import { getPeriodKey } from "../utils/dateUtils.ts";

export interface BankInstitutionProfile {
  id: string;
  name: string;
  defaultBrand: string;
  defaultClosingDay: number;
  defaultDueDay: number;
  colorScheme: CardItem["colorScheme"];
}

export interface DetectedStatementAccount {
  id: string;
  name: string;
  institutionId: string;
  institutionName: string;
  brand: string;
  type: "checking" | "credit";
  balance: number;
  limit: number;
  closingDay: number;
  dueDay: number;
  colorScheme: CardItem["colorScheme"];
  existingCardId?: string | null;
  action: "create" | "link_existing";
  selected: boolean;
  updateExistingBalance?: boolean;
}

export interface DetectedStatementRecurring {
  id: string;
  title: string;
  amount: number;
  type: "expense" | "income";
  category: string;
  accountName: string;
  accountType: "checking" | "credit";
  dueDay: number;
  recurrenceType: RecurrenceType;
  installmentsCount?: number;
  currentInstallment?: number;
  totalInstallments?: number;
  startMonth: number;
  startYear: number;
  sourceTransactionId?: string;
  alreadyExists: boolean;
  selected: boolean;
  reason: string;
}

export interface DetectedStatementTransaction {
  id: string;
  title: string;
  rawDescription: string;
  amount: number;
  type: "despesa" | "receita";
  category: string;
  date: string; // YYYY-MM-DD
  displayDate: string; // DD/MM/YYYY
  accountName: string;
  accountType: "checking" | "credit";
  installmentCurrent?: number;
  installmentTotal?: number;
  isRecurringCandidate: boolean;
  isInvoicePaymentOnCreditStatement?: boolean;
  isDuplicate: boolean;
  selected: boolean;
}

export interface StatementAnalysisSummary {
  institutionName: string;
  statementKind: "checking" | "credit" | "mixed";
  periodLabel: string;
  totalIncome: number;
  totalExpense: number;
  netFlow: number;
  detectedCheckingBalance: number | null;
  detectedCreditLimit: number | null;
  estimatedMonthlyIncome: number;
  transactionsCount: number;
  recurringCount: number;
  accountsCount: number;
  duplicatesCount: number;
  confidence: number;
  aiEnhanced: boolean;
  insights: string[];
}

export interface StatementAnalysisResult {
  summary: StatementAnalysisSummary;
  accounts: DetectedStatementAccount[];
  recurringItems: DetectedStatementRecurring[];
  transactions: DetectedStatementTransaction[];
  extractedRawTextPreview: string;
}

export interface AnalyzeStatementParams {
  rawText: string;
  fileName?: string;
  referenceDate?: Date;
  existingCards?: Array<Pick<CardItem, "id" | "name" | "type" | "brand" | "balance" | "limit" | "closingDay" | "dueDay">>;
  existingTransactions?: Array<{
    id?: string;
    title?: string;
    description?: string;
    amount: number;
    type: "despesa" | "receita" | "in" | "out";
    date?: string | Date;
    occurredAt?: string | number | Date | null;
    account?: string;
  }>;
  existingRecurringItems?: Array<Pick<RecurringItem, "id" | "title" | "amount" | "type" | "category" | "dueDay">>;
}

/**
 * Perfis visuais e operacionais dos principais bancos e emissores brasileiros
 */
export const BANK_PROFILES: Record<string, BankInstitutionProfile> = {
  nubank: {
    id: "nubank",
    name: "Nubank",
    defaultBrand: "Mastercard Ultravioleta",
    defaultClosingDay: 3,
    defaultDueDay: 10,
    colorScheme: {
      gradient: "from-[#1F0A2E] via-[#150620] to-[#0C0212]",
      border: "border-purple-500/25",
      accent: "text-purple-300",
      badgeText: "Nubank",
      chipGradient: "from-purple-200 to-amber-400",
    },
  },
  itau: {
    id: "itau",
    name: "Itaú",
    defaultBrand: "Visa Infinite",
    defaultClosingDay: 10,
    defaultDueDay: 17,
    colorScheme: {
      gradient: "from-[#2B170B] via-[#1E0F06] to-[#100703]",
      border: "border-orange-500/25",
      accent: "text-orange-300",
      badgeText: "Itaú",
      chipGradient: "from-amber-200 to-orange-400",
    },
  },
  inter: {
    id: "inter",
    name: "Banco Inter",
    defaultBrand: "Mastercard Black",
    defaultClosingDay: 8,
    defaultDueDay: 15,
    colorScheme: {
      gradient: "from-[#2B170B] via-[#1E0F06] to-[#100703]",
      border: "border-orange-500/25",
      accent: "text-orange-300",
      badgeText: "Inter",
      chipGradient: "from-amber-200 to-orange-400",
    },
  },
  santander: {
    id: "santander",
    name: "Santander",
    defaultBrand: "Visa Infinite",
    defaultClosingDay: 5,
    defaultDueDay: 12,
    colorScheme: {
      gradient: "from-[#260C0C] via-[#1A0707] to-[#0D0303]",
      border: "border-rose-500/25",
      accent: "text-rose-300",
      badgeText: "Santander",
      chipGradient: "from-amber-300 to-yellow-500",
    },
  },
  bradesco: {
    id: "bradesco",
    name: "Bradesco",
    defaultBrand: "Elo Nanquim",
    defaultClosingDay: 12,
    defaultDueDay: 20,
    colorScheme: {
      gradient: "from-[#260C0C] via-[#1A0707] to-[#0D0303]",
      border: "border-rose-500/25",
      accent: "text-rose-300",
      badgeText: "Bradesco",
      chipGradient: "from-amber-300 to-yellow-500",
    },
  },
  c6: {
    id: "c6",
    name: "C6 Bank",
    defaultBrand: "Mastercard Black",
    defaultClosingDay: 8,
    defaultDueDay: 15,
    colorScheme: {
      gradient: "from-[#1C1C1E] via-[#141416] to-[#0A0A0C]",
      border: "border-white/15",
      accent: "text-white",
      badgeText: "C6 Carbon",
      chipGradient: "from-amber-200 to-amber-500",
    },
  },
  btg: {
    id: "btg",
    name: "BTG Pactual",
    defaultBrand: "Mastercard Black",
    defaultClosingDay: 10,
    defaultDueDay: 17,
    colorScheme: {
      gradient: "from-[#0A192F] via-[#081224] to-[#040914]",
      border: "border-blue-500/25",
      accent: "text-blue-300",
      badgeText: "BTG Pactual",
      chipGradient: "from-blue-200 to-amber-300",
    },
  },
  xp: {
    id: "xp",
    name: "XP Investimentos",
    defaultBrand: "Visa Infinite",
    defaultClosingDay: 8,
    defaultDueDay: 15,
    colorScheme: {
      gradient: "from-[#1C1C1E] via-[#141416] to-[#0A0A0C]",
      border: "border-white/15",
      accent: "text-white",
      badgeText: "XP Infinite",
      chipGradient: "from-amber-200 to-amber-500",
    },
  },
  bb: {
    id: "bb",
    name: "Banco do Brasil",
    defaultBrand: "Ourocard Visa",
    defaultClosingDay: 10,
    defaultDueDay: 18,
    colorScheme: {
      gradient: "from-[#2B2314] via-[#1F190D] to-[#120E06]",
      border: "border-amber-500/30",
      accent: "text-amber-300",
      badgeText: "Banco do Brasil",
      chipGradient: "from-amber-200 to-yellow-500",
    },
  },
  caixa: {
    id: "caixa",
    name: "Caixa",
    defaultBrand: "Visa Platinum",
    defaultClosingDay: 8,
    defaultDueDay: 15,
    colorScheme: {
      gradient: "from-[#0A192F] via-[#081224] to-[#040914]",
      border: "border-blue-500/25",
      accent: "text-blue-300",
      badgeText: "Caixa",
      chipGradient: "from-blue-200 to-amber-300",
    },
  },
  sicredi: {
    id: "sicredi",
    name: "Sicredi",
    defaultBrand: "Mastercard Platinum",
    defaultClosingDay: 10,
    defaultDueDay: 17,
    colorScheme: {
      gradient: "from-[#062419] via-[#041911] to-[#020D09]",
      border: "border-emerald-500/25",
      accent: "text-emerald-300",
      badgeText: "Sicredi",
      chipGradient: "from-emerald-200 to-amber-300",
    },
  },
  picpay: {
    id: "picpay",
    name: "PicPay",
    defaultBrand: "Mastercard",
    defaultClosingDay: 8,
    defaultDueDay: 15,
    colorScheme: {
      gradient: "from-[#062419] via-[#041911] to-[#020D09]",
      border: "border-emerald-500/25",
      accent: "text-emerald-300",
      badgeText: "PicPay",
      chipGradient: "from-emerald-200 to-amber-300",
    },
  },
  mercadopago: {
    id: "mercadopago",
    name: "Mercado Pago",
    defaultBrand: "Visa",
    defaultClosingDay: 8,
    defaultDueDay: 15,
    colorScheme: {
      gradient: "from-[#0A192F] via-[#081224] to-[#040914]",
      border: "border-blue-500/25",
      accent: "text-blue-300",
      badgeText: "Mercado Pago",
      chipGradient: "from-blue-200 to-amber-300",
    },
  },
  default: {
    id: "default",
    name: "Conta Principal",
    defaultBrand: "Mastercard Black",
    defaultClosingDay: 10,
    defaultDueDay: 17,
    colorScheme: {
      gradient: "from-[#1C1C1E] via-[#141416] to-[#0A0A0C]",
      border: "border-white/15",
      accent: "text-white",
      badgeText: "Conta Principal",
      chipGradient: "from-amber-200 to-amber-500",
    },
  },
};

const MONTH_ABBR_MAP: Record<string, number> = {
  jan: 0,
  janeiro: 0,
  fev: 1,
  feb: 1,
  fevereiro: 1,
  mar: 2,
  marco: 2,
  março: 2,
  abr: 3,
  apr: 3,
  abril: 3,
  mai: 4,
  may: 4,
  maio: 4,
  jun: 5,
  junho: 5,
  jul: 6,
  julho: 6,
  ago: 7,
  aug: 7,
  agosto: 7,
  set: 8,
  sep: 8,
  setembro: 8,
  out: 9,
  oct: 9,
  outubro: 9,
  nov: 10,
  novembro: 10,
  dez: 11,
  dec: 11,
  dezembro: 11,
};

/**
 * Decodifica bytes Latin-1 / WinAnsi (comum em PDFs brasileiros)
 */
function decodeLatin1Bytes(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += String.fromCharCode(bytes[i]);
  }
  return out;
}

/**
 * Extrai mapeamentos /ToUnicode CMap de streams PDF descompactados
 */
function parsePdfToUnicodeCMaps(streams: string[]): Map<number, string> {
  const cmap = new Map<number, string>();

  for (const s of streams) {
    if (!s.includes("beginbfchar") && !s.includes("beginbfrange")) continue;

    // 1. beginbfchar ... endbfchar: <0001> <0041>
    const bfcharBlocks = s.matchAll(/beginbfchar([\s\S]*?)endbfchar/g);
    for (const block of bfcharBlocks) {
      const pairs = block[1].matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g);
      for (const pair of pairs) {
        const srcCode = parseInt(pair[1], 16);
        const dstHex = pair[2];
        let decoded = "";
        for (let i = 0; i < dstHex.length; i += 4) {
          const codePoint = parseInt(dstHex.slice(i, i + 4), 16);
          if (!Number.isNaN(codePoint)) {
            decoded += String.fromCharCode(codePoint);
          }
        }
        if (!Number.isNaN(srcCode) && decoded) {
          cmap.set(srcCode, decoded);
        }
      }
    }

    // 2. beginbfrange ... endbfrange: <0001> <0005> <0041>
    const bfrangeBlocks = s.matchAll(/beginbfrange([\s\S]*?)endbfrange/g);
    for (const block of bfrangeBlocks) {
      const ranges = block[1].matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g);
      for (const range of ranges) {
        const start = parseInt(range[1], 16);
        const end = parseInt(range[2], 16);
        const targetStart = parseInt(range[3], 16);
        if (!Number.isNaN(start) && !Number.isNaN(end) && !Number.isNaN(targetStart) && end >= start && end - start <= 512) {
          for (let code = start; code <= end; code++) {
            cmap.set(code, String.fromCharCode(targetStart + (code - start)));
          }
        }
      }
    }
  }

  return cmap;
}

/**
 * Decodifica string literal PDF `(texto)` tratando escapes `\n`, `\r`, `\(`, `\)`, e octais `\ddd`
 */
function decodePdfLiteralString(raw: string, cmap?: Map<number, string>): string {
  let result = "";
  let i = 0;
  while (i < raw.length) {
    const ch = raw[i];
    if (ch === "\\") {
      i++;
      if (i >= raw.length) break;
      const next = raw[i];
      if (next >= "0" && next <= "7") {
        let octal = next;
        if (i + 1 < raw.length && raw[i + 1] >= "0" && raw[i + 1] <= "7") {
          octal += raw[++i];
          if (i + 1 < raw.length && raw[i + 1] >= "0" && raw[i + 1] <= "7") {
            octal += raw[++i];
          }
        }
        const code = parseInt(octal, 8);
        result += cmap?.get(code) ?? String.fromCharCode(code);
      } else if (next === "n") {
        result += "\n";
      } else if (next === "r") {
        result += "\r";
      } else if (next === "t") {
        result += " ";
      } else if (next === "b" || next === "f") {
        // ignore
      } else if (next === "\n" || next === "\r") {
        // line continuation
      } else {
        result += next;
      }
    } else {
      const code = raw.charCodeAt(i);
      result += cmap?.get(code) ?? ch;
    }
    i++;
  }

  // Se for UTF-16BE com BOM (\xFE\xFF)
  if (result.length >= 2 && result.charCodeAt(0) === 0xfe && result.charCodeAt(1) === 0xff) {
    let utf16 = "";
    for (let j = 2; j + 1 < result.length; j += 2) {
      const code = (result.charCodeAt(j) << 8) | result.charCodeAt(j + 1);
      utf16 += String.fromCharCode(code);
    }
    return utf16;
  }

  return result;
}

/**
 * Decodifica string hexadecimal PDF `<48656C6C6F>`
 */
function decodePdfHexString(hexRaw: string, cmap?: Map<number, string>): string {
  const clean = hexRaw.replace(/\s+/g, "");
  if (!clean) return "";

  // UTF-16BE com BOM FEFF
  if (clean.toUpperCase().startsWith("FEFF")) {
    let out = "";
    for (let i = 4; i + 3 < clean.length; i += 4) {
      const cp = parseInt(clean.slice(i, i + 4), 16);
      if (!Number.isNaN(cp)) out += String.fromCharCode(cp);
    }
    return out;
  }

  // Se houver CMap de 2 bytes (4 dígitos hex)
  if (cmap && cmap.size > 0 && clean.length % 4 === 0) {
    let allMapped = true;
    let mappedOut = "";
    for (let i = 0; i < clean.length; i += 4) {
      const code16 = parseInt(clean.slice(i, i + 4), 16);
      if (cmap.has(code16)) {
        mappedOut += cmap.get(code16);
      } else {
        allMapped = false;
        break;
      }
    }
    if (allMapped && mappedOut) return mappedOut;
  }

  let out = "";
  for (let i = 0; i < clean.length; i += 2) {
    const pair = clean.slice(i, i + 2).padEnd(2, "0");
    const code = parseInt(pair, 16);
    if (!Number.isNaN(code)) {
      out += cmap?.get(code) ?? String.fromCharCode(code);
    }
  }
  return out;
}

/**
 * Extrai texto estruturado de streams de conteúdo PDF (`BT ... ET`)
 */
function extractTextFromPdfContentStreams(streams: string[], cmap: Map<number, string>): string {
  const lines: string[] = [];

  for (const content of streams) {
    if (content.includes("beginbfchar") || content.includes("beginbfrange")) {
      continue;
    }

    const btBlocks = content.matchAll(/BT\b([\s\S]*?)\bET\b/g);
    let foundBt = false;

    for (const block of btBlocks) {
      foundBt = true;
      const body = block[1];
      let currentLine = "";
      let lastY: number | null = null;

      // Tokeniza operadores de posicionamento e de texto dentro do bloco BT..ET
      const tokenRegex =
        /(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+T[dD]\b|(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+Tm\b|\bT\*\b|\[((?:[^\]\\]|\\.|\[[^\]]*\])*)\]\s*TJ|\(((?:[^()\\]|\\.)*)\)\s*(?:Tj|'|")\b|<([0-9A-Fa-f\s]+)>\s*Tj\b/g;

      let match: RegExpExecArray | null;
      while ((match = tokenRegex.exec(body)) !== null) {
        if (match[1] !== undefined && match[2] !== undefined) {
          // Td / TD: dx dy
          const dy = parseFloat(match[2]);
          if (Math.abs(dy) > 1.5) {
            if (currentLine.trim()) {
              lines.push(currentLine.trim());
              currentLine = "";
            }
          } else if (currentLine && !currentLine.endsWith(" ")) {
            currentLine += " ";
          }
        } else if (match[7] !== undefined && match[8] !== undefined) {
          // Tm: a b c d e f (f = y)
          const y = parseFloat(match[8]);
          if (lastY !== null && Math.abs(y - lastY) > 2) {
            if (currentLine.trim()) {
              lines.push(currentLine.trim());
              currentLine = "";
            }
          } else if (currentLine && !currentLine.endsWith(" ")) {
            currentLine += " ";
          }
          lastY = y;
        } else if (match[0] === "T*") {
          if (currentLine.trim()) {
            lines.push(currentLine.trim());
            currentLine = "";
          }
        } else if (match[9] !== undefined) {
          // [...] TJ array
          const arrayBody = match[9];
          const itemRegex = /\(((?:[^()\\]|\\.)*)\)|<([0-9A-Fa-f\s]+)>|(-?\d+(?:\.\d+)?)/g;
          let itemMatch: RegExpExecArray | null;
          while ((itemMatch = itemRegex.exec(arrayBody)) !== null) {
            if (itemMatch[1] !== undefined) {
              currentLine += decodePdfLiteralString(itemMatch[1], cmap);
            } else if (itemMatch[2] !== undefined) {
              currentLine += decodePdfHexString(itemMatch[2], cmap);
            } else if (itemMatch[3] !== undefined) {
              const kerning = parseFloat(itemMatch[3]);
              // Em PDF TJ, valores negativos grandes (ex: -120) representam espaço entre palavras/colunas
              if (kerning < -80 && !currentLine.endsWith(" ")) {
                currentLine += " ";
              }
            }
          }
        } else if (match[10] !== undefined) {
          // (...) Tj / ' / "
          const piece = decodePdfLiteralString(match[10], cmap);
          if (match[0].trim().endsWith("'") || match[0].trim().endsWith('"')) {
            if (currentLine.trim()) {
              lines.push(currentLine.trim());
              currentLine = "";
            }
          }
          currentLine += piece;
        } else if (match[11] !== undefined) {
          // <hex> Tj
          currentLine += decodePdfHexString(match[11], cmap);
        }
      }

      if (currentLine.trim()) {
        lines.push(currentLine.trim());
      }
    }

    // Caso o stream tenha strings soltas sem delimitadores BT/ET
    if (!foundBt && (content.includes("Tj") || content.includes("TJ"))) {
      const looseMatches = content.matchAll(/\(((?:[^()\\]|\\.)*)\)\s*Tj/g);
      for (const m of looseMatches) {
        const decoded = decodePdfLiteralString(m[1], cmap).trim();
        if (decoded) lines.push(decoded);
      }
    }
  }

  return lines
    .map((line) => line.replace(/\x00/g, "").replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 0)
    .join("\n");
}

/**
 * Normaliza artefatos de fontes TrueType corrompidas em PDFs bancários brasileiros (ex.: Nubank, Itaú).
 * Em fontes com ToUnicode parcial, caracteres como 'E' e 'F' podem ser emitidos como '(' ou ')'.
 * Exemplo real: "01 S(T 2026" → "01 SET 2026", "D(" → "DE", "CP)" → "CPF", ")UNDACAO" → "FUNDACAO".
 */
export function cleanCorruptedPdfFontArtifacts(text: string): string {
  // Limpa caracteres de controle binários e caracteres de marcadores de máscara corrompidos (\x01c -> •)
  let curr = text
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .replace(/\x01c/g, "•")
    .replace(/\)\(/g, "FE");

  if (!curr.includes("(") && !curr.includes(")")) return curr;

  for (let i = 0; i < 3; i++) {
    const prev = curr;
    curr = curr
      // Rule A: Letra + ( + Letra (ex: S(T -> SET, P(DRO -> PEDRO, M(RCADO -> MERCADO)
      .replace(/([A-Za-z])\(([A-Za-z])/g, (_m, a, b) => a + (a === a.toUpperCase() ? "E" : "e") + b)
      // Rule B: Letra + ( no fim de palavra (ex: D( -> DE, WAND( -> WANDE)
      .replace(/([A-Za-z])\((?=\s|[.,;:!?-]|$)/g, (_m, a) => a + (a === a.toUpperCase() ? "E" : "e"))
      // Rule C: ( + 1 ou 2 letras maiúsculas isoladas (ex: (M R$ -> EM R$)
      .replace(/(^|\s)\(([A-Z]{1,2})(?=\s|[.,;:!?-]|$)/g, (_m, sp, a) => sp + "E" + a)
      // Rule D: Letra + ) + Letra (ex: RA)A(L -> RAFAEL, Master)ormula -> Masterformula)
      .replace(/([A-Za-z])\)([A-Za-z])/g, (_m, a, b) => a + (a === a.toUpperCase() ? "F" : "f") + b)
      // Rule E: Letra + ) no fim de palavra isolada sem abre-parêntese (ex: CP) -> CPF)
      .replace(/([A-Za-z])\)(?=\s|[.,;:!?-]|$)/g, (_m, a) => a + (a === a.toUpperCase() ? "F" : "f"))
      // Rule F: ) no início de palavra (ex: )inanceira -> Financeira, )UNDACAO -> FUNDACAO)
      .replace(/(^|\s)\)([A-Za-z])/g, (_m, sp, a) => sp + (a === a.toUpperCase() ? "F" + a : "F" + a.toLowerCase()));
    if (prev === curr) break;
  }
  return curr;
}

/**
 * Extrai texto de um PDF binário (`Uint8Array`).
 * Aceita uma função opcional `decompressFlate` (ex: usando `zlib.inflateSync` no servidor Node)
 * para descompactar streams `/FlateDecode`.
 */
export function extractTextFromPdfBytes(
  pdfBytes: Uint8Array,
  decompressFlate?: (compressed: Uint8Array) => Uint8Array | null
): string {
  const rawLatin1 = decodeLatin1Bytes(pdfBytes);

  // Se o arquivo na verdade já for texto puro (ex: arquivo .txt/.csv renomeado ou string)
  if (!rawLatin1.startsWith("%PDF-")) {
    try {
      const decoded = new TextDecoder("utf-8", { fatal: false }).decode(pdfBytes);
      return cleanCorruptedPdfFontArtifacts(decoded);
    } catch {
      return cleanCorruptedPdfFontArtifacts(rawLatin1);
    }
  }

  const decompressedStreams: string[] = [];
  const streamRegex = /stream\r?\n/g;
  let match: RegExpExecArray | null;

  while ((match = streamRegex.exec(rawLatin1)) !== null) {
    const dataStart = match.index + match[0].length;
    const endIdx = rawLatin1.indexOf("endstream", dataStart);
    if (endIdx === -1) break;

    // Remove \r\n imediatamente antes de endstream
    let dataEnd = endIdx;
    if (rawLatin1[dataEnd - 1] === "\n") dataEnd--;
    if (rawLatin1[dataEnd - 1] === "\r") dataEnd--;

    // Verifica no dicionário anterior ao stream se possui /FlateDecode
    const headerWindowStart = Math.max(0, match.index - 350);
    const dictHeader = rawLatin1.slice(headerWindowStart, match.index);
    const isFlate = /\/FlateDecode\b/.test(dictHeader);

    const slice = pdfBytes.subarray(dataStart, dataEnd);

    if (isFlate && decompressFlate) {
      const inflated = decompressFlate(slice);
      if (inflated && inflated.length > 0) {
        decompressedStreams.push(decodeLatin1Bytes(inflated));
      }
    } else if (!isFlate) {
      decompressedStreams.push(decodeLatin1Bytes(slice));
    }

    streamRegex.lastIndex = endIdx + 9;
  }

  const cmap = parsePdfToUnicodeCMaps(decompressedStreams);
  const extracted = extractTextFromPdfContentStreams(decompressedStreams, cmap);

  if (extracted.trim().length > 10) {
    return cleanCorruptedPdfFontArtifacts(extracted);
  }

  // Fallback: tenta extrair de todo o documento se não encontrou em streams isolados
  const fallbackFromWhole = extractTextFromPdfContentStreams([rawLatin1], cmap);
  if (fallbackFromWhole.trim().length > 0) {
    return cleanCorruptedPdfFontArtifacts(fallbackFromWhole);
  }

  return cleanCorruptedPdfFontArtifacts(extracted);
}

/**
 * Gera um arquivo PDF válido (`Uint8Array` no padrão `%PDF-1.4`) contendo um extrato
 * bancário e fatura realista para testes imediatos ou demonstração.
 */
export function generateSampleBankStatementPdf(options?: {
  bankName?: string;
  holderName?: string;
  monthYear?: string;
}): Uint8Array {
  const bankName = options?.bankName || "Nubank S.A. - Instituicao de Pagamento";
  const holderName = options?.holderName || "Titular da Carteira";

  const statementLines = [
    `EXTRATO DE CONTA CORRENTE E CARTAO - ${bankName}`,
    `Titular: ${holderName} | Periodo: 01/10/2026 a 31/10/2026`,
    `Saldo em conta final: R$ 4.850,00 | Limite Total do Cartao: R$ 12.000,00`,
    `Fechamento: Dia 03 | Vencimento: Dia 10`,
    `----------------------------------------------------------------`,
    `MOVIMENTACOES DA CONTA CORRENTE (DEBITO / PIX)`,
    `05/10/2026 SALARIO MENSAL EMPRESA TECH LTDA +R$ 8.500,00`,
    `06/10/2026 PAGAMENTO BOLETO ALUGUEL RESIDENCIAL -R$ 2.300,00`,
    `07/10/2026 CONDOMINIO EDIFICIO HORIZONTE -R$ 580,00`,
    `10/10/2026 CONTA DE LUZ ENEL ENERGIA -R$ 215,40`,
    `12/10/2026 VIVO FIBRA INTERNET RESIDENCIAL -R$ 129,90`,
    `14/10/2026 SUPERMERCADO PAO DE ACUCAR -R$ 462,80`,
    `18/10/2026 PIX ENVIADO IFOOD RESTAURANTES -R$ 68,90`,
    `20/10/2026 PIX RECEBIDO REEMBOLSO PROJETO +R$ 450,00`,
    `22/10/2026 DROGASIL FARMACIA E SAUDE -R$ 114,50`,
    `25/10/2026 POSTO SHELL COMBUSTIVEL -R$ 240,00`,
    `----------------------------------------------------------------`,
    `LANCAMENTOS NO CARTAO DE CREDITO (FATURA)`,
    `08/10/2026 NETFLIX.COM ASSINATURA MENSAL CARTAO -R$ 55,90`,
    `09/10/2026 SPOTIFY BRASIL MENSAL CARTAO -R$ 21,90`,
    `11/10/2026 APPLE.COM/BILL ICLOUD CARTAO -R$ 14,90`,
    `15/10/2026 ACADEMIA SMARTFIT MENSALIDADE CARTAO -R$ 139,90`,
    `16/10/2026 AMAZON BR NOTEBOOK PARC 02/10 CARTAO -R$ 380,00`,
    `19/10/2026 UBER *TRIP TRANSPORTE CARTAO -R$ 34,80`,
    `21/10/2026 IFOOD *DELIVERY JANTAR CARTAO -R$ 84,50`,
    `24/10/2026 MERCADO LIVRE FONE BLUETOOTH 01/04 CARTAO -R$ 125,00`,
  ];

  const escapePdf = (str: string) =>
    str.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

  const contentOps: string[] = ["BT", "/F1 10 Tf", "40 780 Td"];
  statementLines.forEach((line, index) => {
    if (index > 0) {
      contentOps.push("0 -18 Td");
    }
    contentOps.push(`(${escapePdf(line)}) Tj`);
  });
  contentOps.push("ET");
  const streamContent = contentOps.join("\n");

  const objects: string[] = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n",
    `4 0 obj\n<< /Length ${streamContent.length} >>\nstream\n${streamContent}\nendstream\nendobj\n`,
    "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (const obj of objects) {
    offsets.push(pdf.length);
    pdf += obj;
  }

  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;

  return new TextEncoder().encode(pdf);
}

/**
 * Converte um arquivo OFX/QFX para texto de linhas padronizadas para o analisador
 */
export function convertOfxToStandardLines(rawOfx: string): string {
  const lines: string[] = [];

  const orgMatch = rawOfx.match(/<ORG>([^<\r\n]+)/i);
  const bankIdMatch = rawOfx.match(/<BANKID>([^<\r\n]+)/i);
  if (orgMatch) lines.push(`Instituição: ${orgMatch[1].trim()}`);
  else if (bankIdMatch) lines.push(`Banco Código: ${bankIdMatch[1].trim()}`);

  const balMatch = rawOfx.match(/<BALAMT>([^<\r\n]+)/i);
  if (balMatch) {
    const val = parseFloat(balMatch[1].trim().replace(",", "."));
    if (Number.isFinite(val)) {
      lines.push(`Saldo em conta final: R$ ${val.toFixed(2).replace(".", ",")}`);
    }
  }

  const isCreditCardOfx = /<CREDITCARDMSGSRSV1>|<CCSTMTRS>/i.test(rawOfx);
  if (isCreditCardOfx) {
    lines.push("FATURA DE CARTAO DE CREDITO");
  }

  const trnBlocks = rawOfx.matchAll(/<STMTTRN>([\s\S]*?)(?:<\/STMTTRN>|(?=<STMTTRN>|<\/BANKTRANLIST>))/gi);
  for (const block of trnBlocks) {
    const content = block[1];
    const dtMatch = content.match(/<DTPOSTED>\s*(\d{4})(\d{2})(\d{2})/i);
    const amtMatch = content.match(/<TRNAMT>\s*([+-]?\d+(?:[.,]\d+)?)/i);
    const memoMatch = content.match(/<MEMO>\s*([^<\r\n]+)/i);
    const nameMatch = content.match(/<NAME>\s*([^<\r\n]+)/i);
    const typeMatch = content.match(/<TRNTYPE>\s*([^<\r\n]+)/i);

    if (!dtMatch || !amtMatch) continue;
    const dateStr = `${dtMatch[3]}/${dtMatch[2]}/${dtMatch[1]}`;
    const rawAmt = parseFloat(amtMatch[1].replace(",", "."));
    if (!Number.isFinite(rawAmt) || Math.abs(rawAmt) < 0.01) continue;

    const desc = (memoMatch?.[1] || nameMatch?.[1] || "Lançamento OFX").trim();
    const trnType = (typeMatch?.[1] || "").toUpperCase();
    const isNegative = rawAmt < 0 || trnType === "DEBIT" || trnType === "PAYMENT" || trnType === "POS";
    const sign = isNegative ? "-" : "+";
    const formattedAmt = Math.abs(rawAmt).toFixed(2).replace(".", ",");
    const suffix = isCreditCardOfx ? " CARTAO" : "";

    lines.push(`${dateStr} ${desc}${suffix} ${sign}R$ ${formattedAmt}`);
  }

  return lines.join("\n");
}

/**
 * Identifica a instituição bancária pelo conteúdo textual ou nome do arquivo
 */
export function detectBankInstitution(text: string, fileName = ""): BankInstitutionProfile {
  const combined = `${fileName}\n${text.slice(0, 4000)}`.toLowerCase();

  if (combined.includes("nubank") || combined.includes("nu pagamentos") || combined.includes("ultravioleta") || /\b260\b.*nu pagamentos/i.test(combined)) {
    return BANK_PROFILES.nubank;
  }
  if (combined.includes("itaú") || combined.includes("itau") || combined.includes("personnalite") || combined.includes("uniclass")) {
    return BANK_PROFILES.itau;
  }
  if (combined.includes("banco inter") || /\binter\b.*(?:conta|fatura|extrato|black)/i.test(combined)) {
    return BANK_PROFILES.inter;
  }
  if (combined.includes("santander")) {
    return BANK_PROFILES.santander;
  }
  if (combined.includes("bradesco") || combined.includes("next")) {
    return BANK_PROFILES.bradesco;
  }
  if (combined.includes("c6 bank") || combined.includes("c6 carbon") || combined.includes("banco c6")) {
    return BANK_PROFILES.c6;
  }
  if (combined.includes("btg pactual") || combined.includes("banco btg")) {
    return BANK_PROFILES.btg;
  }
  if (combined.includes("xp investimentos") || combined.includes("banco xp") || combined.includes("xp visa")) {
    return BANK_PROFILES.xp;
  }
  if (combined.includes("banco do brasil") || combined.includes("ourocard")) {
    return BANK_PROFILES.bb;
  }
  if (combined.includes("caixa economica") || combined.includes("caixa econômica")) {
    return BANK_PROFILES.caixa;
  }
  if (combined.includes("sicredi")) {
    return BANK_PROFILES.sicredi;
  }
  if (combined.includes("picpay")) {
    return BANK_PROFILES.picpay;
  }
  if (combined.includes("mercado pago") || combined.includes("mercadopago")) {
    return BANK_PROFILES.mercadopago;
  }

  return BANK_PROFILES.default;
}

/**
 * Classifica a categoria e determina se é candidato a conta fixa/assinatura
 */
export function classifyStatementMerchant(
  rawTitle: string,
  type: "despesa" | "receita"
): {
  cleanTitle: string;
  category: string;
  isRecurringCandidate: boolean;
  recurringReason?: string;
  recurrenceType?: RecurrenceType;
} {
  // Limpeza de prefixos bancários ruidosos
  let cleaned = rawTitle
    .replace(/\b(?:COMPRA\s+(?:NO\s+)?(?:CARTAO|DEBITO|CREDITO)|PAGTO\s+ELETRONICO|PAGAMENTO\s+DE\s+BOLETO|PAGAMENTO\s+BOLETO|DEBITO\s+AUTOMATICO|DEB\s+AUT|PIX\s+ENVIADO(?:\s*-\s*|\s+PARA\s+)?|PIX\s+RECEBIDO(?:\s*-\s*|\s+DE\s+)?|TED\s+RECEBIDA|TRANSF\s+ELETRONICA|REMUNERACAO|CREDITO\s+EM\s+CONTA|CARTAO)\b/gi, " ")
    .replace(/\s*\*\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Remove traços ou pontuações soltas nas pontas
  cleaned = cleaned.replace(/^[-–—:•.\s]+|[-–—:•.\s]+$/g, "").trim();
  if (!cleaned || cleaned.length < 2) {
    cleaned = type === "receita" ? "Recebimento em Conta" : "Despesa Registrada";
  }

  // Formata capitalização amigável se estiver tudo em maiúsculas
  if (cleaned === cleaned.toUpperCase() && cleaned.length > 3) {
    cleaned = cleaned
      .toLowerCase()
      .replace(/(?:^|\s)\S/g, (char) => char.toUpperCase())
      .replace(/\b(?:De|Da|Do|Das|Dos|E|Em|No|Na|Para|Com)\b/g, (w) => w.toLowerCase())
      .replace(/\b(?:Pix|Ted|Doc|Cpf|Cnpj|Ltda|Sa|S\/a|Br|Me|Iof)\b/gi, (w) => w.toUpperCase());
  }

  const lower = `${rawTitle} ${cleaned}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (type === "receita") {
    if (
      lower.includes("salario") ||
      lower.includes("folha") ||
      lower.includes("pro-labore") ||
      lower.includes("prolabore") ||
      lower.includes("remuneracao") ||
      lower.includes("vencimento") ||
      lower.includes("bolsa")
    ) {
      return {
        cleanTitle: cleaned.includes("Salario") || cleaned.includes("Salário") ? cleaned : `Salário (${cleaned})`,
        category: "Renda",
        isRecurringCandidate: true,
        recurringReason: "Renda mensal recorrente identificada no extrato",
        recurrenceType: "business_day_5",
      };
    }
    if (lower.includes("rendimento") || lower.includes("dividendo") || lower.includes("juros") || lower.includes("cdb") || lower.includes("tesouro")) {
      return {
        cleanTitle: cleaned,
        category: "Investimentos & Metas",
        isRecurringCandidate: false,
      };
    }
    return {
      cleanTitle: cleaned,
      category: "Renda",
      isRecurringCandidate: false,
    };
  }

  // Despesas Fixas de Moradia & Contas de Consumo
  if (
    lower.includes("aluguel") ||
    lower.includes("condominio") ||
    lower.includes("energia") ||
    lower.includes("conta de luz") ||
    lower.includes("enel") ||
    lower.includes("cpfl") ||
    lower.includes("cemig") ||
    lower.includes("light") ||
    lower.includes("equatorial") ||
    lower.includes("neoenergia") ||
    lower.includes("copel") ||
    lower.includes("celesc") ||
    lower.includes("sabesp") ||
    lower.includes("saneago") ||
    lower.includes("copasa") ||
    lower.includes("cedae") ||
    lower.includes("comgas") ||
    lower.includes("naturgy") ||
    lower.includes("iptu")
  ) {
    return {
      cleanTitle: cleaned,
      category: "Moradia",
      isRecurringCandidate: true,
      recurringReason: "Despesa fixa de moradia / concessionária",
      recurrenceType: "fixed_day",
    };
  }

  // Concessionárias de Energia, Água, Gás e Conectividade
  if (
    lower.includes("cemig") ||
    lower.includes("copasa") ||
    lower.includes("sabesp") ||
    lower.includes("enel") ||
    lower.includes("cpfl") ||
    lower.includes("light") ||
    lower.includes("energisa") ||
    lower.includes("comgas") ||
    lower.includes("neoenergia")
  ) {
    return {
      cleanTitle: cleaned,
      category: "Moradia",
      isRecurringCandidate: true,
      recurringReason: "Conta de consumo / concessionária de energia ou água",
      recurrenceType: "fixed_day",
    };
  }

  // Internet & Telecomunicações (Recorrentes) - usando regex de palavra para não confundir 'empréstimo' com TIM
  if (
    /\bvivo\b/i.test(lower) ||
    /\bclaro\b/i.test(lower) ||
    /\btim\b/i.test(lower) ||
    /\boi\b/i.test(lower) ||
    lower.includes("fibra") ||
    lower.includes("internet") ||
    lower.includes("net virtua") ||
    lower.includes("algar") ||
    lower.includes("brisanet")
  ) {
    return {
      cleanTitle: cleaned,
      category: "Moradia",
      isRecurringCandidate: true,
      recurringReason: "Assinatura mensal de internet / telecom",
      recurrenceType: "fixed_day",
    };
  }

  // Tributos e Guias Mensais (DAS MEI, Receita Federal, DARF)
  if (
    lower.includes("receita federal") ||
    lower.includes("simples nacional") ||
    lower.includes("das-mei") ||
    lower.includes("darf") ||
    lower.includes("guia gps")
  ) {
    return {
      cleanTitle: cleaned,
      category: "Moradia",
      isRecurringCandidate: true,
      recurringReason: "Tributo / guia fixa mensal",
      recurrenceType: "fixed_day",
    };
  }

  // Empréstimos, Financiamentos e Resgates (NÃO são assinaturas telecom)
  if (
    lower.includes("emprestimo") ||
    lower.includes("empréstimo") ||
    lower.includes("financiamento") ||
    lower.includes("resgate de emprestimo") ||
    lower.includes("resgate de empréstimo")
  ) {
    return {
      cleanTitle: cleaned,
      category: "Outros",
      isRecurringCandidate: false,
    };
  }

  // Assinaturas Digitais & Streaming
  if (
    lower.includes("netflix") ||
    lower.includes("spotify") ||
    lower.includes("apple.com/bill") ||
    lower.includes("icloud") ||
    lower.includes("amazon prime") ||
    lower.includes("prime video") ||
    lower.includes("disney") ||
    lower.includes("max.com") ||
    lower.includes("hbo") ||
    lower.includes("youtube") ||
    lower.includes("google one") ||
    lower.includes("chatgpt") ||
    lower.includes("openai") ||
    lower.includes("claude") ||
    lower.includes("adobe") ||
    lower.includes("canva") ||
    lower.includes("microsoft 365") ||
    lower.includes("xbox") ||
    lower.includes("playstation") ||
    lower.includes("globoplay") ||
    lower.includes("meli+")
  ) {
    return {
      cleanTitle: cleaned,
      category: "Lazer",
      isRecurringCandidate: true,
      recurringReason: "Assinatura digital recorrente",
      recurrenceType: "fixed_day",
    };
  }

  // Academias, Planos de Saúde & Bem-Estar Recorrentes
  if (
    lower.includes("smartfit") ||
    lower.includes("smart fit") ||
    lower.includes("bluefit") ||
    lower.includes("bodytech") ||
    lower.includes("academia") ||
    lower.includes("gympass") ||
    lower.includes("wellhub") ||
    lower.includes("totalpass") ||
    lower.includes("unimed") ||
    lower.includes("bradesco saude") ||
    lower.includes("sulamerica") ||
    lower.includes("amil") ||
    lower.includes("hapvida") ||
    lower.includes("notredame") ||
    lower.includes("plano de saude")
  ) {
    return {
      cleanTitle: cleaned,
      category: "Saúde",
      isRecurringCandidate: true,
      recurringReason: "Mensalidade recorrente de saúde / academia",
      recurrenceType: "fixed_day",
    };
  }

  // Educação & Mensalidades
  if (
    lower.includes("faculdade") ||
    lower.includes("universidade") ||
    lower.includes("escola") ||
    lower.includes("colegio") ||
    lower.includes("mensalidade") ||
    lower.includes("inatel") ||
    lower.includes("instituto nacional de telecomunicacoes") ||
    lower.includes("instituto nacional de telecomunicações") ||
    lower.includes("alura") ||
    lower.includes("rocketseat") ||
    lower.includes("ingles") ||
    lower.includes("cultura inglesa") ||
    lower.includes("wizard")
  ) {
    return {
      cleanTitle: cleaned,
      category: "Educação",
      isRecurringCandidate: true,
      recurringReason: "Mensalidade educacional recorrente",
      recurrenceType: "fixed_day",
    };
  }

  // Seguros & Tarifas Fixas
  if (
    lower.includes("seguro") ||
    lower.includes("porto seguro") ||
    lower.includes("azul seguros") ||
    lower.includes("tokio marine") ||
    lower.includes("pier") ||
    lower.includes("youse")
  ) {
    return {
      cleanTitle: cleaned,
      category: "Serviços",
      isRecurringCandidate: true,
      recurringReason: "Seguro recorrente",
      recurrenceType: "fixed_day",
    };
  }

  // Supermercado
  if (
    lower.includes("supermercado") ||
    lower.includes("mercado") ||
    lower.includes("atacadao") ||
    lower.includes("assai") ||
    lower.includes("carrefour") ||
    lower.includes("pao de acucar") ||
    lower.includes("extra") ||
    lower.includes("oba hortifruti") ||
    lower.includes("hortifruti") ||
    lower.includes("zaffari") ||
    lower.includes("angeloni") ||
    lower.includes("condor") ||
    lower.includes("muffato") ||
    lower.includes("sonda") ||
    lower.includes("dia %")
  ) {
    return {
      cleanTitle: cleaned,
      category: "Supermercado",
      isRecurringCandidate: false,
    };
  }

  // Alimentação, Restaurantes & Delivery
  if (
    lower.includes("ifood") ||
    lower.includes("ifd*") ||
    lower.includes("rappi") ||
    lower.includes("restaurante") ||
    lower.includes("padaria") ||
    lower.includes("panificadora") ||
    lower.includes("lanchonete") ||
    lower.includes("hamburgueria") ||
    lower.includes("pizzaria") ||
    lower.includes("churrascaria") ||
    lower.includes("mcdonalds") ||
    lower.includes("mc donalds") ||
    lower.includes("burger king") ||
    lower.includes("bk ") ||
    lower.includes("outback") ||
    lower.includes("starbucks") ||
    lower.includes("cafe") ||
    lower.includes("almoco") ||
    lower.includes("jantar") ||
    lower.includes("sushi") ||
    lower.includes("acai")
  ) {
    return {
      cleanTitle: cleaned,
      category: "Alimentação",
      isRecurringCandidate: false,
    };
  }

  // Transporte, Combustível & Pedágio
  if (
    lower.includes("uber") ||
    lower.includes("99app") ||
    lower.includes("99*99") ||
    lower.includes("99 pop") ||
    lower.includes("posto") ||
    lower.includes("combustivel") ||
    lower.includes("gasolina") ||
    lower.includes("shell") ||
    lower.includes("ipiranga") ||
    lower.includes("petrobras") ||
    lower.includes("ale ") ||
    lower.includes("estacionamento") ||
    lower.includes("multipark") ||
    lower.includes("estapar") ||
    lower.includes("sem parar") ||
    lower.includes("veloe") ||
    lower.includes("conectcar") ||
    lower.includes("pedagio") ||
    lower.includes("metro") ||
    lower.includes("bilhete unico") ||
    lower.includes("latam") ||
    lower.includes("azul linhas") ||
    lower.includes("gol linhas")
  ) {
    const isTollSubscription =
      lower.includes("sem parar") || lower.includes("veloe") || lower.includes("conectcar");
    return {
      cleanTitle: cleaned,
      category: "Transporte",
      isRecurringCandidate: isTollSubscription,
      recurringReason: isTollSubscription ? "Tag de pedágio/estacionamento mensal" : undefined,
      recurrenceType: "fixed_day",
    };
  }

  // Farmácia & Saúde Avulsa
  if (
    lower.includes("farmacia") ||
    lower.includes("drogaria") ||
    lower.includes("drogasil") ||
    lower.includes("droga raia") ||
    lower.includes("pacheco") ||
    lower.includes("pague menos") ||
    lower.includes("panvel") ||
    lower.includes("araujo") ||
    lower.includes("clinica") ||
    lower.includes("hospital") ||
    lower.includes("laboratorio") ||
    lower.includes("consulta") ||
    lower.includes("dentista")
  ) {
    return {
      cleanTitle: cleaned,
      category: "Saúde",
      isRecurringCandidate: false,
    };
  }

  // Compras & E-commerce
  if (
    lower.includes("amazon") ||
    lower.includes("mercado livre") ||
    lower.includes("mercadolivre") ||
    lower.includes("shopee") ||
    lower.includes("magalu") ||
    lower.includes("magazine luiza") ||
    lower.includes("casas bahia") ||
    lower.includes("fast shop") ||
    lower.includes("kabum") ||
    lower.includes("aliexpress") ||
    lower.includes("shein") ||
    lower.includes("renner") ||
    lower.includes("zara") ||
    lower.includes("riachuelo") ||
    lower.includes("c&a") ||
    lower.includes("centauro") ||
    lower.includes("nike") ||
    lower.includes("adidas") ||
    lower.includes("shopping")
  ) {
    return {
      cleanTitle: cleaned,
      category: "Compras",
      isRecurringCandidate: false,
    };
  }

  // Pagamento de Fatura de Cartão
  if (lower.includes("fatura") && (lower.includes("pagamento") || lower.includes("pagto") || lower.includes("cartao"))) {
    return {
      cleanTitle: cleaned,
      category: "Pagamento de Fatura",
      isRecurringCandidate: false,
    };
  }

  // Investimentos / Poupança / Caixinha
  if (
    lower.includes("aplicacao") ||
    lower.includes("caixinha") ||
    lower.includes("rdb") ||
    lower.includes("cdb") ||
    lower.includes("tesouro") ||
    lower.includes("investimento")
  ) {
    return {
      cleanTitle: cleaned,
      category: "Investimentos & Metas",
      isRecurringCandidate: false,
    };
  }

  // Transferências PIX / TED genéricas
  if (rawTitle.toLowerCase().includes("pix") || rawTitle.toLowerCase().includes("transf") || rawTitle.toLowerCase().includes("ted")) {
    return {
      cleanTitle: cleaned,
      category: "Transferências",
      isRecurringCandidate: false,
    };
  }

  return {
    cleanTitle: cleaned,
    category: "Outros",
    isRecurringCandidate: false,
  };
}

/** Descrições de transferência (Pix/TED/DOC) nunca representam compra parcelada sem a palavra "parcela". */
const TRANSFER_DESCRIPTION_RE = /\b(?:pix|ted|doc|transf\w*|transfer[eê]ncia)\b/i;

export interface InstallmentDetectionContext {
  /** Conta corrente não tem parcela de cartão: só aceita parcela com palavra explícita ("Parcela 2/10"). */
  accountType?: "checking" | "credit";
  /** Dia do lançamento (1-31). Usado para não confundir a própria data "06/11" com parcela 6/11. */
  transactionDay?: number;
  /** Mês do lançamento (0-11). */
  transactionMonth?: number;
}

/**
 * Extrai informações de parcelamento de uma descrição (ex: "Parc 3/12", "Parcela 1 de 6", "AMAZON 02/10" na fatura).
 *
 * Regras (para não confundir datas com parcelas):
 *  1. Com palavra explícita ("parc", "parcela", "prestação") é sempre parcela.
 *  2. Sem palavra explícita, "X/Y" só é parcela em fatura de cartão, quando o token está isolado
 *     (não colado a letras como em "Isadora06/11"), a descrição não é Pix/TED e o X/Y não é a própria data do lançamento.
 */
export function extractInstallmentInfo(
  description: string,
  context: InstallmentDetectionContext = {}
): {
  currentInstallment: number;
  totalInstallments: number;
} | null {
  const isValid = (current: number, total: number) =>
    current >= 1 && total >= 2 && total <= 48 && current <= total;

  // 1. Parcela explícita: "Parc 02/10", "PARC02/10", "Parcela 2 de 10", "Prestação 3/24"
  const explicitMatch = description.match(
    /\b(?:parc(?:ela)?s?|prest(?:a[cç][aã]o)?)\.?\s*(\d{1,2})\s*(?:\/|de)\s*(\d{1,2})\b/i
  );
  if (explicitMatch) {
    const current = parseInt(explicitMatch[1], 10);
    const total = parseInt(explicitMatch[2], 10);
    return isValid(current, total) ? { currentInstallment: current, totalInstallments: total } : null;
  }

  // 2. Parcela implícita (padrão de fatura de cartão: "LOJA X 02/10")
  if (context.accountType === "checking") return null;
  if (TRANSFER_DESCRIPTION_RE.test(description)) return null;

  const implicitMatch = description.match(/(?:^|\s)(\d{1,2})\/(\d{1,2})(?=\s|$)/);
  if (!implicitMatch) return null;

  const current = parseInt(implicitMatch[1], 10);
  const total = parseInt(implicitMatch[2], 10);
  if (!isValid(current, total)) return null;

  const isOwnDate =
    typeof context.transactionDay === "number" &&
    typeof context.transactionMonth === "number" &&
    current === context.transactionDay &&
    total === context.transactionMonth + 1;
  if (isOwnDate) return null;

  return { currentInstallment: current, totalInstallments: total };
}

/**
 * Remove datas e horários embutidos na descrição (ex.: Itaú "PIX TRANSF ISADORA06/11" → "PIX TRANSF ISADORA").
 * Preserva o token de parcela quando ele foi identificado.
 */
export function stripEmbeddedDateTokens(description: string, keepInstallmentToken: boolean): string {
  let out = description
    .replace(/(?<=[A-Za-zÀ-ÿ.*])\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g, " ")
    .replace(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g, " ")
    .replace(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g, " ");

  if (!keepInstallmentToken) {
    out = out.replace(/(?:^|\s)\d{1,2}\/\d{1,2}(?=\s|$)/g, " ");
  }

  return out.replace(/\s+/g, " ").trim();
}

/**
 * Deixa descrições de Pix e transferências legíveis e elegantes (padrão Apple HIG).
 * Exemplo: "Transferência Recebida - Bartolomeu Chiachio de Paiva - •••.345.506-•• - NU 49119149-3"
 *          → "Transferência Recebida - Bartolomeu Chiachio de Paiva"
 */
export function simplifyTransferDescription(description: string): string {
  let out = description.replace(/\\/g, "");

  const nubankPix = out.match(/^transfer[eê]ncia\s+(enviada|recebida)\s+pelo\s+pix\s*[-–]?\s*(.*)$/i);
  if (nubankPix) {
    const direction = nubankPix[1].toLowerCase() === "enviada" ? "Pix enviado" : "Pix recebido";
    const counterpart = nubankPix[2].split(/\s+[-–]\s+/)[0]?.trim() || "";
    out = counterpart ? `${direction} - ${counterpart}` : direction;
  }

  const generalTransfer = out.match(/^transfer[eê]ncia\s+(recebida|enviada)\s*[-–]?\s*(.*)$/i);
  if (generalTransfer && !out.toLowerCase().includes("pelo pix")) {
    const direction = generalTransfer[1].toLowerCase() === "recebida" ? "Transferência Recebida" : "Transferência Enviada";
    const counterpart = generalTransfer[2].split(/\s+[-–]\s+/)[0]?.trim() || "";
    out = counterpart ? `${direction} - ${counterpart}` : direction;
  }

  out = out
    .replace(/^PIX\s+TRANSF(?:ERENCIA)?\s+/i, "Pix - ")
    .replace(/^PIX\s+QRS?\s+/i, "Pix QR - ")
    // CPF/CNPJ mascarados, agência e conta
    .replace(/[•*c\s]{2,4}\.?\d{3}\.?\d{3}-?[•*c\s]{2,4}/gi, " ")
    .replace(/\bag[eê]ncia:?\s*\d+\b/gi, " ")
    .replace(/\bconta:?\s*[\d.-]+\b/gi, " ")
    .replace(/\bNU\s+\d+[\d.-]*/gi, " ")
    .replace(/\(\d{3,4}\)/g, " ")
    .replace(/\s+[-–]\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return out || description;
}

/**
 * Verifica se uma linha do extrato é um cabeçalho, rodapé ou linha de resumo (não é transação)
 */
function isSummaryOrNoiseLine(line: string): boolean {
  const lower = line
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

  if (lower.length < 5) return true;

  const noisePatterns = [
    /^saldo\s+(?:anterior|do\s+dia|final|atual|bloqueado|disponivel|em\s+conta|total|inicial|liquido|aplicado)/,
    /^total\s+(?:de\s+entradas|de\s+saidas|da\s+fatura|geral|do\s+periodo|a\s+pagar)/,
    /^(?:entradas|saidas)\s+(?:do\s+periodo|totais)/,
    /^resumo\s+(?:da\s+fatura|do\s+mes|financeiro)/,
    /^limite\s+(?:total|disponivel|utilizado|de\s+credito)/,
    /^pagamento\s+minimo/,
    /^sac\b|^ouvidoria\b|^central\s+de\s+atendimento/,
    /^pagina\s+\d+/,
    /^extrato\s+(?:de\s+conta|bancario|mensal|consolidado)/,
    /^data\s+(?:historico|descricao|lancamento)/,
    /^movimentacoes\s+da\s+conta/,
    /^lancamentos\s+no\s+cartao/,
    /^fechamento\s*:|^vencimento\s*:/,
    /^titular\s*:/,
    /^valores\s+em\s+r\$/,
    /^periodo\s*:?\s*\d/,
  ];

  return noisePatterns.some((regex) => regex.test(lower));
}

/**
 * Faz o parse de um valor monetário em string (ex: "-R$ 1.234,56", "1.234,56 D", "+ 450,00", "-45.90")
 */
export function parseStatementAmountToken(rawToken: string): {
  amount: number;
  explicitSign: "in" | "out" | null;
} | null {
  const trimmed = rawToken.trim();
  if (!trimmed) return null;

  let explicitSign: "in" | "out" | null = null;
  if (trimmed.startsWith("-") || trimmed.startsWith("−") || /\bD$/i.test(trimmed) || /^\(.*\)$/.test(trimmed)) {
    explicitSign = "out";
  } else if (trimmed.startsWith("+") || /\bC$/i.test(trimmed)) {
    explicitSign = "in";
  }

  let numericPart = trimmed
    .replace(/[()R$r$\s+−-]/g, "")
    .replace(/[DCdc]$/g, "")
    .trim();

  if (!numericPart) return null;

  if (numericPart.includes(",") && numericPart.includes(".")) {
    // Decide qual é o separador decimal pela última ocorrência
    if (numericPart.lastIndexOf(",") > numericPart.lastIndexOf(".")) {
      numericPart = numericPart.replace(/\./g, "").replace(",", ".");
    } else {
      numericPart = numericPart.replace(/,/g, "");
    }
  } else if (numericPart.includes(",")) {
    numericPart = numericPart.replace(",", ".");
  }

  const value = parseFloat(numericPart);
  if (!Number.isFinite(value) || value < 0 || value > 50_000_000) {
    return null;
  }

  return {
    amount: Math.round(value * 100) / 100,
    explicitSign,
  };
}

/**
 * Converte token de data brasileira ("15/10/2026", "15/10/26", "15/10", "15 OUT 2026", "15 OUT", "2026-10-15")
 */
export function parseStatementDateToken(
  rawDate: string,
  referenceYear: number
): { isoDate: string; displayDate: string; day: number; month: number; year: number } | null {
  const clean = rawDate.trim();

  // 1. YYYY-MM-DD
  const isoMatch = clean.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10) - 1;
    const day = parseInt(isoMatch[3], 10);
    if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
      return {
        isoDate: `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
        displayDate: `${String(day).padStart(2, "0")}/${String(month + 1).padStart(2, "0")}/${year}`,
        day,
        month,
        year,
      };
    }
  }

  // 2. DD/MM/YYYY ou DD/MM/YY ou DD/MM
  const slashMatch = clean.match(/^(\d{1,2})[/.](\d{1,2})(?:[/.](\d{2,4}))?$/);
  if (slashMatch) {
    const day = parseInt(slashMatch[1], 10);
    const month = parseInt(slashMatch[2], 10) - 1;
    let year = referenceYear;
    if (slashMatch[3]) {
      const yRaw = parseInt(slashMatch[3], 10);
      year = yRaw < 100 ? 2000 + yRaw : yRaw;
    }
    if (month >= 0 && month <= 11 && day >= 1 && day <= 31 && year >= 2000 && year <= 2100) {
      return {
        isoDate: `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
        displayDate: `${String(day).padStart(2, "0")}/${String(month + 1).padStart(2, "0")}/${year}`,
        day,
        month,
        year,
      };
    }
  }

  // 3. DD MMM [YYYY] (ex: "15 OUT", "15 Out 2026", "15 de Outubro")
  const textMonthMatch = clean.match(
    /^(\d{1,2})\s+(?:de\s+)?([a-zA-ZçÇ]{3,10})(?:\s+(?:de\s+)?(\d{2,4}))?$/i
  );
  if (textMonthMatch) {
    const day = parseInt(textMonthMatch[1], 10);
    const mName = textMonthMatch[2].toLowerCase();
    const month = MONTH_ABBR_MAP[mName] ?? MONTH_ABBR_MAP[mName.slice(0, 3)];
    let year = referenceYear;
    if (textMonthMatch[3]) {
      const yRaw = parseInt(textMonthMatch[3], 10);
      year = yRaw < 100 ? 2000 + yRaw : yRaw;
    }
    if (month !== undefined && day >= 1 && day <= 31) {
      return {
        isoDate: `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
        displayDate: `${String(day).padStart(2, "0")}/${String(month + 1).padStart(2, "0")}/${year}`,
        day,
        month,
        year,
      };
    }
  }

  return null;
}

/**
 * Extrai metadados globais do extrato (Saldo Final, Limite do Cartão, Fechamento, Vencimento, Tipo Predominante)
 */
export function extractStatementHeaderMetadata(text: string): {
  checkingBalance: number | null;
  creditLimit: number | null;
  closingDay: number | null;
  dueDay: number | null;
  hasCheckingSection: boolean;
  hasCreditSection: boolean;
} {
  let checkingBalance: number | null = null;
  let creditLimit: number | null = null;
  let closingDay: number | null = null;
  let dueDay: number | null = null;

  // 1. Saldo em conta / Saldo final: prioriza correspondência explícita com "R$" (ex.: "Saldo final do período\nR$ 46,63")
  const explicitCurrencyMatch = text.match(
    /saldo\s+(?:em\s+conta(?:\s+final)?|final(?:\s+do\s+per[ií]odo)?|atual|dispon[ií]vel\s+em\s+conta)\s*[:=-]?\s*R\$\s*([+-]?\s*\d{1,3}(?:\.\d{3})*,\d{2}|[+-]?\d+(?:[.,]\d{2}))/i
  );
  if (explicitCurrencyMatch) {
    const parsed = parseStatementAmountToken(explicitCurrencyMatch[1]);
    if (parsed) {
      checkingBalance = parsed.explicitSign === "out" ? -parsed.amount : parsed.amount;
    }
  }

  // 2. Fallback caso não haja "R$" explícito
  if (checkingBalance === null) {
    const balanceRegexes = [
      /saldo\s+(?:em\s+conta(?:\s+final)?|final(?:\s+do\s+per[ií]odo)?|atual|dispon[ií]vel\s+em\s+conta)\s*[:=-]?\s*(?:R\$\s*)?([+-]?\s*\d{1,3}(?:\.\d{3})*,\d{2}|[+-]?\d+(?:[.,]\d{2}))/gi,
      /saldo\s+do\s+dia\s*[:=-]?\s*(?:R\$\s*)?([+-]?\s*\d{1,3}(?:\.\d{3})*,\d{2}|[+-]?\d+(?:[.,]\d{2}))/gi,
    ];
    for (const rx of balanceRegexes) {
      const matches = Array.from(text.matchAll(rx));
      const first = matches[0];
      if (first) {
        const parsed = parseStatementAmountToken(first[1]);
        if (parsed) {
          checkingBalance = parsed.explicitSign === "out" ? -parsed.amount : parsed.amount;
          break;
        }
      }
    }
  }

  // Limite do cartão
  const limitMatch = text.match(
    /limite\s+(?:total(?:\s+do\s+cart[aã]o)?|de\s+cr[eé]dito)\s*[:=-]?\s*(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2}|\d+(?:[.,]\d{2}))/i
  );
  if (limitMatch) {
    const parsed = parseStatementAmountToken(limitMatch[1]);
    if (parsed) creditLimit = parsed.amount;
  }

  // Fechamento e Vencimento
  const closingMatch = text.match(/fechamento\s*(?:da\s+fatura)?\s*[:=-]?\s*(?:dia\s*)?(\d{1,2})\b/i);
  if (closingMatch) {
    const d = parseInt(closingMatch[1], 10);
    if (d >= 1 && d <= 31) closingDay = d;
  }

  const dueMatch = text.match(/vencimento\s*(?:da\s+fatura)?\s*[:=-]?\s*(?:dia\s*)?(\d{1,2})\b/i);
  if (dueMatch) {
    const d = parseInt(dueMatch[1], 10);
    if (d >= 1 && d <= 31) dueDay = d;
  }

  const lower = text.toLowerCase();
  // "pagamento de fatura" dentro de extrato de conta corrente NÃO significa que o arquivo é fatura de cartão!
  const hasPureInvoiceKeyword =
    (lower.includes("fatura") && !lower.includes("pagamento de fatura") && !lower.includes("pagamento da fatura")) ||
    lower.includes("fatura fechada") ||
    lower.includes("resumo da fatura");

  const hasCreditKeywords =
    hasPureInvoiceKeyword ||
    lower.includes("cartao de credito") ||
    lower.includes("cartão de crédito") ||
    lower.includes("lancamentos no cartao") ||
    lower.includes("lançamentos no cartão") ||
    lower.includes("pagamento minimo") ||
    lower.includes("pagamento mínimo");

  const hasCheckingKeywords =
    lower.includes("conta corrente") ||
    lower.includes("extrato de conta") ||
    lower.includes("movimentacoes da conta") ||
    lower.includes("movimentações da conta") ||
    lower.includes("pix enviado") ||
    lower.includes("pix recebido") ||
    lower.includes("saldo em conta") ||
    lower.includes("saldo anterior") ||
    lower.includes("total de entradas") ||
    lower.includes("total de saídas") ||
    lower.includes("total de saidas");

  return {
    checkingBalance,
    creditLimit,
    closingDay,
    dueDay,
    hasCheckingSection: hasCheckingKeywords || !hasCreditKeywords,
    hasCreditSection: hasCreditKeywords && !hasCheckingKeywords ? true : Boolean(creditLimit && creditLimit > 0),
  };
}

/**
 * Analisa o texto completo de um extrato bancário ou fatura (PDF extraído, CSV, OFX ou texto colado)
 * e retorna contas, cartões, contas fixas/recorrências e transações prontas para confirmação do usuário.
 */
export function analyzeBankStatementText(params: AnalyzeStatementParams): StatementAnalysisResult {
  const {
    rawText,
    fileName = "",
    referenceDate = new Date(),
    existingCards = [],
    existingTransactions = [],
    existingRecurringItems = [],
  } = params;

  const refYear = referenceDate.getFullYear();

  // Se for conteúdo OFX bruto, converte primeiro para linhas padronizadas
  const normalizedInputText =
    rawText.includes("<OFX>") || rawText.includes("<STMTTRN>")
      ? convertOfxToStandardLines(rawText)
      : rawText;

  const institution = detectBankInstitution(normalizedInputText, fileName);
  const headerMeta = extractStatementHeaderMetadata(normalizedInputText);

  const rawLines = normalizedInputText
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => l.length > 0);

  // Estado de seção conforme percorre o documento (permite extratos mistos Conta + Cartão)
  let currentSectionMode: "checking" | "credit" =
    headerMeta.hasCreditSection && !headerMeta.hasCheckingSection ? "credit" : "checking";

  const rawExtractedTransactions: Array<{
    dateInfo: NonNullable<ReturnType<typeof parseStatementDateToken>>;
    rawDescription: string;
    amount: number;
    type: "despesa" | "receita";
    accountType: "checking" | "credit";
  }> = [];

  // Regex para linha única com Data no início e Valor no final:
  // Ex: "05/10/2026 SALARIO EMPRESA +R$ 8.500,00"
  // Ex: "15 OUT Uber Do Brasil R$ 24,90"
  // Ex: "2026-10-12;Supermercado;-450.20" (CSV)
  const lineTransactionRegex =
    /^(\d{4}-\d{2}-\d{2}|\d{1,2}[/.]\d{1,2}(?:[/.]\d{2,4})?|\d{1,2}\s+(?:de\s+)?[a-zA-ZçÇ]{3,10}(?:\s+\d{2,4})?)[\s;|,\t]+(.+?)[\s;|,\t]+([+-−]?\s*(?:R\$\s*)?[+-−]?\s*\d{1,3}(?:\.\d{3})*,\d{2}(?:\s*[DCdc])?|[+-−]?\s*(?:R\$\s*)?\d+(?:[.,]\d{2})(?:\s*[DCdc])?)$/;

  let i = 0;
  while (i < rawLines.length) {
    const line = rawLines[i];
    const lowerLine = line.toLowerCase();

    // Detecta mudança de seção no PDF (Conta Corrente vs Cartão de Crédito)
    if (
      lowerLine.includes("lancamentos no cartao") ||
      lowerLine.includes("lançamentos no cartão") ||
      lowerLine.includes("fatura do cartao") ||
      lowerLine.includes("fatura de cartao") ||
      lowerLine.includes("compras no credito")
    ) {
      currentSectionMode = "credit";
      i++;
      continue;
    }
    if (
      lowerLine.includes("movimentacoes da conta") ||
      lowerLine.includes("movimentações da conta") ||
      lowerLine.includes("extrato de conta corrente")
    ) {
      currentSectionMode = "checking";
      i++;
      continue;
    }

    if (isSummaryOrNoiseLine(line)) {
      i++;
      continue;
    }

    // Tentativa 1: Linha única completa (Data + Descrição + Valor)
    const singleMatch = line.match(lineTransactionRegex);
    if (singleMatch) {
      const dateInfo = parseStatementDateToken(singleMatch[1], refYear);
      const amountInfo = parseStatementAmountToken(singleMatch[3]);
      const desc = singleMatch[2].trim();

      if (dateInfo && amountInfo && !isSummaryOrNoiseLine(desc)) {
        const descLower = desc
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "");

        const isExplicitCardLine =
          currentSectionMode === "credit" ||
          /\bcartao\b|\bcredito\b|\bfatura\b/.test(descLower) && !descLower.includes("pagamento de fatura");

        const isIncomeKeyword =
          descLower.includes("salario") ||
          descLower.includes("pix recebido") ||
          descLower.includes("ted recebida") ||
          descLower.includes("transferencia recebida") ||
          descLower.includes("reembolso") ||
          descLower.includes("deposito") ||
          descLower.includes("credito salarial") ||
          descLower.includes("remuneracao") ||
          descLower.includes("rendimento");

        const isExpenseKeyword =
          descLower.includes("pix enviado") ||
          descLower.includes("pagamento") ||
          descLower.includes("pagto") ||
          descLower.includes("compra") ||
          descLower.includes("boleto") ||
          descLower.includes("debito") ||
          descLower.includes("tarifa") ||
          descLower.includes("saque");

        let txType: "despesa" | "receita" = "despesa";
        if (isExplicitCardLine) {
          txType = "despesa";
        } else if (amountInfo.explicitSign === "in" && !isExpenseKeyword) {
          txType = "receita";
        } else if (amountInfo.explicitSign === "out") {
          txType = "despesa";
        } else if (isIncomeKeyword) {
          txType = "receita";
        }

        rawExtractedTransactions.push({
          dateInfo,
          rawDescription: desc,
          amount: amountInfo.amount,
          type: txType,
          accountType: isExplicitCardLine ? "credit" : "checking",
        });
        i++;
        continue;
      }
    }

    // Tentativa 2: Layout por blocos com Data no topo (padrão oficial Nubank Conta e outros bancos digitais)
    // Exemplo:
    // 01 OUT 2026
    // Total de entradas
    // + 342,93
    // Transferência recebida pelo Pix
    // JOAO PEDRO CHIACHIO DE PAIVA - ...
    // 342,93
    const sectionDate = parseStatementDateToken(line, refYear);
    if (sectionDate) {
      let currentSectionSign: "in" | "out" | null = null;
      let j = i + 1;

      while (j < rawLines.length) {
        const subLine = rawLines[j];
        // Se encontramos uma nova data, para o bloco atual
        if (parseStatementDateToken(subLine, refYear)) {
          break;
        }

        const subLower = subLine.toLowerCase();

        // Pula linhas de cabeçalho/rodapé de quebra de página sem quebrar o bloco da data atual
        if (
          isSummaryOrNoiseLine(subLine) ||
          subLower.includes("tem alguma duvida") ||
          subLower.includes("tem alguma dúvida") ||
          subLower.includes("extrato gerado dia") ||
          /^\d+\s+de\s+\d+$/i.test(subLine) ||
          subLower === "valores em r$" ||
          subLower.startsWith("nu financeira") ||
          subLower.startsWith("nu pagamentos")
        ) {
          j++;
          continue;
        }

        if (subLower === "total de entradas" || subLower.startsWith("entradas")) {
          currentSectionSign = "in";
          j++;
          // Pula o somatório que costuma vir logo abaixo (ex: '+ 342,93')
          if (j < rawLines.length && parseStatementAmountToken(rawLines[j])) {
            j++;
          }
          continue;
        }

        if (subLower === "total de saidas" || subLower === "total de saídas" || subLower.startsWith("saidas") || subLower.startsWith("saídas")) {
          currentSectionSign = "out";
          j++;
          // Pula o somatório que costuma vir logo abaixo (ex: '- 356,43')
          if (j < rawLines.length && parseStatementAmountToken(rawLines[j])) {
            j++;
          }
          continue;
        }

        const isTxStart =
          subLine.startsWith("Transferência") ||
          subLine.startsWith("Transferencia") ||
          subLine.startsWith("Pix") ||
          subLine.startsWith("PIX") ||
          subLine.startsWith("Compra no débito") ||
          subLine.startsWith("Compra no debito") ||
          subLine.startsWith("Pagamento de fatura") ||
          subLine.startsWith("Pagamento de boleto") ||
          subLine.startsWith("Resgate de empréstimo") ||
          subLine.startsWith("Resgate de emprestimo") ||
          subLine.startsWith("Estorno") ||
          subLine.startsWith("Aplicação RDB") ||
          subLine.startsWith("Aplicacao RDB") ||
          subLine.startsWith("Resgate RDB") ||
          subLine.startsWith("Depósito") ||
          subLine.startsWith("Deposito");

        if (isTxStart) {
          const headerTitle = subLine;
          let details = "";
          let itemAmount: number | null = null;
          let k = j + 1;

          while (k < rawLines.length && k < j + 8) {
            const detailLine = rawLines[k];
            if (
              parseStatementDateToken(detailLine, refYear) ||
              detailLine.toLowerCase().startsWith("total de") ||
              detailLine.startsWith("Transferência") ||
              detailLine.startsWith("Compra no débito") ||
              detailLine.startsWith("Pagamento") ||
              detailLine.startsWith("Resgate") ||
              detailLine.startsWith("Tem alguma dúvida")
            ) {
              break;
            }

            const amtCheck = parseStatementAmountToken(detailLine);
            // Um valor numérico isolado na linha final do item é o valor da transação (ignora números de conta tipo 12345-6)
            if (amtCheck && !/conta:?\s*[\d.-]+/i.test(detailLine) && !detailLine.toLowerCase().includes("agencia") && !detailLine.toLowerCase().includes("agência")) {
              itemAmount = amtCheck.amount;
              k++;
              break;
            } else {
              if (!details) {
                details = detailLine;
              } else if (!detailLine.includes("PAGAMENTOS") && !detailLine.includes("Conta:") && !detailLine.includes("Agência:")) {
                details += " " + detailLine;
              }
            }
            k++;
          }

          if (itemAmount !== null) {
            const rawDescription = details ? `${headerTitle} - ${details}` : headerTitle;
            const explicitIncome = /recebida|recebido|deposito|depósito|salario|salário|rendimento/i.test(headerTitle);
            const explicitExpense = /enviada|enviado|compra|pagamento|aplicacao|aplicação/i.test(headerTitle);
            const txType: "despesa" | "receita" =
              explicitIncome ? "receita" : explicitExpense ? "despesa" : currentSectionSign === "in" ? "receita" : "despesa";

            rawExtractedTransactions.push({
              dateInfo: sectionDate,
              rawDescription,
              amount: itemAmount,
              type: txType,
              accountType: currentSectionMode,
            });
            j = k;
            continue;
          }
        }

        j++;
      }

      if (j > i + 1) {
        i = j;
        continue;
      }
    }

    // Tentativa 3: Layout multi-linha clássico (Data em linha isolada, descrição + valor nas seguintes)
    const standaloneDate = parseStatementDateToken(line, refYear);
    if (standaloneDate && i + 1 < rawLines.length) {
      const nextLine = rawLines[i + 1];
      // Verifica se nextLine tem Descrição + Valor, ou se Valor está em i + 2
      const nextWithAmt = nextLine.match(
        /^(.+?)\s+([+-−]?\s*(?:R\$\s*)?[+-−]?\s*\d{1,3}(?:\.\d{3})*,\d{2}(?:\s*[DCdc])?|[+-−]?\s*(?:R\$\s*)?\d+(?:[.,]\d{2})(?:\s*[DCdc])?)$/
      );
      if (nextWithAmt && !isSummaryOrNoiseLine(nextWithAmt[1])) {
        const amtInfo = parseStatementAmountToken(nextWithAmt[2]);
        if (amtInfo) {
          const desc = nextWithAmt[1].trim();
          const descLower = desc.toLowerCase();
          const isIncome =
            amtInfo.explicitSign === "in" ||
            descLower.includes("salario") ||
            descLower.includes("salário") ||
            descLower.includes("pix recebido") ||
            descLower.includes("recebido");

          rawExtractedTransactions.push({
            dateInfo: standaloneDate,
            rawDescription: desc,
            amount: amtInfo.amount,
            type: currentSectionMode === "credit" ? "despesa" : isIncome ? "receita" : "despesa",
            accountType: currentSectionMode,
          });
          i += 2;
          continue;
        }
      } else if (i + 2 < rawLines.length && !isSummaryOrNoiseLine(nextLine)) {
        const thirdLineAmt = parseStatementAmountToken(rawLines[i + 2]);
        if (thirdLineAmt) {
          const desc = nextLine.trim();
          const descLower = desc.toLowerCase();
          const isIncome =
            thirdLineAmt.explicitSign === "in" ||
            descLower.includes("salario") ||
            descLower.includes("salário") ||
            descLower.includes("pix recebido");

          rawExtractedTransactions.push({
            dateInfo: standaloneDate,
            rawDescription: desc,
            amount: thirdLineAmt.amount,
            type: currentSectionMode === "credit" ? "despesa" : isIncome ? "receita" : "despesa",
            accountType: currentSectionMode,
          });
          i += 3;
          continue;
        }
      }
    }

    i++;
  }

  // Determina nomes das contas detectadas e vinculação com cartões existentes
  const hasCheckingTx =
    rawExtractedTransactions.some((t) => t.accountType === "checking") ||
    headerMeta.checkingBalance !== null;
  const hasCreditTx =
    rawExtractedTransactions.some((t) => t.accountType === "credit") ||
    headerMeta.creditLimit !== null ||
    (headerMeta.hasCreditSection && !headerMeta.hasCheckingSection);

  const existingCheckingCard = existingCards.find(
    (c) =>
      c.type === "checking" &&
      (c.name.toLowerCase().includes(institution.name.toLowerCase()) ||
        institution.id === "default")
  ) || existingCards.find((c) => c.type === "checking");

  const existingCreditCard = existingCards.find(
    (c) =>
      c.type === "credit" &&
      c.name.toLowerCase().includes(institution.name.toLowerCase())
  );

  const checkingAccountName = existingCheckingCard
    ? existingCheckingCard.name
    : institution.id === "default"
    ? "Conta Principal"
    : `Conta ${institution.name}`;

  const creditCardName = existingCreditCard
    ? existingCreditCard.name
    : institution.id === "default"
    ? "Cartão de Crédito"
    : `${institution.name} Crédito`;

  // Processa transações enriquecidas com categorização, parcelas e deduplicação
  const detectedTransactions: DetectedStatementTransaction[] = [];

  for (let idx = 0; idx < rawExtractedTransactions.length; idx++) {
    const rawTx = rawExtractedTransactions[idx];
    const installmentInfo = extractInstallmentInfo(rawTx.rawDescription, {
      accountType: rawTx.accountType,
      transactionDay: rawTx.dateInfo.day,
      transactionMonth: rawTx.dateInfo.month,
    });

    // Se tem parcela X/Y, é tipicamente cartão de crédito (ou financiamento/boleto parcelado)
    const classified = classifyStatementMerchant(rawTx.rawDescription, rawTx.type);

    let cleanTitle = classified.cleanTitle;
    if (rawTx.accountType === "checking" && TRANSFER_DESCRIPTION_RE.test(rawTx.rawDescription)) {
      cleanTitle = simplifyTransferDescription(stripEmbeddedDateTokens(cleanTitle, false));
    } else {
      cleanTitle = stripEmbeddedDateTokens(cleanTitle, Boolean(installmentInfo));
    }

    const isInvoicePaymentOnCredit =
      rawTx.accountType === "credit" &&
      (classified.category === "Pagamento de Fatura" ||
        /pagamento\s+(?:de\s+)?fatura|pagamento\s+recebido/i.test(rawTx.rawDescription));

    const targetAccountName =
      rawTx.accountType === "credit" ? creditCardName : checkingAccountName;

    // Verifica duplicidade no histórico existente do usuário
    const isDuplicate = existingTransactions.some((existing) => {
      const sameAmount = Math.abs(existing.amount - rawTx.amount) < 0.01;
      if (!sameAmount) return false;

      const existingTitle = (existing.title || existing.description || "").toLowerCase().trim();
      const candTitle = classified.cleanTitle.toLowerCase().trim();
      const titleOverlap =
        existingTitle === candTitle ||
        existingTitle.includes(candTitle) ||
        candTitle.includes(existingTitle);

      if (!titleOverlap) return false;

      const existingDateRaw = existing.occurredAt || existing.date;
      if (!existingDateRaw) return true;
      const existingIso =
        typeof existingDateRaw === "string" && /^\d{4}-\d{2}-\d{2}/.test(existingDateRaw)
          ? existingDateRaw.slice(0, 10)
          : new Date(existingDateRaw).toISOString().slice(0, 10);

      return existingIso === rawTx.dateInfo.isoDate;
    });

    detectedTransactions.push({
      id: `stmt-tx-${idx + 1}`,
      title: cleanTitle,
      rawDescription: rawTx.rawDescription,
      amount: rawTx.amount,
      type: rawTx.type,
      category: classified.category,
      date: rawTx.dateInfo.isoDate,
      displayDate: rawTx.dateInfo.displayDate,
      accountName: targetAccountName,
      accountType: rawTx.accountType,
      installmentCurrent: installmentInfo?.currentInstallment,
      installmentTotal: installmentInfo?.totalInstallments,
      isRecurringCandidate: Boolean(classified.isRecurringCandidate || installmentInfo),
      isInvoicePaymentOnCreditStatement: isInvoicePaymentOnCredit,
      isDuplicate,
      selected: !isDuplicate && !isInvoicePaymentOnCredit,
    });
  }

  // Calcula somatórios
  const totalIncome = detectedTransactions
    .filter((t) => t.type === "receita" && !t.isInvoicePaymentOnCreditStatement)
    .reduce((acc, t) => acc + t.amount, 0);

  const totalExpense = detectedTransactions
    .filter((t) => t.type === "despesa" && !t.isInvoicePaymentOnCreditStatement)
    .reduce((acc, t) => acc + t.amount, 0);

  const checkingNetFlow = detectedTransactions
    .filter((t) => t.accountType === "checking")
    .reduce((acc, t) => acc + (t.type === "receita" ? t.amount : -t.amount), 0);

  const creditTotalSpent = detectedTransactions
    .filter((t) => t.accountType === "credit" && t.type === "despesa" && !t.isInvoicePaymentOnCreditStatement)
    .reduce((acc, t) => acc + t.amount, 0);

  // Sintetiza Contas & Cartões detectados
  const detectedAccounts: DetectedStatementAccount[] = [];

  if (hasCheckingTx) {
    const inferredBalance =
      headerMeta.checkingBalance !== null
        ? headerMeta.checkingBalance
        : existingCheckingCard?.balance !== undefined
        ? existingCheckingCard.balance
        : Math.max(0, Math.round(checkingNetFlow * 100) / 100);

    detectedAccounts.push({
      id: existingCheckingCard?.id || `stmt-acc-checking-${institution.id}`,
      name: checkingAccountName,
      institutionId: institution.id,
      institutionName: institution.name,
      brand: "Conta",
      type: "checking",
      balance: inferredBalance,
      limit: 0,
      closingDay: headerMeta.closingDay || institution.defaultClosingDay,
      dueDay: headerMeta.dueDay || institution.defaultDueDay,
      colorScheme: {
        ...institution.colorScheme,
        badgeText: checkingAccountName,
      },
      existingCardId: existingCheckingCard?.id || null,
      action: existingCheckingCard ? "link_existing" : "create",
      selected: true,
      updateExistingBalance: headerMeta.checkingBalance !== null,
    });
  }

  if (hasCreditTx) {
    const inferredLimit =
      headerMeta.creditLimit !== null
        ? headerMeta.creditLimit
        : existingCreditCard?.limit
        ? existingCreditCard.limit
        : Math.max(5000, Math.ceil((creditTotalSpent * 2.5) / 500) * 500);

    detectedAccounts.push({
      id: existingCreditCard?.id || `stmt-acc-credit-${institution.id}`,
      name: creditCardName,
      institutionId: institution.id,
      institutionName: institution.name,
      brand: existingCreditCard?.brand || institution.defaultBrand,
      type: "credit",
      balance: 0,
      limit: inferredLimit,
      closingDay: headerMeta.closingDay || existingCreditCard?.closingDay || institution.defaultClosingDay,
      dueDay: headerMeta.dueDay || existingCreditCard?.dueDay || institution.defaultDueDay,
      colorScheme: {
        ...institution.colorScheme,
        badgeText: creditCardName,
      },
      existingCardId: existingCreditCard?.id || null,
      action: existingCreditCard ? "link_existing" : "create",
      selected: true,
    });
  }

  // Sintetiza Contas Fixas, Assinaturas, Salários e Parcelamentos para o Planejamento Mensal
  const detectedRecurringMap = new Map<string, DetectedStatementRecurring>();

  for (const tx of detectedTransactions) {
    if (tx.isInvoicePaymentOnCreditStatement) continue;

    const classified = classifyStatementMerchant(tx.rawDescription, tx.type);
    const hasInstallments =
      typeof tx.installmentCurrent === "number" &&
      typeof tx.installmentTotal === "number" &&
      tx.installmentTotal >= 2;

    if (!classified.isRecurringCandidate && !hasInstallments) {
      continue;
    }

    const txDateObj = new Date(`${tx.date}T12:00:00`);
    const dueDay = Number.isNaN(txDateObj.getTime()) ? 10 : txDateObj.getDate();
    const txMonth = Number.isNaN(txDateObj.getTime()) ? referenceDate.getMonth() : txDateObj.getMonth();
    const txYear = Number.isNaN(txDateObj.getTime()) ? referenceDate.getFullYear() : txDateObj.getFullYear();

    // Se for compra parcelada (ex: "Amazon Br Notebook 02/10"), calcula o início ou parcelas restantes
    let installmentsCount: number | undefined = undefined;
    let startMonth = txMonth;
    let startYear = txYear;
    let recurringTitle = tx.title;
    let reason = classified.recurringReason || "Conta fixa mensal identificada";

    if (hasInstallments) {
      const current = tx.installmentCurrent!;
      const total = tx.installmentTotal!;
      installmentsCount = total;

      // Calcula o mês de início real da parcela 1 para que o cronograma do app bata exatamente na parcela X neste mês!
      const startDate = new Date(txYear, txMonth - (current - 1), 1);
      startMonth = startDate.getMonth();
      startYear = startDate.getFullYear();

      // Limpa o "02/10" do título base da recorrência para não ficar estático
      recurringTitle = tx.title
        .replace(/\b(?:parc(?:ela)?\.?\s*)?\d{1,2}\s*(?:\/|de)\s*\d{1,2}\b/gi, "")
        .replace(/\s+/g, " ")
        .trim() || tx.title;

      const remaining = Math.max(0, total - current);
      reason =
        remaining > 0
          ? `Parcelamento ${current}/${total} detectado (${remaining} ${remaining === 1 ? "parcela futura restante" : "parcelas futuras restantes"})`
          : `Última parcela (${current}/${total}) neste ciclo`;
    }

    const dedupeKey = `${recurringTitle.toLowerCase()}-${tx.type}`;
    if (detectedRecurringMap.has(dedupeKey)) continue;

    const alreadyExists = existingRecurringItems.some((existing) => {
      const existingNorm = existing.title.toLowerCase().trim();
      const candNorm = recurringTitle.toLowerCase().trim();
      return (
        existingNorm === candNorm ||
        existingNorm.includes(candNorm) ||
        candNorm.includes(existingNorm)
      );
    });

    detectedRecurringMap.set(dedupeKey, {
      id: `stmt-rec-${detectedRecurringMap.size + 1}`,
      title: recurringTitle,
      amount: tx.amount,
      type: tx.type === "receita" ? "income" : "expense",
      category: tx.category,
      accountName: tx.accountName,
      accountType: tx.accountType,
      dueDay,
      recurrenceType: classified.recurrenceType || "fixed_day",
      installmentsCount,
      currentInstallment: tx.installmentCurrent,
      totalInstallments: tx.installmentTotal,
      startMonth,
      startYear,
      sourceTransactionId: tx.id,
      alreadyExists,
      selected: !alreadyExists,
      reason,
    });
  }

  const recurringItems = Array.from(detectedRecurringMap.values());

  // Estima a renda mensal base (Salário detectado ou soma de entradas recorrentes/principais)
  const salaryRecurring = recurringItems
    .filter((r) => r.type === "income")
    .reduce((sum, r) => sum + r.amount, 0);
  const estimatedMonthlyIncome =
    salaryRecurring > 0 ? salaryRecurring : Math.round(totalIncome * 100) / 100;

  // Período coberto pelo extrato
  const sortedDates = detectedTransactions.map((t) => t.date).sort();
  const periodLabel =
    sortedDates.length >= 2
      ? `${ sortedDates[0].split("-").reverse().join("/") } a ${ sortedDates[sortedDates.length - 1].split("-").reverse().join("/") }`
      : sortedDates.length === 1
      ? sortedDates[0].split("-").reverse().join("/")
      : getPeriodKey(referenceDate.getFullYear(), referenceDate.getMonth());

  const statementKind: StatementAnalysisSummary["statementKind"] =
    hasCheckingTx && hasCreditTx ? "mixed" : hasCreditTx ? "credit" : "checking";

  const duplicatesCount = detectedTransactions.filter((t) => t.isDuplicate).length;

  const insights: string[] = [];
  if (detectedAccounts.length > 0) {
    insights.push(
      `Identificamos ${detectedAccounts.map((a) => `${a.name} (${a.type === "checking" ? "Conta" : "Crédito"})`).join(" e ")}.`
    );
  }
  if (recurringItems.length > 0) {
    const newRecCount = recurringItems.filter((r) => !r.alreadyExists).length;
    insights.push(
      `${recurringItems.length} ${recurringItems.length === 1 ? "compromisso recorrente/parcelado identificado" : "compromissos recorrentes/parcelados identificados"} (${newRecCount} novos para o Planejamento Mensal).`
    );
  }
  if (duplicatesCount > 0) {
    insights.push(
      `${duplicatesCount} ${duplicatesCount === 1 ? "lançamento já existia" : "lançamentos já existiam"} na sua carteira e foram desmarcados automaticamente para evitar duplicidade.`
    );
  }

  return {
    summary: {
      institutionName: institution.name,
      statementKind,
      periodLabel,
      totalIncome: Math.round(totalIncome * 100) / 100,
      totalExpense: Math.round(totalExpense * 100) / 100,
      netFlow: Math.round((totalIncome - totalExpense) * 100) / 100,
      detectedCheckingBalance: headerMeta.checkingBalance,
      detectedCreditLimit: headerMeta.creditLimit,
      estimatedMonthlyIncome,
      transactionsCount: detectedTransactions.length,
      recurringCount: recurringItems.length,
      accountsCount: detectedAccounts.length,
      duplicatesCount,
      confidence: detectedTransactions.length > 0 ? 0.96 : 0.4,
      aiEnhanced: false,
      insights,
    },
    accounts: detectedAccounts,
    recurringItems,
    transactions: detectedTransactions,
    extractedRawTextPreview: normalizedInputText.slice(0, 1500),
  };
}

/**
 * Combina os resultados de análise de múltiplos arquivos de extrato (ex.: 4 extratos do Nubank + 1 extrato do Itaú)
 * preservando todas as contas distintas (Conta Nubank, Conta Itaú, etc.), unificando lançamentos sem duplicatas e
 * consolidando compromissos recorrentes e de planejamento de forma harmonizada.
 */
export function mergeMultipleStatementAnalyses(
  analyses: StatementAnalysisResult[]
): StatementAnalysisResult {
  if (analyses.length === 0) {
    return analyzeBankStatementText({ rawText: "" });
  }
  if (analyses.length === 1) {
    return analyses[0];
  }

  // 1. Unificar Contas & Cartões por ID / Instituição + Tipo
  // Ordena análises cronologicamente para que o extrato mais recente forneça o saldo atual da conta
  const analysesWithLatestDate = analyses.map((a) => {
    const latestTxDate = a.transactions.reduce((max, t) => (t.date > max ? t.date : max), "");
    return { a, latestTxDate };
  });
  analysesWithLatestDate.sort((x, y) => x.latestTxDate.localeCompare(y.latestTxDate));

  const mergedAccountsMap = new Map<string, DetectedStatementAccount>();
  for (const { a } of analysesWithLatestDate) {
    for (const acc of a.accounts) {
      const key = `${acc.institutionId}-${acc.type}`;
      if (!mergedAccountsMap.has(key)) {
        mergedAccountsMap.set(key, { ...acc });
      } else {
        const existing = mergedAccountsMap.get(key)!;
        // O extrato mais recente no tempo define o saldo da conta corrente
        if (acc.updateExistingBalance || acc.balance !== existing.balance) {
          existing.balance = acc.balance;
          existing.updateExistingBalance = existing.updateExistingBalance || acc.updateExistingBalance;
        }
        if (acc.limit > existing.limit) {
          existing.limit = acc.limit;
        }
      }
    }
  }
  const mergedAccounts = Array.from(mergedAccountsMap.values());

  // 2. Unificar Transações (evitando duplicatas entre extratos sobrepostos do mesmo banco/período)
  const mergedTransactions: DetectedStatementTransaction[] = [];
  const txSignatureSet = new Set<string>();

  for (const a of analyses) {
    for (const tx of a.transactions) {
      // Assinatura única baseada em conta, data, valor e título normalizado
      const normTitle = tx.title.toLowerCase().replace(/\s+/g, " ").trim();
      const sig = `${tx.accountName}|${tx.date}|${tx.amount.toFixed(2)}|${tx.type}|${normTitle}`;
      if (txSignatureSet.has(sig)) {
        continue;
      }
      txSignatureSet.add(sig);
      mergedTransactions.push({
        ...tx,
        id: `stmt-tx-${mergedTransactions.length + 1}`,
      });
    }
  }

  // Ordena por data decrescente
  mergedTransactions.sort((t1, t2) => t2.date.localeCompare(t1.date));

  // 3. Unificar Recorrências / Contas Fixas / Parcelas
  const mergedRecurringMap = new Map<string, DetectedStatementRecurring>();
  for (const a of analyses) {
    for (const rec of a.recurringItems) {
      const key = `${rec.title.toLowerCase().trim()}-${rec.type}`;
      if (!mergedRecurringMap.has(key)) {
        mergedRecurringMap.set(key, {
          ...rec,
          id: `stmt-rec-${mergedRecurringMap.size + 1}`,
        });
      } else {
        const existing = mergedRecurringMap.get(key)!;
        // Se for parcelado, preserva o parcelamento mais avançado
        if (rec.currentInstallment && (!existing.currentInstallment || rec.currentInstallment > existing.currentInstallment)) {
          existing.currentInstallment = rec.currentInstallment;
          existing.totalInstallments = rec.totalInstallments;
          existing.installmentsCount = rec.installmentsCount;
          existing.startMonth = rec.startMonth;
          existing.startYear = rec.startYear;
        }
      }
    }
  }

  // 3.1. Identifica empiricamente compromissos que se repetem através de múltiplos meses/extratos
  const txGroupMap = new Map<string, DetectedStatementTransaction[]>();
  for (const tx of mergedTransactions) {
    if (tx.isInvoicePaymentOnCreditStatement) continue;
    const cleanKey = tx.title
      .toLowerCase()
      .replace(/r\$\s*[\d,.]+/g, "")
      .replace(/[-–•*]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (cleanKey.length < 4) continue;
    if (!txGroupMap.has(cleanKey)) txGroupMap.set(cleanKey, []);
    txGroupMap.get(cleanKey)!.push(tx);
  }

  for (const [_key, groupTxs] of txGroupMap.entries()) {
    const distinctMonths = new Set(groupTxs.map((t) => t.date.slice(0, 7)));
    if (distinctMonths.size >= 2) {
      const sampleTx = groupTxs[0];
      const recKey = `${sampleTx.title.toLowerCase().trim()}-${sampleTx.type}`;
      if (!mergedRecurringMap.has(recKey)) {
        const txDateObj = new Date(`${sampleTx.date}T12:00:00`);
        const dueDay = Number.isNaN(txDateObj.getTime()) ? 10 : txDateObj.getDate();
        const avgAmount =
          Math.round((groupTxs.reduce((s, t) => s + t.amount, 0) / groupTxs.length) * 100) / 100;

        const startMonth = Number.isNaN(txDateObj.getTime()) ? new Date().getMonth() : txDateObj.getMonth();
        const startYear = Number.isNaN(txDateObj.getTime()) ? new Date().getFullYear() : txDateObj.getFullYear();

        mergedRecurringMap.set(recKey, {
          id: `stmt-rec-${mergedRecurringMap.size + 1}`,
          title: sampleTx.title,
          amount: avgAmount,
          type: sampleTx.type === "receita" ? "income" : "expense",
          category: sampleTx.category,
          accountName: sampleTx.accountName,
          accountType: sampleTx.accountType,
          dueDay,
          recurrenceType: "fixed_day",
          startMonth,
          startYear,
          sourceTransactionId: sampleTx.id,
          alreadyExists: false,
          selected: true,
          reason: `Compromisso recorrente identificado em ${distinctMonths.size} meses no extrato`,
        });
      }
    }
  }
  const mergedRecurring = Array.from(mergedRecurringMap.values());

  // 4. Consolidar Totais
  const totalIncome = mergedTransactions
    .filter((t) => t.type === "receita" && !t.isInvoicePaymentOnCreditStatement)
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpense = mergedTransactions
    .filter((t) => t.type === "despesa" && !t.isInvoicePaymentOnCreditStatement)
    .reduce((sum, t) => sum + t.amount, 0);

  const salaryRecurring = mergedRecurring
    .filter((r) => r.type === "income")
    .reduce((sum, r) => sum + r.amount, 0);
  const estimatedMonthlyIncome =
    salaryRecurring > 0 ? salaryRecurring : Math.round(totalIncome * 100) / 100;

  const distinctInstitutions = Array.from(
    new Set(analyses.map((a) => a.summary.institutionName).filter(Boolean))
  );
  const institutionName =
    distinctInstitutions.length === 1
      ? distinctInstitutions[0]
      : distinctInstitutions.slice(0, 2).join(" + ") +
        (distinctInstitutions.length > 2 ? ` (+${distinctInstitutions.length - 2})` : "");

  const sortedDates = mergedTransactions.map((t) => t.date).sort();
  const periodLabel =
    sortedDates.length >= 2
      ? `${sortedDates[0].split("-").reverse().join("/")} a ${sortedDates[sortedDates.length - 1].split("-").reverse().join("/")}`
      : sortedDates.length === 1
      ? sortedDates[0].split("-").reverse().join("/")
      : analyses[0]?.summary.periodLabel || "";

  const duplicatesCount = mergedTransactions.filter((t) => t.isDuplicate).length;

  return {
    summary: {
      institutionName,
      statementKind: mergedAccounts.some((a) => a.type === "credit") && mergedAccounts.some((a) => a.type === "checking")
        ? "mixed"
        : mergedAccounts.some((a) => a.type === "credit")
        ? "credit"
        : "checking",
      periodLabel,
      totalIncome: Math.round(totalIncome * 100) / 100,
      totalExpense: Math.round(totalExpense * 100) / 100,
      netFlow: Math.round((totalIncome - totalExpense) * 100) / 100,
      detectedCheckingBalance: mergedAccounts.find((a) => a.type === "checking")?.balance ?? null,
      detectedCreditLimit: mergedAccounts.find((a) => a.type === "credit")?.limit ?? null,
      estimatedMonthlyIncome,
      transactionsCount: mergedTransactions.length,
      recurringCount: mergedRecurring.length,
      accountsCount: mergedAccounts.length,
      duplicatesCount,
      confidence: 0.98,
      aiEnhanced: analyses.some((a) => a.summary.aiEnhanced),
      insights: [
        `Identificamos ${mergedAccounts.length} conta(s)/cartão(ões) a partir dos extratos enviados (${distinctInstitutions.join(", ")}).`,
        `${mergedRecurring.length} compromissos recorrentes e contas fixas consolidados no Planejamento Mensal.`,
        `${mergedTransactions.length} lançamentos processados no total sem duplicações.`,
      ],
    },
    accounts: mergedAccounts,
    recurringItems: mergedRecurring,
    transactions: mergedTransactions,
    extractedRawTextPreview: analyses.map((a) => a.extractedRawTextPreview).join("\n---\n").slice(0, 2000),
  };
}

