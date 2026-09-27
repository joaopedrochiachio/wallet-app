"use client";

import React from "react";
import {
  Layers,
  ShieldCheck,
  TrendingUp,
  Receipt,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Calculator,
  Compass,
} from "lucide-react";

interface FormattedMessageProps {
  content: string;
  role?: "user" | "assistant";
}

/**
 * Helper to parse inline markdown (bold, currency, percentages) and clean stray markdown symbols
 */
function renderInlineContent(text: string): React.ReactNode[] {
  if (!text) return [];

  // Remove any loose triple dashes or raw hash markers from inline text
  let cleaned = text.replace(/^#+\s*/g, "");

  // Regex to split by bold: **something**
  const boldRegex = /\*\*(.+?)\*\*/g;
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = boldRegex.exec(cleaned)) !== null) {
    if (match.index > lastIndex) {
      const normalPart = cleaned.substring(lastIndex, match.index);
      nodes.push(...highlightFinancialTokens(normalPart, nodes.length));
    }

    const boldContent = match[1].trim();
    if (boldContent) {
      nodes.push(
        <strong
          key={`bold-${nodes.length}-${match.index}`}
          className="font-semibold text-[#1D1D1F]"
        >
          {boldContent}
        </strong>
      );
    }

    lastIndex = boldRegex.lastIndex;
  }

  if (lastIndex < cleaned.length) {
    const remaining = cleaned.substring(lastIndex);
    nodes.push(...highlightFinancialTokens(remaining, nodes.length));
  }

  return nodes;
}

/**
 * Highlights currency values (R$ 00,00) and percentages (00%) within normal text
 */
function highlightFinancialTokens(text: string, baseKey: number): React.ReactNode[] {
  // Clean any remaining orphan single asterisks
  const sanitized = text.replace(/(^|\s)\*([^*]+)\*(\s|$)/g, "$1$2$3").replace(/\*/g, "");

  // Tokenize for Currency (R$ 1.234,56 or R$ 123,45) and Percentages (12% or 13,0%)
  const tokenRegex = /(R\$\s*[\d\.,]+|\b\d+([,\.]\d+)?%)/g;
  const parts: React.ReactNode[] = [];
  let lastIdx = 0;
  let m: RegExpExecArray | null;

  while ((m = tokenRegex.exec(sanitized)) !== null) {
    if (m.index > lastIdx) {
      parts.push(sanitized.substring(lastIdx, m.index));
    }
    const token = m[1];
    parts.push(
      <span
        key={`fin-${baseKey}-${lastIdx}-${m.index}`}
        className="font-semibold text-[#1D1D1F] tracking-tight"
      >
        {token}
      </span>
    );
    lastIdx = tokenRegex.lastIndex;
  }

  if (lastIdx < sanitized.length) {
    parts.push(sanitized.substring(lastIdx));
  }

  return parts;
}

interface CategoryCardItem {
  category: string;
  amount: string;
  count?: string;
  merchants: string[];
}

interface KeyValueItem {
  key: string;
  value: string;
}

type ParsedBlock =
  | { type: "heading"; title: string; level: number }
  | { type: "divider" }
  | { type: "category_breakdown"; items: CategoryCardItem[] }
  | { type: "key_value_list"; items: KeyValueItem[] }
  | { type: "bullet_list"; items: string[] }
  | { type: "numbered_list"; items: string[] }
  | { type: "paragraph"; text: string };

/**
 * Parses raw markdown text into structured semantic blocks
 */
