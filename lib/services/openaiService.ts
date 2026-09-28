import OpenAI from "openai";

/**
 * Camada Única de Integração com a API da OpenAI (Responses API)
 * Utiliza o SDK oficial da OpenAI (JS/TS) com o modelo gpt-6-luna (padrão)
 * e gpt-6-sol (opcional por configuração).
 */

export const OPENAI_MODELS = {
  MAIN: "gpt-6-luna",
  OPTIONAL: "gpt-6-sol",
} as const;

export type SupportedOpenAIModel = (typeof OPENAI_MODELS)[keyof typeof OPENAI_MODELS];

/**
 * Tabela de Preços Standard Oficiais da OpenAI (USD por 1 Milhão de tokens).
 * Data de Referência: Setembro/2026.
 * Fonte: OpenAI Pricing Guide (Standard Tier / Responses API).
 * 
 * - gpt-6-luna (Padrão): US$ 0,10 / 1M entrada, US$ 0,05 / 1M entrada em cache, US$ 0,50 / 1M saída.
 * - gpt-6-sol (Opcional): US$ 2,00 / 1M entrada, US$ 1,00 / 1M entrada em cache, US$ 10,00 / 1M saída.
 * 
 * NOTA CONTÁBIL CRÍTICA: Na OpenAI Responses API, 'output_tokens' já inclui 'reasoning_tokens'.
 * O cálculo de custo NUNCA soma 'reasoning_tokens' além de 'output_tokens',
 * pois isso cobraria os tokens de raciocínio duas vezes.
 */
export interface ModelPricing {
  inputPerMillion: number;
  cachedInputPerMillion: number;
  outputPerMillion: number;
  reasoningPerMillion: number;
}

export const MODEL_PRICING: Record<string, ModelPricing> = {
  "gpt-6-luna": {
    inputPerMillion: 0.10, // US$ 0,10 por 1M tokens de entrada
    cachedInputPerMillion: 0.05, // US$ 0,05 por 1M tokens de entrada em cache (desconto de 50%)
    outputPerMillion: 0.50, // US$ 0,50 por 1M tokens de saída (já inclui raciocínio)
    reasoningPerMillion: 0.50, // Documentado para observabilidade
  },
  "gpt-6-sol": {
    inputPerMillion: 2.00, // US$ 2,00 por 1M tokens de entrada
    cachedInputPerMillion: 1.00, // US$ 1,00 por 1M tokens de entrada em cache
    outputPerMillion: 10.00, // US$ 10,00 por 1M tokens de saída (já inclui raciocínio)
    reasoningPerMillion: 10.00,
  },
};

/**
 * Calcula o custo estimado em USD com base nos tokens consumidos.
 * Garante que reasoning_tokens NÃO seja cobrado duas vezes.
 */
export function calculateEstimatedCostUsd(
  model: string,
  usage: {
    inputTokens: number;
    cachedInputTokens?: number;
    outputTokens: number;
    reasoningTokens?: number;
  }
): { costUsd: number; isEstimated: boolean } {
  const pricing = MODEL_PRICING[model] || MODEL_PRICING[OPENAI_MODELS.MAIN];
  const cachedTokens = Math.min(usage.inputTokens, usage.cachedInputTokens ?? 0);
  const uncachedInputTokens = Math.max(0, usage.inputTokens - cachedTokens);

  const uncachedInputCost = (uncachedInputTokens / 1_000_000) * pricing.inputPerMillion;
  const cachedInputCost = (cachedTokens / 1_000_000) * pricing.cachedInputPerMillion;
  // outputTokens já contém reasoning_tokens nos modelos da OpenAI:
  const outputCost = (usage.outputTokens / 1_000_000) * pricing.outputPerMillion;

  const total = Number((uncachedInputCost + cachedInputCost + outputCost).toFixed(6));
  return {
    costUsd: total,
    isEstimated: false,
  };
}

/**
 * Estimativa de fallback caso a resposta não traga usage detalhado.
 */
