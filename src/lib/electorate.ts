import {
  DEFAULT_PROJECTED_ELECTORATE_2026,
  ELECTORATE_PROJECTION_BY_UF,
} from "../data/electorateProjection";

export function getProjectedElectorateWeightByUF(uf: string): number {
  return ELECTORATE_PROJECTION_BY_UF[uf]?.projectedElectorate2026 ?? 0;
}

export function distributeNationalElectorate(
  total: number,
  selectedUFs: string[],
): Record<string, number> {
  const safeTotal = Math.max(0, Math.round(Number.isFinite(total) ? total : 0));
  const weightedUFs = selectedUFs
    .map((uf, index) => ({
      uf,
      index,
      weight: getProjectedElectorateWeightByUF(uf),
    }))
    .filter((item) => item.weight > 0);

  const totalWeight = weightedUFs.reduce((sum, item) => sum + item.weight, 0);
  if (safeTotal === 0 || totalWeight === 0) return {};

  const rows = weightedUFs.map((item) => {
    const exact = (item.weight / totalWeight) * safeTotal;
    const base = Math.floor(exact);
    return {
      ...item,
      exact,
      base,
      remainder: exact - base,
    };
  });

  const result: Record<string, number> = {};
  rows.forEach((row) => {
    result[row.uf] = row.base;
  });

  let diff = safeTotal - rows.reduce((sum, row) => sum + row.base, 0);
  [...rows]
    .sort((a, b) => {
      if (b.remainder !== a.remainder) return b.remainder - a.remainder;
      return a.index - b.index;
    })
    .forEach((row) => {
      if (diff <= 0) return;
      result[row.uf] += 1;
      diff -= 1;
    });

  return result;
}

export function getDefaultProjectedNationalElectorate(): number {
  return DEFAULT_PROJECTED_ELECTORATE_2026;
}
