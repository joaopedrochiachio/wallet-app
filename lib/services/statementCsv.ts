/**
 * Leitor de extratos e faturas em CSV dos bancos brasileiros.
 *
 * Converte o CSV nas mesmas "linhas padronizadas" que o leitor de OFX gera
 * (`dd/mm/aaaa descrição ±R$ 0,00`), para que o analisador de extratos faça o
 * resto (categorias, parcelas, duplicados) do mesmo jeito para todo formato.
 *
 * Formatos cobertos pelo mapeamento de colunas:
 * - Nubank fatura:  date,title,amount           (positivo = compra; negativo = pagamento)
 * - Nubank conta:   Data,Valor,Identificador,Descrição   (negativo = saída)
 * - Inter, Itaú, C6, BB, Santander e genéricos: Data / Lançamento / Histórico / Descrição / Valor,
 *   com `;` ou `,`, decimal com vírgula ou ponto, e colunas separadas de Crédito/Débito.
 */

export interface CsvStatementRow {
  date: Date;
  description: string;
  /** Sinal do ponto de vista da conta corrente: negativo = saiu dinheiro. */
  amount: number;
}

export interface CsvStatement {
  kind: "credit" | "checking";
  institution: string | null;
  rows: CsvStatementRow[];
}

const DATE_HEADERS = ["date", "data", "data lancamento", "data lançamento", "data da compra", "data de lancamento", "dt lancamento", "data movimento"];
const DESC_HEADERS = ["title", "descricao", "descrição", "description", "historico", "histórico", "lancamento", "lançamento", "estabelecimento", "detalhes", "memo"];
const AMOUNT_HEADERS = ["amount", "valor", "valor (r$)", "valor r$", "valor em r$", "quantia"];
const CREDIT_COL = ["credito", "crédito", "entrada", "entradas"];
const DEBIT_COL = ["debito", "débito", "saida", "saída", "saidas", "saídas"];

const normalize = (value: string) =>
  value.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/^﻿/, "").trim().toLowerCase();

function detectDelimiter(headerLine: string): string {
  const counts = [";", ",", "\t"].map((delimiter) => ({ delimiter, count: splitCsvLine(headerLine, delimiter).length }));
  return counts.sort((a, b) => b.count - a.count)[0].delimiter;
}

