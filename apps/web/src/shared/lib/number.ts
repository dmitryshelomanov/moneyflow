export function parseDecimalInput(value: string) {
  const normalized = value.replace(/\s+/g, "").replace(",", ".").trim();
  if (!normalized) return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}
