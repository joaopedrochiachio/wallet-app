import test from "node:test";
import assert from "node:assert/strict";
import zlib from "node:zlib";
import {
  extractTextFromPdfBytes,
  generateSampleBankStatementPdf,
  detectBankInstitution,
  analyzeBankStatementText,
  convertOfxToStandardLines,
  extractInstallmentInfo,
} from "../lib/services/statementImportService.ts";
import {
  PAGE_TUTORIALS,
  ONBOARDING_DIRECT_STEPS,
  evaluateGettingStartedTutorial,
} from "../lib/utils/tutorialData.ts";

test("generateSampleBankStatementPdf & extractTextFromPdfBytes: extrai texto de PDF binário real e identifica todas as linhas", () => {
  const pdfBytes = generateSampleBankStatementPdf({
    bankName: "Nubank S.A.",
    holderName: "Carlos Silva",
  });

  // Verifica assinatura mágica %PDF-1.4
  const header = new TextDecoder().decode(pdfBytes.subarray(0, 8));
  assert.ok(header.startsWith("%PDF-1.4"));

  const extractedText = extractTextFromPdfBytes(pdfBytes);
  assert.ok(extractedText.includes("Nubank S.A."));
  assert.ok(extractedText.includes("SALARIO MENSAL EMPRESA TECH LTDA"));
  assert.ok(extractedText.includes("ALUGUEL RESIDENCIAL"));
  assert.ok(extractedText.includes("NETFLIX.COM"));
  assert.ok(extractedText.includes("AMAZON BR NOTEBOOK PARC 02/10"));
});

test("extractTextFromPdfBytes: descompacta streams PDF com /FlateDecode (zlib) e /ToUnicode CMap", () => {
  const rawStreamContent = `BT /F1 11 Tf 40 700 Td (10/10/2026 PIX ENVIADO IFOOD -R$ 64,90) Tj 0 -20 Td (12/10/2026 SPOTIFY MENSAL CARTAO -R$ 21,90) Tj ET`;
  const compressed = zlib.deflateSync(Buffer.from(rawStreamContent, "latin1"));

  const prefix = Buffer.from(
    "%PDF-1.4\n1 0 obj\n<< /Length " + compressed.length + " /Filter /FlateDecode >>\nstream\n",
    "latin1"
  );
  const suffix = Buffer.from("\nendstream\nendobj\n%%EOF", "latin1");
  const fullPdfBytes = new Uint8Array(Buffer.concat([prefix, compressed, suffix]));

  const extracted = extractTextFromPdfBytes(fullPdfBytes, (slice) => {
    try {
      return new Uint8Array(zlib.inflateSync(slice));
    } catch {
      return null;
    }
  });

  assert.ok(extracted.includes("10/10/2026 PIX ENVIADO IFOOD -R$ 64,90"));
  assert.ok(extracted.includes("12/10/2026 SPOTIFY MENSAL CARTAO -R$ 21,90"));
});

test("detectBankInstitution: reconhece bancos brasileiros pelo texto ou nome do arquivo", () => {
  assert.equal(detectBankInstitution("Nu Pagamentos S.A. - Extrato", "extrato.pdf").id, "nubank");
  assert.equal(detectBankInstitution("Itaú Unibanco S.A. Personnalité", "").id, "itau");
  assert.equal(detectBankInstitution("Banco Inter S.A. Conta Digital", "").id, "inter");
  assert.equal(detectBankInstitution("Banco Santander Brasil", "").id, "santander");
  assert.equal(detectBankInstitution("C6 Carbon Mastercard Black", "fatura-c6.pdf").id, "c6");
});