/** Divide uma linha respeitando aspas ("20,00" não quebra no meio). */
export function splitCsvLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index++) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index++;
      } else {
        quoted = !quoted;
      }
    } else if (char === delimiter && !quoted) {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

/** "1.234,56" · "1234.56" · "- 697,26" · "R$ 20,00" · "(50,00)" · "50,00 D" → número com sinal. */
export function parseCsvAmount(raw: string): number | null {
  let text = raw.replace(/R\$/gi, "").replace(/\s+/g, "").replace(/−/g, "-");
  if (!text) return null;
  let sign = 1;
  if (/^\(.*\)$/.test(text)) {
    sign = -1;
    text = text.slice(1, -1);
  }
  if (/[dD]$/.test(text)) {
    sign = -1;
    text = text.slice(0, -1);
  } else if (/[cC]$/.test(text)) {
    text = text.slice(0, -1);
  }
  if (text.startsWith("-")) {
    sign *= -1;
    text = text.slice(1);
  } else if (text.startsWith("+")) {
    text = text.slice(1);
  }
  const lastComma = text.lastIndexOf(",");
  const lastDot = text.lastIndexOf(".");
  if (lastComma > lastDot) text = text.replace(/\./g, "").replace(",", ".");
  else if (lastDot > lastComma && lastComma >= 0) text = text.replace(/,/g, "");
  else if (lastComma === -1 && (text.match(/\./g) || []).length > 1) text = text.replace(/\./g, "");
  if (!/^\d+(\.\d+)?$/.test(text)) return null;
  const value = Number(text) * sign;
  return Number.isFinite(value) ? value : null;
}

/** "2026-11-14" · "14/11/2026" · "14/11/26" · "14-11-2026" → Date ao meio-dia. */
export function parseCsvDate(raw: string): Date | null {
  const text = raw.trim();
  let match = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
  match = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/.exec(text);
  if (match) {
    const year = Number(match[3].length === 2 ? `20${match[3]}` : match[3]);
    const date = new Date(year, Number(match[2]) - 1, Number(match[1]), 12);
    return date.getMonth() === Number(match[2]) - 1 ? date : null;
  }
  return null;
}

function findColumn(headers: string[], candidates: string[]): number {
  const exact = headers.findIndex((header) => candidates.includes(header));
  if (exact >= 0) return exact;
  return headers.findIndex((header) => candidates.some((candidate) => header.startsWith(candidate)));
}

/** Reconhece e lê um CSV de extrato/fatura. Retorna null se não parecer um. */
export function parseCsvStatement(rawText: string, fileName = ""): CsvStatement | null {
  const lines = rawText.replace(/^﻿/, "").split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return null;

  // O cabeçalho pode vir depois de linhas de título (ex.: "Extrato Conta Corrente").
  for (let headerIndex = 0; headerIndex < Math.min(lines.length - 1, 12); headerIndex++) {
    const delimiter = detectDelimiter(lines[headerIndex]);
    const headers = splitCsvLine(lines[headerIndex], delimiter).map(normalize);
    if (headers.length < 2) continue;
    const dateCol = findColumn(headers, DATE_HEADERS.map(normalize));
    const descCol = findColumn(headers, DESC_HEADERS.map(normalize));
    const amountCol = findColumn(headers, AMOUNT_HEADERS.map(normalize));
    const creditCol = findColumn(headers, CREDIT_COL.map(normalize));
    const debitCol = findColumn(headers, DEBIT_COL.map(normalize));
    if (dateCol < 0 || (amountCol < 0 && (creditCol < 0 || debitCol < 0))) continue;

    // Fatura do Nubank: "date,title,amount" com compras positivas.
    const nubankCard = headers.includes("date") && headers.includes("title") && headers.includes("amount");
    const lowerName = normalize(fileName);
    const cardHint = /fatura|cartao|card|credit/.test(lowerName);

    const rows: CsvStatementRow[] = [];
    for (const line of lines.slice(headerIndex + 1)) {
      const cells = splitCsvLine(line, delimiter);
      const date = parseCsvDate(cells[dateCol] ?? "");
      if (!date) continue;
      let amount: number | null;
      if (amountCol >= 0) {
        amount = parseCsvAmount(cells[amountCol] ?? "");
      } else {
        const credit = parseCsvAmount(cells[creditCol] ?? "") ?? 0;
        const debit = parseCsvAmount(cells[debitCol] ?? "") ?? 0;
        amount = Math.abs(credit) - Math.abs(debit);
      }
      if (amount === null || Math.abs(amount) < 0.005) continue;
      const description = (descCol >= 0 ? cells[descCol] : "")
        || cells.filter((_, index) => index !== dateCol && index !== amountCol).join(" ").trim()
        || "Lançamento";
      rows.push({ date, description: description.replace(/\s+/g, " ").trim(), amount });
    }
    if (rows.length === 0) continue;

    // Em fatura, compra vem positiva e pagamento negativo: inverte para a visão da conta.
    const positives = rows.filter((row) => row.amount > 0).length;
    const isCard = nubankCard || (cardHint && positives >= rows.length / 2);
    const normalizedRows = isCard ? rows.map((row) => ({ ...row, amount: -row.amount })) : rows;
    const institution = /nubank|nu_/i.test(fileName) || nubankCard ? "Nubank" : null;

    return { kind: isCard ? "credit" : "checking", institution, rows: normalizedRows };
  }
  return null;
}

const pad = (value: number) => String(value).padStart(2, "0");

/** Mesmo formato de linhas do leitor de OFX, para o analisador de extratos. */
export function convertCsvToStandardLines(statement: CsvStatement): string {
  const lines: string[] = [];
  if (statement.institution) lines.push(`Instituição: ${statement.institution}`);
  if (statement.kind === "credit") lines.push("FATURA DE CARTAO DE CREDITO");
  for (const row of statement.rows) {
    const date = `${pad(row.date.getDate())}/${pad(row.date.getMonth() + 1)}/${row.date.getFullYear()}`;
    const value = Math.abs(row.amount).toFixed(2).replace(".", ",");
    const suffix = statement.kind === "credit" ? " CARTAO" : "";
    lines.push(`${date} ${row.description}${suffix} ${row.amount < 0 ? "-" : "+"}R$ ${value}`);
  }
  return lines.join("\n");
}
