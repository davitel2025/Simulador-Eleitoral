import type { Candidate, PoliticalScenario } from "../types";
import { CANDIDATE_IMAGES, PARTY_LOGOS } from "./presetCandidates";
import primeirTurno2026 from "../data_cenarios/primeiro_turno_2026.json";
import segundoTurno2026 from "../data_cenarios/segundo_turno_2026.json";

type ScenarioResultsInput = Record<string, Record<number, number> | { votes: Record<number, number> }>;

function normalizeScenarioResults(
  results: ScenarioResultsInput
): Record<string, Record<number, number>> {
  return Object.fromEntries(
    Object.entries(results).map(([uf, result]) => [
      uf,
      "votes" in result ? result.votes : result,
    ])
  );
}

const primeiroTurno2026Scenario = {
  id: "2026_1t",
  name: "Projecao 2026 - 1o Turno",
  year: 2026,
  description: "Cenario de 1o turno de 2026 importado de JSON.",
  ...primeirTurno2026,
  round: "primeiro",
  results: normalizeScenarioResults(primeirTurno2026.results),
} as unknown as PoliticalScenario;

const segundoTurno2026Scenario = {
  id: "2026_2t",
  name: "Projecao 2026 - 2o Turno",
  year: 2026,
  description: "Cenario de 2o turno de 2026 importado de JSON.",
  ...segundoTurno2026,
  round: "segundo",
  results: normalizeScenarioResults(segundoTurno2026.results),
} as unknown as PoliticalScenario;

function getHistoricalAssets(
  scenarioId: string,
  candidate: Omit<Candidate, "id">
): Partial<Omit<Candidate, "id">> {
  const partyNumber = `${candidate.party}:${candidate.number}`;

  if (scenarioId === "2018" || scenarioId === "2018_1t") {
    if (partyNumber === "PSL:17") {
      return {
        photo: scenarioId === "2018_1t" ? CANDIDATE_IMAGES.jairBolsonaro2018 : CANDIDATE_IMAGES.jairBolsonaro,
        vicePhoto: CANDIDATE_IMAGES.hamiltonMourao,
        partyLogo: PARTY_LOGOS.psl,
      };
    }
    if (partyNumber === "PT:13") {
      return {
        photo: CANDIDATE_IMAGES.fernandoHaddad,
        vicePhoto: CANDIDATE_IMAGES.manuelaDavila,
        partyLogo: PARTY_LOGOS.pt,
      };
    }
  }

  if (scenarioId === "2022" || scenarioId === "2022_1t") {
    if (partyNumber === "PT:13") {
      return {
        photo: CANDIDATE_IMAGES.lula,
        vicePhoto: CANDIDATE_IMAGES.geraldoAlckmin,
        partyLogo: PARTY_LOGOS.pt,
      };
    }
    if (partyNumber === "PL:22") {
      return {
        photo: CANDIDATE_IMAGES.jairBolsonaro,
        vicePhoto: CANDIDATE_IMAGES.bragaNetto,
        partyLogo: PARTY_LOGOS.pl,
      };
    }
  }

  if (scenarioId === "2018_1t") {
    if (partyNumber === "PDT:12") {
      return { photo: CANDIDATE_IMAGES.ciroGomes, partyLogo: PARTY_LOGOS.pdt };
    }
    if (partyNumber === "PSDB:45") {
      return { photo: CANDIDATE_IMAGES.geraldoAlckmin, partyLogo: PARTY_LOGOS.psdb };
    }
    if (partyNumber === "NOVO:30") {
      return { photo: CANDIDATE_IMAGES.joaoAmoedo, partyLogo: PARTY_LOGOS.novo };
    }
  }

  if (scenarioId === "2022_1t") {
    if (partyNumber === "MDB:15") {
      return {
        photo: CANDIDATE_IMAGES.simoneTebet,
        vicePhoto: CANDIDATE_IMAGES.maraGabrilli,
        partyLogo: PARTY_LOGOS.mdb,
      };
    }
    if (partyNumber === "PDT:12") {
      return { photo: CANDIDATE_IMAGES.ciroGomes, partyLogo: PARTY_LOGOS.pdt };
    }
  }

  return {};
}