function parseMessageIntoBlocks(content: string): ParsedBlock[] {
  const lines = content.split("\n");
  const blocks: ParsedBlock[] = [];

  let i = 0;
  while (i < lines.length) {
    const rawLine = lines[i].trim();

    // Skip empty lines
    if (!rawLine) {
      i++;
      continue;
    }

    // 1. Dividers (--- or ***)
    if (/^(\-{3,}|\*{3,})$/.test(rawLine)) {
      blocks.push({ type: "divider" });
      i++;
      continue;
    }

    // 2. Headings (### Title, ## Title, # Title)
    const headingMatch = rawLine.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      let title = headingMatch[2].replace(/:$/, "").replace(/\*\*/g, "").trim();
      blocks.push({ type: "heading", title, level });
      i++;
      continue;
    }

    // 3. Category Breakdown Block Detection
    // Pattern: "* **Category:** **R$ 100** (N compras)" followed optionally by "* *Lançamentos:* Merchant1, Merchant2"
    if (
      rawLine.startsWith("*") &&
      (rawLine.includes("R$") || rawLine.includes("compra")) &&
      !rawLine.toLowerCase().includes("forma de pagamento") &&
      !rawLine.toLowerCase().includes("impacto") &&
      !rawLine.toLowerCase().includes("recomendação")
    ) {
      const categoryItems: CategoryCardItem[] = [];

      while (i < lines.length) {
        const line = lines[i].trim();
        if (!line.startsWith("*") && !line.startsWith("-")) break;

        // Check if this line is a category line
        const catMatch = line.match(/^[\*\-]\s*\*\*([^\*:]+):\*\*\s*(.+)$/);
        if (catMatch) {
          const category = catMatch[1].trim();
          const remainder = catMatch[2].trim();

          // Extract amount (e.g. R$ 167,50)
          const amtMatch = remainder.match(/R\$\s*[\d\.,]+/);
          const amount = amtMatch ? amtMatch[0] : "";

          // Extract count (e.g. 4 compras)
          const countMatch = remainder.match(/\((\d+\s*compras?)\)/i);
          const count = countMatch ? countMatch[1] : undefined;

          // Check if the next line has launch items (Lançamentos)
          let merchants: string[] = [];
          if (i + 1 < lines.length) {
            const nextLine = lines[i + 1].trim();
            if (
              nextLine.toLowerCase().includes("lançamentos:") ||
              nextLine.toLowerCase().includes("lancamentos:")
            ) {
              const merchantsStr = nextLine
                .replace(/^[\*\-]\s*\*?Lançamentos:\*?\s*/i, "")
                .replace(/^[\*\-]\s*\*?Lancamentos:\*?\s*/i, "")
                .replace(/\*+/g, "")
                .trim();

              if (merchantsStr) {
                merchants = merchantsStr
                  .split(/[,;]/)
                  .map((m) => m.trim().replace(/\.$/, ""))
                  .filter(Boolean);
              }
              i++; // consume next line as part of this category card
            }
          }

          categoryItems.push({ category, amount, count, merchants });
          i++;
        } else {
          break;
        }
      }

      if (categoryItems.length > 0) {
        blocks.push({ type: "category_breakdown", items: categoryItems });
        continue;
      }
    }

    // 4. Key-Value List Detection (e.g. * **Forma de Pagamento:** 100% no crédito...)
    const kvMatch = rawLine.match(/^[\*\-]\s*\*\*([^\*:]+):\*\*\s*(.+)$/);
    if (kvMatch) {
      const kvItems: KeyValueItem[] = [];

      while (i < lines.length) {
        const line = lines[i].trim();
        const m = line.match(/^[\*\-]\s*\*\*([^\*:]+):\*\*\s*(.+)$/);
        if (m) {
          kvItems.push({
            key: m[1].trim(),
            value: m[2].trim(),
          });
          i++;
        } else {
          break;
        }
      }

      if (kvItems.length > 0) {
        blocks.push({ type: "key_value_list", items: kvItems });
        continue;
      }
    }

    // 5. Numbered List (1. ...)
    if (/^\d+\.\s+/.test(rawLine)) {
      const numItems: string[] = [];
      while (i < lines.length) {
        const line = lines[i].trim();
        const m = line.match(/^\d+\.\s+(.+)$/);
        if (m) {
          numItems.push(m[1].trim());
          i++;
        } else {
          break;
        }
      }
      blocks.push({ type: "numbered_list", items: numItems });
      continue;
    }

    // 6. Regular Bullet List (* ... or - ...)
    if (/^[\*\-]\s+/.test(rawLine)) {
      const bulletItems: string[] = [];
      while (i < lines.length) {
        const line = lines[i].trim();
        const m = line.match(/^[\*\-]\s+(.+)$/);
        if (m) {
          bulletItems.push(m[1].trim());
          i++;
        } else {
          break;
        }
      }
      blocks.push({ type: "bullet_list", items: bulletItems });
      continue;
    }

    // 7. Regular Paragraph
    let paragraphText = rawLine;
    i++;
    while (i < lines.length) {
      const nextLine = lines[i].trim();
      if (
        !nextLine ||
        nextLine.startsWith("#") ||
        /^(\-{3,}|\*{3,})$/.test(nextLine) ||
        /^[\*\-]\s+/.test(nextLine) ||
        /^\d+\.\s+/.test(nextLine)
      ) {
        break;
      }
      paragraphText += " " + nextLine;
      i++;
    }

    blocks.push({ type: "paragraph", text: paragraphText });
  }

  return blocks;
}

