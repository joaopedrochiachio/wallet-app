/**
 * Serviço de Integração com Google Gemini AI Studio
 * Implementa modelo de cascata resiliente com fallback automático entre modelos.
 */

export const MODEL_CASCADE = [
  "gemini-3.6-flash",
  "gemini-3.7-flash",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-3-flash",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
] as const;

export type SupportedGeminiModel = (typeof MODEL_CASCADE)[number];

export interface GeminiChatMessage {
  role: "user" | "model" | "assistant";
  content: string;
}

export interface GeminiCascadeOptions {
  systemPrompt?: string;
  messages?: GeminiChatMessage[];
  prompt?: string;
  temperature?: number;
  maxOutputTokens?: number;
  jsonMode?: boolean;
  timeoutMs?: number;
  customApiKey?: string;
}

export interface GeminiCascadeResponse {
  text: string;
  modelUsed: string;
  durationMs: number;
  attemptedModels: string[];
}

export class GeminiCascadeError extends Error {
  attemptedModels: string[];
  lastErrorDetails?: unknown;

  constructor(message: string, attemptedModels: string[], lastErrorDetails?: unknown) {
    super(message);
    this.name = "GeminiCascadeError";
    this.attemptedModels = attemptedModels;
    this.lastErrorDetails = lastErrorDetails;
  }
}

/**
 * Executa uma chamada à API do Gemini utilizando o modelo de cascata.
 * Percorre os modelos em sequência até obter uma resposta válida.
 */
export async function callGeminiCascade(
  options: GeminiCascadeOptions
): Promise<GeminiCascadeResponse> {
  const apiKey =
    options.customApiKey ||
    process.env.GEMINI_API_KEY ||
    process.env.NEXT_PUBLIC_GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "Chave da API do Gemini não configurada. Defina GEMINI_API_KEY no arquivo .env.local"
    );
  }

  // Prepara as mensagens no formato da API Gemini v1beta
  let contents: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }> = [];

  if (options.messages && options.messages.length > 0) {
    contents = options.messages.map((m) => ({
      role: m.role === "assistant" ? "model" : (m.role as "user" | "model"),
      parts: [{ text: m.content }],
    }));
  } else if (options.prompt) {
    contents = [
      {
        role: "user",
        parts: [{ text: options.prompt }],
      },
    ];
  } else {
    throw new Error("Nenhum prompt ou histórico de mensagens fornecido para o Gemini.");
  }

  const payload: Record<string, unknown> = {
    contents,
    generationConfig: {
      temperature: options.temperature ?? 0.3,
      maxOutputTokens: options.maxOutputTokens ?? 2048,
      ...(options.jsonMode ? { responseMimeType: "application/json" } : {}),
    },
  };

  if (options.systemPrompt) {
    payload.systemInstruction = {
      parts: [{ text: options.systemPrompt }],
    };
  }

  const attemptedModels: string[] = [];
  let lastError: unknown = null;
  const timeoutMs = options.timeoutMs ?? 30000;

  for (const model of MODEL_CASCADE) {
    attemptedModels.push(model);
    const start = Date.now();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
        apiKey
      )}`;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await response.json();

      if (response.ok && data?.candidates?.[0]?.content?.parts?.[0]?.text) {
        const text = data.candidates[0].content.parts[0].text;
        const durationMs = Date.now() - start;

        return {
          text,
          modelUsed: model,
          durationMs,
          attemptedModels,
        };
      }

      // Se a resposta retornou erro HTTP (ex: 404, 429 quota, 503 overload), continua cascata
      const errorMsg =
        data?.error?.message ||
        `Status ${response.status} (${response.statusText || "Erro desconhecido"})`;

      console.warn(
        `[Gemini Cascade] Modelo ${model} falhou (${response.status}): ${errorMsg}. Tentando próximo...`
      );
      lastError = data?.error || { status: response.status, message: errorMsg };
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      const isAbort = (err as { name?: string })?.name === "AbortError";
      const message = isAbort ? `Timeout de ${timeoutMs}ms excedido` : (err as Error)?.message;

      console.warn(
        `[Gemini Cascade] Exceção no modelo ${model}: ${message}. Tentando próximo modelo...`
      );
      lastError = err;
    }
  }

  throw new GeminiCascadeError(
    `Todos os modelos na cascata falharam. Modelos tentados: ${attemptedModels.join(", ")}`,
    attemptedModels,
    lastError
  );
}
