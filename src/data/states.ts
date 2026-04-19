import type { RegionName, StateInfo } from "../types";

export const REGIONS: RegionName[] = ["Norte", "Nordeste", "Centro-Oeste", "Sudeste", "Sul"];

export const STATES: StateInfo[] = [
  { uf: "AC", name: "Acre", region: "Norte", voters: 588433, ibgeCode: "12" },
  { uf: "AL", name: "Alagoas", region: "Nordeste", voters: 2325656, ibgeCode: "27" },
  { uf: "AP", name: "Amapa", region: "Norte", voters: 550696, ibgeCode: "16" },
  { uf: "AM", name: "Amazonas", region: "Norte", voters: 2647748, ibgeCode: "13" },
  { uf: "BA", name: "Bahia", region: "Nordeste", voters: 11291528, ibgeCode: "29" },
  { uf: "CE", name: "Ceara", region: "Nordeste", voters: 6813332, ibgeCode: "23" },
  { uf: "DF", name: "Distrito Federal", region: "Centro-Oeste", voters: 2203045, ibgeCode: "53" },
  { uf: "ES", name: "Espirito Santo", region: "Sudeste", voters: 2928087, ibgeCode: "32" },
  { uf: "GO", name: "Goias", region: "Centro-Oeste", voters: 4877114, ibgeCode: "52" },
  { uf: "MA", name: "Maranhao", region: "Nordeste", voters: 5042999, ibgeCode: "21" },
  { uf: "MT", name: "Mato Grosso", region: "Centro-Oeste", voters: 2469414, ibgeCode: "51" },
  { uf: "MS", name: "Mato Grosso do Sul", region: "Centro-Oeste", voters: 1996510, ibgeCode: "50" },
  { uf: "MG", name: "Minas Gerais", region: "Sudeste", voters: 16290870, ibgeCode: "31" },
  { uf: "PA", name: "Para", region: "Norte", voters: 6082312, ibgeCode: "15" },
  { uf: "PB", name: "Paraiba", region: "Nordeste", voters: 3091684, ibgeCode: "25" },
  { uf: "PR", name: "Parana", region: "Sul", voters: 8475632, ibgeCode: "41" },
  { uf: "PE", name: "Pernambuco", region: "Nordeste", voters: 7018098, ibgeCode: "26" },
  { uf: "PI", name: "Piaui", region: "Nordeste", voters: 2573810, ibgeCode: "22" },
  { uf: "RJ", name: "Rio de Janeiro", region: "Sudeste", voters: 12827296, ibgeCode: "33" },
  { uf: "RN", name: "Rio Grande do Norte", region: "Nordeste", voters: 2554722, ibgeCode: "24" },
  { uf: "RS", name: "Rio Grande do Sul", region: "Sul", voters: 8593452, ibgeCode: "43" },
  { uf: "RO", name: "Rondonia", region: "Norte", voters: 1230987, ibgeCode: "11" },
  { uf: "RR", name: "Roraima", region: "Norte", voters: 366240, ibgeCode: "14" },
  { uf: "SC", name: "Santa Catarina", region: "Sul", voters: 5489658, ibgeCode: "42" },
  { uf: "SP", name: "Sao Paulo", region: "Sudeste", voters: 34667793, ibgeCode: "35" },
  { uf: "SE", name: "Sergipe", region: "Nordeste", voters: 1671801, ibgeCode: "28" },
  { uf: "TO", name: "Tocantins", region: "Norte", voters: 1094003, ibgeCode: "17" },
];

export const STATE_BY_UF = Object.fromEntries(
  STATES.map((state) => [state.uf, state]),
) as Record<string, StateInfo>;
