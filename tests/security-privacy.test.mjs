import test from "node:test";
import assert from "node:assert/strict";

import {
  sanitizeTextInput,
  validateCurrency,
  validateDayOfMonth,
  validateInstallmentsCount,
  validateEmail,
  validatePassword,
} from "../lib/utils/security.ts";

import { redactPersonalData } from "../lib/services/privacyService.ts";
import { checkRateLimit, clearRateLimitStore } from "../lib/utils/rateLimiter.ts";

test("sanitizeTextInput remove tags HTML, scripts e caracteres perigosos", () => {
  const dirty = '<script>alert("xss")</script><b>Compra segura</b>';
  const clean = sanitizeTextInput(dirty);
  assert.ok(!clean.includes("<script>"));
  assert.ok(!clean.includes("<b>"));
  assert.ok(!clean.includes('"'));
  assert.equal(clean, "alert(xss)Compra segura");

  const longText = "a".repeat(300);
  const truncated = sanitizeTextInput(longText, 50);
  assert.equal(truncated.length, 50);
});

test("validateCurrency valida limites, casas decimais e rejeita NaN/negativos", () => {
  // Valores válidos
  const valid1 = validateCurrency("1.500,50");
  assert.equal(valid1.isValid, true);
  assert.equal(valid1.value, 1500.5);

  const valid2 = validateCurrency(250.75);
  assert.equal(valid2.isValid, true);
  assert.equal(valid2.value, 250.75);

  // Rejeição de negativos
  const neg = validateCurrency("-50,00");
  assert.equal(neg.isValid, false);

  // Rejeição de NaN e texto inválido
  const nanVal = validateCurrency("valor_invalido");
  assert.equal(nanVal.isValid, false);

  // Rejeição de números astronômicos
  const huge = validateCurrency(999_999_999_999);
  assert.equal(huge.isValid, false);
});

test("validateDayOfMonth e validateInstallmentsCount restringem limites", () => {
  assert.equal(validateDayOfMonth(15).value, 15);
  assert.equal(validateDayOfMonth("31").value, 31);
  assert.equal(validateDayOfMonth(0).isValid, false);
  assert.equal(validateDayOfMonth(32).isValid, false);

  assert.equal(validateInstallmentsCount(12).value, 12);
  assert.equal(validateInstallmentsCount(400).isValid, false);
});

test("validateEmail e validatePassword realizam validação rigorosa de credenciais", () => {
  assert.equal(validateEmail("usuario@provedor.com.br"), true);
  assert.equal(validateEmail("email_invalido"), false);
  assert.equal(validateEmail("@sem_usuario.com"), false);

  assert.equal(validatePassword("123456").isValid, true);
  assert.equal(validatePassword("123").isValid, false);
  assert.equal(validatePassword("a".repeat(150)).isValid, false);
});

test("redactPersonalData mascara CNPJ formatado e não-formatado", () => {
  // CNPJ formatado
  const textWithFormattedCnpj = "Pagamento para empresa CNPJ 11.222.333/0001-81 no débito";
  const masked1 = redactPersonalData(textWithFormattedCnpj);
  assert.ok(!masked1.includes("11.222.333/0001-81"));
  assert.ok(masked1.includes("[CNPJ REMOVIDO]"));

  // CNPJ em texto com palavra-chave
  const textWithRawCnpj = "Nota fiscal cnpj 11222333000181 emitida";
  const masked2 = redactPersonalData(textWithRawCnpj);
  assert.ok(!masked2.includes("11222333000181"));
  assert.ok(masked2.includes("[CNPJ REMOVIDO]"));
});

test("redactPersonalData mascara Chaves PIX Aleatórias (UUID v4 / EVP)", () => {
  const textWithPixKey = "Chave aleatória pix: 123e4567-e89b-12d3-a456-426614174000 para transferência";
  const masked = redactPersonalData(textWithPixKey);
  assert.ok(!masked.includes("123e4567-e89b-12d3-a456-426614174000"));
  assert.ok(masked.includes("[CHAVE PIX REMOVIDA]"));
});

test("redactPersonalData mascara Agência e Conta bancária", () => {
  const bankText = "Depósito na agência 1234 conta corrente 98765-4";
  const masked = redactPersonalData(bankText);
  assert.ok(!masked.includes("1234"));
  assert.ok(!masked.includes("98765-4"));
  assert.ok(masked.includes("[AGÊNCIA REMOVIDA]"));
  assert.ok(masked.includes("[CONTA REMOVIDA]"));
});

