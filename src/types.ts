export type CandidateId = number;
export type ElectionRound = "primeiro" | "segundo";
export type RegionName = "Norte" | "Nordeste" | "Centro-Oeste" | "Sudeste" | "Sul";
export type AnalyticsTab = "regioes" | "desempenho" | "ranking" | "candidatos";
export type PhotoCardShape = "circle" | "portrait";
export type HistoricalMunicipalityScenarioKey = "2018_1t" | "2018" | "2022_1t" | "2022";
export type MunicipalityMapStyle = "original" | "broadcast";

export interface Candidate {
  id: CandidateId;
  name: string;
  vice: string;
  party: string;
  number: string;
  color: string;
  photo?: string;
  vicePhoto?: string;
  titular?: string;
  titularPhoto?: string;
  partyLogo?: string;
  ideology?: string;
  coalition?: string;
  locked?: boolean;
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
  name: string;
  d: string;
}

export interface RegionalMunicipalityPath {
  uf: string;
  code: string;
  name: string;
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
  round?: ElectionRound;
  description: string;
  candidates: Omit<Candidate, 'id'>[];
  results?: Record<string, Record<number, number>>;
  nationalResults?: Record<number, number>; // percentuais nacionais por ordem de candidato do cenário
  customStates?: CustomStateInfo[]; // para cenários personalizados
  nationalVoters?: number; // eleitorado nacional total (distribui proporcionalmente por estado)
  municipalityResultStrategy?: HistoricalMunicipalityScenarioKey;
  isCustom?: boolean;
  generatedAt?: string;
}