test("analyzeBankStatementText: analisa PDF completo, identifica contas, cartões, fixas, parcelas e transações", () => {
  const pdfBytes = generateSampleBankStatementPdf({
    bankName: "Nubank S.A.",
    holderName: "Investidor Wallet",
  });
  const extractedText = extractTextFromPdfBytes(pdfBytes);

  const analysis = analyzeBankStatementText({
    rawText: extractedText,
    fileName: "extrato-nubank-outubro.pdf",
    referenceDate: new Date(2026, 9, 28, 12, 0, 0),
  });

  // 1. Resumo e Instituição
  assert.equal(analysis.summary.institutionName, "Nubank");
  assert.equal(analysis.summary.statementKind, "mixed");
  assert.equal(analysis.summary.detectedCheckingBalance, 4850);
  assert.equal(analysis.summary.detectedCreditLimit, 12000);
  assert.equal(analysis.summary.estimatedMonthlyIncome, 8500);
  assert.equal(analysis.summary.totalIncome, 8950); // 8500 salario + 450 reembolso

  // 2. Contas e Cartões detectados (1 Conta Corrente + 1 Cartão de Crédito)
  assert.equal(analysis.accounts.length, 2);
  const checkingAcc = analysis.accounts.find((a) => a.type === "checking");
  const creditAcc = analysis.accounts.find((a) => a.type === "credit");
  assert.ok(checkingAcc);
  assert.equal(checkingAcc.balance, 4850);
  assert.ok(creditAcc);
  assert.equal(creditAcc.limit, 12000);
  assert.equal(creditAcc.closingDay, 3);
  assert.equal(creditAcc.dueDay, 10);

  // 3. Contas Fixas, Assinaturas, Salário e Parcelamentos detectados
  assert.ok(analysis.recurringItems.length >= 8);
  const salaryRec = analysis.recurringItems.find((r) => r.type === "income");
  assert.ok(salaryRec);
  assert.equal(salaryRec.amount, 8500);

  const netflixRec = analysis.recurringItems.find((r) => r.title.toLowerCase().includes("netflix"));
  assert.ok(netflixRec);
  assert.equal(netflixRec.amount, 55.9);
  assert.equal(netflixRec.category, "Lazer");

  const amazonInstallment = analysis.recurringItems.find((r) =>
    r.title.toLowerCase().includes("amazon")
  );
  assert.ok(amazonInstallment);
  assert.equal(amazonInstallment.installmentsCount, 10);
  assert.equal(amazonInstallment.currentInstallment, 2);
  assert.equal(amazonInstallment.amount, 380);

  // 4. Transações detectadas
  assert.equal(analysis.transactions.length, 18);
});

test("analyzeBankStatementText: desmarca automaticamente duplicatas que já existem na carteira", () => {
  const sampleText = `
    Nubank Extrato
    05/10/2026 SALARIO MENSAL +R$ 8.500,00
    10/10/2026 NETFLIX.COM -R$ 55,90
    15/10/2026 UBER TRIP -R$ 34,80
  `;

  const analysis = analyzeBankStatementText({
    rawText: sampleText,
    existingTransactions: [
      {
        id: "tx-existing-1",
        title: "Netflix.com",
        amount: 55.9,
        type: "despesa",
        date: "2026-10-10",
      },
    ],
  });

  assert.equal(analysis.transactions.length, 3);
  assert.equal(analysis.summary.duplicatesCount, 1);

  const netflixTx = analysis.transactions.find((t) => t.amount === 55.9);
  assert.ok(netflixTx);
  assert.equal(netflixTx.isDuplicate, true);
  assert.equal(netflixTx.selected, false);
});

