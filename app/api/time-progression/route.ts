import { NextRequest, NextResponse } from "next/server";
import { processDueOccurrencesForUser } from "@/lib/services/timeProgressionService";

function isAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    // Em produção, se o segredo não estiver configurado, bloqueia por segurança
    return process.env.NODE_ENV === "development";
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader) return false;

  const [scheme, token] = authHeader.split(" ");
  return scheme?.toLowerCase() === "bearer" && token === cronSecret;
}

function parseAndValidateAsOfDate(asOfParam: string | null): Date | null {
  if (!asOfParam) return new Date();

  const parsed = new Date(asOfParam);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  // Teto de segurança: não permitir datas futuras além de 24 horas a partir de agora
  const maxAllowed = new Date(Date.now() + 24 * 60 * 60 * 1000);
  if (parsed.getTime() > maxAllowed.getTime()) {
    return null;
  }

  return parsed;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { success: false, error: "Acesso não autorizado." },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId")?.trim();
  const asOfParam = searchParams.get("asOfDate");

  if (!userId) {
    return NextResponse.json(
      { success: false, error: "userId obrigatório para processamento" },
      { status: 400 }
    );
  }

  const asOfDate = parseAndValidateAsOfDate(asOfParam);
  if (!asOfDate) {
    return NextResponse.json(
      { success: false, error: "asOfDate inválida ou além do limite permitido." },
      { status: 400 }
    );
  }

  try {
    const result = await processDueOccurrencesForUser(userId, asOfDate);
    return NextResponse.json({
      success: true,
      processedCount: result.processedCount,
      processedOccurrences: result.processedOccurrences,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Erro interno",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { success: false, error: "Acesso não autorizado." },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const userId = typeof body.userId === "string" ? body.userId.trim() : "";
    const asOfParam = body.asOfDate;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "userId obrigatório no corpo da requisição" },
        { status: 400 }
      );
    }

    const asOfDate = parseAndValidateAsOfDate(asOfParam);
    if (!asOfDate) {
      return NextResponse.json(
        { success: false, error: "asOfDate inválida ou além do limite permitido." },
        { status: 400 }
      );
    }

    const result = await processDueOccurrencesForUser(userId, asOfDate);

    return NextResponse.json({
      success: true,
      processedCount: result.processedCount,
      processedOccurrences: result.processedOccurrences,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Erro interno",
      },
      { status: 500 }
    );
  }
}
