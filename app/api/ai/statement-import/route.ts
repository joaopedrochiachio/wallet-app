import { NextRequest, NextResponse } from "next/server.js";
import zlib from "node:zlib";
import {
  extractTextFromPdfBytes,
  analyzeBankStatementText,
  type AnalyzeStatementParams,
} from "../../../../lib/services/statementImportService.ts";
import { redactPersonalData } from "../../../../lib/services/privacyService.ts";
import { callOpenAIResponses } from "../../../../lib/services/openaiService.ts";
import { checkRateLimit } from "../../../../lib/utils/rateLimiter.ts";
import { verifyServerAuth } from "../../../../lib/auth/serverAuth.ts";
import { reserveAIQuota, reconcileAIQuota } from "../../../../lib/services/aiUsageService.ts";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
const MAX_PAYLOAD_BYTES = 10 * 1024 * 1024; // 10 MB para suportar PDFs de múltiplos meses

/**
 * Descompacta streams /FlateDecode de arquivos PDF usando o módulo nativo node:zlib
 */
function decompressPdfFlateStream(compressed: Uint8Array): Uint8Array | null {
  try {
    return new Uint8Array(zlib.inflateSync(compressed));
  } catch {
    try {
      return new Uint8Array(zlib.inflateRawSync(compressed));
    } catch {
      try {
        return new Uint8Array(zlib.unzipSync(compressed));
      } catch {
        return null;
      }
    }
  }
}

interface UploadedStatementFilePayload {
  fileName: string;
  mimeType?: string;
  base64Content?: string;
  textContent?: string;
}

