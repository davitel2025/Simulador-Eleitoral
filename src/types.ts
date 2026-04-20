export type CandidateId = number;
export type ElectionRound = "primeiro" | "segundo";
export type RegionName = "Norte" | "Nordeste" | "Centro-Oeste" | "Sudeste" | "Sul";
export type AnalyticsTab = "regioes" | "desempenho" | "ranking" | "candidatos";
export type PhotoCardShape = "circle" | "portrait";

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
  coalition?: string;
}

export interface StateInfo {
  uf: string;
  name: string;
  region: RegionName;
  voters: number;
  voters2018: number;
  voters2022: number;
  ibgeCode: string;
}

export interface CustomStateInfo {
  uf: string;
  voters: number;
}

export interface StateResult {
  uf: string;
  votes: Record<CandidateId, number>;
  winner: CandidateId | null;
  usesMunicipalities: boolean;
  municipalities: Record<string, Record<CandidateId, number>>;
  municipalityPaint: Record<string, CandidateId>;
  excluded?: boolean; // quando true, não entra na contagem nacional
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
  customStates?: CustomStateInfo[]; // para cenários personalizados
  isCustom?: boolean;
}
