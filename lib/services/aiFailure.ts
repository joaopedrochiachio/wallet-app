import { OpenAIIntegrationError } from "./openaiService.ts";

/** Traduz a falha do provedor em resposta HTTP clara (sem detalhes técnicos sensíveis). */
export function describeProviderFailure(err: unknown): { status: number; code: string; error: string } {
  const code = err instanceof OpenAIIntegrationError ? err.code : "AI_PROVIDER_ERROR";
  switch (code) {
    case "MISSING_OPENAI_API_KEY":
    case "AUTHENTICATION_FAILED":
      return { status: 503, code, error: "A IA está indisponível por um problema de configuração do servidor. Já registramos a falha." };
    case "INSUFFICIENT_QUOTA":
      return { status: 503, code, error: "A IA está temporariamente sem créditos. Tente novamente mais tarde." };
    case "OPENAI_TIMEOUT_UNCERTAIN":
      return { status: 504, code, error: "A IA demorou demais para responder. Tente novamente." };
    case "MODEL_REFUSAL":
      return { status: 422, code, error: "A IA não pôde responder a essa pergunta. Tente reformular." };
    default: {
      const status = err instanceof OpenAIIntegrationError && err.status === 429 ? 429 : 502;
      return {
        status,
        code,
        error: status === 429
          ? "Muitas solicitações à IA agora. Aguarde alguns segundos e tente novamente."
          : "A IA está indisponível no momento. Tente novamente em instantes.",
      };
    }
  }
}