export function estimateTokensFromText(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

export interface OpenAIChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface OpenAICallParams {
  systemPrompt?: string;
  messages?: OpenAIChatMessage[];
  prompt?: string;
  model?: string;
  reasoningEffort?: "none" | "low" | "medium" | "high";
  maxOutputTokens?: number;
  jsonSchema?: {
    name: string;
    strict?: boolean;
    schema: Record<string, unknown>;
  };
  timeoutMs?: number;
}

export interface OpenAIResponseResult {
  text: string;
  modelUsed: string;
  durationMs: number;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  estimatedCostUsd: number;
  isCostEstimated: boolean;
  requestId: string;
}

export class OpenAIIntegrationError extends Error {
  code: string;
  status?: number;
  retryable: boolean;
  retryAfterSec?: number;
  isUncertainResult?: boolean;
  estimatedUncertainCostUsd?: number;
  technicalDetails?: unknown;

  constructor(
    message: string,
    options: {
      code: string;
      status?: number;
      retryable?: boolean;
      retryAfterSec?: number;
      isUncertainResult?: boolean;
      estimatedUncertainCostUsd?: number;
      technicalDetails?: unknown;
    }
  ) {
    super(message);
    this.name = "OpenAIIntegrationError";
    this.code = options.code;
    this.status = options.status;
    this.retryable = options.retryable ?? false;
    this.retryAfterSec = options.retryAfterSec;
    this.isUncertainResult = options.isUncertainResult ?? false;
    this.estimatedUncertainCostUsd = options.estimatedUncertainCostUsd;
    this.technicalDetails = options.technicalDetails;
  }
}

/**
 * Retorna o modelo configurado para o ambiente.
 * Padrão: gpt-6-luna.
 * Para ativar gpt-6-sol: configure OPENAI_MODEL_OVERRIDE="gpt-6-sol".
 */
export function resolveConfiguredModel(overrideModel?: string): string {
  if (overrideModel) return overrideModel;
  const envOverride = process.env.OPENAI_MODEL_OVERRIDE?.trim();
  if (envOverride === OPENAI_MODELS.OPTIONAL) {
    return OPENAI_MODELS.OPTIONAL;
  }
  return OPENAI_MODELS.MAIN;
}

/**
 * Instancia o cliente da OpenAI de forma segura no servidor.
 */
let cachedClient: OpenAI | null = null;
let lastApiKey: string | undefined = undefined;

export function getOpenAIClient(): OpenAI {
  let apiKey = process.env.OPENAI_API_KEY?.trim();
  if (apiKey) {
    while (
      (apiKey.startsWith('"') && apiKey.endsWith('"')) ||
      (apiKey.startsWith("'") && apiKey.endsWith("'"))
    ) {
      apiKey = apiKey.slice(1, -1).trim();
    }
  }

  if (!apiKey) {
    throw new OpenAIIntegrationError(
      "Chave da API da OpenAI não configurada no servidor. Defina OPENAI_API_KEY no ambiente.",
      { code: "MISSING_OPENAI_API_KEY", status: 500, retryable: false }
    );
  }

  // Se a chave mudou ou cliente ainda não existe, cria nova instância
  if (!cachedClient || lastApiKey !== apiKey) {
    cachedClient = new OpenAI({
      apiKey,
      maxRetries: 0, // Controlamos o retry de forma explícita e estrita
    });
    lastApiKey = apiKey;
  }

  return cachedClient;
}

/**
 * Reseta o cliente cacheado (útil para testes unitários com mocks)
 */
export function resetOpenAIClient(): void {
  cachedClient = null;
  lastApiKey = undefined;
}

/**
 * Constrói e valida o payload estritamente compatível com a OpenAI Responses API.
 * Exportado para validação em testes unitários.
 */
export function buildResponsesPayload(
  params: OpenAICallParams
): OpenAI.Responses.ResponseCreateParamsNonStreaming {
  const selectedModel = resolveConfiguredModel(params.model);

  const inputMessages: Array<{ role: "user" | "assistant"; content: string }> = [];

  if (params.messages && params.messages.length > 0) {
    for (const m of params.messages) {
      if (m.role === "user" || m.role === "assistant") {
        inputMessages.push({ role: m.role, content: m.content });
      }
    }
  } else if (params.prompt) {
    inputMessages.push({ role: "user", content: params.prompt });
  } else {
    throw new OpenAIIntegrationError("Nenhum prompt ou mensagem fornecido para a OpenAI.", {
      code: "EMPTY_PROMPT",
      status: 400,
      retryable: false,
    });
  }

  const reasoningEffort = params.reasoningEffort ?? "none";
  const maxOutputTokens = params.maxOutputTokens ?? 2048;

  const payload: OpenAI.Responses.ResponseCreateParamsNonStreaming = {
    model: selectedModel,
    input: inputMessages,
    store: false,
    service_tier: "default",
    reasoning: {
      effort: reasoningEffort,
    },
    max_output_tokens: maxOutputTokens,
  };

  if (params.systemPrompt) {
    payload.instructions = params.systemPrompt;
  }

  // Structured Outputs no formato oficial da Responses API:
  // text: { format: { type: "json_schema", name, schema, strict } }
  // (NUNCA aninhar objeto json_schema dentro de format)
  if (params.jsonSchema) {
    payload.text = {
      format: {
        type: "json_schema",
        name: params.jsonSchema.name,
        schema: params.jsonSchema.schema,
        strict: params.jsonSchema.strict ?? true,
      },
    };
  }

  return payload;
}

/**
 * Executa uma chamada à Responses API da OpenAI com controle rigoroso de custos e erros.
 * - Standard processing (service_tier: "default")
 * - store: false para não reter dados no servidor OpenAI
 * - reasoning.effort: "none" ou "low"
 * - Sem ferramentas pagas (web_search / file_search desligados)
 * - No máximo 1 retry controlado para erros comprovadamente transitórios (500, 503, 429 transitório)
 * - NUNCA repete 401 (auth), 400 (bad request), 402/quota/billing limits
 */
export async function callOpenAIResponses(
  params: OpenAICallParams
): Promise<OpenAIResponseResult> {
  const client = getOpenAIClient();
  const selectedModel = resolveConfiguredModel(params.model);
  const timeoutMs = params.timeoutMs ?? 30000;

  const payload = buildResponsesPayload(params);

  // String unificada para estimativa de fallback de tokens de entrada sem erro de precedência
  const inputRepresentation =
    (params.systemPrompt ? `${params.systemPrompt}\n` : "") +
    (params.messages ? JSON.stringify(params.messages) : (params.prompt || ""));

  const maxAttempts = 2;
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const startTime = Date.now();
    try {
      const response = await client.responses.create(payload, {
        timeout: timeoutMs,
      });

      const durationMs = Date.now() - startTime;
      const requestId = response.id || `resp-${Date.now()}`;

      // 1. Verificação de status da resposta
      if (response.status === "incomplete") {
        const reason = response.incomplete_details?.reason || "output_limit";
        throw new OpenAIIntegrationError(
          `A resposta da OpenAI foi interrompida ou incompleta (motivo: ${reason}).`,
          {
            code: "INCOMPLETE_RESPONSE",
            status: 502,
            retryable: false,
            technicalDetails: { reason, incomplete_details: response.incomplete_details },
          }
        );
      }

      if (response.status === "failed") {
        throw new OpenAIIntegrationError(
          response.error?.message || "A solicitação foi recusada ou falhou no processamento da OpenAI.",
          {
            code: response.error?.code || "RESPONSE_FAILED",
            status: 502,
            retryable: false,
            technicalDetails: response.error,
          }
        );
      }

      // 2. Verificação de recusa do modelo (refusal)
      const hasRefusal = response.output?.some(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (item: any) => item.type === "refusal" || Boolean(item.refusal)
      );
      if (hasRefusal) {
        throw new OpenAIIntegrationError(
          "A solicitação foi recusada pelo modelo de IA por critérios de segurança ou conformidade.",
          { code: "MODEL_REFUSAL", status: 400, retryable: false }
        );
      }

      const text = response.output_text || "";

      // 3. Validação de saída textual
      if (!text.trim()) {
        throw new OpenAIIntegrationError("A OpenAI retornou uma resposta textual em branco.", {
          code: "EMPTY_RESPONSE",
          status: 502,
          retryable: false,
        });
      }

      // 4. Se a chamada solicitou saída estruturada JSON, valida integridade do parsing
      if (params.jsonSchema) {
        try {
          JSON.parse(text);
        } catch (jsonErr) {
          throw new OpenAIIntegrationError(
            "A resposta gerada não atende ao formato JSON estruturado esperado.",
            {
              code: "INVALID_JSON_OUTPUT",
              status: 502,
              retryable: false,
              technicalDetails: jsonErr,
            }
          );
        }
      }

      // 5. Apuração de tokens e custos
      const inputTokens = response.usage?.input_tokens ?? estimateTokensFromText(inputRepresentation);
      const cachedInputTokens = response.usage?.input_tokens_details?.cached_tokens ?? 0;
      const outputTokens = response.usage?.output_tokens ?? estimateTokensFromText(text);
      const reasoningTokens = response.usage?.output_tokens_details?.reasoning_tokens ?? 0;
      const isCostEstimated = !response.usage;

      const { costUsd } = calculateEstimatedCostUsd(selectedModel, {
        inputTokens,
        cachedInputTokens,
        outputTokens,
        reasoningTokens,
      });

      return {
        text,
        modelUsed: selectedModel,
        durationMs,
        inputTokens,
        cachedInputTokens,
        outputTokens,
        reasoningTokens,
        estimatedCostUsd: costUsd,
        isCostEstimated,
        requestId,
      };
    } catch (err: unknown) {
      lastError = err;
      const durationMs = Date.now() - startTime;

      if (err instanceof OpenAIIntegrationError) {
        throw err;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const apiErr = err as any;
      const status = typeof apiErr?.status === "number" ? apiErr.status : undefined;
      const rawCode = String(apiErr?.code || apiErr?.type || "");

      // Erros de autenticação (não repetíveis)
      if (status === 401) {
        throw new OpenAIIntegrationError(
          "Falha de autenticação na OpenAI. Verifique a chave OPENAI_API_KEY no servidor.",
          { code: "AUTHENTICATION_FAILED", status: 401, retryable: false }
        );
      }

      // Erros de parâmetros (não repetíveis)
      if (status === 400) {
        throw new OpenAIIntegrationError(
          "Parâmetros de requisição inválidos para a OpenAI.",
          { code: "INVALID_REQUEST", status: 400, retryable: false }
        );
      }

      // Erros de teto rígido do projeto/organização ou saldo esgotado (NÃO repetíveis)
      const isQuotaOrBilling =
        status === 402 ||
        rawCode.includes("insufficient_quota") ||
        rawCode.includes("billing_hard_limit_reached") ||
        rawCode.includes("quota_exceeded");

      if (isQuotaOrBilling) {
        throw new OpenAIIntegrationError(
          "Créditos insuficientes ou limite de gastos da OpenAI alcançado.",
          { code: "INSUFFICIENT_QUOTA", status: 402, retryable: false }
        );
      }

      // Erros de timeout de rede onde o servidor da OpenAI pode ter processado a requisição
      const isTimeout =
        apiErr?.name === "APIConnectionTimeoutError" ||
        apiErr?.name === "TimeoutError" ||
        rawCode.includes("timeout");

      // Falha comprovadamente transitória (500, 503, 429 temporário)
      const isTransient = status === 429 || status === 500 || status === 503 || isTimeout;

      if (attempt < maxAttempts && isTransient) {
        const retryAfterHeader = apiErr?.headers?.["retry-after"];
        const waitSec = retryAfterHeader ? Math.min(parseInt(retryAfterHeader, 10) || 1, 5) : 1;

        console.warn(
          `[OPENAI_TRANSIENT_RETRY] Tentativa ${attempt} falhou (${status || apiErr?.name}). Aguardando ${waitSec}s antes de única repetição.`
        );
        await new Promise((resolve) => setTimeout(resolve, waitSec * 1000));
        continue;
      }

      // Se falhou por timeout definitivo, calcula custo incerto para não assumir custo zero
      let estimatedUncertainCostUsd: number | undefined = undefined;
      if (isTimeout) {
        const estInput = estimateTokensFromText(inputRepresentation);
        const estOutput = Math.min(params.maxOutputTokens ?? 2048, 1000);
        const { costUsd } = calculateEstimatedCostUsd(selectedModel, {
          inputTokens: estInput,
          outputTokens: estOutput,
        });
        estimatedUncertainCostUsd = costUsd;
      }

      console.error("[OPENAI_CALL_FAILED]", {
        model: selectedModel,
        status,
        code: rawCode || "UNKNOWN_ERROR",
        durationMs,
        attempt,
      });

      throw new OpenAIIntegrationError(
        status === 429
          ? "Limite de requisições por minuto atingido na OpenAI. Aguarde alguns instantes."
          : isTimeout
          ? "Tempo limite de comunicação com a OpenAI esgotado."
          : "Não foi possível obter resposta da OpenAI no momento.",
        {
          code: isTimeout ? "OPENAI_TIMEOUT_UNCERTAIN" : rawCode || "OPENAI_REQUEST_FAILED",
          status: status || 500,
          retryable: false,
          isUncertainResult: isTimeout,
          estimatedUncertainCostUsd,
        }
      );
    }
  }

  throw new OpenAIIntegrationError("Falha na chamada à OpenAI após repetição controlada.", {
    code: "MAX_RETRIES_EXCEEDED",
    status: 500,
    retryable: false,
    technicalDetails: lastError,
  });
}
