/**
 * Utilitário de Limitação de Taxa (Sliding Window In-Memory Rate Limiter)
 * Protege rotas de backend contra ataques de negação de serviço (DoS),
 * força bruta e consumo excessivo de cotas (Denial of Wallet).
 */

interface RateLimitRecord {
  timestamps: number[];
}

// Armazena as janelas de requisição em memória por chave
const rateLimitStore = new Map<string, RateLimitRecord>();

// Limpeza periódica de chaves expiradas para evitar vazamento de memória (a cada 5 minutos)
let lastCleanup = Date.now();
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

function cleanupExpiredRecords(windowMs: number) {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;

  for (const [key, record] of rateLimitStore.entries()) {
    const validTimestamps = record.timestamps.filter((t) => now - t < windowMs);
    if (validTimestamps.length === 0) {
      rateLimitStore.delete(key);
    } else {
      record.timestamps = validTimestamps;
    }
  }
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetMs: number;
  retryAfterSec: number;
}

/**
 * Verifica se uma requisição sob determinada chave está dentro da cota permitida.
 * @param key Identificador único (ex: 'ai-chat:uid_123' ou 'api:ip_1.2.3.4')
 * @param limit Número máximo de requisições permitidas na janela
 * @param windowMs Duração da janela em milissegundos (padrão: 60.000ms = 1 minuto)
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number = 60000
): RateLimitResult {
  const now = Date.now();
  cleanupExpiredRecords(windowMs);

  let record = rateLimitStore.get(key);
  if (!record) {
    record = { timestamps: [] };
    rateLimitStore.set(key, record);
  }

  // Filtra apenas requisições dentro da janela deslizante atual
  record.timestamps = record.timestamps.filter((t) => now - t < windowMs);

  if (record.timestamps.length >= limit) {
    const oldestTimestamp = record.timestamps[0];
    const resetMs = Math.max(0, oldestTimestamp + windowMs - now);
    const retryAfterSec = Math.ceil(resetMs / 1000);

    return {
      allowed: false,
      limit,
      remaining: 0,
      resetMs,
      retryAfterSec: Math.max(1, retryAfterSec),
    };
  }

  // Registra a nova requisição
  record.timestamps.push(now);

  const remaining = Math.max(0, limit - record.timestamps.length);
  const resetMs = windowMs;
  const retryAfterSec = 0;

  return {
    allowed: true,
    limit,
    remaining,
    resetMs,
    retryAfterSec,
  };
}

/**
 * Limpa o histórico de rate limit (útil para testes unitários)
 */
export function clearRateLimitStore(): void {
  rateLimitStore.clear();
}
