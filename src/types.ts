export type CandidateId = number;
export type ElectionRound = "primeiro" | "segundo";
export type RegionName = "Norte" | "Nordeste" | "Centro-Oeste" | "Sudeste" | "Sul";

export interface Candidate {
  id: CandidateId;
  name: string;
  vice: string;
  party: string;
  number: string;
  color: string;
  photo?: string;
  vicePhoto?: string;
  partyLogo?: string;
  ideology?: string;
}

export interface StateInfo {
  uf: string;
  name: string;
  region: RegionName;
  voters: number; // voters padrão (2026)
  voters2018: number; // eleitorado real de 2018
  voters2022: number; // eleitorado real de 2022
  ibgeCode: string;
}

export interface StateResult {
  uf: string;
  votes: Record<CandidateId, number>;
  winner: CandidateId | null;
  usesMunicipalities: boolean;
  municipalities: Record<string, Record<CandidateId, number>>;
  municipalityPaint: Record<string, CandidateId>;
}

export interface PathData {
  uf: string;
  d: string;
  centroid: [number, number];
}

export interface MunicipalityPath {
  code: string;
  d: string;
}

export interface RegionalMunicipalityPath {
  uf: string;
  code: string;
  d: string;
}

export interface RankedItem {
  candidate: Candidate;
  pct: number;
  votes?: number;
}

export interface PoliticalScenario {
  id: string;
  name: string;
  year: number;
  description: string;
  candidates: Omit<Candidate, 'id'>[];
  results?: Record<string, Record<number, number>>;
}