export function FormattedMessage({ content, role = "assistant" }: FormattedMessageProps) {
  if (role === "user") {
    return <div className="whitespace-pre-line font-normal text-white">{content}</div>;
  }

  const blocks = parseMessageIntoBlocks(content);

  return (
    <div className="space-y-3.5 text-[#1D1D1F]">
      {blocks.map((block, idx) => {
        switch (block.type) {
          case "heading": {
            const titleLower = block.title.toLowerCase();
            let Icon = TrendingUp;
            if (titleLower.includes("categoria") || titleLower.includes("detalhamento")) {
              Icon = Layers;
            } else if (
              titleLower.includes("cfo") ||
              titleLower.includes("diagnóstico") ||
              titleLower.includes("parecer")
            ) {
              Icon = ShieldCheck;
            } else if (titleLower.includes("simula") || titleLower.includes("compra")) {
              Icon = Calculator;
            } else if (titleLower.includes("recomenda") || titleLower.includes("plano")) {
              Icon = ArrowRight;
            }

            return (
              <div key={idx} className="flex items-center gap-2 pt-1.5 pb-0.5 border-b border-black/[0.04]">
                <div className="w-5 h-5 rounded-md bg-[#1D1D1F] text-white flex items-center justify-center shrink-0 shadow-2xs">
                  <Icon size={12} />
                </div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#1D1D1F]">
                  {block.title}
                </h4>
              </div>
            );
          }

          case "divider":
            return <div key={idx} className="border-t border-black/[0.06] my-2" />;

          case "category_breakdown":
            return (
              <div key={idx} className="grid grid-cols-1 gap-2 pt-0.5">
                {block.items.map((cat, cIdx) => (
                  <div
                    key={cIdx}
                    className="p-3 rounded-2xl bg-white border border-black/[0.06] shadow-[0_1px_4px_rgba(0,0,0,0.02)] space-y-2 hover:border-black/15 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-xs text-[#1D1D1F]">
                          {cat.category}
                        </span>
                        {cat.count && (
                          <span className="text-[10px] font-medium text-[#86868B] bg-[#F2F2F7] px-2 py-0.5 rounded-full">
                            {cat.count}
                          </span>
                        )}
                      </div>

                      {cat.amount && (
                        <span className="text-xs font-bold text-[#1D1D1F] bg-emerald-50 text-emerald-800 border border-emerald-200/50 px-2.5 py-0.5 rounded-full">
                          {cat.amount}
                        </span>
                      )}
                    </div>

                    {cat.merchants && cat.merchants.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-0.5 border-t border-black/[0.03]">
                        <span className="text-[10px] font-medium text-[#86868B]">
                          Lançamentos:
                        </span>
                        {cat.merchants.map((m, mIdx) => (
                          <span
                            key={mIdx}
                            className="text-[10px] font-medium text-[#48484A] bg-[#F7F7FA] border border-black/[0.04] px-2 py-0.5 rounded-md"
                          >
                            {m}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            );

          case "key_value_list":
            return (
              <div key={idx} className="space-y-2 pt-0.5">
                {block.items.map((item, kIdx) => {
                  const keyLower = item.key.toLowerCase();
                  const isAlert = keyLower.includes("alerta") || keyLower.includes("risco");
                  const isCard = keyLower.includes("pagamento") || keyLower.includes("cartão");
                  const dotColor = isAlert ? "bg-amber-500" : isCard ? "bg-blue-600" : "bg-[#1D1D1F]";

                  return (
                    <div
                      key={kIdx}
                      className="p-3 rounded-2xl bg-white border border-black/[0.05] shadow-[0_1px_4px_rgba(0,0,0,0.02)] space-y-1"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                        <span className="text-[11px] font-bold text-[#1D1D1F] uppercase tracking-wide">
                          {item.key}
                        </span>
                      </div>
                      <div className="text-xs text-[#3A3A3C] leading-relaxed pl-3 font-normal">
                        {renderInlineContent(item.value)}
                      </div>
                    </div>
                  );
                })}
              </div>
            );

          case "bullet_list":
            return (
              <ul key={idx} className="space-y-1.5 pl-1 text-xs text-[#3A3A3C]">
                {block.items.map((item, bIdx) => (
                  <li key={bIdx} className="flex items-start gap-2 leading-relaxed">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#86868B] mt-1.5 shrink-0" />
                    <span>{renderInlineContent(item)}</span>
                  </li>
                ))}
              </ul>
            );

          case "numbered_list":
            return (
              <ol key={idx} className="space-y-2 pl-0.5 text-xs text-[#3A3A3C]">
                {block.items.map((item, nIdx) => (
                  <li key={nIdx} className="flex items-start gap-2.5 leading-relaxed">
                    <span className="w-4 h-4 rounded-full bg-[#1D1D1F] text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                      {nIdx + 1}
                    </span>
                    <span className="pt-0.5">{renderInlineContent(item)}</span>
                  </li>
                ))}
              </ol>
            );

          case "paragraph":
            return (
              <p
                key={idx}
                className="text-xs sm:text-[13px] text-[#1D1D1F] leading-relaxed font-normal"
              >
                {renderInlineContent(block.text)}
              </p>
            );

          default:
            return null;
        }
      })}
    </div>
  );
}
