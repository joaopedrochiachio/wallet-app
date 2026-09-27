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
 * Tabela de Preços Documentada (USD por 1 Milhão de tokens).
 * gpt-6-luna: Modelo principal de alta velocidade e raciocínio eficiente.
 * gpt-6-sol: Modelo opcional de alta capacidade (desativado por padrão).
 */
export interface ModelPricing {
  inputPerMillion: number;
  outputPerMillion: number;
  reasoningPerMillion: number;
}

export const MODEL_PRICING: Record<string, ModelPricing> = {
  "gpt-6-luna": {
    inputPerMillion: 0.15, // US$ 0,15 por 1M tokens de entrada
    outputPerMillion: 0.60, // US$ 0,60 por 1M tokens de saída
    reasoningPerMillion: 0.60, // US$ 0,60 por 1M tokens de raciocínio
  },
  "gpt-6-sol": {
    inputPerMillion: 2.50, // US$ 2,50 por 1M tokens de entrada
    outputPerMillion: 10.00, // US$ 10,00 por 1M tokens de saída
    reasoningPerMillion: 10.00, // US$ 10,00 por 1M tokens de raciocínio
  },
};

/**
 * Calcula o custo estimado em USD com base nos tokens consumidos.
 */
export function calculateEstimatedCostUsd(
  model: string,
  usage: {
    inputTokens: number;
    outputTokens: number;
    reasoningTokens?: number;
  }
): { costUsd: number; isEstimated: boolean } {
  const pricing = MODEL_PRICING[model] || MODEL_PRICING[OPENAI_MODELS.MAIN];
  const inputCost = (usage.inputTokens / 1_000_000) * pricing.inputPerMillion;
  const outputCost = (usage.outputTokens / 1_000_000) * pricing.outputPerMillion;
  const reasoningCost = ((usage.reasoningTokens ?? 0) / 1_000_000) * pricing.reasoningPerMillion;

  const total = Number((inputCost + outputCost + reasoningCost).toFixed(6));
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
  technicalDetails?: unknown;

  constructor(
    message: string,
    options: {
      code: string;
      status?: number;
      retryable?: boolean;
      retryAfterSec?: number;
      technicalDetails?: unknown;
    }
  ) {
    super(message);
    this.name = "OpenAIIntegrationError";
    this.code = options.code;
    this.status = options.status;
    this.retryable = options.retryable ?? false;
    this.retryAfterSec = options.retryAfterSec;
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
  const apiKey = process.env.OPENAI_API_KEY?.trim();
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
 * Executa uma chamada à Responses API da OpenAI com controle rigoroso de custos e erros.
 * - Standard processing (service_tier: "default")
 * - store: false para não reter dados no servidor OpenAI
 * - reasoning.effort: "none" ou "low"
 * - Sem ferramentas pagas (web_search / file_search desligados)
 * - No máximo 1 retry controlado para erros transitórios (500, 503, 429 transitório)
 * - NUNCA repete 401 (auth), 400 (bad request), 402/quota esgotada
 */
export async function callOpenAIResponses(
  params: OpenAICallParams
): Promise<OpenAIResponseResult> {
  const client = getOpenAIClient();
  const selectedModel = resolveConfiguredModel(params.model);

  // Prepara as mensagens no formato da Responses API
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

  const timeoutMs = params.timeoutMs ?? 30000;
  const reasoningEffort = params.reasoningEffort ?? "none";
  const maxOutputTokens = params.maxOutputTokens ?? 2048;

  // Monta o payload conforme a Responses API oficial da OpenAI
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload: any = {
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

  if (params.jsonSchema) {
    payload.text = {
      format: {
        type: "json_schema",
        json_schema: {
          name: params.jsonSchema.name,
          strict: params.jsonSchema.strict ?? true,
          schema: params.jsonSchema.schema,
        },
      },
    };
  }

  // Execução com no máximo 1 repetição controlada para erros transitórios
  const maxAttempts = 2;
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const startTime = Date.now();
    try {
      // client.responses.create com timeout de requisição
      const response = await client.responses.create(payload, {
        timeout: timeoutMs,
      });

      const durationMs = Date.now() - startTime;
      const text = response.output_text || "";
      const requestId = response.id || `resp-${Date.now()}`;

      const inputTokens = response.usage?.input_tokens ?? estimateTokensFromText(params.systemPrompt || "" + JSON.stringify(inputMessages));
      const outputTokens = response.usage?.output_tokens ?? estimateTokensFromText(text);
      const reasoningTokens = response.usage?.output_tokens_details?.reasoning_tokens ?? 0;
      const isCostEstimated = !response.usage;

      const { costUsd } = calculateEstimatedCostUsd(selectedModel, {
        inputTokens,
        outputTokens,
        reasoningTokens,
      });

      return {
        text,
        modelUsed: selectedModel,
        durationMs,
        inputTokens,
        outputTokens,
        reasoningTokens,
        estimatedCostUsd: costUsd,
        isCostEstimated,
        requestId,
      };
    } catch (err: unknown) {
      lastError = err;
      const durationMs = Date.now() - startTime;

      // Classifica o erro da API da OpenAI
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const apiErr = err as any;
      const status = typeof apiErr?.status === "number" ? apiErr.status : undefined;
      const code = String(apiErr?.code || apiErr?.type || "UNKNOWN_OPENAI_ERROR");

      // Erros que NUNCA devem ser repetidos
      if (status === 401) {
        throw new OpenAIIntegrationError(
          "Falha de autenticação na OpenAI. Verifique a chave OPENAI_API_KEY no servidor.",
          { code: "AUTHENTICATION_FAILED", status: 401, retryable: false }
        );
      }

      if (status === 400) {
        throw new OpenAIIntegrationError(
          "Parâmetros de requisição inválidos para a OpenAI.",
          { code: "INVALID_REQUEST", status: 400, retryable: false }
        );
      }

      if (status === 402 || code.includes("insufficient_quota") || code.includes("billing")) {
        throw new OpenAIIntegrationError(
          "Créditos insuficientes ou cota excedida na OpenAI.",
          { code: "INSUFFICIENT_QUOTA", status: 402, retryable: false }
        );
      }

      // Se for a primeira tentativa e for transitório (429 rate limit, 500, 503, timeout)
      const isTransient = status === 429 || status === 500 || status === 503 || apiErr?.name === "APIConnectionTimeoutError" || apiErr?.name === "TimeoutError";

      if (attempt < maxAttempts && isTransient) {
        const retryAfterHeader = apiErr?.headers?.["retry-after"];
        const waitSec = retryAfterHeader ? Math.min(parseInt(retryAfterHeader, 10) || 1, 5) : 1;

        console.warn(`[OPENAI_TRANSIENT_RETRY] Tentativa ${attempt} falhou (${status || apiErr?.name}). Aguardando ${waitSec}s antes da repetição única.`);
        await new Promise((resolve) => setTimeout(resolve, waitSec * 1000));
        continue;
      }

      // Se chegou aqui, lança erro com informações seguras (sem expor chave ou prompts)
      console.error("[OPENAI_CALL_FAILED]", {
        model: selectedModel,
        status,
        code,
        durationMs,
        attempt,
      });

      throw new OpenAIIntegrationError(
        status === 429
          ? "Limite de requisições por minuto atingido na OpenAI. Aguarde alguns instantes."
          : "Não foi possível obter resposta da OpenAI no momento.",
        {
          code: code || "OPENAI_REQUEST_FAILED",
          status: status || 500,
          retryable: false,
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
