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

function cleanEnvKey(raw?: string): string {
  if (!raw) return "";
  return raw.trim().replace(/^["']+|["']+$/g, "").replace(/[\r\n\s]+/g, "").trim();
}

/**
 * A chave vem exclusivamente de OPENAI_API_KEY (variável de servidor).
 * Nunca use NEXT_PUBLIC_ para segredos: esse prefixo publica o valor no navegador.
 */
function resolveOpenAIKeyFromEnv(): string {
  const key = cleanEnvKey(process.env.OPENAI_API_KEY);
  return key && key !== "your-openai-api-key-here" ? key : "";
}

export function getOpenAIClient(): OpenAI {
  const currentKey = resolveOpenAIKeyFromEnv();

  if (!currentKey || currentKey === "your-openai-api-key-here") {
    throw new OpenAIIntegrationError(
      "OPENAI_API_KEY não configurada no servidor. Defina-a nas Environment Variables da Vercel e faça um Redeploy.",
      { code: "MISSING_OPENAI_API_KEY", status: 500, retryable: false }
    );
  }

  // Se a chave mudou ou cliente ainda não existe, cria nova instância
  if (!cachedClient || lastApiKey !== currentKey) {
    cachedClient = new OpenAI({
      apiKey: currentKey,
      maxRetries: 1,
    });
    lastApiKey = currentKey;
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
 * Resolve a lista de modelos reais da OpenAI para execução em produção.
 * "gpt-6-luna" e "gpt-6-sol" são codinomes internos mapeados automaticamente
 * para os modelos reais da API da OpenAI (gpt-4o-mini / gpt-4.1-mini / gpt-4o).
 */
/**
 * Dois trilhos de modelo reais:
 * - Análise (informativo, rótulo gpt-6-sol): modelo forte, para raciocinar sobre o mês.
 * - Conversa (chat, rótulo gpt-6-luna): modelo rápido e barato.
 * Cada trilho tem cascata: se um modelo não existir na conta, tenta o próximo.
 * OPENAI_ANALYSIS_MODEL / OPENAI_CHAT_MODEL sobrescrevem o primeiro da fila.
 */
export const ANALYSIS_MODEL_CANDIDATES = ["gpt-6.1-sol", "gpt-6-sol", "gpt-5.5", "gpt-4.1"];
export const CHAT_MODEL_CANDIDATES = ["gpt-6-luna", "gpt-5.4-mini", "gpt-4o-mini"];

export function resolveRealOpenAIModelCandidates(configuredModel: string): string[] {
  const isAnalysis = configuredModel === OPENAI_MODELS.OPTIONAL;
  const envReal = isAnalysis
    ? cleanEnvKey(process.env.OPENAI_ANALYSIS_MODEL)
    : cleanEnvKey(process.env.OPENAI_CHAT_MODEL || process.env.OPENAI_REAL_MODEL || process.env.OPENAI_MODEL);
  const envOverride = cleanEnvKey(process.env.OPENAI_MODEL_OVERRIDE);
  const customReal =
    envReal ||
    (envOverride && envOverride !== OPENAI_MODELS.MAIN && envOverride !== OPENAI_MODELS.OPTIONAL ? envOverride : "");
  const base = isAnalysis ? ANALYSIS_MODEL_CANDIDATES : CHAT_MODEL_CANDIDATES;
  return Array.from(new Set(customReal ? [customReal, ...base] : base));
}

/** Modelos com raciocínio aceitam reasoning_effort. */
function supportsReasoningEffort(model: string): boolean {
  return /^(gpt-5|gpt-6|o\d)/.test(model);
}

/**
 * Esforço de raciocínio enviado de fato ao modelo.
 *
 * Importante: NÃO enviar o parâmetro não significa "sem raciocínio". Em vários
 * modelos de raciocínio o padrão é "medium", e os tokens de raciocínio saem do
 * mesmo teto de max_completion_tokens: a resposta podia voltar vazia (ou
 * estourar o tempo) e o chat mostrava "IA indisponível". Por isso "none" é
 * traduzido para o menor nível que cada família aceita.
 */
export function resolveReasoningEffort(
  model: string,
  requested: OpenAICallParams["reasoningEffort"]
): "none" | "minimal" | "low" | "medium" | "high" | undefined {
  if (!supportsReasoningEffort(model)) return undefined;
  const effort = requested ?? "none";
  if (effort !== "none") return effort;
  // gpt-5 original (gpt-5, gpt-5-mini, gpt-5-nano e versões datadas): menor nível é "minimal"
  if (/^gpt-5(-(mini|nano))?(-\d{4}-\d{2}-\d{2})?$/.test(model)) return "minimal";
  // Série o (o3, o4-mini...): menor nível é "low"
  if (/^o\d/.test(model)) return "low";
  // gpt-5.1 em diante e gpt-6: aceitam "none"
  return "none";
}

/**
 * Teto de tokens de saída. Em modelos de raciocínio somamos uma folga para o
 * raciocínio não consumir o espaço da resposta (só se paga o que for usado).
 */
export function resolveMaxCompletionTokens(model: string, maxOutputTokens: number, effort: ReturnType<typeof resolveReasoningEffort>): number {
  if (!effort) return maxOutputTokens;
  const headroom = effort === "none" ? 500 : effort === "minimal" ? 1500 : effort === "low" ? 3000 : 6000;
  return maxOutputTokens + headroom;
}

/**
 * Reserva opcional via Google Gemini, ativada apenas quando GEMINI_API_KEY está
 * definida no servidor. A chave segue no cabeçalho (não na URL, que vai para logs).
 */
async function tryGeminiBackup(
  params: OpenAICallParams,
  inputRepresentation: string,
  selectedModelLabel: string
): Promise<OpenAIResponseResult | null> {
  const geminiKey = cleanEnvKey(process.env.GEMINI_API_KEY);
  if (!geminiKey) return null;

  const startTime = Date.now();
  try {
    const userPromptText =
      params.messages && params.messages.length > 0
        ? params.messages.map((m) => `${m.role === "user" ? "Usuário" : "Assistente"}: ${m.content}`).join("\n\n")
        : params.prompt || "";
    const fullPrompt = params.jsonSchema
      ? `${userPromptText}\n\nResponda ESTRITAMENTE em JSON válido seguindo o schema: ${JSON.stringify(params.jsonSchema.schema)}`
      : userPromptText;

    const geminiRes = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": geminiKey },
        body: JSON.stringify({
          ...(params.systemPrompt ? { systemInstruction: { parts: [{ text: params.systemPrompt }] } } : {}),
          contents: [{ role: "user", parts: [{ text: fullPrompt }] }],
          generationConfig: {
            maxOutputTokens: params.maxOutputTokens ?? 2048,
            ...(params.jsonSchema ? { responseMimeType: "application/json" } : {}),
          },
        }),
        signal: AbortSignal.timeout(params.timeoutMs ?? 30000),
      }
    );

    if (!geminiRes.ok) {
      console.error("[GEMINI_BACKUP_FAILED]", { status: geminiRes.status });
      return null;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = (await geminiRes.json()) as any;
    const text = String(data?.candidates?.[0]?.content?.parts?.[0]?.text || "").trim();
    if (!text) return null;

    const inputTokens = estimateTokensFromText(inputRepresentation);
    const outputTokens = estimateTokensFromText(text);
    const { costUsd } = calculateEstimatedCostUsd(selectedModelLabel, { inputTokens, outputTokens });
    return {
      text,
      modelUsed: "gemini-2.0-flash",
      durationMs: Date.now() - startTime,
      inputTokens,
      cachedInputTokens: 0,
      outputTokens,
      reasoningTokens: 0,
      estimatedCostUsd: costUsd,
      isCostEstimated: true,
      requestId: `gemini-${Date.now()}`,
    };
  } catch (err) {
    console.error("[GEMINI_BACKUP_FAILED]", { message: err instanceof Error ? err.message : String(err) });
    return null;
  }
}

/**
 * Executa uma chamada à API da OpenAI com cascata resiliente de modelos reais em produção
 * (gpt-4o-mini -> gpt-4.1-mini -> gpt-4o) e compatibilidade total com Structured Outputs.
 */
export async function callOpenAIResponses(
  params: OpenAICallParams
): Promise<OpenAIResponseResult> {
  const selectedModel = resolveConfiguredModel(params.model);
  const timeoutMs = params.timeoutMs ?? 30000;

  // Valida o formato do payload para manter contrato estrito
  buildResponsesPayload(params);

  const inputRepresentation =
    (params.systemPrompt ? `${params.systemPrompt}\n` : "") +
    (params.messages ? JSON.stringify(params.messages) : (params.prompt || ""));

  let client: OpenAI;
  try {
    client = getOpenAIClient();
  } catch (missingKeyErr) {
    // Sem OPENAI_API_KEY: usa o Gemini apenas se GEMINI_API_KEY estiver configurada
    const altResult = await tryGeminiBackup(
      params,
      inputRepresentation,
      selectedModel
    );
    if (altResult) return altResult;
    throw missingKeyErr;
  }

  const candidateModels = resolveRealOpenAIModelCandidates(selectedModel);
  let lastError: unknown = null;

  // Monta lista de mensagens compatível com Chat Completions API (suportada universalmente em todos os modelos OpenAI)
  const chatMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
  if (params.systemPrompt) {
    chatMessages.push({
      role: "system",
      content: params.systemPrompt,
    });
  }
  if (params.messages && params.messages.length > 0) {
    for (const m of params.messages) {
      if (m.role === "user" || m.role === "assistant") {
        chatMessages.push({ role: m.role, content: m.content });
      }
    }
  } else if (params.prompt) {
    chatMessages.push({ role: "user", content: params.prompt });
  }

  for (const realModel of candidateModels) {
    const startTime = Date.now();
    try {
      const effort = resolveReasoningEffort(realModel, params.reasoningEffort);
      const completionParams: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
        model: realModel,
        messages: chatMessages,
        max_completion_tokens: resolveMaxCompletionTokens(realModel, params.maxOutputTokens ?? 2048, effort),
      };
      if (effort) {
        (completionParams as unknown as Record<string, unknown>).reasoning_effort = effort;
      }

      if (params.jsonSchema) {
        completionParams.response_format = {
          type: "json_schema",
          json_schema: {
            name: params.jsonSchema.name,
            strict: params.jsonSchema.strict ?? true,
            schema: params.jsonSchema.schema,
          },
        };
      }

      let completion: OpenAI.Chat.Completions.ChatCompletion;
      try {
        completion = await client.chat.completions.create(completionParams, {
          timeout: timeoutMs,
        });
      } catch (schemaErr: unknown) {
        // Se algum modelo recusar strict json_schema, tenta json_object no mesmo modelo
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const status = (schemaErr as any)?.status;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const errText = `${(schemaErr as any)?.param ?? ""} ${(schemaErr as any)?.message ?? ""}`;
        if (status === 400 && effort && effort !== "low" && /reasoning/i.test(errText)) {
          // Modelo não aceita esse nível de raciocínio: "low" é aceito por todos os que raciocinam.
          completion = await client.chat.completions.create(
            { ...completionParams, reasoning_effort: "low", max_completion_tokens: resolveMaxCompletionTokens(realModel, params.maxOutputTokens ?? 2048, "low") } as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
            { timeout: timeoutMs }
          );
        } else if (params.jsonSchema && status === 400) {
          const fallbackParams: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
            ...completionParams,
            messages: [
              ...chatMessages,
              {
                role: "system",
                content: `Responda ESTRITAMENTE em JSON válido respeitando esta estrutura: ${JSON.stringify(params.jsonSchema.schema)}`,
              },
            ],
            response_format: { type: "json_object" },
          };
          completion = await client.chat.completions.create(fallbackParams, {
            timeout: timeoutMs,
          });
        } else {
          throw schemaErr;
        }
      }

      const durationMs = Date.now() - startTime;
      const requestId = completion.id || `resp-${Date.now()}`;
      const choice = completion.choices?.[0];

      if (choice?.message?.refusal) {
        throw new OpenAIIntegrationError(
          "A solicitação foi recusada pelo modelo de IA por critérios de segurança ou conformidade.",
          { code: "MODEL_REFUSAL", status: 400, retryable: false }
        );
      }

      let text = (choice?.message?.content || "").trim();
      // Remove cercas markdown ```json ... ``` caso o modo json_object tenha sido usado
      if (params.jsonSchema && text.startsWith("```")) {
        text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
      }

      if (!text) {
        // Resposta vazia (ex.: o raciocínio consumiu o teto). Tenta o próximo modelo da fila.
        throw new OpenAIIntegrationError("A OpenAI retornou uma resposta textual em branco.", {
          code: "EMPTY_RESPONSE",
          status: 502,
          retryable: true,
          technicalDetails: { finishReason: choice?.finish_reason, model: realModel },
        });
      }

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

      const inputTokens = completion.usage?.prompt_tokens ?? estimateTokensFromText(inputRepresentation);
      const cachedInputTokens = completion.usage?.prompt_tokens_details?.cached_tokens ?? 0;
      const outputTokens = completion.usage?.completion_tokens ?? estimateTokensFromText(text);
      const reasoningTokens = completion.usage?.completion_tokens_details?.reasoning_tokens ?? 0;
      const isCostEstimated = !completion.usage;

      const { costUsd } = calculateEstimatedCostUsd(selectedModel, {
        inputTokens,
        cachedInputTokens,
        outputTokens,
        reasoningTokens,
      });

      return {
        text,
        // Modelo que de fato respondeu (o rótulo do trilho fica no cálculo de custo)
        modelUsed: realModel,
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const apiErr = err as any;
      const status = typeof apiErr?.status === "number" ? apiErr.status : undefined;
      const rawCode = String(apiErr?.code || apiErr?.type || "");

      // Se o erro foi modelo não encontrado ou sem acesso (404 / 403 / model_not_found), tenta o próximo modelo da cascata
      if (
        status === 404 ||
        status === 403 ||
        rawCode.includes("model_not_found") ||
        rawCode.includes("does_not_exist")
      ) {
        continue;
      }

      // Resposta em branco não é falha do provedor: o próximo modelo costuma responder.
      if (err instanceof OpenAIIntegrationError && err.code === "EMPTY_RESPONSE") {
        console.warn("[OPENAI_EMPTY_RESPONSE]", err.technicalDetails);
        continue;
      }

      // Se falhar na OpenAI, tenta o Gemini (somente se GEMINI_API_KEY estiver configurada)
      const altResult = await tryGeminiBackup(
        params,
        inputRepresentation,
        selectedModel
      );
      if (altResult) {
        return altResult;
      }

      if (err instanceof OpenAIIntegrationError) {
        throw err;
      }

      if (status === 401) {
        throw new OpenAIIntegrationError(
          "Falha de autenticação na OpenAI. Verifique a chave OPENAI_API_KEY no servidor.",
          { code: "AUTHENTICATION_FAILED", status: 401, retryable: false }
        );
      }

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

      const isTimeout =
        apiErr?.name === "APIConnectionTimeoutError" ||
        apiErr?.name === "TimeoutError" ||
        rawCode.includes("timeout");

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

  // Última tentativa em provedor alternativo se todos os modelos OpenAI foram recusados
  const altResult = await tryGeminiBackup(
    params,
    inputRepresentation,
    selectedModel
  );
  if (altResult) {
    return altResult;
  }

  throw new OpenAIIntegrationError("Falha na chamada à OpenAI após tentar modelos disponíveis.", {
    code: "MAX_RETRIES_EXCEEDED",
    status: 500,
    retryable: false,
    technicalDetails: lastError,
  });
}
