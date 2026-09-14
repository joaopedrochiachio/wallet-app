import { NextRequest, NextResponse } from "next/server";
import { processDueOccurrencesForUser } from "@/lib/services/timeProgressionService";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const asOfParam = searchParams.get("asOfDate");

  if (!userId) {
    return NextResponse.json(
      { success: false, error: "userId obrigatório para processamento" },
      { status: 400 }
    );
  }

  const asOfDate = asOfParam ? new Date(asOfParam) : new Date();

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
  try {
    const body = await request.json();
    const userId = body.userId;
    const asOfParam = body.asOfDate;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "userId obrigatório no corpo da requisição" },
        { status: 400 }
      );
    }

    const asOfDate = asOfParam ? new Date(asOfParam) : new Date();
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