test("redactPersonalData mascara nomes de terceiros em transferências e PIX", () => {
  const pixText = "Pix enviado para Carlos Eduardo da Silva no valor de R$ 150,00";
  const masked = redactPersonalData(pixText);
  assert.ok(!masked.includes("Carlos Eduardo da Silva"));
  assert.ok(masked.includes("[DESTINATÁRIO REDIGIDO]"));
  assert.ok(masked.includes("R$ 150,00")); // Preserva valores contábeis
});

test("redactPersonalData mascara dados sensíveis de saúde conforme Art. 5º, II da LGPD", () => {
  const healthText = "Pagamento de quimioterapia e radioterapia no valor de R$ 2.500,00";
  const masked = redactPersonalData(healthText);
  assert.ok(!masked.includes("quimioterapia"));
  assert.ok(!masked.includes("radioterapia"));
  assert.ok(masked.includes("[SAÚDE]"));
  assert.ok(masked.includes("R$ 2.500,00"));
});

test("checkRateLimit controla limites de chamadas por chave e bloqueia requisições em excesso (DoS)", () => {
  clearRateLimitStore();

  const testKey = "test-user-limit";
  const limit = 3;
  const windowMs = 5000;

  // Primeira chamada: permitida
  const r1 = checkRateLimit(testKey, limit, windowMs);
  assert.equal(r1.allowed, true);
  assert.equal(r1.remaining, 2);

  // Segunda chamada: permitida
  const r2 = checkRateLimit(testKey, limit, windowMs);
  assert.equal(r2.allowed, true);
  assert.equal(r2.remaining, 1);

  // Terceira chamada: permitida
  const r3 = checkRateLimit(testKey, limit, windowMs);
  assert.equal(r3.allowed, true);
  assert.equal(r3.remaining, 0);

  // Quarta chamada: BLOQUEADA (429)
  const r4 = checkRateLimit(testKey, limit, windowMs);
  assert.equal(r4.allowed, false);
  assert.equal(r4.remaining, 0);
  assert.ok(r4.retryAfterSec > 0);

  // Chaves diferentes não interferem entre si
  const otherUser = checkRateLimit("another-user", limit, windowMs);
  assert.equal(otherUser.allowed, true);
  assert.equal(otherUser.remaining, 2);
});

test("Deteccao de padroes de sondagem de URL e Path Traversal", () => {
  const SUSPICIOUS_PATTERNS = [
    /\.\./,
    /%2e%2e/i,
    /\/\.env/i,
    /\/\.git/i,
    /\/\.aws/i,
    /\/\.ssh/i,
    /\/wp-admin/i,
    /\/phpmyadmin/i,
    /\/actuator/i,
    /\.(bak|config|sql|tar|gz|zip|sh|bat)$/i,
  ];

  const maliciousUrls = [
    "/../../etc/passwd",
    "/%2e%2e/%2e%2e/secret",
    "/.env",
    "/.env.production",
    "/.git/config",
    "/.aws/credentials",
    "/wp-admin/login.php",
    "/database.sql",
    "/backup.tar.gz",
  ];

  for (const url of maliciousUrls) {
    const isDetected = SUSPICIOUS_PATTERNS.some((pat) => pat.test(url));
    assert.equal(isDetected, true, `A URL maliciosa ${url} deveria ser detectada`);
  }

  const legitimateUrls = [
    "/dashboard",
    "/transactions",
    "/cards",
    "/planning",
    "/goals",
    "/profile",
    "/ai",
    "/api/ai/chat",
    "/api/ai/analyze",
    "/api/time-progression",
  ];

  for (const url of legitimateUrls) {
    const isDetected = SUSPICIOUS_PATTERNS.some((pat) => pat.test(url));
    assert.equal(isDetected, false, `A URL legítima ${url} NÃO deveria ser detectada como maliciosa`);
  }
});

test("Sanitizacao e validacao rigorosa de dados em Onboarding e Planning", () => {
  // Simulação de entrada maliciosa em Onboarding
  const maliciousName = '<img src=x onerror=alert("hacked")>Carlos Silva';
  const cleanName = sanitizeTextInput(maliciousName, 80);
  assert.ok(!cleanName.includes("<img"));
  assert.ok(!cleanName.includes("onerror"));
  assert.equal(cleanName, "Carlos Silva");

  // Simulação de entrada com valor negativo ou absurdamente alto no Planejamento
  const negativeAmount = validateCurrency("-150,00");
  assert.equal(negativeAmount.isValid, false);

  const validAmount = validateCurrency("3.250,80");
  assert.equal(validAmount.isValid, true);
  assert.equal(validAmount.value, 3250.8);

  // Simulação de dia de vencimento fora da faixa
  assert.equal(validateDayOfMonth(0).isValid, false);
  assert.equal(validateDayOfMonth(32).isValid, false);
  assert.equal(validateDayOfMonth(15).isValid, true);
  assert.equal(validateDayOfMonth(15).value, 15);
});

