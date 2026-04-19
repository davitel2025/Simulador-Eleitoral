import type { PoliticalScenario } from "../types";

export const POLITICAL_SCENARIOS: PoliticalScenario[] = [
  {
    id: "2018",
    name: "Eleições 2018",
    year: 2018,
    description: "Resultado do 2º turno de 2018",
    candidates: [
      {
        name: "Jair Bolsonaro",
        vice: "Hamilton Mourão",
        party: "PSL",
        number: "17",
        color: "#1e40af",
        ideology: "Direita"
      },
      {
        name: "Fernando Haddad",
        vice: "Manuela D'Ávila",
        party: "PT",
        number: "13",
        color: "#dc2626",
        ideology: "Esquerda"
      }
    ],
    results: {
      "AC": { 1: 53.87, 2: 46.13 },
      "AL": { 1: 69.45, 2: 30.55 },
      "AM": { 1: 60.76, 2: 39.24 },
      "AP": { 1: 56.30, 2: 43.70 },
      "BA": { 1: 40.46, 2: 59.54 },
      "CE": { 1: 30.73, 2: 69.27 },
      "DF": { 1: 70.49, 2: 29.51 },
      "ES": { 1: 60.71, 2: 39.29 },
      "GO": { 1: 66.83, 2: 33.17 },
      "MA": { 1: 48.67, 2: 51.33 },
      "MG": { 1: 62.59, 2: 37.41 },
      "MS": { 1: 65.93, 2: 34.07 },
      "MT": { 1: 68.50, 2: 31.50 },
      "PA": { 1: 54.06, 2: 45.94 },
      "PB": { 1: 51.07, 2: 48.93 },
      "PE": { 1: 40.52, 2: 59.48 },
      "PI": { 1: 44.62, 2: 55.38 },
      "PR": { 1: 69.60, 2: 30.40 },
      "RJ": { 1: 66.19, 2: 33.81 },
      "RN": { 1: 54.78, 2: 45.22 },
      "RO": { 1: 68.37, 2: 31.63 },
      "RR": { 1: 75.51, 2: 24.49 },
      "RS": { 1: 65.29, 2: 34.71 },
      "SC": { 1: 78.04, 2: 21.96 },
      "SE": { 1: 57.90, 2: 42.10 },
      "SP": { 1: 60.69, 2: 39.31 },
      "TO": { 1: 64.06, 2: 35.94 }
    }
  },
  {
    id: "2022",
    name: "Eleições 2022",
    year: 2022,
    description: "Resultado do 2º turno de 2022",
    candidates: [
      {
        name: "Luiz Inácio Lula da Silva",
        vice: "Geraldo Alckmin",
        party: "PT",
        number: "13",
        color: "#dc2626",
        ideology: "Esquerda"
      },
      {
        name: "Jair Bolsonaro",
        vice: "Braga Netto",
        party: "PL",
        number: "22",
        color: "#1e40af",
        ideology: "Direita"
      }
    ],
    results: {
      "AC": { 1: 48.00, 2: 52.00 },
      "AL": { 1: 50.89, 2: 49.11 },
      "AM": { 1: 51.73, 2: 48.27 },
      "AP": { 1: 54.67, 2: 45.33 },
      "BA": { 1: 69.38, 2: 30.62 },
      "CE": { 1: 69.67, 2: 30.33 },
      "DF": { 1: 48.41, 2: 51.59 },
      "ES": { 1: 47.82, 2: 52.18 },
      "GO": { 1: 43.60, 2: 56.40 },
      "MA": { 1: 68.26, 2: 31.74 },
      "MG": { 1: 50.08, 2: 49.92 },
      "MS": { 1: 43.33, 2: 56.67 },
      "MT": { 1: 35.04, 2: 64.96 },
      "PA": { 1: 56.17, 2: 43.83 },
      "PB": { 1: 61.11, 2: 38.89 },
      "PE": { 1: 66.18, 2: 33.82 },
      "PI": { 1: 65.36, 2: 34.64 },
      "PR": { 1: 43.60, 2: 56.40 },
      "RJ": { 1: 55.03, 2: 44.97 },
      "RN": { 1: 58.55, 2: 41.45 },
      "RO": { 1: 40.66, 2: 59.34 },
      "RR": { 1: 24.29, 2: 75.71 },
      "RS": { 1: 44.82, 2: 55.18 },
      "SC": { 1: 30.70, 2: 69.30 },
      "SE": { 1: 65.98, 2: 34.02 },
      "SP": { 1: 48.18, 2: 51.82 },
      "TO": { 1: 44.28, 2: 55.72 }
    }
  },
  {
    id: "2026_simulado",
    name: "Projeção 2026",
    year: 2026,
    description: "Cenário simulado para 2026",
    candidates: [
      {
        name: "Candidato A",
        vice: "Vice A",
        party: "Partido A",
        number: "1",
        color: "#dc2626",
        ideology: "Centro-Esquerda"
      },
      {
        name: "Candidato B",
        vice: "Vice B",
        party: "Partido B",
        number: "2",
        color: "#1e40af",
        ideology: "Centro-Direita"
      }
    ]
  }
];