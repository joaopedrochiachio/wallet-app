import test from "node:test";
import assert from "node:assert/strict";
import zlib from "node:zlib";
import {
  extractTextFromPdfBytes,
  generateSampleBankStatementPdf,
  detectBankInstitution,
  analyzeBankStatementText,
  mergeMultipleStatementAnalyses,
  convertOfxToStandardLines,
  extractInstallmentInfo,
  stripEmbeddedDateTokens,
  simplifyTransferDescription,
  cleanCorruptedPdfFontArtifacts,
} from "../lib/services/statementImportService.ts";
import {
  PAGE_TUTORIALS,
  ONBOARDING_DIRECT_STEPS,
  evaluateGettingStartedTutorial,
} from "../lib/utils/tutorialData.ts";
import {
  buildForwardRecurringUpdate,
  getEffectiveRecurringItemForPeriod,
} from "../lib/utils/dateUtils.ts";
import {
  getCardInvoiceDetailsForMonth,
  getCardOpenInvoiceDetails,
  calculateCheckingBalance,
} from "../lib/utils/ledger.ts";

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

  // Não confunde datas coladas em Pix (ex.: Itaú "PIX TRANSF ISADORA06/11", "PIX TRANSF WELLING04/11") com parcelamento
  assert.equal(extractInstallmentInfo("PIX TRANSF Isadora06/11"), null);
  assert.equal(extractInstallmentInfo("PIX TRANSF Welling04/11"), null);
  assert.equal(extractInstallmentInfo("PIX TRANSF João Pe04/11"), null);
  assert.equal(extractInstallmentInfo("PIX Qrs Imperial Pr03/11"), null);

  // Em conta corrente não assume data X/Y como parcela
  assert.equal(
    extractInstallmentInfo("TRANSFERENCIA FULANO 06/11", { accountType: "checking" }),
    null
  );
});

test("stripEmbeddedDateTokens & simplifyTransferDescription: limpa datas embutidas e normaliza Pix", () => {
  assert.equal(
    stripEmbeddedDateTokens("PIX TRANSF Isadora06/11", false),
    "PIX TRANSF Isadora"
  );
  assert.equal(
    simplifyTransferDescription("PIX TRANSF João Pe"),
    "Pix - João Pe"
  );
});

test("mergeMultipleStatementAnalyses: combina extratos de múltiplos bancos (Nubank + Itaú) sem duplicar e preserva contas", () => {
  const nubankAnalysis = analyzeBankStatementText({
    rawText: `
      Nubank S.A.
      Saldo em conta: R$ 1.500,00
      01/10/2026 SALARIO +R$ 5.000,00
      05/10/2026 NETFLIX.COM -R$ 55,90
    `,
    fileName: "extrato-nubank-outubro.pdf",
  });

  const itauAnalysis = analyzeBankStatementText({
    rawText: `
      Banco Itaú S.A.
      Saldo em conta: R$ 3.200,00
      04/11/2026 PIX TRANSF Welling04/11 -R$ 150,00
      06/11/2026 PIX TRANSF Isadora06/11 -R$ 35,00
    `,
    fileName: "extrato-itau-novembro.pdf",
  });

  const merged = mergeMultipleStatementAnalyses([nubankAnalysis, itauAnalysis]);

  // Deve identificar as duas contas distintas (Nubank e Itaú)
  assert.equal(merged.accounts.length, 2);
  const hasNubank = merged.accounts.some((a) => a.institutionId === "nubank");
  const hasItau = merged.accounts.some((a) => a.institutionId === "itau");
  assert.ok(hasNubank);
  assert.ok(hasItau);

  // Lançamentos foram consolidados e não há falsos parcelamentos de Pix
  assert.equal(merged.transactions.length, 4);
  const pixTx = merged.transactions.find((t) => t.rawDescription.includes("Isadora"));
  assert.ok(pixTx);
  assert.equal(pixTx.installmentCurrent, undefined);
  assert.equal(pixTx.installmentTotal, undefined);

  // Não gerou falsas recorrências de parcelamento para os Pix
  const pixRec = merged.recurringItems.find((r) => r.title.toLowerCase().includes("isadora"));
  assert.equal(pixRec, undefined);
});

