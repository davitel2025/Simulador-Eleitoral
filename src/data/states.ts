import type { RegionName, StateInfo } from "../types";
import { ELECTORATE_PROJECTION_BY_UF } from "./electorateProjection";

export const REGIONS: RegionName[] = ["Norte", "Nordeste", "Centro-Oeste", "Sudeste", "Sul"];

const STATE_METADATA = [
  { uf: "AC", name: "Acre", region: "Norte", ibgeCode: "12" },
  { uf: "AP", name: "Amapa", region: "Norte", ibgeCode: "16" },
  { uf: "AM", name: "Amazonas", region: "Norte", ibgeCode: "13" },
  { uf: "PA", name: "Para", region: "Norte", ibgeCode: "15" },
  { uf: "RO", name: "Rondonia", region: "Norte", ibgeCode: "11" },
  { uf: "RR", name: "Roraima", region: "Norte", ibgeCode: "14" },
  { uf: "TO", name: "Tocantins", region: "Norte", ibgeCode: "17" },

  { uf: "AL", name: "Alagoas", region: "Nordeste", ibgeCode: "27" },
  { uf: "BA", name: "Bahia", region: "Nordeste", ibgeCode: "29" },
  { uf: "CE", name: "Ceara", region: "Nordeste", ibgeCode: "23" },
  { uf: "MA", name: "Maranhao", region: "Nordeste", ibgeCode: "21" },
  { uf: "PB", name: "Paraiba", region: "Nordeste", ibgeCode: "25" },
  { uf: "PE", name: "Pernambuco", region: "Nordeste", ibgeCode: "26" },
  { uf: "PI", name: "Piaui", region: "Nordeste", ibgeCode: "22" },
  { uf: "RN", name: "Rio Grande do Norte", region: "Nordeste", ibgeCode: "24" },
  { uf: "SE", name: "Sergipe", region: "Nordeste", ibgeCode: "28" },

  { uf: "DF", name: "Distrito Federal", region: "Centro-Oeste", ibgeCode: "53" },
  { uf: "GO", name: "Goias", region: "Centro-Oeste", ibgeCode: "52" },
  { uf: "MT", name: "Mato Grosso", region: "Centro-Oeste", ibgeCode: "51" },
  { uf: "MS", name: "Mato Grosso do Sul", region: "Centro-Oeste", ibgeCode: "50" },

  { uf: "ES", name: "Espirito Santo", region: "Sudeste", ibgeCode: "32" },
  { uf: "MG", name: "Minas Gerais", region: "Sudeste", ibgeCode: "31" },
  { uf: "RJ", name: "Rio de Janeiro", region: "Sudeste", ibgeCode: "33" },
  { uf: "SP", name: "Sao Paulo", region: "Sudeste", ibgeCode: "35" },

  { uf: "PR", name: "Parana", region: "Sul", ibgeCode: "41" },
  { uf: "RS", name: "Rio Grande do Sul", region: "Sul", ibgeCode: "43" },
  { uf: "SC", name: "Santa Catarina", region: "Sul", ibgeCode: "42" },
] as const satisfies ReadonlyArray<{
  uf: string;
  name: string;
  region: RegionName;
  ibgeCode: string;
}>;

// Os nomes legacy voters/voters2018/voters2022 representam eleitorado apto,
// nao votos validos. A distribuicao de votos por candidato continua separada.
export const STATES: StateInfo[] = STATE_METADATA.map((state) => {
  const projection = ELECTORATE_PROJECTION_BY_UF[state.uf];
  return {
    ...state,
    voters: projection.projectedElectorate2026,
    voters2018: projection.electorate2018,
    voters2022: projection.electorate2022,
  };
});

export const STATE_BY_UF = Object.fromEntries(
  STATES.map((state) => [state.uf, state]),
) as Record<string, StateInfo>;