test("convertOfxToStandardLines & analyzeBankStatementText: suporta arquivos OFX bancários", () => {
  const sampleOfx = `
    <OFX>
      <SIGNONMSGSRSV1><SONRS><FI><ORG>ITAU UNIBANCO</ORG></FI></SONRS></SIGNONMSGSRSV1>
      <BANKMSGSRSV1>
        <STMTTRNRS>
          <STMTRS>
            <BANKTRANLIST>
              <STMTTRN>
                <TRNTYPE>CREDIT
                <DTPOSTED>20261005120000
                <TRNAMT>6500.00
                <MEMO>SALARIO FOLHA EMPRESA
              </STMTTRN>
              <STMTTRN>
                <TRNTYPE>DEBIT
                <DTPOSTED>20261010120000
                <TRNAMT>-189.90
                <MEMO>CONTA DE LUZ ENEL
              </STMTTRN>
            </BANKTRANLIST>
            <LEDGERBAL>
              <BALAMT>3420.50
            </LEDGERBAL>
          </STMTRS>
        </STMTTRNRS>
      </BANKMSGSRSV1>
    </OFX>
  `;

  const analysis = analyzeBankStatementText({ rawText: sampleOfx });
  assert.equal(analysis.summary.institutionName, "Itaú");
  assert.equal(analysis.summary.detectedCheckingBalance, 3420.5);
  assert.equal(analysis.transactions.length, 2);
  assert.equal(analysis.transactions[0].type, "receita");
  assert.equal(analysis.transactions[0].amount, 6500);
  assert.equal(analysis.transactions[1].category, "Moradia");
});

test("extractInstallmentInfo: detecta diferentes formatos de parcelamento brasileiro", () => {
  assert.deepEqual(extractInstallmentInfo("AMAZON BR PARC 02/10"), {
    currentInstallment: 2,
    totalInstallments: 10,
  });
  assert.deepEqual(extractInstallmentInfo("MERCADO LIVRE Parcela 3 de 12"), {
    currentInstallment: 3,
    totalInstallments: 12,
  });
  assert.equal(extractInstallmentInfo("SUPERMERCADO COMPRA A VISTA"), null);
});

test("PAGE_TUTORIALS & ONBOARDING_DIRECT_STEPS: fornece passo a passo didático e direto para todas as telas do app", () => {
  assert.equal(ONBOARDING_DIRECT_STEPS.length, 3);
  assert.ok(ONBOARDING_DIRECT_STEPS[0].title.toLowerCase().includes("nome"));
  assert.ok(ONBOARDING_DIRECT_STEPS[1].title.toLowerCase().includes("pdf"));

  const expectedRoutes = [
    "/dashboard",
    "/transactions",
    "/planning",
    "/cards",
    "/goals",
    "/ai",
    "/profile",
  ];

  for (const route of expectedRoutes) {
    const config = PAGE_TUTORIALS[route];
    assert.ok(config, `Tutorial ausente para a rota ${route}`);
    assert.equal(config.steps.length, 3);
    assert.ok(config.headline.length > 5);
    assert.ok(config.summary.length > 5);
  }

  // Usuário novo que acabou de entrar: tutorial aparece na tela inicial
  const incompleteState = evaluateGettingStartedTutorial({
    userName: "Carlos Silva",
    monthlyIncomeBase: 5000,
    cardsCount: 1,
    recurringCount: 0,
    transactionsCount: 0,
  });
  assert.equal(incompleteState.allStepsCompleted, false);
  assert.equal(incompleteState.shouldHideFromHome, false);

  // Usuário que já cumpriu todos os passos (ou importou o PDF do extrato): tutorial some da tela inicial
  const completedState = evaluateGettingStartedTutorial({
    userName: "Carlos Silva",
    monthlyIncomeBase: 5000,
    cardsCount: 2,
    recurringCount: 4,
    transactionsCount: 15,
  });
  assert.equal(completedState.allStepsCompleted, true);
  assert.equal(completedState.shouldHideFromHome, true);

  // Usuário que clicou em concluir/dispensar manualmente: tutorial some da tela inicial
  const manualDismissState = evaluateGettingStartedTutorial({
    userName: "Carlos Silva",
    monthlyIncomeBase: 5000,
    cardsCount: 1,
    recurringCount: 0,
    transactionsCount: 0,
    manuallyCompleted: true,
  });
  assert.equal(manualDismissState.shouldHideFromHome, true);
});