test("cleanCorruptedPdfFontArtifacts: corrige glifos danificados de fontes TrueType bancárias (E->( e F->))", () => {
  const corruptedSample =
    "01 S(T 2026\n01 D( S(T(MBRO D( 2026\nVALOR(S (M R$\nCP)\n)(RR(IRA\nMaster)ormula\n)inanceira";
  const cleaned = cleanCorruptedPdfFontArtifacts(corruptedSample);

  assert.ok(cleaned.includes("01 SET 2026"));
  assert.ok(cleaned.includes("01 DE SETEMBRO DE 2026"));
  assert.ok(cleaned.includes("VALORES EM R$"));
  assert.ok(cleaned.includes("CPF"));
  assert.ok(cleaned.includes("FERREIRA"));
  assert.ok(cleaned.includes("Masterformula"));
  assert.ok(cleaned.includes("Financeira"));
});

test("simplifyTransferDescription: limpa contrapartes mascaradas e títulos longos em transferências", () => {
  const nubankLong =
    "Transferência Recebida - Bartolomeu Chiachio de Paiva - •••.345.506-•• - NU 49119149-3";
  assert.equal(
    simplifyTransferDescription(nubankLong),
    "Transferência Recebida - Bartolomeu Chiachio de Paiva"
  );

  const pixEnv =
    "Transferência enviada pelo Pix - Cecília Pereira Januário - •••.913.206-•• - NU 448704942-1";
  assert.equal(
    simplifyTransferDescription(pixEnv),
    "Pix enviado - Cecília Pereira Januário"
  );
});

