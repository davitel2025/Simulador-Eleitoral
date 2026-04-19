import type { CandidateId } from "../types";

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function normalizeName(value: string): string {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").trim();
}

export function getWinner(votes: Record<CandidateId, number>): CandidateId | null {
  const entries = Object.entries(votes).map(([id, pct]) => ({ id: Number(id), pct }));
  if (entries.length === 0) return null;
  entries.sort((a, b) => b.pct - a.pct);
  if (entries.length > 1 && entries[0].pct === entries[1].pct) return null;
  return entries[0].id;
}

export function formatPct(value: number): string {
  return `${value.toFixed(2)}%`;
}

export function readFileAsBase64(file: File, onDone: (result: string) => void): void {
  const reader = new FileReader();
  reader.onload = (event) => {
    const content = String(event.target?.result ?? "");
    if (content) onDone(content);
  };
  reader.readAsDataURL(file);
}

export function normalizeVotesForCandidates(
  rawVotes: Record<CandidateId, number>,
  candidateIds: CandidateId[],
): Record<CandidateId, number> {
  const filtered: Record<CandidateId, number> = {};
  let total = 0;
  for (const id of candidateIds) {
    const value = Number(rawVotes[id] ?? 0);
    filtered[id] = value;
    total += value;
  }
  if (total <= 0) {
    const equalShare = 100 / candidateIds.length;
    for (const id of candidateIds) filtered[id] = equalShare;
    return filtered;
  }
  for (const id of candidateIds) filtered[id] = (filtered[id] / total) * 100;
  return filtered;
}
