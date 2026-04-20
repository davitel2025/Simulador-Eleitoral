import type { RegionName, StateInfo } from "../types";

export const REGIONS: RegionName[] = ["Norte", "Nordeste", "Centro-Oeste", "Sudeste", "Sul"];

// Votos válidos EXATOS por estado — dados oficiais TSE
// 2018: 2º turno — total nacional = 104.838.640 votos válidos (Bolsonaro × Haddad)
// 2022: 2º turno — total nacional = 118.552.353 votos válidos (Lula × Bolsonaro)
// 2026: projeção estimada (eleitorado ~3% acima de 2022)
// fator de ajuste ~0.80 aplicado manualmente

export const STATES: StateInfo[] = [
  // NORTE
  { uf: "AC", name: "Acre", region: "Norte", voters: 490000, voters2018: 381876, voters2022: 409316, ibgeCode: "12" },
  { uf: "AP", name: "Amapá", region: "Norte", voters: 454000, voters2018: 368712, voters2022: 390465, ibgeCode: "16" },
  { uf: "AM", name: "Amazonas", region: "Norte", voters: 2180000, voters2018: 1761246, voters2022: 1966732, ibgeCode: "13" },
  { uf: "PA", name: "Pará", region: "Norte", voters: 5010000, voters2018: 3854957, voters2022: 4582979, ibgeCode: "15" },
  { uf: "RO", name: "Rondônia", region: "Norte", voters: 1014000, voters2018: 824311, voters2022: 896140, ibgeCode: "11" },
  { uf: "RR", name: "Roraima", region: "Norte", voters: 302000, voters2018: 256140, voters2022: 280646, ibgeCode: "14" },
  { uf: "TO", name: "Tocantins", region: "Norte", voters: 902000, voters2018: 728277, voters2022: 846247, ibgeCode: "17" },

  // NORDESTE
  { uf: "AL", name: "Alagoas", region: "Nordeste", voters: 1916000, voters2018: 1522127, voters2022: 1664658, ibgeCode: "27" },
  { uf: "BA", name: "Bahia", region: "Nordeste", voters: 9304000, voters2018: 7545283, voters2022: 8454843, ibgeCode: "29" },
  { uf: "CE", name: "Ceará", region: "Nordeste", voters: 5616000, voters2018: 4792117, voters2022: 5442368, ibgeCode: "23" },
  { uf: "MA", name: "Maranhão", region: "Nordeste", voters: 4156000, voters2018: 3315478, voters2022: 3751174, ibgeCode: "21" },
  { uf: "PB", name: "Paraíba", region: "Nordeste", voters: 2549000, voters2018: 2233436, voters2022: 2404455, ibgeCode: "25" },
  { uf: "PE", name: "Pernambuco", region: "Nordeste", voters: 5785000, voters2018: 4959107, voters2022: 5439765, ibgeCode: "26" },
  { uf: "PI", name: "Piauí", region: "Nordeste", voters: 2121000, voters2018: 1839208, voters2022: 2018448, ibgeCode: "22" },
  { uf: "RN", name: "Rio Grande do Norte", region: "Nordeste", voters: 2105000, voters2018: 1783589, voters2022: 2038166, ibgeCode: "24" },
  { uf: "SE", name: "Sergipe", region: "Nordeste", voters: 1378000, voters2018: 1123921, voters2022: 1284037, ibgeCode: "28" },

  // CENTRO-OESTE
  { uf: "DF", name: "Distrito Federal", region: "Centro-Oeste", voters: 1815000, voters2018: 1543751, voters2022: 1770626, ibgeCode: "53" },
  { uf: "GO", name: "Goiás", region: "Centro-Oeste", voters: 4018000, voters2018: 3242799, voters2022: 3735156, ibgeCode: "52" },
  { uf: "MT", name: "Mato Grosso", region: "Centro-Oeste", voters: 2035000, voters2018: 1634825, voters2022: 1869516, ibgeCode: "51" },
  { uf: "MS", name: "Mato Grosso do Sul", region: "Centro-Oeste", voters: 1646000, voters2018: 1337074, voters2022: 1480153, ibgeCode: "50" },

  // SUDESTE
  { uf: "ES", name: "Espírito Santo", region: "Sudeste", voters: 2413000, voters2018: 2024379, voters2022: 2208912, ibgeCode: "32" },
  { uf: "MG", name: "Minas Gerais", region: "Sudeste", voters: 13420000, voters2018: 10483295, voters2022: 12332270, ibgeCode: "31" },
  { uf: "RJ", name: "Rio de Janeiro", region: "Sudeste", voters: 10570000, voters2018: 8342445, voters2022: 9560111, ibgeCode: "33" },
  { uf: "SP", name: "São Paulo", region: "Sudeste", voters: 28570000, voters2018: 22518155, voters2022: 25736469, ibgeCode: "35" },

  // SUL
  { uf: "PR", name: "Paraná", region: "Sul", voters: 6985000, voters2018: 6173206, voters2022: 6665948, ibgeCode: "41" },
  { uf: "RS", name: "Rio Grande do Sul", region: "Sul", voters: 7082000, voters2018: 6156908, voters2022: 6625036, ibgeCode: "43" },
  { uf: "SC", name: "Santa Catarina", region: "Sul", voters: 4524000, voters2018: 3906966, voters2022: 4399548, ibgeCode: "42" },
];

export const STATE_BY_UF = Object.fromEntries(
  STATES.map((state) => [state.uf, state]),
) as Record<string, StateInfo>;