test("mergeMultipleStatementAnalyses: preserva saldo da competência mais recente e identifica padrões de múltiplos meses", () => {
  const augustText = `
    Nubank S.A.
    Saldo final do período R$ 46,63
    05 AGO 2026
    Total de entradas
    + 150,00
    Transferência Recebida - Bartolomeu Chiachio - NU 123
    150,00
    10 AGO 2026
    Total de saídas
    - 400,00
    Transferência enviada pelo Pix - CEMIG DISTRIBUICAO S.A
    400,00
  `;
  const octoberText = `
    Nubank S.A.
    Saldo final do período R$ 0,00
    01 OUT 2026
    Total de entradas
    + 150,00
    Transferência Recebida - Bartolomeu Chiachio - NU 123
    150,00
    10 OUT 2026
    Total de saídas
    - 400,00
    Transferência enviada pelo Pix - CEMIG DISTRIBUICAO S.A
    400,00
  `;

  const resAug = analyzeBankStatementText({ rawText: augustText, fileName: "ago.pdf" });
  const resOct = analyzeBankStatementText({ rawText: octoberText, fileName: "out.pdf" });

  const merged = mergeMultipleStatementAnalyses([resAug, resOct]);

  // Conta Nubank tem saldo 0,00 (do extrato de outubro mais recente, e não 46,63 de agosto)
  const nubankAcc = merged.accounts.find((a) => a.institutionId === "nubank");
  assert.ok(nubankAcc);
  assert.equal(nubankAcc.balance, 0);

  // Não inventou cartão de crédito
  assert.equal(merged.accounts.some((a) => a.type === "credit"), false);

  // Identificou Bartolomeu e Cemig como padrões recorrentes através dos meses
  assert.ok(merged.recurringItems.some((r) => r.title.toLowerCase().includes("bartolomeu")));
  assert.ok(merged.recurringItems.some((r) => r.title.toLowerCase().includes("cemig")));
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

test("buildForwardRecurringUpdate: aumento salarial aplica-se apenas ao mês selecionado e meses à frente, preservando meses anteriores", () => {
  const initialSalaryItem = {
    id: "rec-salary-1",
    title: "Salário Empresa Tech",
    amount: 5000,
    type: "income",
    account: "Conta Principal",
    cardId: "card-checking-1",
    category: "Salário / Extra",
    dueDay: 5,
    recurrenceType: "business_day_5",
    startYear: 2026,
    startMonth: 8, // Setembro/2026
    active: true,
  };

  // Em Novembro/2026 ("2026-11") o usuário teve um aumento para R$ 6.200
  const forwardUpdates = buildForwardRecurringUpdate(initialSalaryItem, "2026-11", {
    amount: 6200,
  });

  const updatedSalaryItem = {
    ...initialSalaryItem,
    ...forwardUpdates,
  };

  // Meses anteriores a Novembro/2026 devem manter R$ 5.000
  assert.equal(getEffectiveRecurringItemForPeriod(updatedSalaryItem, "2026-09").amount, 5000);
  assert.equal(getEffectiveRecurringItemForPeriod(updatedSalaryItem, "2026-10").amount, 5000);

  // Novembro/2026 e meses à frente devem refletir o novo valor de R$ 6.200
  assert.equal(getEffectiveRecurringItemForPeriod(updatedSalaryItem, "2026-11").amount, 6200);
  assert.equal(getEffectiveRecurringItemForPeriod(updatedSalaryItem, "2026-12").amount, 6200);
  assert.equal(getEffectiveRecurringItemForPeriod(updatedSalaryItem, "2027-01").amount, 6200);
});

test("Pagamento de Fatura ('Paguei a fatura'): quita a competência da fatura e debita da conta corrente como planejado", () => {
  const checkingCard = {
    id: "card-checking",
    name: "Conta Principal",
    type: "checking",
    brand: "Mastercard",
    last4: "0001",
    limit: 0,
    spent: 0,
    dueDate: "—",
    colorScheme: { primary: "#111", secondary: "#222", text: "#fff", accent: "#0071E3" },
    balance: 0,
    openingBalance: 5000,
    ledgerBalanceVersion: 2,
  };

  const creditCard = {
    id: "card-nubank",
    name: "Nubank",
    type: "credit",
    brand: "Mastercard",
    last4: "1234",
    limit: 8000,
    spent: 0,
    dueDate: "10",
    dueDay: 10,
    closingDay: 3,
    colorScheme: { primary: "#820AD1", secondary: "#4A0578", text: "#fff", accent: "#820AD1" },
  };

  const recurringItems = [
    {
      id: "rec-netflix",
      title: "Netflix",
      amount: 55.9,
      type: "expense",
      account: "Nubank",
      cardId: "card-nubank",
      category: "Assinaturas",
      dueDay: 15,
      recurrenceType: "fixed_day",
      startYear: 2026,
      startMonth: 8,
      active: true,
    },
  ];

  // Compra de R$ 400 em 18/Out/2026 (após fechamento dia 3 -> vence em 10/Nov/2026, periodKey "2026-11")
  const baseTransactions = [
    {
      id: "tx-1",
      title: "Supermercado",
      amount: 400,
      type: "despesa",
      category: "Alimentação",
      account: "Nubank",
      cardId: "card-nubank",
      kind: "regular",
      date: "18 de out.",
      occurredAt: new Date(2026, 9, 18, 12, 0, 0),
    },
  ];

  const refDate = new Date(2026, 10, 4, 12, 0, 0); // 04/Nov/2026
  const beforePayDetails = getCardInvoiceDetailsForMonth(
    creditCard,
    baseTransactions,
    recurringItems,
    2026,
    10, // Novembro (monthIndex 10 -> "2026-11")
    refDate
  );

  // R$ 400 (compra) + R$ 55,90 (Netflix recorrente) = R$ 455,90
  assert.equal(beforePayDetails.totalInvoice, 455.9);
  assert.equal(beforePayDetails.isPaid, false);

  // Usuário clica em "Paguei a fatura" para a competência "2026-11"
  const afterPayTransactions = [
    ...baseTransactions,
    {
      id: "tx-pay-checking",
      title: "Pagamento Fatura Nubank",
      amount: 455.9,
      type: "despesa",
      category: "Pagamento de Fatura",
      account: "Conta Principal",
      cardId: "card-checking",
      relatedCardId: "card-nubank",
      groupId: "invoice-card-nubank-1",
      kind: "invoice_payment",
      periodKey: "2026-11",
      date: "04 de nov.",
      occurredAt: refDate,
    },
    {
      id: "tx-pay-settlement",
      title: "Baixa Fatura Nubank",
      amount: 455.9,
      type: "receita",
      category: "Baixa de Fatura",
      account: "Nubank",
      cardId: "card-nubank",
      relatedCardId: "card-checking",
      groupId: "invoice-card-nubank-1",
      kind: "invoice_settlement",
      periodKey: "2026-11",
      date: "04 de nov.",
      occurredAt: refDate,
    },
  ];

  const afterPayDetails = getCardInvoiceDetailsForMonth(
    creditCard,
    afterPayTransactions,
    recurringItems,
    2026,
    10,
    refDate
  );

  // A fatura paga preserva seu valor real (455.9) para histórico e análises de IA,
  // enquanto a pendência (pendingInvoice) zera e o status passa a isPaid = true
  assert.equal(afterPayDetails.totalInvoice, 455.9);
  assert.equal(afterPayDetails.pendingInvoice, 0);
  assert.equal(afterPayDetails.paidAmount, 455.9);
  assert.equal(afterPayDetails.isPaid, true);

  // Conta corrente foi debitada exatamente no valor planejado (5000 - 455.9 = 4544.1)
  const checkingBalance = calculateCheckingBalance(checkingCard, afterPayTransactions);
  assert.equal(Math.round(checkingBalance * 100) / 100, 4544.1);
});


