import assert from "node:assert/strict";
import test from "node:test";
import { parseCsvAmount, parseCsvStatement } from "../lib/services/statementCsv.ts";
import { analyzeBankStatementText } from "../lib/services/statementImportService.ts";

const NUBANK_CARD = `date,title,amount
2026-11-14,Minha Make Pouso Alegr,"20,00"
2026-11-13,Auto Posto Medicina,"50,00"
2026-11-06,Vivara Lojavivara-8029 - Parcela 1/3,"91,68"
2026-11-04,Pagamento recebido,"- 697,26"
`;

test("fatura do Nubank em CSV: compras viram despesa no cartão e o pagamento fica de fora", () => {
  const r = analyzeBankStatementText({ rawText: NUBANK_CARD, fileName: "Nubank_2026-12-08.csv", referenceDate: new Date(2026, 10, 25) });
  assert.equal(r.summary.statementKind, "credit");
  assert.equal(r.summary.institutionName, "Nubank");
  const purchases = r.transactions.filter((t) => t.selected);
  assert.equal(purchases.length, 3);
  assert.ok(purchases.every((t) => t.type === "despesa" && t.accountType === "credit"));
  assert.equal(Math.round(purchases.reduce((s, t) => s + t.amount, 0) * 100) / 100, 161.68);
  const ring = purchases.find((t) => t.title.includes("Vivara"));
  assert.deepEqual([ring.installmentCurrent, ring.installmentTotal], [1, 3]);
  const payment = r.transactions.find((t) => t.title === "Pagamento recebido");
  assert.equal(payment.isInvoicePaymentOnCreditStatement, true);
  assert.equal(payment.selected, false);
});

test("conta do Nubank em CSV: negativo é saída, positivo é entrada", () => {
  const csv = `Data,Valor,Identificador,Descrição
01/11/2026,-45.90,abc-1,Compra no débito - Padaria Central
05/11/2026,3200.00,abc-2,Transferência recebida - Empresa X
`;
  const parsed = parseCsvStatement(csv, "NU_123_01NOV2026_30NOV2026.csv");
  assert.equal(parsed.kind, "checking");
  assert.deepEqual(parsed.rows.map((row) => row.amount), [-45.9, 3200]);
  const r = analyzeBankStatementText({ rawText: csv, fileName: "NU_123.csv", referenceDate: new Date(2026, 10, 25) });
  assert.equal(r.transactions.find((t) => t.amount === 3200).type, "receita");
  assert.equal(r.transactions.find((t) => t.amount === 45.9).type, "despesa");
});

test("Inter/Itaú: ponto e vírgula, título antes do cabeçalho e valor com milhar", () => {
  const csv = `Extrato Conta Corrente
Período;01/11/2026 a 30/11/2026

Data Lançamento;Histórico;Descrição;Valor;Saldo
03/11/2026;Pix enviado;Aluguel;-1.250,00;2.000,00
05/11/2026;Pix recebido;Salário;4.300,50;6.300,50
`;
  const parsed = parseCsvStatement(csv, "extrato.csv");
  assert.equal(parsed.kind, "checking");
  assert.deepEqual(parsed.rows.map((row) => [row.date.getDate(), row.amount]), [[3, -1250], [5, 4300.5]]);
});

test("colunas separadas de crédito e débito", () => {
  const csv = `data;lançamento;crédito;débito
10/11/2026;TED recebida;500,00;
11/11/2026;Conta de luz;;120,35
`;
  const parsed = parseCsvStatement(csv, "bb.csv");
  assert.deepEqual(parsed.rows.map((row) => row.amount), [500, -120.35]);
});

test("formatos de valor", () => {
  assert.equal(parseCsvAmount("- 697,26"), -697.26);
  assert.equal(parseCsvAmount("R$ 1.234,56"), 1234.56);
  assert.equal(parseCsvAmount("1234.56"), 1234.56);
  assert.equal(parseCsvAmount("(50,00)"), -50);
  assert.equal(parseCsvAmount("50,00 D"), -50);
  assert.equal(parseCsvAmount("1.000.000"), 1000000);
  assert.equal(parseCsvAmount("abc"), null);
});

test("texto que não é CSV de extrato continua no leitor antigo", () => {
  assert.equal(parseCsvStatement("05/10/2026 SALARIO EMPRESA +R$ 8.500,00", "colado.txt"), null);
});