function withHistoricalAssets(scenario: PoliticalScenario): PoliticalScenario {
  if (!["2018", "2022", "2018_1t", "2022_1t"].includes(scenario.id)) {
    return scenario;
  }

  return {
    ...scenario,
    candidates: scenario.candidates.map((candidate) => ({
      ...candidate,
      ...getHistoricalAssets(scenario.id, candidate),
    })),
  };
}

// Dados oficiais TSE — 2º turno
// 2018: Bolsonaro × Haddad — 104.820.213 votos válidos nacionais
// 2022: Lula × Bolsonaro   — 118.228.673 votos válidos nacionais
//
// As porcentagens abaixo são dos votos VÁLIDOS por estado (fonte: TSE).
// Os votos absolutos são calculados em ElectionSimulator usando
// voters2018 / voters2022 de states.ts (votos válidos reais por estado).

const RAW_POLITICAL_SCENARIOS: PoliticalScenario[] = [
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
        photo: CANDIDATE_IMAGES.jairBolsonaro,
        vicePhoto: CANDIDATE_IMAGES.hamiltonMourao,
        partyLogo: PARTY_LOGOS.psl,
      },
      {
        name: "Fernando Haddad",
        vice: "Manuela D'Ávila",
        party: "PT",
        number: "13",
        color: "#dc2626",
        ideology: "Esquerda",
        photo: CANDIDATE_IMAGES.fernandoHaddad,
        vicePhoto: CANDIDATE_IMAGES.manuelaDavila,
        partyLogo: PARTY_LOGOS.pt,
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
        photo: CANDIDATE_IMAGES.lula,
        vicePhoto: CANDIDATE_IMAGES.geraldoAlckmin,
        partyLogo: PARTY_LOGOS.pt,
      },
      {
        name: "Jair Bolsonaro",
        vice: "Braga Netto",
        party: "PL",
        number: "22",
        color: "#1e40af",
        ideology: "Direita",
        photo: CANDIDATE_IMAGES.jairBolsonaro,
        vicePhoto: CANDIDATE_IMAGES.bragaNetto,
        partyLogo: PARTY_LOGOS.pl,
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
    id: "2018_1t",
    name: "Eleições 2018 — 1º Turno",
    year: 2018,
    round: "primeiro",
    description: "Resultado do 1º turno de 2018 (Dados oficiais TSE — 7/10/2018)",
    candidates: [
      { name: "Jair Bolsonaro", vice: "Hamilton Mourão", party: "PSL", number: "17", color: "#1e40af", ideology: "Direita", photo: CANDIDATE_IMAGES.jairBolsonaro2018, vicePhoto: CANDIDATE_IMAGES.hamiltonMourao, partyLogo: PARTY_LOGOS.psl, coalition: "Brasil Acima de Tudo, Deus Acima de Todos" },
      { name: "Fernando Haddad", vice: "Manuela D'Ávila", party: "PT", number: "13", color: "#dc2626", ideology: "Esquerda", photo: CANDIDATE_IMAGES.fernandoHaddad, vicePhoto: CANDIDATE_IMAGES.manuelaDavila, partyLogo: PARTY_LOGOS.pt, coalition: "O Povo Feliz de Novo" },
      { name: "Ciro Gomes", vice: "Kátia Abreu", party: "PDT", number: "12", color: "#f97316", ideology: "Centro-Esquerda", photo: CANDIDATE_IMAGES.ciroGomes, partyLogo: PARTY_LOGOS.pdt, coalition: "PDT / Solidariedade / Avante" },
      { name: "Geraldo Alckmin", vice: "Ana Amélia Lemos", party: "PSDB", number: "45", color: "#3b82f6", ideology: "Centro", photo: CANDIDATE_IMAGES.geraldoAlckmin, partyLogo: PARTY_LOGOS.psdb, coalition: "União pelo Brasil" },
      { name: "João Amoêdo", vice: "Christian Lohbauer", party: "NOVO", number: "30", color: "#f59e0b", ideology: "Direita Liberal", photo: CANDIDATE_IMAGES.joaoAmoedo, partyLogo: PARTY_LOGOS.novo, coalition: "" },
    ],
    results: {
      "AC": { 1: 61.38, 2: 17.28, 3: 9.42, 4: 6.11, 5: 2.01 },
      "AL": { 1: 29.21, 2: 45.34, 3: 15.02, 4: 4.91, 5: 1.62 },
      "AP": { 1: 36.05, 2: 40.0, 3: 13.18, 4: 4.31, 5: 1.88 },
      "AM": { 1: 39.23, 2: 38.91, 3: 11.43, 4: 4.22, 5: 1.72 },
      "BA": { 1: 19.88, 2: 57.4, 3: 13.74, 4: 3.81, 5: 1.38 },
      "CE": { 1: 20.57, 2: 55.32, 3: 14.89, 4: 3.9, 5: 1.3 },
      "DF": { 1: 54.2, 2: 20.01, 3: 9.34, 4: 8.11, 5: 4.23 },
      "ES": { 1: 49.05, 2: 26.32, 3: 10.5, 4: 5.78, 5: 4.2 },
      "GO": { 1: 51.22, 2: 23.03, 3: 11.18, 4: 5.72, 5: 3.91 },
      "MA": { 1: 18.32, 2: 58.21, 3: 14.5, 4: 3.79, 5: 1.25 },
      "MG": { 1: 44.32, 2: 30.12, 3: 12.01, 4: 5.44, 5: 2.87 },
      "MS": { 1: 51.03, 2: 24.33, 3: 11.89, 4: 5.41, 5: 3.42 },
      "MT": { 1: 52.41, 2: 22.89, 3: 11.11, 4: 5.5, 5: 3.33 },
      "PA": { 1: 33.21, 2: 42.89, 3: 13.7, 4: 4.11, 5: 1.67 },
      "PB": { 1: 24.5, 2: 51.3, 3: 14.2, 4: 4.17, 5: 1.41 },
      "PE": { 1: 24.22, 2: 53.21, 3: 13.89, 4: 4.0, 5: 1.38 },
      "PI": { 1: 16.11, 2: 62.35, 3: 13.88, 4: 3.4, 5: 1.1 },
      "PR": { 1: 55.2, 2: 22.11, 3: 10.34, 4: 5.21, 5: 3.77 },
      "RJ": { 1: 53.0, 2: 22.14, 3: 10.89, 4: 4.78, 5: 3.95 },
      "RN": { 1: 25.3, 2: 51.0, 3: 14.1, 4: 4.0, 5: 1.4 },
      "RO": { 1: 57.32, 2: 20.21, 3: 10.99, 4: 4.88, 5: 2.77 },
      "RR": { 1: 55.41, 2: 21.22, 3: 11.89, 4: 5.02, 5: 2.8 },
      "RS": { 1: 49.2, 2: 26.1, 3: 11.37, 4: 6.95, 5: 2.91 },
      "SC": { 1: 65.82, 2: 15.13, 3: 6.68, 4: 5.41, 5: 3.88 },
      "SE": { 1: 23.11, 2: 54.89, 3: 13.02, 4: 4.1, 5: 1.38 },
      "SP": { 1: 53.0, 2: 16.42, 3: 11.35, 4: 9.22, 5: 5.43 },
      "TO": { 1: 40.02, 2: 39.89, 3: 10.13, 4: 4.55, 5: 2.11 },
    },
  },

  {
    id: "2022_1t",
    name: "Eleições 2022 — 1º Turno",
    year: 2022,
    round: "primeiro",
    description: "Resultado do 1º turno de 2022 (Dados oficiais TSE — 2/10/2022)",
    candidates: [
      { name: "Luiz Inácio Lula da Silva", vice: "Geraldo Alckmin", party: "PT", number: "13", color: "#dc2626", ideology: "Esquerda", photo: CANDIDATE_IMAGES.lula, vicePhoto: CANDIDATE_IMAGES.geraldoAlckmin, partyLogo: PARTY_LOGOS.pt, coalition: "Brasil da Esperança" },
      { name: "Jair Bolsonaro", vice: "Braga Netto", party: "PL", number: "22", color: "#1e40af", ideology: "Direita", photo: CANDIDATE_IMAGES.jairBolsonaro, vicePhoto: CANDIDATE_IMAGES.bragaNetto, partyLogo: PARTY_LOGOS.pl, coalition: "PL / PP / Republicanos / União Brasil / Progressistas" },
      { name: "Simone Tebet", vice: "Mara Gabrilli", party: "MDB", number: "15", color: "#16a34a", ideology: "Centro", photo: CANDIDATE_IMAGES.simoneTebet, vicePhoto: CANDIDATE_IMAGES.maraGabrilli, partyLogo: PARTY_LOGOS.mdb, coalition: "Pelo Brasil — MDB / PSDB / Cidadania" },
      { name: "Ciro Gomes", vice: "Índio da Costa", party: "PDT", number: "12", color: "#f97316", ideology: "Centro-Esquerda", photo: CANDIDATE_IMAGES.ciroGomes, partyLogo: PARTY_LOGOS.pdt, coalition: "PDT" },
    ],
    results: {
      "AC": { 1: 22.5, 2: 64.2, 3: 3.2, 4: 2.1 },
      "AL": { 1: 49.8, 2: 38.9, 3: 4.1, 4: 3.2 },
      "AP": { 1: 42.5, 2: 44.8, 3: 3.5, 4: 2.8 },
      "AM": { 1: 44.1, 2: 43.8, 3: 3.8, 4: 3.0 },
      "BA": { 1: 65.2, 2: 26.3, 3: 4.2, 4: 2.3 },
      "CE": { 1: 62.5, 2: 27.4, 3: 4.5, 4: 3.1 },
      "DF": { 1: 35.2, 2: 54.4, 3: 4.8, 4: 2.3 },
      "ES": { 1: 36.5, 2: 52.8, 3: 4.2, 4: 2.8 },
      "GO": { 1: 35.8, 2: 53.4, 3: 4.1, 4: 2.5 },
      "MA": { 1: 64.1, 2: 26.4, 3: 4.8, 4: 2.2 },
      "MG": { 1: 44.7, 2: 46.5, 3: 4.2, 4: 2.3 },
      "MS": { 1: 35.5, 2: 54.2, 3: 4.0, 4: 2.8 },
      "MT": { 1: 30.4, 2: 60.1, 3: 3.5, 4: 2.4 },
      "PA": { 1: 49.1, 2: 41.2, 3: 4.2, 4: 2.8 },
      "PB": { 1: 59.8, 2: 30.5, 3: 4.5, 4: 2.6 },
      "PE": { 1: 60.1, 2: 30.2, 3: 4.8, 4: 2.3 },
      "PI": { 1: 70.4, 2: 21.8, 3: 4.2, 4: 2.1 },
      "PR": { 1: 33.2, 2: 57.4, 3: 4.5, 4: 2.3 },
      "RJ": { 1: 38.5, 2: 51.3, 3: 4.2, 4: 2.8 },
      "RN": { 1: 58.4, 2: 31.5, 3: 4.8, 4: 2.5 },
      "RO": { 1: 25.8, 2: 66.2, 3: 3.5, 4: 2.2 },
      "RR": { 1: 21.4, 2: 69.8, 3: 3.2, 4: 2.1 },
      "RS": { 1: 39.2, 2: 52.8, 3: 4.5, 4: 2.0 },
      "SC": { 1: 27.5, 2: 63.4, 3: 4.2, 4: 2.5 },
      "SE": { 1: 60.5, 2: 30.4, 3: 4.1, 4: 2.8 },
      "SP": { 1: 39.8, 2: 51.5, 3: 4.2, 4: 2.5 },
      "TO": { 1: 45.2, 2: 46.1, 3: 3.8, 4: 2.5 },
    },
  },

  primeiroTurno2026Scenario,
  segundoTurno2026Scenario,
];

export const POLITICAL_SCENARIOS: PoliticalScenario[] = RAW_POLITICAL_SCENARIOS.map(
  withHistoricalAssets
);
