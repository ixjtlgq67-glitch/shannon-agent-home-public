export function formatUsd(value: number | null): string {
  if (value === null) return "Not available";
  if (value === 0) return "$0.00";
  if (Math.abs(value) < 0.01) return `$${value.toFixed(6)}`;
  return `$${value.toFixed(4)}`;
}

export function formatRate(value: number | null): string {
  if (value === null) return "Not available";
  return `${Math.round(value * 1000) / 10}%`;
}

export function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
