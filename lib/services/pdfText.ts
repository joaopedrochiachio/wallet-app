/**
 * Texto de PDF de banco com o PDF.js (via unpdf), remontado em linhas.
 *
 * O PDF guarda cada pedaço de texto numa posição (x, y), não em linhas. Para o
 * analisador de extratos, cada lançamento precisa virar uma linha como
 * "05/11 Mercado R$ 23,25": juntamos os pedaços na mesma altura, da esquerda
 * para a direita, página por página.
 */

export interface PositionedText {
  str: string;
  x: number;
  y: number;
  width: number;
  fontSize: number;
}

export class PdfPasswordError extends Error {
  constructor() {
    super("Este PDF tem senha. Abra no app do banco e exporte de novo sem senha, ou use o CSV/OFX.");
    this.name = "PdfPasswordError";
  }
}

/** Junta pedaços de texto de uma página em linhas legíveis. */
export function itemsToLines(items: PositionedText[]): string[] {
  const pieces = items.filter((item) => item.str.trim().length > 0);
  if (pieces.length === 0) return [];
  // De cima para baixo (no PDF, y cresce para cima).
  const sorted = [...pieces].sort((a, b) => b.y - a.y || a.x - b.x);
  const rows: PositionedText[][] = [];
  for (const piece of sorted) {
    const tolerance = Math.max(2, piece.fontSize * 0.45);
    const row = rows.find((candidate) => Math.abs(candidate[0].y - piece.y) <= tolerance);
    if (row) row.push(piece);
    else rows.push([piece]);
  }
  return rows
    .sort((a, b) => b[0].y - a[0].y)
    .map((row) => {
      const ordered = row.sort((a, b) => a.x - b.x);
      let line = "";
      let lastEnd: number | null = null;
      for (const piece of ordered) {
        // Espaço só quando há distância real entre os pedaços (letras soltas não viram "M e r c a d o").
        const gap = lastEnd === null ? 0 : piece.x - lastEnd;
        const needsSpace = line.length > 0 && gap > Math.max(1, piece.fontSize * 0.18) && !line.endsWith(" ");
        line += `${needsSpace ? " " : ""}${piece.str}`;
        lastEnd = piece.x + piece.width;
      }
      return line.replace(/\s+/g, " ").trim();
    })
    .filter((line) => line.length > 0);
}

/** Extrai o texto do PDF em linhas. Lança PdfPasswordError se tiver senha. */
export async function extractPdfLines(bytes: Uint8Array): Promise<string> {
  const { extractTextItems } = await import("unpdf");
  try {
    const { items } = await extractTextItems(new Uint8Array(bytes));
    return items
      .map((page) => itemsToLines(page.map((item) => ({
        str: item.str,
        x: item.x,
        y: item.y,
        width: item.width,
        fontSize: item.fontSize || 10,
      }))).join("\n"))
      .join("\n");
  } catch (error) {
    if (error instanceof Error && /password/i.test(`${error.name} ${error.message}`)) throw new PdfPasswordError();
    throw error;
  }
}
