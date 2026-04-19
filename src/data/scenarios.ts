import type { PoliticalScenario } from "../types";

// Dados oficiais TSE — 2º turno
// 2018: Bolsonaro × Haddad — 104.820.213 votos válidos nacionais
// 2022: Lula × Bolsonaro   — 118.228.673 votos válidos nacionais
//
// As porcentagens abaixo são dos votos VÁLIDOS por estado (fonte: TSE).
// Os votos absolutos são calculados em ElectionSimulator usando
// voters2018 / voters2022 de states.ts (votos válidos reais por estado).

export const POLITICAL_SCENARIOS: PoliticalScenario[] = [
  // ─────────────────────────────────────────────────────────────────────────
  // ELEIÇÕES 2018 — 2º TURNO
  // Bolsonaro (PSL) = candidato 1  |  Haddad (PT) = candidato 2
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "2018",
    name: "Eleições 2018",
    year: 2018,
    description: "Resultado do 2º turno de 2018 (Dados oficiais TSE)",
    candidates: [
      {
        name: "Jair Bolsonaro",
        vice: "Hamilton Mourão",
        party: "PSL",
        number: "17",
        color: "#1e40af",
        ideology: "Direita",
        photo:
          "https://upload.wikimedia.org/wikipedia/commons/d/d0/Jair_Bolsonaro_pela_EC_77_-M%C3%A9dico_Militar_no_SUS%28cropped%29.jpg",
      },
      {
        name: "Fernando Haddad",
        vice: "Manuela D'Ávila",
        party: "PT",
        number: "13",
        color: "#dc2626",
        ideology: "Esquerda",
        photo:
          "https://www.fenajufe.org.br/wp-content/uploads/2018/10/0001hADDAD19OUT2018.jpg",
      },
    ],
    // Porcentagens dos votos válidos — fonte TSE (2º turno 28/10/2018)
    results: {
      "AC": { 1: 77.22, 2: 22.78 },
      "AL": { 1: 40.08, 2: 59.92 },
      "AP": { 1: 50.20, 2: 49.80 },
      "AM": { 1: 50.27, 2: 49.73 },
      "BA": { 1: 27.31, 2: 72.69 },
      "CE": { 1: 28.89, 2: 71.11 },
      "DF": { 1: 69.99, 2: 30.01 },
      "ES": { 1: 63.06, 2: 36.94 },
      "GO": { 1: 65.52, 2: 34.48 },
      "MA": { 1: 26.74, 2: 73.26 },
      "MG": { 1: 58.19, 2: 41.81 },
      "MS": { 1: 65.22, 2: 34.78 },
      "MT": { 1: 66.42, 2: 33.58 },
      "PA": { 1: 45.19, 2: 54.81 },
      "PB": { 1: 35.02, 2: 64.98 },
      "PE": { 1: 33.50, 2: 66.50 },
      "PI": { 1: 22.95, 2: 77.05 },
      "PR": { 1: 68.43, 2: 31.57 },
      "RJ": { 1: 67.95, 2: 32.05 },
      "RN": { 1: 36.59, 2: 63.41 },
      "RO": { 1: 72.18, 2: 27.82 },
      "RR": { 1: 71.55, 2: 28.45 },
      "RS": { 1: 63.24, 2: 36.76 },
      "SC": { 1: 75.92, 2: 24.08 },
      "SE": { 1: 32.46, 2: 67.54 },
      "SP": { 1: 67.97, 2: 32.03 },
      "TO": { 1: 48.98, 2: 51.02 },
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // ELEIÇÕES 2022 — 2º TURNO
  // Lula (PT) = candidato 1  |  Bolsonaro (PL) = candidato 2
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "2022",
    name: "Eleições 2022",
    year: 2022,
    description: "Resultado do 2º turno de 2022 (Dados oficiais TSE)",
    candidates: [
      {
        name: "Luiz Inácio Lula da Silva",
        vice: "Geraldo Alckmin",
        party: "PT",
        number: "13",
        color: "#dc2626",
        ideology: "Esquerda",
        photo:
          "https://s2-valor.glbimg.com/hrCeXhkq6K3qhOcxCsmmNsXftjQ=/0x0:2775x1850/924x0/smart/filters:strip_icc()/i.s3.glbimg.com/v1/AUTH_63b422c2caee4269b8b34177e8876b93/internal_photos/bs/2022/R/N/KYBjTgRyO1r8ibD8RmUA/c158e26e504b4ba88530ec867cb099f5-9624a.jpg",
      },
      {
        name: "Jair Bolsonaro",
        vice: "Braga Netto",
        party: "PL",
        number: "22",
        color: "#1e40af",
        ideology: "Direita",
        photo:
          "https://upload.wikimedia.org/wikipedia/commons/3/33/Jair_Bolsonaro_2022_%28cropped%29.jpg",
      },
    ],
    // Porcentagens dos votos válidos — fonte TSE (2º turno 30/10/2022)
    results: {
      "AC": { 1: 29.70, 2: 70.30 },
      "AL": { 1: 58.68, 2: 41.32 },
      "AP": { 1: 48.64, 2: 51.36 },
      "AM": { 1: 51.10, 2: 48.90 },
      "BA": { 1: 72.12, 2: 27.88 },
      "CE": { 1: 69.97, 2: 30.03 },
      "DF": { 1: 41.19, 2: 58.81 },
      "ES": { 1: 41.96, 2: 58.04 },
      "GO": { 1: 41.29, 2: 58.71 },
      "MA": { 1: 71.14, 2: 28.86 },
      "MG": { 1: 50.20, 2: 49.80 },
      "MS": { 1: 40.51, 2: 59.49 },
      "MT": { 1: 34.92, 2: 65.08 },
      "PA": { 1: 54.75, 2: 45.25 },
      "PB": { 1: 66.62, 2: 33.38 },
      "PE": { 1: 66.93, 2: 33.07 },
      "PI": { 1: 76.86, 2: 23.14 },
      "PR": { 1: 37.60, 2: 62.40 },
      "RJ": { 1: 43.47, 2: 56.53 },
      "RN": { 1: 65.10, 2: 34.90 },
      "RO": { 1: 29.34, 2: 70.66 },
      "RR": { 1: 23.92, 2: 76.08 },
      "RS": { 1: 43.65, 2: 56.35 },
      "SC": { 1: 30.73, 2: 69.27 },
      "SE": { 1: 67.21, 2: 32.79 },
      "SP": { 1: 44.76, 2: 55.24 },
      "TO": { 1: 51.36, 2: 48.64 },
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // PROJEÇÃO 2026 — cenário simulado
  // ─────────────────────────────────────────────────────────────────────────
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
        ideology: "Centro-Esquerda",
      },
      {
        name: "Candidato B",
        vice: "Vice B",
        party: "Partido B",
        number: "2",
        color: "#1e40af",
        ideology: "Centro-Direita",
      },
    ],
  },
];
