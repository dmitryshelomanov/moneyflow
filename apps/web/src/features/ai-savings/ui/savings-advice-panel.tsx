import { formatMoney } from "@moneyflow/shared";
import type { SavingsAdviceResponse } from "@moneyflow/shared";
import { GlassCard } from "@/shared/ui/glass-card";

type Props = {
  advice: SavingsAdviceResponse;
};

const impactLabel: Record<"low" | "medium" | "high", string> = {
  low: "Низкий",
  medium: "Средний",
  high: "Высокий",
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function rationaleToHtml(rationale: string) {
  return rationale
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join("");
}

function sanitizeAdviceHtml(rawHtml: string) {
  if (typeof window === "undefined") return rationaleToHtml(rawHtml);
  const parser = new DOMParser();
  const doc = parser.parseFromString(rawHtml, "text/html");
  const allowedTags = new Set(["P", "UL", "LI", "STRONG", "EM", "BR"]);

  const sanitizeNode = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) {
      return escapeHtml(node.textContent ?? "");
    }
    if (!(node instanceof HTMLElement)) return "";
    if (!allowedTags.has(node.tagName)) {
      return [...node.childNodes].map(sanitizeNode).join("");
    }
    const tag = node.tagName.toLowerCase();
    const content = [...node.childNodes].map(sanitizeNode).join("");
    if (tag === "br") return "<br>";
    return `<${tag}>${content}</${tag}>`;
  };

  return [...doc.body.childNodes].map(sanitizeNode).join("");
}

export function SavingsAdvicePanel({ advice }: Props) {
  return (
    <GlassCard className="space-y-3">
      <div>
        <h2 className="font-display text-xl text-black">Где сэкономить</h2>
        <p className="text-xs text-black/55">
          Период: {advice.period.from} - {advice.period.to}
        </p>
      </div>

      {advice.tips.length === 0 ? (
        <p className="text-sm text-black/65">
          Пока нет явных рекомендаций для этого периода.
        </p>
      ) : (
        <ul className="space-y-2">
          {advice.tips.map((tip, index) => (
            <li
              key={`${tip.title}-${index}`}
              className="rounded-2xl border-2 border-black/15 bg-white/55 p-3"
            >
              <div className="text-sm font-semibold text-black">
                {tip.title}
              </div>
              <div className="mt-1 text-xs text-black/70">
                Влияние: {impactLabel[tip.impact]}
                {tip.category ? ` · Категория: ${tip.category}` : ""}
                {tip.estimatedSaving != null
                  ? ` · Потенциал: ${tip.estimatedSavingFormatted ?? formatMoney(tip.estimatedSaving, advice.currency)}`
                  : ""}
              </div>
              <div
                className="mt-2 space-y-1 text-sm text-black/80 [&>p]:leading-relaxed"
                dangerouslySetInnerHTML={{
                  __html: tip.detailsHtml
                    ? sanitizeAdviceHtml(tip.detailsHtml)
                    : rationaleToHtml(tip.rationale),
                }}
              />
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-black/50">{advice.disclaimer}</p>
    </GlassCard>
  );
}