export async function POST(req: NextRequest) {
  try {
    const contentLength = req.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > MAX_PAYLOAD_BYTES) {
      return NextResponse.json(
        {
          success: false,
          error: "O arquivo enviado excede o tamanho máximo permitido de 10 MB.",
        },
        { status: 413 }
      );
    }

    const clientIp = req.headers.get("x-forwarded-for") || "local";
    const rateCheck = checkRateLimit(`statement-import:${clientIp}`, 15, 60000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Muitas importações seguidas. Aguarde ${rateCheck.retryAfterSec} segundos.`,
        },
        { status: 429 }
      );
    }

    const body = await req.json();
    const {
      files = [],
      rawText = "",
      existingCards = [],
      existingTransactions = [],
      existingRecurringItems = [],
      useAI = false,
    } = body as {
      files?: UploadedStatementFilePayload[];
      rawText?: string;
      existingCards?: AnalyzeStatementParams["existingCards"];
      existingTransactions?: AnalyzeStatementParams["existingTransactions"];
      existingRecurringItems?: AnalyzeStatementParams["existingRecurringItems"];
      useAI?: boolean;
    };

    const extractedParts: string[] = [];
    const fileNames: string[] = [];

    if (Array.isArray(files)) {
      for (const file of files.slice(0, 5)) {
        if (!file) continue;
        if (file.fileName) fileNames.push(file.fileName);

        if (typeof file.textContent === "string" && file.textContent.trim()) {
          extractedParts.push(file.textContent.trim());
          continue;
        }

        if (typeof file.base64Content === "string" && file.base64Content.trim()) {
          const cleanBase64 = file.base64Content.replace(/^data:[^;]+;base64,/, "");
          const bytes = new Uint8Array(Buffer.from(cleanBase64, "base64"));
          const isPdf =
            file.fileName?.toLowerCase().endsWith(".pdf") ||
            file.mimeType === "application/pdf" ||
            (bytes.length > 4 &&
              bytes[0] === 0x25 &&
              bytes[1] === 0x50 &&
              bytes[2] === 0x44 &&
              bytes[3] === 0x46);

          if (isPdf) {
            const pdfText = extractTextFromPdfBytes(bytes, decompressPdfFlateStream);
            if (pdfText.trim()) {
              extractedParts.push(pdfText);
            }
          } else {
            const decodedText = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
            if (decodedText.trim()) {
              extractedParts.push(decodedText);
            }
          }
        }
      }
    }

    if (typeof rawText === "string" && rawText.trim()) {
      extractedParts.push(rawText.trim());
    }

    const combinedText = extractedParts.join("\n\n");
    if (!combinedText.trim()) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Não foi possível extrair texto legível do arquivo enviado. Verifique se o PDF possui texto selecionável (não é apenas uma foto escaneada) ou cole o texto do extrato.",
          code: "EMPTY_EXTRACTED_TEXT",
        },
        { status: 422 }
      );
    }

    // 1. Análise Contábil e Determinística Local (Instantânea e 100% exata)
    const analysis = analyzeBankStatementText({
      rawText: combinedText,
      fileName: fileNames.join(", "),
      existingCards: Array.isArray(existingCards) ? existingCards.slice(0, 30) : [],
      existingTransactions: Array.isArray(existingTransactions) ? existingTransactions.slice(0, 500) : [],
      existingRecurringItems: Array.isArray(existingRecurringItems) ? existingRecurringItems.slice(0, 100) : [],
    });

    // 2. Refinamento Opcional por IA para lançamentos com categoria "Outros" (somente para usuário autenticado e dentro da cota)
    const uncategorizedItems = analysis.transactions.filter((t) => t.category === "Outros");
    if (useAI && uncategorizedItems.length > 0 && process.env.OPENAI_API_KEY?.trim()) {
      const authResult = await verifyServerAuth(req);
      if ("user" in authResult) {
        const quotaRes = await reserveAIQuota({
          uid: authResult.user.uid,
          route: "patterns",
        });
        if (quotaRes.allowed && quotaRes.reservation) {
          let aiSucceeded = false;
          let actualCostUsd = 0;
          try {
            const sanitizedList = uncategorizedItems.slice(0, 25).map((item) => ({
              id: item.id,
              title: redactPersonalData(item.title),
              type: item.type,
              amount: item.amount,
            }));

            const aiResult = await callOpenAIResponses({
              systemPrompt:
                "Você é um classificador contábil brasileiro. Classifique cada lançamento em uma das categorias oficiais: Alimentação, Supermercado, Transporte, Moradia, Lazer, Saúde, Educação, Compras, Serviços, Renda, Transferências, Investimentos & Metas. E indique se é uma conta fixa mensal (isRecurring: boolean).",
              prompt: `Classifique os seguintes lançamentos bancários (JSON):\n${JSON.stringify(sanitizedList)}`,
              reasoningEffort: "none",
              maxOutputTokens: 1000,
              timeoutMs: 12000,
              jsonSchema: {
                name: "StatementCategoryEnrichment",
                strict: true,
                schema: {
                  type: "object",
                  properties: {
                    items: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          id: { type: "string" },
                          category: { type: "string" },
                          cleanTitle: { type: "string" },
                          isRecurring: { type: "boolean" },
                        },
                        required: ["id", "category", "cleanTitle", "isRecurring"],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ["items"],
                  additionalProperties: false,
                },
              },
            });

            aiSucceeded = true;
            actualCostUsd = aiResult.estimatedCostUsd;

            const parsedAI = JSON.parse(aiResult.text) as {
              items?: Array<{ id: string; category: string; cleanTitle: string; isRecurring: boolean }>;
            };

            if (Array.isArray(parsedAI.items)) {
              const mapById = new Map(parsedAI.items.map((i) => [i.id, i]));
              for (const tx of analysis.transactions) {
                const enriched = mapById.get(tx.id);
                if (enriched) {
                  tx.category = enriched.category || tx.category;
                  if (enriched.cleanTitle && enriched.cleanTitle.length >= 2) {
                    tx.title = enriched.cleanTitle;
                  }
                  tx.isRecurringCandidate = tx.isRecurringCandidate || enriched.isRecurring;
                }
              }
              analysis.summary.aiEnhanced = true;
            }
          } catch (aiErr) {
            console.warn("[STATEMENT_IMPORT_AI_FALLBACK] Mantendo classificação determinística:", aiErr);
          } finally {
            await reconcileAIQuota({
              reservation: quotaRes.reservation,
              success: aiSucceeded,
              actualCostUsd,
            });
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      analysis,
    });
  } catch (err: unknown) {
    console.error("[STATEMENT_IMPORT_API_ERROR]", err);
    return NextResponse.json(
      {
        success: false,
        error:
          err instanceof Error
            ? err.message
            : "Ocorreu um erro ao analisar o extrato bancário.",
      },
      { status: 500 }
    );
  }
}

