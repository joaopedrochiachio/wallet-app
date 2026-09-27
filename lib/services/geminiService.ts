/**
 * @deprecated Este serviço foi completamente descontinuado e removido na migração para OpenAI.
 * A camada única de integração agora é lib/services/openaiService.ts.
 * Não há fallback silencioso para Gemini.
 */

export function callGeminiCascade(): never {
  throw new Error(
    "O serviço Google Gemini foi completamente descontinuado. Todas as rotas de IA agora utilizam a API da OpenAI (Responses API) com o modelo gpt-6-luna."
  );
}
