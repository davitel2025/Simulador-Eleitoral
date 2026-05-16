export type ElectorateProjectionRow = {
  uf: string;
  electorate2018: number;
  electorate2022: number;
  electorateLatest: number;
  projectedElectorate2026: number;
  growthRate2022To2026: number;
};

export const ELECTORATE_PROJECTION_SOURCE = {
  historical2018:
    "TSE Dados Abertos - Eleitorado 2018 / perfil_eleitorado_2018.csv",
  historical2018Url: "https://dadosabertos.tse.jus.br/dataset/eleitorado-2018",
  historical2022:
    "TSE Dados Abertos - Eleitorado 2022 / perfil_eleitorado_2022.csv",
  historical2022Url: "https://dadosabertos.tse.jus.br/dataset/eleitorado-2022",
  latest:
    "TSE Dados Abertos - Eleitorado Atual / perfil_eleitorado_ATUAL.csv",
  latestUrl: "https://dadosabertos.tse.jus.br/dataset/eleitorado-atual",
  latestGeneratedAt: "01/05/2026 06:48:31",
  note:
    "projectedElectorate2026 usa o snapshot oficial mais recente do TSE como projecao ate a publicacao do eleitorado final das eleicoes de 2026.",
} as const;

const ELECTORATE_PROJECTION_INPUT = [
  { uf: "AC", electorate2018: 547680, electorate2022: 588433, electorateLatest: 609390 },
  { uf: "AL", electorate2018: 2187967, electorate2022: 2325656, electorateLatest: 2422681 },
  { uf: "AM", electorate2018: 2428098, electorate2022: 2647748, electorateLatest: 2792400 },
  { uf: "AP", electorate2018: 512110, electorate2022: 550687, electorateLatest: 570554 },
  { uf: "BA", electorate2018: 10393170, electorate2022: 11291528, electorateLatest: 11228794 },
  { uf: "CE", electorate2018: 6344483, electorate2022: 6820673, electorateLatest: 6944142 },
  { uf: "DF", electorate2018: 2084356, electorate2022: 2203045, electorateLatest: 2226439 },
  { uf: "ES", electorate2018: 2754728, electorate2022: 2921506, electorateLatest: 2970151 },
  { uf: "GO", electorate2018: 4454497, electorate2022: 4870354, electorateLatest: 5037772 },
  { uf: "MA", electorate2018: 4537237, electorate2022: 5042999, electorateLatest: 5141988 },
  { uf: "MG", electorate2018: 15700966, electorate2022: 16290870, electorateLatest: 16307287 },
  { uf: "MS", electorate2018: 1877982, electorate2022: 1996510, electorateLatest: 2004323 },
  { uf: "MT", electorate2018: 2330281, electorate2022: 2469414, electorateLatest: 2616959 },
  { uf: "PA", electorate2018: 5499283, electorate2022: 6082312, electorateLatest: 6217772 },
  { uf: "PB", electorate2018: 2867649, electorate2022: 3091684, electorateLatest: 3218795 },
  { uf: "PE", electorate2018: 6570072, electorate2022: 7018098, electorateLatest: 7196813 },
  { uf: "PI", electorate2018: 2370894, electorate2022: 2573810, electorateLatest: 2684774 },
  { uf: "PR", electorate2018: 7971087, electorate2022: 8475632, electorateLatest: 8550233 },
  { uf: "RJ", electorate2018: 12408340, electorate2022: 12827296, electorateLatest: 12783408 },
  { uf: "RN", electorate2018: 2373619, electorate2022: 2554727, electorateLatest: 2641263 },
  { uf: "RO", electorate2018: 1175733, electorate2022: 1230987, electorateLatest: 1261061 },
  { uf: "RR", electorate2018: 333464, electorate2022: 366240, electorateLatest: 395369 },
  { uf: "RS", electorate2018: 8354732, electorate2022: 8593469, electorateLatest: 8487805 },
  { uf: "SC", electorate2018: 5070212, electorate2022: 5489658, electorateLatest: 5670906 },
  { uf: "SE", electorate2018: 1577058, electorate2022: 1671801, electorateLatest: 1727601 },
  { uf: "SP", electorate2018: 33040411, electorate2022: 34667793, electorateLatest: 33901649 },
  { uf: "TO", electorate2018: 1039439, electorate2022: 1094003, electorateLatest: 1171387 },
] as const;

export const ELECTORATE_PROJECTION: ElectorateProjectionRow[] =
  ELECTORATE_PROJECTION_INPUT.map((row) => ({
    ...row,
    projectedElectorate2026: row.electorateLatest,
    growthRate2022To2026:
      row.electorate2022 > 0
        ? row.electorateLatest / row.electorate2022 - 1
        : 0,
  }));

export const ELECTORATE_PROJECTION_BY_UF = Object.fromEntries(
  ELECTORATE_PROJECTION.map((row) => [row.uf, row]),
) as Record<string, ElectorateProjectionRow>;

export const DEFAULT_PROJECTED_ELECTORATE_2026 =
  ELECTORATE_PROJECTION.reduce(
    (sum, row) => sum + row.projectedElectorate2026,
    0,
  );
