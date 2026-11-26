import assert from "node:assert/strict";
import test from "node:test";
import { extractPdfLines, itemsToLines } from "../lib/services/pdfText.ts";
import { analyzeBankStatementText, generateSampleBankStatementPdf } from "../lib/services/statementImportService.ts";

const piece = (str, x, y, width = str.length * 5, fontSize = 10) => ({ str, x, y, width, fontSize });

test("fatura em colunas: data, descrição e valor em pedaços separados viram uma linha", () => {
  const lines = itemsToLines([
    piece("R$ 23,25", 480, 700), piece("05/11", 40, 700), piece("Mercadinho 24h", 100, 700),
    piece("R$ 91,68", 480, 684), piece("06/11", 40, 684.6), piece("Vivara - Parcela 1/3", 100, 684),
    piece("Fatura de dezembro", 40, 760, 90, 14),
  ]);
  assert.deepEqual(lines, ["Fatura de dezembro", "05/11 Mercadinho 24h R$ 23,25", "06/11 Vivara - Parcela 1/3 R$ 91,68"]);
});

test("letras posicionadas uma a uma não ganham espaço no meio da palavra", () => {
  const letters = "Posto".split("").map((char, index) => piece(char, 100 + index * 5, 500, 5));
  assert.deepEqual(itemsToLines([...letters, piece("R$ 50,00", 300, 500)]), ["Posto R$ 50,00"]);
});

test("PDF de verdade passa pelo PDF.js e chega ao analisador", async () => {
  const text = await extractPdfLines(generateSampleBankStatementPdf());
  assert.match(text, /05\/10\/2026 SALARIO MENSAL EMPRESA TECH LTDA \+R\$ 8\.500,00/);
  const result = analyzeBankStatementText({ rawText: text, fileName: "extrato.pdf", referenceDate: new Date(2026, 10, 25) });
  assert.ok(result.transactions.length >= 15);
});

test("arquivo que não é PDF dá erro em vez de texto lixo", async () => {
  await assert.rejects(() => extractPdfLines(new TextEncoder().encode("isto não é um pdf")));
});
