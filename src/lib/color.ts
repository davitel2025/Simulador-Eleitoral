import { clamp } from "./utils";

export function shadeHex(hex: string, amount: number, target: "black" | "white"): string {
  const normalized = hex.startsWith("#") ? hex.slice(1) : hex;
  const full = normalized.length === 3
    ? normalized.split("").map((value) => value + value).join("")
    : normalized;
  const r = Number.parseInt(full.slice(0, 2), 16);
  const g = Number.parseInt(full.slice(2, 4), 16);
  const b = Number.parseInt(full.slice(4, 6), 16);
  const targetValue = target === "black" ? 0 : 255;
  const rn = Math.round(r + (targetValue - r) * amount).toString(16).padStart(2, "0");
  const gn = Math.round(g + (targetValue - g) * amount).toString(16).padStart(2, "0");
  const bn = Math.round(b + (targetValue - b) * amount).toString(16).padStart(2, "0");
  return `#${rn}${gn}${bn}`;
}

export function getColorByWinnerPct(baseColor: string, winnerPct: number): string {
  const pct = clamp(winnerPct, 0, 100);
  if (pct <= 50) return shadeHex(baseColor, 0.56, "white");
  if (pct < 60) return shadeHex(baseColor, 0.35, "white");
  const intensity = clamp((pct - 60) / 40, 0, 1);
  return shadeHex(baseColor, 0.1 + intensity * 0.7, "black");
}
