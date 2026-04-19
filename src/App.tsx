import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { geoMercator, geoPath } from "d3-geo";
import html2canvas from "html2canvas";

type CandidateId = number;
type RegionName = "Norte" | "Nordeste" | "Centro-Oeste" | "Sudeste" | "Sul";
type ElectionRound = "primeiro" | "segundo";

interface Candidate {
  id: CandidateId;
  name: string;
  vice: string;
  party: string;
  number: string;
  color: string;
  photo?: string;
  partyLogo?: string;
  vicePhoto?: string;
}

interface StateInfo {
  uf: string;
  name: string;
  region: RegionName;
  voters: number;
  ibgeCode: string;
}

interface MunicipalityResult {
  code: string;
  name: string;
  votes: Record<CandidateId, number>;
  winner: CandidateId | null;
}

interface StateResult {
  uf: string;
  votes: Record<CandidateId, number>;
  winner: CandidateId | null;
  usesMunicipalities: boolean;
  municipalities: Record<string, MunicipalityResult>;
  municipalityPaint: Record<string, CandidateId>;
}

interface PathData {
  uf: string;
  d: string;
  centroid: [number, number];
}

interface MunicipalityPath {
  code: string;
  name: string;
  d: string;
}

interface RegionalMunicipalityPath {
  code: string;
  name: string;
  d: string;
  uf: string;
}

const REGIONS: RegionName[] = ["Norte", "Nordeste", "Centro-Oeste", "Sudeste", "Sul"];

const STATES: StateInfo[] = [
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

const STATE_BY_UF = Object.fromEntries(STATES.map((state) => [state.uf, state])) as Record<string, StateInfo>;

const STATE_GEO_URL =
  "https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/brazil-states.geojson";

const UF_NAME_MAP: Record<string, string> = {
  Acre: "AC", Alagoas: "AL", Amazonas: "AM", Amapa: "AP", Bahia: "BA", Ceara: "CE",
  "Distrito Federal": "DF", "Espirito Santo": "ES", Goias: "GO", Maranhao: "MA",
  "Minas Gerais": "MG", "Mato Grosso do Sul": "MS", "Mato Grosso": "MT", Para: "PA",
  Paraiba: "PB", Pernambuco: "PE", Piaui: "PI", Parana: "PR", "Rio de Janeiro": "RJ",
  "Rio Grande do Norte": "RN", Rondonia: "RO", Roraima: "RR", "Rio Grande do Sul": "RS",
  "Santa Catarina": "SC", Sergipe: "SE", "Sao Paulo": "SP", Tocantins: "TO",
};

const DEFAULT_COLORS = ["#f43f5e", "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];

const VIEWBOX_WIDTH = 980;
const VIEWBOX_HEIGHT = 820;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeName(value: string): string {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").trim();
}

function resolveUf(properties: Record<string, unknown>): string {
  const directKeys = ["sigla", "UF_05", "abbrev", "SIGLA", "uf"];
  for (const key of directKeys) {
    const value = properties[key];
    if (typeof value === "string" && value.length === 2) {
      return value.toUpperCase();
    }
  }
  const candidateNames = [properties.name, properties.nome, properties.NAME].filter(
    (item): item is string => typeof item === "string",
  );
  for (const name of candidateNames) {
    const normalized = normalizeName(name);
    if (UF_NAME_MAP[normalized]) {
      return UF_NAME_MAP[normalized];
    }
  }
  return "";
}

function shadeHex(hex: string, amount: number, target: "black" | "white"): string {
  const normalized = hex.startsWith("#") ? hex.slice(1) : hex;
  const full = normalized.length === 3 ? normalized.split("").map((value) => value + value).join("") : normalized;
  const r = Number.parseInt(full.slice(0, 2), 16);
  const g = Number.parseInt(full.slice(2, 4), 16);
  const b = Number.parseInt(full.slice(4, 6), 16);
  const targetValue = target === "black" ? 0 : 255;
  const rn = Math.round(r + (targetValue - r) * amount).toString(16).padStart(2, "0");
  const gn = Math.round(g + (targetValue - g) * amount).toString(16).padStart(2, "0");
  const bn = Math.round(b + (targetValue - b) * amount).toString(16).padStart(2, "0");
  return `#${rn}${gn}${bn}`;
}

function getColorByWinnerPct(baseColor: string, winnerPct: number): string {
  const pct = clamp(winnerPct, 0, 100);
  if (pct <= 50) return shadeHex(baseColor, 0.56, "white");
  if (pct < 60) return shadeHex(baseColor, 0.35, "white");
  const intensity = clamp((pct - 60) / 40, 0, 1);
  return shadeHex(baseColor, 0.1 + intensity * 0.7, "black");
}

function buildStatePaths(geoData: any): PathData[] {
  const projection = geoMercator();
  projection.fitExtent([[20, 20], [VIEWBOX_WIDTH - 20, VIEWBOX_HEIGHT - 20]], geoData);
  const generator = geoPath(projection);
  return geoData.features
    .map((feature: any) => {
      const uf = resolveUf(feature.properties ?? {});
      const d = generator(feature) ?? "";
      const centroid = generator.centroid(feature) as [number, number];
      return { uf, d, centroid };
    })
    .filter((pathItem: PathData) => pathItem.uf && pathItem.d);
}

function buildRegionPaths(geoData: any, region: RegionName): PathData[] {
  if (!geoData?.features?.length) return [];
  const regionFeatures = geoData.features.filter((feature: any) => {
    const uf = resolveUf(feature.properties ?? {});
    return STATE_BY_UF[uf]?.region === region;
  });
  if (regionFeatures.length === 0) return [];
  const regionGeo = { type: "FeatureCollection", features: regionFeatures };
  const projection = geoMercator();
  projection.fitExtent([[20, 20], [VIEWBOX_WIDTH - 20, VIEWBOX_HEIGHT - 20]], regionGeo as any);
  const generator = geoPath(projection);
  return regionFeatures.map((feature: any) => {
    const uf = resolveUf(feature.properties ?? {});
    const d = generator(feature) ?? "";
    const centroid = generator.centroid(feature) as [number, number];
    return { uf, d, centroid };
  }).filter((item: PathData) => item.uf && item.d);
}

function buildMunicipalityPaths(geoData: any): MunicipalityPath[] {
  const projection = geoMercator();
  projection.fitExtent([[16, 16], [VIEWBOX_WIDTH - 16, VIEWBOX_HEIGHT - 16]], geoData);
  const generator = geoPath(projection);
  return geoData.features
    .map((feature: any) => {
      const props = feature.properties ?? {};
      const code = String(props.id ?? props.codigo ?? props.codarea ?? props.CD_MUN ?? props.geocodigo ?? "");
      const name = String(props.name ?? props.nome ?? props.NM_MUNICIP ?? "Municipio");
      const d = generator(feature) ?? "";
      return { code, name, d };
    })
    .filter((item: MunicipalityPath) => item.code && item.d);
}

function buildRegionalMunicipalityPaths(featuresWithUf: any[]): RegionalMunicipalityPath[] {
  if (featuresWithUf.length === 0) return [];
  const collection = { type: "FeatureCollection", features: featuresWithUf };
  const projection = geoMercator();
  projection.fitExtent([[16, 16], [VIEWBOX_WIDTH - 16, VIEWBOX_HEIGHT - 16]], collection as any);
  const generator = geoPath(projection);
  return featuresWithUf
    .map((feature: any) => {
      const props = feature.properties ?? {};
      const code = String(props.id ?? props.codigo ?? props.codarea ?? props.CD_MUN ?? props.geocodigo ?? "");
      const name = String(props.name ?? props.nome ?? props.NM_MUNICIP ?? "Municipio");
      const uf = String(props._uf ?? "");
      const d = generator(feature) ?? "";
      return { code, name, d, uf };
    })
    .filter((item: RegionalMunicipalityPath) => item.code && item.d);
}

async function fetchMunicipalityGeo(ibgeCode: string): Promise<any | null> {
  const urls = [
    `https://raw.githubusercontent.com/tbrugz/geodata-br/master/geojson/geojs-${ibgeCode}-mun.json`,
    `https://servicodados.ibge.gov.br/api/v3/malhas/estados/${ibgeCode}?formato=application/vnd.geo+json&intrarregiao=municipio`,
  ];
  for (const url of urls) {
    try {
      const response = await fetch(url);
      if (!response.ok) continue;
      const data = await response.json();
      if (data?.features?.length) return data;
    } catch {
      continue;
    }
  }
  return null;
}

function getWinner(votes: Record<CandidateId, number>): CandidateId | null {
  const entries = Object.entries(votes).map(([id, pct]) => ({ id: Number(id), pct }));
  if (entries.length === 0) return null;
  entries.sort((a, b) => b.pct - a.pct);
  if (entries.length > 1 && entries[0].pct === entries[1].pct) return null;
  return entries[0].id;
}

function formatPct(value: number): string {
  return `${value.toFixed(2)}%`;
}

function readFileAsBase64(file: File, onDone: (result: string) => void): void {
  const reader = new FileReader();
  reader.onload = (event) => {
    const content = String(event.target?.result ?? "");
    if (content) onDone(content);
  };
  reader.readAsDataURL(file);
}

function normalizeVotesForCandidates(
  rawVotes: Record<CandidateId, number>,
  candidateIds: CandidateId[],
): Record<CandidateId, number> {
  const filtered: Record<CandidateId, number> = {};
  let total = 0;
  for (const id of candidateIds) {
    const value = Number(rawVotes[id] ?? 0);
    filtered[id] = value;
    total += value;
  }
  if (total <= 0) {
    const equalShare = 100 / candidateIds.length;
    for (const id of candidateIds) filtered[id] = equalShare;
    return filtered;
  }
  for (const id of candidateIds) filtered[id] = (filtered[id] / total) * 100;
  return filtered;
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
    </svg>
  );
}

type AnalyticsTab = "regioes" | "desempenho" | "ranking";

export default function App() {
  const [electionRound, setElectionRound] = useState<ElectionRound | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [setupComplete, setSetupComplete] = useState(false);

  if (!electionRound) {
    return <InitialScreen onSelect={setElectionRound} />;
  }

  if (!setupComplete) {
    return (
      <CandidateSetupScreen
        round={electionRound}
        initialCandidates={candidates}
        onComplete={(newCandidates) => {
          setCandidates(newCandidates);
          setSetupComplete(true);
        }}
        onBack={() => setElectionRound(null)}
      />
    );
  }

  return (
    <ElectionSimulator
      round={electionRound}
      candidates={candidates}
      onCandidatesChange={setCandidates}
      onRestart={() => {
        setElectionRound(null);
        setSetupComplete(false);
        setCandidates([]);
      }}
    />
  );
}

function InitialScreen({ onSelect }: { onSelect: (round: ElectionRound) => void }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-zinc-950 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="max-w-2xl w-full">
        <div className="text-center mb-12">
          <div className="inline-flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-2xl shadow-emerald-500/25 mb-6">
            <svg className="h-10 w-10 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <rect x="4" y="4" width="16" height="16" rx="2" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </div>
          <h1 className="text-5xl font-black tracking-tight text-white mb-3">Simulador Eleitoral</h1>
          <p className="text-xl text-slate-400">Brasil 2026 - Eleicoes Presidenciais</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <motion.button type="button" onClick={() => onSelect("primeiro")} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            className="group relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-violet-600/20 to-purple-900/20 p-8 text-left shadow-2xl transition-all hover:border-white/20">
            <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-violet-500/10 blur-3xl transition-all group-hover:bg-violet-500/20" />
            <div className="relative z-10">
              <div className="mb-4 text-4xl">🗳️</div>
              <h2 className="text-3xl font-black text-white mb-2">Primeiro Turno</h2>
              <p className="text-slate-400">Configure multiplos candidatos</p>
            </div>
          </motion.button>

          <motion.button type="button" onClick={() => onSelect("segundo")} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            className="group relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-emerald-600/20 to-teal-900/20 p-8 text-left shadow-2xl transition-all hover:border-white/20">
            <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-emerald-500/10 blur-3xl transition-all group-hover:bg-emerald-500/20" />
            <div className="relative z-10">
              <div className="mb-4 text-4xl">🏆</div>
              <h2 className="text-3xl font-black text-white mb-2">Segundo Turno</h2>
              <p className="text-slate-400">Confronto entre 2 candidatos</p>
            </div>
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}

function CandidateSetupScreen({ round, initialCandidates, onComplete, onBack }: {
  round: ElectionRound;
  initialCandidates: Candidate[];
  onComplete: (candidates: Candidate[]) => void;
  onBack: () => void;
}) {
  const [candidates, setCandidates] = useState<Candidate[]>(() => {
    if (initialCandidates.length > 0) return initialCandidates;
    if (round === "segundo") {
      return [
        { id: 1, name: "Candidato 1", vice: "Vice 1", party: "Partido 1", number: "13", color: DEFAULT_COLORS[0] },
        { id: 2, name: "Candidato 2", vice: "Vice 2", party: "Partido 2", number: "22", color: DEFAULT_COLORS[1] },
      ];
    }
    return [
      { id: 1, name: "Candidato 1", vice: "Vice 1", party: "Partido 1", number: "13", color: DEFAULT_COLORS[0] },
      { id: 2, name: "Candidato 2", vice: "Vice 2", party: "Partido 2", number: "22", color: DEFAULT_COLORS[1] },
      { id: 3, name: "Candidato 3", vice: "Vice 3", party: "Partido 3", number: "45", color: DEFAULT_COLORS[2] },
    ];
  });

  const addCandidate = () => {
    const newId = Math.max(...candidates.map((c) => c.id), 0) + 1;
    setCandidates([...candidates, {
      id: newId, name: `Candidato ${newId}`, vice: `Vice ${newId}`, party: `Partido ${newId}`,
      number: String(newId), color: DEFAULT_COLORS[newId % DEFAULT_COLORS.length],
    }]);
  };

  const removeCandidate = (id: CandidateId) => {
    if (candidates.length <= 2) return;
    setCandidates(candidates.filter((c) => c.id !== id));
  };

  const updateCandidate = (id: CandidateId, updates: Partial<Candidate>) => {
    setCandidates(candidates.map((c) => (c.id === id ? { ...c, ...updates } : c)));
  };

  const canProceed = candidates.length >= 2 && candidates.every((c) => c.name.trim() && c.party.trim());

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-zinc-950 p-4 overflow-y-auto">
      <div className="max-w-6xl mx-auto py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-black text-white mb-2">
              Configurar {round === "primeiro" ? "Primeiro" : "Segundo"} Turno
            </h1>
            <p className="text-slate-400">Configure os candidatos</p>
          </div>
          <button type="button" onClick={onBack} className="rounded-xl border border-white/15 bg-slate-800/80 px-6 py-3 text-sm font-bold text-white transition-all hover:bg-slate-700">
            ← Voltar
          </button>
        </div>

        <div className="grid gap-6 mb-8">
          {candidates.map((candidate, index) => (
            <motion.div key={candidate.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.1 }}
              className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-800/40 p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-2xl font-black text-white">Candidato #{candidate.id}</h3>
                {candidates.length > 2 && (
                  <button type="button" onClick={() => removeCandidate(candidate.id)}
                    className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-bold text-red-300 transition-all hover:bg-red-500/20">
                    Remover
                  </button>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-4">
                <CandidateField label="Nome" value={candidate.name} onChange={(value) => updateCandidate(candidate.id, { name: value })} placeholder="Nome" />
                <CandidateField label="Vice" value={candidate.vice} onChange={(value) => updateCandidate(candidate.id, { vice: value })} placeholder="Vice" />
                <CandidateField label="Partido" value={candidate.party} onChange={(value) => updateCandidate(candidate.id, { party: value })} placeholder="Partido" />
                <CandidateField label="Numero" value={candidate.number} onChange={(value) => updateCandidate(candidate.id, { number: value })} placeholder="Numero" />
              </div>

              <div className="grid gap-4 md:grid-cols-4">
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">Cor</label>
                  <input type="color" value={candidate.color} onChange={(e) => updateCandidate(candidate.id, { color: e.target.value })}
                    className="h-12 w-full cursor-pointer rounded-xl border border-slate-600 bg-slate-900" />
                </div>
                <FileUploadField label="Foto" currentFile={candidate.photo}
                  onUpload={(photo) => updateCandidate(candidate.id, { photo })}
                  onRemove={() => updateCandidate(candidate.id, { photo: undefined })} />
                <FileUploadField label="Foto Vice" currentFile={candidate.vicePhoto}
                  onUpload={(vicePhoto) => updateCandidate(candidate.id, { vicePhoto })}
                  onRemove={() => updateCandidate(candidate.id, { vicePhoto: undefined })} />
                <FileUploadField label="Logo Partido" currentFile={candidate.partyLogo}
                  onUpload={(partyLogo) => updateCandidate(candidate.id, { partyLogo })}
                  onRemove={() => updateCandidate(candidate.id, { partyLogo: undefined })} />
              </div>
            </motion.div>
          ))}
        </div>

        {round === "primeiro" && (
          <button type="button" onClick={addCandidate}
            className="mb-8 w-full rounded-2xl border-2 border-dashed border-white/20 bg-white/5 py-6 text-sm font-bold text-slate-300 transition-all hover:border-white/30 hover:bg-white/10">
            + Adicionar Candidato
          </button>
        )}

        <button type="button" onClick={() => onComplete(candidates)} disabled={!canProceed}
          className="w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 px-8 py-5 text-lg font-black text-white shadow-2xl shadow-emerald-500/25 transition-all hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100">
          Iniciar Simulacao
        </button>
      </div>
    </div>
  );
}

function CandidateField({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (value: string) => void; placeholder: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">{label}</label>
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full rounded-xl border border-slate-600 bg-slate-900/80 px-4 py-3 text-slate-200 placeholder:text-slate-600 focus:border-white/30 focus:outline-none focus:ring-2 focus:ring-white/10 transition-all" />
    </div>
  );
}

function FileUploadField({ label, currentFile, onUpload, onRemove }: {
  label: string; currentFile?: string; onUpload: (file: string) => void; onRemove: () => void;
}) {
  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    readFileAsBase64(file, onUpload);
  };

  return (
    <div>
      <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">{label}</label>
      {currentFile ? (
        <div className="space-y-2">
          <div className="h-12 w-12 overflow-hidden rounded-lg border-2 border-emerald-500/50">
            <img src={currentFile} alt={label} className="h-full w-full object-cover" />
          </div>
          <button type="button" onClick={onRemove} className="text-xs font-bold text-red-300 hover:text-red-200">Remover</button>
        </div>
      ) : (
        <label className="flex h-12 cursor-pointer items-center justify-center rounded-xl border border-dashed border-slate-600 bg-slate-900/50 text-xs font-bold text-slate-400 transition-all hover:border-white/30 hover:bg-slate-800">
          Upload
          <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
        </label>
      )}
    </div>
  );
}

function ElectionSimulator({ round, candidates, onCandidatesChange, onRestart }: {
  round: ElectionRound;
  candidates: Candidate[];
  onCandidatesChange: (candidates: Candidate[]) => void;
  onRestart: () => void;
}) {
  const [results, setResults] = useState<Record<string, StateResult>>({});
  const [paths, setPaths] = useState<PathData[]>([]);
  const [stateGeoData, setStateGeoData] = useState<any>(null);
  const [stateDialog, setStateDialog] = useState<{ uf: string; view: "menu" | "edit" | "photo" | "municipios" } | null>(null);
  const [hoveredState, setHoveredState] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [nationalPhotoOpen, setNationalPhotoOpen] = useState(false);
  const [regionalPhotoOpen, setRegionalPhotoOpen] = useState(false);
  const [selectedPhotoRegion, setSelectedPhotoRegion] = useState<RegionName>("Sudeste");
  const [analyticsTab, setAnalyticsTab] = useState<AnalyticsTab>("regioes");
  const [regionFocus, setRegionFocus] = useState<RegionName | null>(null);
  const [neonStates, setNeonStates] = useState(true);
  const [nationalPhotoScale, setNationalPhotoScale] = useState(1.45);
  const [photoMapScale, setPhotoMapScale] = useState(520);
  const importRef = useRef<HTMLInputElement>(null);

  const [mapZoom, setMapZoom] = useState(1);
  const [mapOffset, setMapOffset] = useState({ x: 0, y: 0 });
  const mapContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadMap = async () => {
      const response = await fetch(STATE_GEO_URL);
      const data = await response.json();
      setStateGeoData(data);
      setPaths(buildStatePaths(data));
    };
    loadMap().catch(() => {
      setStateGeoData(null);
      setPaths([]);
    });
  }, []);

  useEffect(() => {
    const mapNode = mapContainerRef.current;
    if (!mapNode) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const delta = event.deltaY > 0 ? -0.12 : 0.12;
      setMapZoom((prev) => clamp(Number((prev + delta).toFixed(2)), 0.5, 5));
    };
    mapNode.addEventListener("wheel", onWheel, { passive: false });
    return () => mapNode.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => {
    const candidateIds = candidates.map((candidate) => candidate.id);
    if (candidateIds.length === 0) return;
    setResults((prev) => {
      const next: Record<string, StateResult> = {};
      for (const [uf, result] of Object.entries(prev)) {
        const normalizedVotes = normalizeVotesForCandidates(result.votes, candidateIds);
        next[uf] = {
          ...result,
          votes: normalizedVotes,
          winner: getWinner(normalizedVotes),
          municipalityPaint: result.municipalityPaint ?? {},
        };
      }
      return next;
    });
  }, [candidates]);

  const national = useMemo(() => {
    const candidateVotes: Record<CandidateId, number> = {};
    candidates.forEach((c) => { candidateVotes[c.id] = 0; });
    let totalVoters = 0;
    let statesCounted = 0;
    for (const state of STATES) {
      const result = results[state.uf];
      if (!result) continue;
      statesCounted += 1;
      totalVoters += state.voters;
      Object.entries(result.votes).forEach(([candidateId, pct]) => {
        const id = Number(candidateId);
        candidateVotes[id] = (candidateVotes[id] || 0) + (pct / 100) * state.voters;
      });
    }
    const totalVotes = Object.values(candidateVotes).reduce((sum, v) => sum + v, 0);
    const candidatePcts: Record<CandidateId, number> = {};
    Object.keys(candidateVotes).forEach((id) => {
      const numId = Number(id);
      candidatePcts[numId] = totalVotes > 0 ? (candidateVotes[numId] / totalVotes) * 100 : 0;
    });
    return { candidateVotes, candidatePcts, totalVotes, totalVoters, statesCounted, winner: getWinner(candidatePcts) };
  }, [results, candidates]);

  const candidateById = useMemo(() => {
    return Object.fromEntries(candidates.map((c) => [c.id, c]));
  }, [candidates]);

  const getStateFill = (uf: string): string => {
    const result = results[uf];
    if (!result || !result.winner) return "#1e293b";
    const winnerPct = result.votes[result.winner] || 0;
    const candidate = candidateById[result.winner];
    if (!candidate) return "#1e293b";
    return getColorByWinnerPct(candidate.color, winnerPct);
  };

  const handleStateSave = (result: StateResult) => {
    const hasMunicipalityPaint = Object.keys(result.municipalityPaint ?? {}).length > 0;
    setResults((prev) => ({
      ...prev,
      [result.uf]: {
        ...result,
        municipalityPaint: result.municipalityPaint ?? {},
        usesMunicipalities: hasMunicipalityPaint,
      },
    }));
    setStateDialog(null);
  };

  const handleMunicipalitySave = (uf: string, municipalityPaint: Record<string, CandidateId>) => {
    setResults((prev) => {
      const existing = prev[uf];
      const candidateIds = candidates.map((candidate) => candidate.id);
      const fallbackVotes = normalizeVotesForCandidates({}, candidateIds);
      const nextState: StateResult = existing ?? {
        uf,
        votes: fallbackVotes,
        winner: getWinner(fallbackVotes),
        municipalities: {},
        usesMunicipalities: false,
        municipalityPaint: {},
      };
      return {
        ...prev,
        [uf]: {
          ...nextState,
          municipalityPaint,
          usesMunicipalities: Object.keys(municipalityPaint).length > 0,
        },
      };
    });
    setStateDialog(null);
  };

  const handleExport = () => {
    const payload = { round, candidates, results, generatedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `simulador-${round}-turno-${Date.now()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = String(e.target?.result ?? "");
        const payload = JSON.parse(text);
        if (payload.candidates && Array.isArray(payload.candidates)) {
          onCandidatesChange(payload.candidates);
        }
        if (payload.results && typeof payload.results === "object") {
          const normalized: Record<string, StateResult> = {};
          for (const [uf, result] of Object.entries(payload.results as Record<string, any>)) {
            normalized[uf] = {
              uf,
              votes: result.votes ?? {},
              winner: result.winner ?? null,
              municipalities: result.municipalities ?? {},
              municipalityPaint: result.municipalityPaint ?? {},
              usesMunicipalities: Object.keys(result.municipalityPaint ?? {}).length > 0,
            };
          }
          setResults(normalized);
        }
      } catch {
        alert("Arquivo invalido. Certifique-se de importar um JSON exportado pelo simulador.");
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  const selectedStateInfo = stateDialog ? STATE_BY_UF[stateDialog.uf] : null;
  const hoveredStateInfo = hoveredState ? STATE_BY_UF[hoveredState] : null;
  const hoveredResult = hoveredState ? results[hoveredState] : undefined;

  const sortedCandidates = useMemo(() => {
    return [...candidates].sort((a, b) => {
      const aPct = national.candidatePcts[a.id] || 0;
      const bPct = national.candidatePcts[b.id] || 0;
      return bPct - aPct;
    });
  }, [candidates, national.candidatePcts]);

  const performanceStats = useMemo(() => {
    const candidateWins: Record<CandidateId, number> = {};
    candidates.forEach((c) => { candidateWins[c.id] = 0; });
    const allResults = Object.values(results);
    allResults.forEach((result) => {
      if (result.winner) {
        candidateWins[result.winner] = (candidateWins[result.winner] || 0) + 1;
      }
    });
    const averageMargin = allResults.length === 0 ? 0 :
      allResults.reduce((sum, result) => {
        const sorted = Object.values(result.votes).sort((a, b) => b - a);
        return sum + (sorted[0] - (sorted[1] || 0));
      }, 0) / allResults.length;
    return { candidateWins, averageMargin };
  }, [results, candidates]);

  const regionalStats = useMemo(() => {
    const grouped = new Map<RegionName, { votes: Record<CandidateId, number>; wins: Record<CandidateId, number>; statesCounted: number }>();
    for (const state of STATES) {
      const current = grouped.get(state.region) ?? { votes: {}, wins: {}, statesCounted: 0 };
      candidates.forEach((c) => {
        if (!current.votes[c.id]) current.votes[c.id] = 0;
        if (!current.wins[c.id]) current.wins[c.id] = 0;
      });
      const result = results[state.uf];
      if (result) {
        current.statesCounted += 1;
        Object.entries(result.votes).forEach(([id, pct]) => {
          const numId = Number(id);
          current.votes[numId] += (pct / 100) * state.voters;
        });
        if (result.winner) {
          current.wins[result.winner] += 1;
        }
      }
      grouped.set(state.region, current);
    }
    return REGIONS.map((region) => {
      const value = grouped.get(region) ?? { votes: {}, wins: {}, statesCounted: 0 };
      const total = Object.values(value.votes).reduce((sum, v) => sum + v, 0);
      const pcts: Record<CandidateId, number> = {};
      candidates.forEach((c) => {
        pcts[c.id] = total > 0 ? ((value.votes[c.id] || 0) / total) * 100 : 0;
      });
      return { region, pcts, wins: value.wins, statesCounted: value.statesCounted, winner: getWinner(pcts) };
    });
  }, [results, candidates]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-zinc-950 text-slate-100">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-slate-950/80 backdrop-blur-xl px-4 py-4 shadow-2xl md:px-6">
        <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-4 xl:flex-row xl:items-center">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/25">
              <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <rect x="4" y="4" width="16" height="16" rx="2" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-400">
                {round === "primeiro" ? "Primeiro" : "Segundo"} Turno
              </p>
              <h1 className="text-2xl font-black tracking-tight text-white">Brasil 2026</h1>
            </div>
          </div>

          <div className="flex-1 space-y-2">
            <div className="flex items-end justify-between text-xs font-bold">
              {sortedCandidates.slice(0, 3).map((candidate) => {
                const pct = national.candidatePcts[candidate.id] || 0;
                return (
                  <div key={candidate.id} className="flex items-center gap-2" style={{ color: candidate.color }}>
                    <div className="text-lg font-black">{formatPct(pct)}</div>
                    <span className="hidden md:inline">{candidate.name}</span>
                  </div>
                );
              })}
              <div className="px-3 py-1 rounded-full bg-white/5 text-xs font-semibold text-slate-400 border border-white/10">
                {national.statesCounted}/27
              </div>
            </div>

            <div className="relative h-5 overflow-hidden rounded-full bg-slate-800/80 shadow-inner flex">
              {sortedCandidates.map((candidate) => {
                const pct = national.candidatePcts[candidate.id] || 0;
                return (
                  <motion.div key={candidate.id} className="h-full" style={{ backgroundColor: candidate.color, width: `${pct}%` }}
                    initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                    transition={{ type: "spring", stiffness: 120, damping: 20 }} />
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setSettingsOpen((prev) => !prev)}
              className="rounded-xl border border-white/15 bg-gradient-to-r from-slate-800 to-slate-700/50 px-4 py-2.5 text-sm font-semibold text-slate-200 shadow-lg transition-all hover:bg-slate-700">
              Candidatos
            </button>
            <button type="button" onClick={() => setNationalPhotoOpen(true)}
              className="rounded-xl bg-gradient-to-r from-violet-600 to-violet-700 px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition-all hover:scale-105">
              Foto Nacional
            </button>
            <button type="button" onClick={() => setRegionalPhotoOpen(true)}
              className="rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition-all hover:scale-105">
              Foto Regional
            </button>
            <button type="button" onClick={handleExport}
              className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm font-semibold text-emerald-300 shadow-lg transition-all hover:bg-emerald-500/20">
              Exportar
            </button>
            <button type="button" onClick={() => importRef.current?.click()}
              className="rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-2.5 text-sm font-semibold text-sky-300 shadow-lg transition-all hover:bg-sky-500/20">
              Importar
            </button>
            <input ref={importRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
            <button type="button" onClick={() => setResults({})}
              className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-2.5 text-sm font-semibold text-amber-300 shadow-lg transition-all hover:bg-amber-500/20">
              Limpar
            </button>
            <button type="button" onClick={onRestart}
              className="rounded-xl border border-red-500/35 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-300 shadow-lg transition-all hover:bg-red-500/20">
              Reiniciar
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-[1800px] grid-cols-1 gap-6 px-4 py-6 xl:grid-cols-[320px_minmax(0,1fr)] xl:px-6">
        <aside className="max-h-[calc(100vh-180px)] overflow-y-auto rounded-2xl border border-white/10 bg-gradient-to-b from-slate-900/80 to-slate-900/40 p-4 shadow-2xl backdrop-blur-sm">
          <h2 className="mb-4 text-sm font-black uppercase tracking-[0.18em] text-slate-400">Estados</h2>
          <div className="space-y-1.5">
            {STATES.map((state) => {
              const result = results[state.uf];
              const winner = result?.winner ? candidateById[result.winner] : null;
              const winnerPct = result?.winner ? result.votes[result.winner] : null;
              return (
                <motion.button key={state.uf} type="button" whileHover={{ x: 4 }} onClick={() => setStateDialog({ uf: state.uf, view: "menu" })}
                  onMouseEnter={() => setHoveredState(state.uf)} onMouseLeave={() => setHoveredState(null)}
                  className="group flex w-full items-center justify-between rounded-xl border border-transparent px-4 py-3 text-left transition-all hover:border-white/15 hover:bg-white/5 active:scale-[0.98]">
                  <div>
                    <div className="text-sm font-bold text-slate-200">{state.name}</div>
                    <div className="text-xs font-medium text-slate-500">{state.uf}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-black" style={{ color: winner?.color || "#64748b" }}>
                      {winnerPct ? formatPct(winnerPct) : "--"}
                    </div>
                    <div className="text-[11px] font-medium text-slate-500">
                      {result?.usesMunicipalities ? "Municipios" : "Estado"}
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </aside>

        <section className="space-y-6">
          <AnimatePresence initial={false}>
            {settingsOpen && (
              <motion.div
                initial={{ opacity: 0, y: -10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.98 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="rounded-2xl border border-white/10 bg-gradient-to-b from-slate-900/90 to-slate-900/60 p-5 shadow-2xl backdrop-blur-sm"
              >
                <CandidateManager
                  round={round}
                  candidates={candidates}
                  neonStates={neonStates}
                  photoScale={nationalPhotoScale}
                  photoMapScale={photoMapScale}
                  onNeonStatesChange={setNeonStates}
                  onPhotoScaleChange={setNationalPhotoScale}
                  onPhotoMapScaleChange={setPhotoMapScale}
                  onChange={onCandidatesChange}
                />
              </motion.div>
            )}
          </AnimatePresence>

          <div ref={mapContainerRef}
            className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-slate-950 to-slate-900 shadow-2xl touch-none cursor-grab active:cursor-grabbing overscroll-contain">
            <div className="absolute right-4 bottom-4 z-20 flex flex-col gap-2">
              <div className="flex items-center gap-1 rounded-xl border border-white/15 bg-black/60 p-1 backdrop-blur-md shadow-2xl">
                <button type="button" onClick={() => setMapZoom((prev) => clamp(prev - 0.2, 0.5, 5))}
                  className="w-10 h-10 flex items-center justify-center rounded-lg bg-slate-800 text-xl font-bold text-white hover:bg-slate-700 active:scale-95 transition-all shadow-lg">
                  -
                </button>
                <div className="min-w-[60px] text-center text-[10px] font-black tracking-tighter uppercase text-slate-400">
                  {Math.round(mapZoom * 100)}%
                </div>
                <button type="button" onClick={() => setMapZoom((prev) => clamp(prev + 0.2, 0.5, 5))}
                  className="w-10 h-10 flex items-center justify-center rounded-lg bg-slate-800 text-xl font-bold text-white hover:bg-slate-700 active:scale-95 transition-all shadow-lg">
                  +
                </button>
              </div>
              <button type="button" onClick={() => { setMapZoom(1); setMapOffset({ x: 0, y: 0 }); }}
                className="rounded-xl border border-white/20 bg-black/60 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white hover:bg-white/10 backdrop-blur-md shadow-2xl active:scale-95 transition-all">
                Centralizar
              </button>
            </div>

            {hoveredStateInfo && hoveredResult && (
              <motion.div key={hoveredStateInfo.uf} initial={{ opacity: 0, y: -8, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="absolute left-4 top-4 z-20 w-72 rounded-2xl border border-white/15 bg-gradient-to-br from-black/80 to-black/60 px-4 py-4 shadow-2xl backdrop-blur-xl">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">{hoveredStateInfo.name}</div>
                  <div className="rounded-lg bg-white/10 px-2 py-0.5 text-xs font-bold text-white">{hoveredStateInfo.uf}</div>
                </div>
                {Object.entries(hoveredResult.votes).map(([candidateId, pct]) => {
                  const candidate = candidateById[Number(candidateId)];
                  if (!candidate) return null;
                  return (
                    <div key={candidateId} className="flex items-center justify-between text-sm py-1">
                      <span className="font-semibold" style={{ color: candidate.color }}>{candidate.name}</span>
                      <span className="font-black text-white">{formatPct(pct)}</span>
                    </div>
                  );
                })}
              </motion.div>
            )}

            {paths.length === 0 ? (
              <div className="flex h-[70vh] items-center justify-center text-slate-400">
                <div className="text-center">
                  <div className="mx-auto mb-4 h-16 w-16 animate-spin rounded-full border-4 border-slate-800 border-t-emerald-500 shadow-[0_0_30px_-5px_rgba(16,185,129,0.3)]"></div>
                  <p className="text-sm font-black uppercase tracking-widest text-emerald-500/80 animate-pulse">Carregando mapa...</p>
                </div>
              </div>
            ) : (
              <div className="h-[70vh] w-full overflow-hidden">
                <motion.div className="w-full h-full origin-center" drag dragConstraints={mapContainerRef} dragElastic={0.1}
                  style={{ x: mapOffset.x, y: mapOffset.y, scale: mapZoom }}
                  onDragEnd={(_event: unknown, info: { offset: { x: number; y: number } }) => { setMapOffset((prev) => ({ x: prev.x + info.offset.x, y: prev.y + info.offset.y })); }}>
                  <svg viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`} className="h-full w-full pointer-events-none"
                    style={{ filter: "drop-shadow(0 20px 50px rgba(0,0,0,0.5))" }}>
                    {paths.map((pathItem) => {
                      const isHovered = hoveredState === pathItem.uf;
                      const result = results[pathItem.uf];
                      const winnerColor = result?.winner ? candidateById[result.winner]?.color : null;
                      return (
                        <g key={pathItem.uf} className="pointer-events-auto">
                          <motion.path d={pathItem.d} fill={getStateFill(pathItem.uf)} stroke={isHovered ? "#ffffff" : "#334155"}
                            strokeWidth={isHovered ? 2.5 : 1} className="cursor-pointer transition-colors duration-200"
                            style={{ filter: neonStates && isHovered && winnerColor ? `drop-shadow(0 0 15px ${winnerColor})` : "none" }}
                            onMouseEnter={() => setHoveredState(pathItem.uf)} onMouseLeave={() => setHoveredState(null)}
                            onClick={() => setStateDialog({ uf: pathItem.uf, view: "menu" })} whileHover={{ scale: 1.01 }} />
                          <text x={pathItem.centroid[0]} y={pathItem.centroid[1]}
                            className={`pointer-events-none select-none font-black ${isHovered ? "fill-white" : "fill-slate-400"}`}
                            style={{ fontSize: "11px", textShadow: "0 1px 3px rgba(0,0,0,0.8)", opacity: mapZoom < 0.8 && !isHovered ? 0 : 1 }}
                            textAnchor="middle">
                            {pathItem.uf}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </motion.div>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-slate-900/90 to-slate-900/60 p-5 shadow-2xl">
            <div className="mb-5 flex flex-wrap gap-2">
              {[
                { id: "regioes", label: "🗺️ Ganhos por regiao" },
                { id: "desempenho", label: "📊 Desempenho geral" },
                { id: "ranking", label: "🏆 Ranking de estados" },
              ].map((tab) => (
                <button key={tab.id} type="button" onClick={() => setAnalyticsTab(tab.id as AnalyticsTab)}
                  className={`relative overflow-hidden rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${
                    analyticsTab === tab.id
                      ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/25"
                      : "bg-slate-800/60 text-slate-300 hover:bg-slate-700/80"
                  }`}>
                  {tab.label}
                </button>
              ))}
            </div>

            {analyticsTab === "regioes" && (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => setRegionFocus(null)}
                    className={`rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${regionFocus === null ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg" : "bg-slate-800/60 text-slate-300 hover:bg-slate-700/80"}`}>
                    Brasil inteiro
                  </button>
                  {regionalStats.map((row) => (
                    <button type="button" key={row.region} onClick={() => setRegionFocus(row.region)}
                      className={`rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${regionFocus === row.region ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg" : "bg-slate-800/60 text-slate-300 hover:bg-slate-700/80"}`}>
                      {row.region}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_1fr]">
                  <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-slate-950/80 to-slate-900/50 p-4 shadow-xl">
                    <div className="mb-3 text-sm font-bold text-slate-300">
                      {regionFocus ? `Mapa da regiao ${regionFocus}` : "Mapa do Brasil por regioes"}
                    </div>
                    <div className="relative overflow-hidden group">
                      <svg viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`} className="h-[420px] w-full transition-transform duration-500 group-hover:scale-[1.05]">
                        {paths.map((pathItem) => {
                          const state = STATE_BY_UF[pathItem.uf];
                          if (!state) return null;
                          const inFocus = regionFocus ? state.region === regionFocus : true;
                          const result = results[pathItem.uf];
                          const winnerColor = result?.winner ? candidateById[result.winner]?.color : null;
                          return (
                            <g key={pathItem.uf}>
                              <path d={pathItem.d} fill={inFocus ? getStateFill(pathItem.uf) : "#020617"}
                                stroke={inFocus ? (winnerColor ? winnerColor : "#1e293b") : "#0f172a"}
                                strokeWidth={inFocus ? (winnerColor ? 1.5 : 1) : 0.2}
                                className={`transition-all duration-500 ${inFocus ? "cursor-pointer" : "cursor-default"}`}
                                style={{ opacity: inFocus ? 1 : 0.3 }}
                                onClick={() => { if (inFocus) setStateDialog({ uf: pathItem.uf, view: "menu" }); }} />
                              {inFocus && (
                                <text x={pathItem.centroid[0]} y={pathItem.centroid[1]}
                                  className="pointer-events-none select-none fill-white/80 text-[10px] font-black"
                                  textAnchor="middle" style={{ textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}>
                                  {pathItem.uf}
                                </text>
                              )}
                            </g>
                          );
                        })}
                      </svg>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {regionalStats.filter((row) => (regionFocus ? row.region === regionFocus : true)).map((row) => {
                      const winner = row.winner ? candidateById[row.winner] : null;
                      return (
                        <motion.div key={row.region}
                          className="rounded-xl border border-white/10 bg-gradient-to-br from-slate-800/50 to-slate-900/30 p-4 shadow-lg hover:shadow-xl transition-shadow"
                          whileHover={{ scale: 1.02 }}>
                          <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{row.region}</div>
                          <div className="mt-2 text-2xl font-black" style={{ color: winner?.color || "#a1a1aa" }}>
                            {winner?.name || "Sem dados"}
                          </div>
                          <div className="mt-2 space-y-1">
                            {candidates.map((c) => (
                              <div key={c.id} className="flex items-center justify-between text-xs">
                                <span style={{ color: c.color }}>{c.name}</span>
                                <span className="font-bold text-slate-300">{formatPct(row.pcts[c.id] || 0)}</span>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {analyticsTab === "desempenho" && (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <motion.div className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-800/60 to-slate-900/40 p-5 shadow-lg hover:shadow-xl transition-shadow" whileHover={{ scale: 1.02 }}>
                  <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500 flex items-center gap-2">
                    <span className="text-xl">👑</span>
                    Lideranca nacional
                  </div>
                  {sortedCandidates[0] && (
                    <div className="mt-3 text-3xl font-black" style={{ color: sortedCandidates[0].color, textShadow: `0 0 40px ${sortedCandidates[0].color}40` }}>
                      {sortedCandidates[0].name}
                    </div>
                  )}
                </motion.div>
                <motion.div className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-800/60 to-slate-900/40 p-5 shadow-lg hover:shadow-xl transition-shadow" whileHover={{ scale: 1.02 }}>
                  <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500 flex items-center gap-2">
                    <span className="text-xl">🗺️</span>
                    Estados vencidos
                  </div>
                  <div className="mt-3 space-y-1">
                    {candidates.map((c) => (
                      <div key={c.id} className="flex items-center justify-between text-sm">
                        <span style={{ color: c.color }}>{c.name}</span>
                        <span className="font-black text-white">{performanceStats.candidateWins[c.id] || 0}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>
                <motion.div className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-800/60 to-slate-900/40 p-5 shadow-lg hover:shadow-xl transition-shadow" whileHover={{ scale: 1.02 }}>
                  <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500 flex items-center gap-2">
                    <span className="text-xl">📈</span>
                    Margem media
                  </div>
                  <div className="mt-3 text-3xl font-black text-white drop-shadow-lg">
                    {performanceStats.averageMargin.toFixed(2)} <span className="text-lg text-slate-400">pp</span>
                  </div>
                </motion.div>
              </div>
            )}

            {analyticsTab === "ranking" && (
              <div className="space-y-2">
                {STATES.map((state, index) => {
                  const result = results[state.uf];
                  if (!result) return null;
                  const winner = result.winner ? candidateById[result.winner] : null;
                  return (
                    <motion.div key={state.uf} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.02 }}
                      className="group flex items-center justify-between rounded-xl border border-white/10 bg-gradient-to-r from-slate-800/50 to-slate-900/30 px-4 py-3 shadow-lg hover:shadow-xl transition-all hover:border-white/20 hover:scale-[1.01]">
                      <div className="flex items-center gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-slate-700 to-slate-800 text-lg font-black text-slate-400 ring-2 ring-white/10">
                          {index + 1}
                        </div>
                        <div>
                          <div className="font-bold text-slate-200">{state.name}</div>
                          <div className="text-xs font-medium text-slate-500">{state.uf}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        {winner && (
                          <>
                            <div className="text-lg font-black" style={{ color: winner.color, textShadow: `0 0 20px ${winner.color}40` }}>
                              {winner.name}
                            </div>
                            <div className="text-sm font-medium text-slate-400">{formatPct(result.votes[result.winner!])}</div>
                          </>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </main>

      <AnimatePresence>
        {selectedStateInfo && stateDialog?.view === "menu" && (
          <StateActionModal
            key={`${selectedStateInfo.uf}-menu`}
            stateInfo={selectedStateInfo}
            onClose={() => setStateDialog(null)}
            onEdit={() => setStateDialog({ uf: selectedStateInfo.uf, view: "edit" })}
            onPhoto={() => setStateDialog({ uf: selectedStateInfo.uf, view: "photo" })}
            onMunicipalityEdit={() => setStateDialog({ uf: selectedStateInfo.uf, view: "municipios" })}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedStateInfo && stateDialog?.view === "edit" && (
          <StateModal
            key={`${selectedStateInfo.uf}-edit`}
            stateInfo={selectedStateInfo}
            initialResult={results[selectedStateInfo.uf]}
            candidates={candidates}
            onClose={() => setStateDialog(null)}
            onSave={handleStateSave}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedStateInfo && stateDialog?.view === "municipios" && (
          <MunicipalityPaintModal
            key={`${selectedStateInfo.uf}-municipios`}
            stateInfo={selectedStateInfo}
            candidates={candidates}
            initialPaint={results[selectedStateInfo.uf]?.municipalityPaint ?? {}}
            onClose={() => setStateDialog(null)}
            onSave={(paint) => handleMunicipalitySave(selectedStateInfo.uf, paint)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedStateInfo && stateDialog?.view === "photo" && (
          <StatePhotoModal
            key={`${selectedStateInfo.uf}-photo`}
            stateInfo={selectedStateInfo}
            candidates={candidates}
            result={results[selectedStateInfo.uf]}
            photoScale={nationalPhotoScale}
            photoMapScale={photoMapScale}
            onClose={() => setStateDialog(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {nationalPhotoOpen && (
          <NationalPhotoModal candidates={sortedCandidates} national={national} paths={paths} results={results}
            photoScale={nationalPhotoScale} photoMapScale={photoMapScale} candidateById={candidateById} onClose={() => setNationalPhotoOpen(false)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {regionalPhotoOpen && (
          <RegionalPhotoModal region={selectedPhotoRegion} onRegionChange={setSelectedPhotoRegion} candidates={sortedCandidates}
            paths={paths} stateGeoData={stateGeoData} results={results} photoScale={nationalPhotoScale} photoMapScale={photoMapScale} candidateById={candidateById} onClose={() => setRegionalPhotoOpen(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}

function CandidateManager({
  round, candidates, neonStates, photoScale, photoMapScale, onNeonStatesChange, onPhotoScaleChange, onPhotoMapScaleChange, onChange,
}: {
  round: ElectionRound;
  candidates: Candidate[];
  neonStates: boolean;
  photoScale: number;
  photoMapScale: number;
  onNeonStatesChange: (value: boolean) => void;
  onPhotoScaleChange: (value: number) => void;
  onPhotoMapScaleChange: (value: number) => void;
  onChange: (candidates: Candidate[]) => void;
}) {
  const updateCandidate = (id: CandidateId, updates: Partial<Candidate>) => {
    onChange(candidates.map((candidate) => (candidate.id === id ? { ...candidate, ...updates } : candidate)));
  };

  const addCandidate = () => {
    const nextId = Math.max(...candidates.map((candidate) => candidate.id), 0) + 1;
    const color = DEFAULT_COLORS[(nextId - 1) % DEFAULT_COLORS.length];
    onChange([...candidates, { id: nextId, name: `Candidato ${nextId}`, vice: `Vice ${nextId}`, party: `Partido ${nextId}`, number: String(nextId), color }]);
  };

  const removeCandidate = (id: CandidateId) => {
    if (candidates.length <= 2) return;
    onChange(candidates.filter((candidate) => candidate.id !== id));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-black text-white">Candidatos</h3>
        {round === "primeiro" && (
          <button type="button" onClick={addCandidate} className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-300">
            + Adicionar
          </button>
        )}
      </div>
      <div className="grid gap-4">
        {candidates.map((candidate) => (
          <div key={candidate.id} className="rounded-xl border border-white/10 bg-slate-900/50 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-black text-white">{candidate.name || `Candidato ${candidate.id}`}</div>
              {round === "primeiro" && candidates.length > 2 && (
                <button type="button" onClick={() => removeCandidate(candidate.id)} className="text-xs font-bold text-red-300 hover:text-red-200">Remover</button>
              )}
            </div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-3 mb-2">
              <input type="text" value={candidate.name} onChange={(event) => updateCandidate(candidate.id, { name: event.target.value })}
                className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200" placeholder="Nome" />
              <input type="text" value={candidate.vice} onChange={(event) => updateCandidate(candidate.id, { vice: event.target.value })}
                className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200" placeholder="Vice" />
              <input type="text" value={candidate.party} onChange={(event) => updateCandidate(candidate.id, { party: event.target.value })}
                className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200" placeholder="Partido" />
            </div>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <input type="text" value={candidate.number} onChange={(event) => updateCandidate(candidate.id, { number: event.target.value })}
                className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200" placeholder="Numero" />
              <input type="color" value={candidate.color} onChange={(event) => updateCandidate(candidate.id, { color: event.target.value })}
                className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950 cursor-pointer" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <SimpleUpload label="Foto" image={candidate.photo} borderColor={candidate.color}
                onUpload={(photo) => updateCandidate(candidate.id, { photo })}
                onRemove={() => updateCandidate(candidate.id, { photo: undefined })} rounded="full" />
              <SimpleUpload label="Foto Vice" image={candidate.vicePhoto} borderColor={candidate.color}
                onUpload={(vicePhoto) => updateCandidate(candidate.id, { vicePhoto })}
                onRemove={() => updateCandidate(candidate.id, { vicePhoto: undefined })} rounded="full" />
              <SimpleUpload label="Logo" image={candidate.partyLogo}
                onUpload={(partyLogo) => updateCandidate(candidate.id, { partyLogo })}
                onRemove={() => updateCandidate(candidate.id, { partyLogo: undefined })} rounded="lg" />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <label className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-sm font-semibold text-slate-300">
          Efeito neon
          <input type="checkbox" checked={neonStates} onChange={(event) => onNeonStatesChange(event.target.checked)} className="h-4 w-4 accent-emerald-500" />
        </label>
        <div className="rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2">
          <div className="mb-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Escala avatar foto</div>
          <input type="range" min={1.1} max={1.9} step={0.05} value={photoScale}
            onChange={(event) => onPhotoScaleChange(Number(event.target.value))}
            className="h-2 w-full appearance-none rounded-full bg-slate-700" />
          <div className="text-right text-[10px] text-slate-500 mt-0.5">{photoScale.toFixed(2)}x</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2">
          <div className="mb-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Tamanho mapa foto</div>
          <input type="range" min={280} max={800} step={20} value={photoMapScale}
            onChange={(event) => onPhotoMapScaleChange(Number(event.target.value))}
            className="h-2 w-full appearance-none rounded-full bg-slate-700" />
          <div className="text-right text-[10px] text-slate-500 mt-0.5">{photoMapScale}px</div>
        </div>
      </div>
    </div>
  );
}

function SimpleUpload({ label, image, onUpload, onRemove, borderColor = "#475569", rounded }: {
  label: string;
  image?: string;
  onUpload: (base64: string) => void;
  onRemove: () => void;
  borderColor?: string;
  rounded: "full" | "lg";
}) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">{label}</div>
      {image ? (
        <div className="flex flex-col items-center gap-1">
          <div
            className={`h-12 w-12 overflow-hidden border-2 ${rounded === "full" ? "rounded-full" : "rounded-lg bg-slate-800"}`}
            style={{ borderColor }}
          >
            <img src={image} alt={label} className="h-full w-full object-cover" />
          </div>
          <button type="button" onClick={onRemove} className="text-[10px] font-bold text-red-400 hover:text-red-300">Remover</button>
        </div>
      ) : (
        <label className="flex h-14 cursor-pointer items-center justify-center rounded-lg border border-dashed border-slate-600 bg-slate-900/50 text-[10px] font-bold text-slate-400 hover:border-white/30 hover:bg-slate-800 transition-all">
          Upload
          <input type="file" accept="image/*" className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) readFileAsBase64(file, onUpload);
            }} />
        </label>
      )}
    </div>
  );
}

function StateActionModal({ stateInfo, onClose, onEdit, onPhoto, onMunicipalityEdit }: {
  stateInfo: StateInfo;
  onClose: () => void;
  onEdit: () => void;
  onPhoto: () => void;
  onMunicipalityEdit: () => void;
}) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/80 p-4 backdrop-blur-sm">
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 14, opacity: 0 }}
        className="mx-auto mt-24 w-full max-w-xl rounded-3xl border border-white/10 bg-slate-950 p-6">
        <div className="mb-6 text-center">
          <h3 className="text-3xl font-black text-white">{stateInfo.name}</h3>
          <p className="text-sm text-slate-400">Escolha uma acao para este estado</p>
        </div>
        <div className="grid gap-3">
          <button type="button" onClick={onPhoto} className="rounded-xl bg-violet-600 px-4 py-4 text-left text-white">
            <div className="text-lg font-black">Foto estadual</div>
            <div className="text-sm text-violet-100">Visual completo do resultado no estado</div>
          </button>
          <button type="button" onClick={onEdit} className="rounded-xl bg-emerald-600 px-4 py-4 text-left text-white">
            <div className="text-lg font-black">Alterar porcentagens</div>
            <div className="text-sm text-emerald-100">Editar votos de todos os candidatos</div>
          </button>
          <button type="button" onClick={onMunicipalityEdit} className="rounded-xl bg-blue-600 px-4 py-4 text-left text-white">
            <div className="text-lg font-black">Alterar municipios</div>
            <div className="text-sm text-blue-100">Pinte os municipios manualmente por candidato</div>
          </button>
          <button type="button" onClick={onClose} className="rounded-xl border border-white/15 px-4 py-3 text-sm font-bold text-slate-200">
            Fechar
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function MunicipalityPaintModal({ stateInfo, candidates, initialPaint, onClose, onSave }: {
  stateInfo: StateInfo;
  candidates: Candidate[];
  initialPaint: Record<string, CandidateId>;
  onClose: () => void;
  onSave: (paint: Record<string, CandidateId>) => void;
}) {
  const [paths, setPaths] = useState<MunicipalityPath[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateId | null>(candidates[0]?.id ?? null);
  const [paint, setPaint] = useState<Record<string, CandidateId>>(initialPaint);
  const isPaintingRef = useRef(false);

  useEffect(() => {
    let active = true;
    fetchMunicipalityGeo(stateInfo.ibgeCode).then((geo) => {
      if (!active) return;
      if (geo) setPaths(buildMunicipalityPaths(geo));
      setLoading(false);
    }).catch(() => {
      if (!active) return;
      setLoading(false);
    });
    return () => { active = false; };
  }, [stateInfo.ibgeCode]);

  // Listeners globais para encerrar a pintura mesmo se o mouse sair do SVG
  useEffect(() => {
    const stopPainting = () => { isPaintingRef.current = false; };
    window.addEventListener("mouseup", stopPainting);
    window.addEventListener("blur", stopPainting);
    return () => {
      window.removeEventListener("mouseup", stopPainting);
      window.removeEventListener("blur", stopPainting);
    };
  }, []);

  const candidateById = useMemo(() => Object.fromEntries(candidates.map((candidate) => [candidate.id, candidate])), [candidates]);

  const applyPaint = (municipalityCode: string) => {
    setPaint((prev) => {
      const next = { ...prev };
      if (!selectedCandidate) {
        if (!(municipalityCode in next)) return prev;
        delete next[municipalityCode];
        return next;
      }
      if (next[municipalityCode] === selectedCandidate) return prev;
      next[municipalityCode] = selectedCandidate;
      return next;
    });
  };

  const handleMunicipalityMouseDown = (municipalityCode: string, event: React.MouseEvent) => {
    if (event.button !== 0) return;
    event.preventDefault();
    isPaintingRef.current = true;
    applyPaint(municipalityCode);
  };

  const handleMunicipalityMouseEnter = (municipalityCode: string, event: React.MouseEvent) => {
    // Se o botao esquerdo continua pressionado mesmo apos entrar (caso o usuario tenha iniciado fora)
    if (!isPaintingRef.current) {
      if (event.buttons === 1) {
        isPaintingRef.current = true;
      } else {
        return;
      }
    }
    applyPaint(municipalityCode);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 overflow-y-auto bg-black/80 p-4 backdrop-blur-sm">
      <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }} className="mx-auto w-full max-w-6xl rounded-3xl border border-white/10 bg-slate-950 p-6">
        <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-3xl font-black text-white">Alterar municipios - {stateInfo.name}</h3>
            <p className="text-sm text-slate-400">Selecione um candidato e clique (ou segure e arraste) sobre os municipios para colorir.</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => onSave(paint)} className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-black text-zinc-950">Salvar municipios</button>
            <button type="button" onClick={onClose} className="rounded-xl border border-white/15 px-4 py-2 text-sm font-bold text-white">Fechar</button>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          {candidates.map((candidate) => (
            <button
              key={candidate.id}
              type="button"
              onClick={() => setSelectedCandidate(candidate.id)}
              className={`rounded-xl px-3 py-2 text-xs font-black transition-all ${selectedCandidate === candidate.id ? "ring-2 ring-white" : "opacity-85"}`}
              style={{ backgroundColor: `${candidate.color}33`, color: candidate.color, border: `1px solid ${candidate.color}66` }}
            >
              {candidate.name}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setSelectedCandidate(null)}
            className={`rounded-xl border px-3 py-2 text-xs font-black transition-all ${selectedCandidate === null ? "border-white text-white" : "border-slate-600 text-slate-300"}`}
          >
            Borracha
          </button>
          <button type="button" onClick={() => setPaint({})} className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs font-black text-red-300">
            Limpar pintura
          </button>
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-3">
          {loading ? (
            <div className="flex h-[68vh] items-center justify-center">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-700 border-t-emerald-500" />
            </div>
          ) : paths.length === 0 ? (
            <div className="flex h-[68vh] items-center justify-center text-slate-400">Nao foi possivel carregar os municipios.</div>
          ) : (
            <svg
              viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
              className="h-[68vh] w-full select-none"
              onMouseLeave={() => { isPaintingRef.current = false; }}
              onContextMenu={(event) => event.preventDefault()}
              style={{ touchAction: "none" }}
            >
              {paths.map((pathItem) => {
                const candidate = candidateById[paint[pathItem.code]];
                return (
                  <path
                    key={pathItem.code}
                    d={pathItem.d}
                    fill={candidate ? candidate.color : "#0f172a"}
                    stroke={candidate ? shadeHex(candidate.color, 0.3, "black") : "#1f2937"}
                    strokeWidth={0.7}
                    className="cursor-pointer transition-colors duration-150 hover:brightness-125"
                    onMouseDown={(event) => handleMunicipalityMouseDown(pathItem.code, event)}
                    onMouseEnter={(event) => handleMunicipalityMouseEnter(pathItem.code, event)}
                  />
                );
              })}
            </svg>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function StateSilhouetteMap({
  uf, ibgeCode, winnerColor, winnerPct,
}: {
  uf: string; ibgeCode: string; winnerColor: string | null; winnerPct: number;
}) {
  const [municipalityPaths, setMunicipalityPaths] = useState<MunicipalityPath[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    const run = async () => {
      setLoading(true);
      const geo = await fetchMunicipalityGeo(ibgeCode);
      if (!active) return;
      if (geo) setMunicipalityPaths(buildMunicipalityPaths(geo));
      setLoaded(true);
      setLoading(false);
    };
    run().catch(() => {
      if (!active) return;
      setLoaded(true);
      setLoading(false);
    });
    return () => { active = false; };
  }, [ibgeCode]);

  if (loading || !loaded) {
    return (
      <div className="flex h-48 items-center justify-center text-slate-500">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-700 border-t-emerald-500" />
      </div>
    );
  }

  if (municipalityPaths.length === 0) {
    return <div className="flex h-48 items-center justify-center text-slate-500 text-sm">Mapa indisponivel</div>;
  }

  const fill = winnerColor ? getColorByWinnerPct(winnerColor, winnerPct) : "#1e293b";
  const stroke = winnerColor ? shadeHex(winnerColor, 0.4, "black") : "#334155";

  return (
    <svg viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`} className="h-48 w-full rounded-xl">
      {municipalityPaths.map((p) => (
        <path key={p.code} d={p.d} fill={fill} stroke={stroke} strokeWidth={0.6} />
      ))}
      <text x={VIEWBOX_WIDTH / 2} y={VIEWBOX_HEIGHT / 2} textAnchor="middle" dominantBaseline="central"
        fill="rgba(255,255,255,0.12)" style={{ fontSize: "160px", fontWeight: 900 }}>
        {uf}
      </text>
    </svg>
  );
}

interface RankedItem {
  candidate: Candidate;
  pct: number;
  votes?: number;
}

function TopCandidateCard({ item, rank, avatarPx, showVice = true, showVotes = false }: {
  item: RankedItem; rank: number; avatarPx: number; showVice?: boolean; showVotes?: boolean;
}) {
  const { candidate, pct, votes } = item;
  const isFirst = rank === 0;
  return (
    <div className="rounded-3xl border bg-slate-900/60 p-6 text-center flex flex-col items-center" style={{ borderColor: `${candidate.color}40` }}>
      <div className="mb-3 px-4 py-1 rounded-full text-xs font-black uppercase tracking-widest"
        style={{ backgroundColor: `${candidate.color}25`, color: candidate.color, border: `1px solid ${candidate.color}50` }}>
        {isFirst ? "Vencedor" : "2o Colocado"}
      </div>
      {candidate.partyLogo && (
        <div className="mb-3 h-10 w-auto flex items-center justify-center">
          <img src={candidate.partyLogo} alt={candidate.party} className="h-10 object-contain" />
        </div>
      )}
      <div className="mb-3 overflow-hidden rounded-full border-4 bg-slate-900 flex-shrink-0"
        style={{ width: avatarPx, height: avatarPx, borderColor: candidate.color }}>
        {candidate.photo ? (
          <img src={candidate.photo} alt={candidate.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-3xl font-black" style={{ color: candidate.color }}>
            {candidate.number}
          </div>
        )}
      </div>
      <div className="text-3xl font-black mb-1" style={{ color: candidate.color }}>{candidate.name}</div>
      {showVice && candidate.vice && (
        <div className="flex items-center gap-2 mb-2">
          {candidate.vicePhoto && (
            <div className="h-8 w-8 overflow-hidden rounded-full border-2" style={{ borderColor: candidate.color }}>
              <img src={candidate.vicePhoto} alt={candidate.vice} className="h-full w-full object-cover" />
            </div>
          )}
          <div className="text-xs font-semibold text-slate-400">Vice: {candidate.vice}</div>
        </div>
      )}
      {!candidate.partyLogo && <div className="text-xs font-bold text-slate-500 mb-2">{candidate.party}</div>}
      <div className="mb-3 text-sm font-black rounded-lg px-3 py-1" style={{ backgroundColor: `${candidate.color}20`, color: candidate.color }}>
        #{candidate.number}
      </div>
      <div className="text-6xl font-black text-white">{formatPct(pct)}</div>
      {showVotes && votes !== undefined && (
        <div className="mt-1 text-sm text-slate-500">{Math.round(votes).toLocaleString("pt-BR")} votos</div>
      )}
    </div>
  );
}

function BottomCandidateCard({ item, avatarPx, showVotes = false }: {
  item: RankedItem; avatarPx: number; showVotes?: boolean;
}) {
  const { candidate, pct, votes } = item;
  return (
    <div className="rounded-2xl border bg-slate-900/40 p-4 text-center flex flex-col items-center" style={{ borderColor: `${candidate.color}30` }}>
      {candidate.partyLogo && (
        <div className="mb-2 h-7 flex items-center justify-center">
          <img src={candidate.partyLogo} alt={candidate.party} className="h-7 object-contain" />
        </div>
      )}
      <div className="mb-2 overflow-hidden rounded-full border-2 bg-slate-900" style={{ width: avatarPx, height: avatarPx, borderColor: candidate.color }}>
        {candidate.photo ? (
          <img src={candidate.photo} alt={candidate.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm font-black" style={{ color: candidate.color }}>
            {candidate.number}
          </div>
        )}
      </div>
      <div className="text-lg font-black mb-0.5" style={{ color: candidate.color }}>{candidate.name}</div>
      {!candidate.partyLogo && <div className="text-xs text-slate-500 mb-0.5">{candidate.party}</div>}
      <div className="text-xs font-bold mb-1" style={{ color: candidate.color }}>#{candidate.number}</div>
      <div className="text-2xl font-black text-white">{formatPct(pct)}</div>
      {showVotes && votes !== undefined && (
        <div className="text-xs text-slate-500">{Math.round(votes).toLocaleString("pt-BR")}</div>
      )}
    </div>
  );
}

function OthersCard({ othersPct, othersVotes, avatarPx, showVotes = false }: {
  othersPct: number; othersVotes?: number; avatarPx: number; showVotes?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-600/40 bg-slate-900/40 p-4 text-center flex flex-col items-center">
      <div className="mb-2 overflow-hidden rounded-full border-2 border-slate-500 bg-slate-800 flex items-center justify-center" style={{ width: avatarPx, height: avatarPx }}>
        <UserIcon className="h-3/5 w-3/5 text-slate-400" />
      </div>
      <div className="text-lg font-black mb-0.5 text-slate-300">Outros</div>
      <div className="text-xs text-slate-500 mb-1">Demais candidatos</div>
      <div className="text-2xl font-black text-white">{formatPct(othersPct)}</div>
      {showVotes && othersVotes !== undefined && (
        <div className="text-xs text-slate-500">{Math.round(othersVotes).toLocaleString("pt-BR")}</div>
      )}
    </div>
  );
}

function NationalMapCenter({
  paths, results, candidateById, mapSizePx,
}: {
  paths: PathData[];
  results: Record<string, StateResult>;
  candidateById: Record<number, Candidate>;
  mapSizePx: number;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-2 flex-shrink-0" style={{ width: mapSizePx }}>
      <svg
        viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
        width={mapSizePx}
        height={Math.round(mapSizePx * (VIEWBOX_HEIGHT / VIEWBOX_WIDTH))}
        className="drop-shadow-[0_20px_60px_rgba(0,0,0,0.8)]"
        style={{ display: "block" }}
      >
        {paths.map((pathItem) => {
          const result = results[pathItem.uf];
          const winner = result?.winner ? candidateById[result.winner] : null;
          const pct = result?.winner ? result.votes[result.winner] : 0;
          const fill = winner ? getColorByWinnerPct(winner.color, pct) : "#0f172a";
          return (
            <path key={pathItem.uf} d={pathItem.d} fill={fill} stroke="#1e293b" strokeWidth={1.5} />
          );
        })}
      </svg>
    </div>
  );
}

function RegionalMapCenter({
  regionPaths, results, candidateById, mapSizePx,
}: {
  regionPaths: PathData[];
  results: Record<string, StateResult>;
  candidateById: Record<number, Candidate>;
  mapSizePx: number;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-2 flex-shrink-0" style={{ width: mapSizePx }}>
      <svg
        viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
        width={mapSizePx}
        height={Math.round(mapSizePx * (VIEWBOX_HEIGHT / VIEWBOX_WIDTH))}
        className="drop-shadow-[0_20px_60px_rgba(0,0,0,0.8)]"
        style={{ display: "block" }}
      >
        {regionPaths.map((pathItem) => {
          const result = results[pathItem.uf];
          const winner = result?.winner ? candidateById[result.winner] : null;
          const pct = result?.winner ? result.votes[result.winner] : 0;
          const fill = winner ? getColorByWinnerPct(winner.color, pct) : "#0f172a";
          return (
            <path key={pathItem.uf} d={pathItem.d} fill={fill} stroke="#1e293b" strokeWidth={1.5} />
          );
        })}
      </svg>
    </div>
  );
}

function RegionalMunicipalityMapCenter({
  region, results, candidateById, mapSizePx,
}: {
  region: RegionName;
  results: Record<string, StateResult>;
  candidateById: Record<number, Candidate>;
  mapSizePx: number;
}) {
  const [paths, setPaths] = useState<RegionalMunicipalityPath[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setPaths([]);
    const run = async () => {
      const statesInRegion = STATES.filter((state) => state.region === region);
      const collected: any[] = [];
      await Promise.all(statesInRegion.map(async (state) => {
        const geo = await fetchMunicipalityGeo(state.ibgeCode);
        if (geo?.features) {
          for (const feature of geo.features) {
            if (!feature.properties) feature.properties = {};
            feature.properties._uf = state.uf;
            collected.push(feature);
          }
        }
      }));
      if (!active) return;
      setPaths(buildRegionalMunicipalityPaths(collected));
      setLoading(false);
    };
    run().catch(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [region]);

  const svgH = Math.round(mapSizePx * (VIEWBOX_HEIGHT / VIEWBOX_WIDTH));

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-2 flex-shrink-0" style={{ width: mapSizePx, height: svgH }}>
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-700 border-t-emerald-500" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center px-4 py-2 flex-shrink-0" style={{ width: mapSizePx }}>
      <svg
        viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
        width={mapSizePx}
        height={svgH}
        className="drop-shadow-[0_20px_60px_rgba(0,0,0,0.8)]"
        style={{ display: "block" }}
      >
        {paths.map((pathItem) => {
          const stateResult = results[pathItem.uf];
          const paintedId = stateResult?.municipalityPaint?.[pathItem.code];
          const paintedCandidate = paintedId ? candidateById[paintedId] : null;
          let fill = "#0f172a";
          let stroke = "#1e293b";
          if (paintedCandidate) {
            fill = paintedCandidate.color;
            stroke = shadeHex(paintedCandidate.color, 0.35, "black");
          } else if (stateResult?.winner) {
            const winner = candidateById[stateResult.winner];
            const pct = stateResult.votes[stateResult.winner] || 0;
            if (winner) {
              fill = getColorByWinnerPct(winner.color, pct);
              stroke = shadeHex(winner.color, 0.4, "black");
            }
          }
          return (
            <path key={`${pathItem.uf}-${pathItem.code}`} d={pathItem.d} fill={fill} stroke={stroke} strokeWidth={0.4} />
          );
        })}
      </svg>
    </div>
  );
}

function StateMapCenter({
  stateInfo, winnerColor, winnerPct, mapSizePx, showMunicipalityPaint, municipalityPaint, candidateById,
}: {
  stateInfo: StateInfo;
  winnerColor: string | null;
  winnerPct: number;
  mapSizePx: number;
  showMunicipalityPaint: boolean;
  municipalityPaint: Record<string, CandidateId>;
  candidateById: Record<number, Candidate>;
}) {
  const [municipalityPaths, setMunicipalityPaths] = useState<MunicipalityPath[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchMunicipalityGeo(stateInfo.ibgeCode).then((geo) => {
      if (!active) return;
      if (geo) setMunicipalityPaths(buildMunicipalityPaths(geo));
      setLoading(false);
    }).catch(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [stateInfo.ibgeCode]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-8 flex-shrink-0" style={{ width: mapSizePx }}>
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-700 border-t-emerald-500" />
      </div>
    );
  }

  const fallbackFill = winnerColor ? getColorByWinnerPct(winnerColor, winnerPct) : "#1e293b";
  const svgH = Math.round(mapSizePx * (VIEWBOX_HEIGHT / VIEWBOX_WIDTH));

  return (
    <div className="flex flex-col items-center justify-center px-4 py-2 flex-shrink-0" style={{ width: mapSizePx }}>
      <svg
        viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
        width={mapSizePx}
        height={svgH}
        className="drop-shadow-[0_20px_60px_rgba(0,0,0,0.8)]"
        style={{ display: "block" }}
      >
        {municipalityPaths.length > 0 ? (
          municipalityPaths.map((pathItem) => {
            const paintedCandidate = candidateById[municipalityPaint[pathItem.code]];
            const fill = showMunicipalityPaint && paintedCandidate
              ? paintedCandidate.color
              : fallbackFill;
            const stroke = showMunicipalityPaint
              ? (paintedCandidate ? shadeHex(paintedCandidate.color, 0.35, "black") : "#1e293b")
              : fallbackFill;
            return (
              <path key={pathItem.code} d={pathItem.d} fill={fill} stroke={stroke} strokeWidth={showMunicipalityPaint ? 0.55 : 0} />
            );
          })
        ) : (
          <text x={VIEWBOX_WIDTH / 2} y={VIEWBOX_HEIGHT / 2} textAnchor="middle" dominantBaseline="central"
            fill={winnerColor || "#64748b"} style={{ fontSize: "220px", fontWeight: 900, opacity: 0.4 }}>
            {stateInfo.uf}
          </text>
        )}
      </svg>
    </div>
  );
}

function MapSizeSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-900/80 px-4 py-2 backdrop-blur-sm">
      <span className="text-xs font-black uppercase tracking-widest text-slate-400 whitespace-nowrap">Mapa</span>
      <input
        type="range" min={280} max={800} step={20} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-28 appearance-none rounded-full bg-slate-700 accent-violet-500"
      />
      <span className="text-xs font-bold text-slate-400 w-12 text-right">{value}px</span>
    </div>
  );
}

function StatePhotoModal({ stateInfo, candidates, result, photoScale, photoMapScale, onClose }: {
  stateInfo: StateInfo;
  candidates: Candidate[];
  result?: StateResult;
  photoScale: number;
  photoMapScale: number;
  onClose: () => void;
}) {
  const captureRef = useRef<HTMLDivElement>(null);
  const [localMapScale, setLocalMapScale] = useState(photoMapScale);
  const [showMunicipalityPaint, setShowMunicipalityPaint] = useState(result?.usesMunicipalities ?? false);

  const ranked = useMemo(() => {
    const rows = candidates
      .map((candidate) => {
        const pct = result?.votes?.[candidate.id] ?? 0;
        const votes = (pct / 100) * stateInfo.voters;
        return { candidate, pct, votes };
      })
      .sort((a, b) => b.pct - a.pct);
    const totalVotes = rows.reduce((sum, item) => sum + item.votes, 0);
    const first = rows[0] ?? null;
    const second = rows[1] ?? null;
    const lower = rows.slice(2);
    const bottom3 = lower.slice(0, 3);
    const rest = lower.slice(3);
    const othersPct = rest.reduce((sum, item) => sum + item.pct, 0);
    const othersVotes = rest.reduce((sum, item) => sum + item.votes, 0);
    return { first, second, bottom3, othersPct, othersVotes, totalVotes, hasOthers: rest.length > 0 };
  }, [candidates, result, stateInfo.voters]);

  const candidateById = useMemo(() => Object.fromEntries(candidates.map((candidate) => [candidate.id, candidate])), [candidates]);

  const winnerCandidate = ranked.first?.candidate;
  const winnerColor = winnerCandidate?.color ?? null;
  const winnerPct = ranked.first?.pct ?? 0;

  const handleDownload = async () => {
    if (!captureRef.current) return;
    const canvas = await html2canvas(captureRef.current, { backgroundColor: "#0f172a", scale: 2, useCORS: true, logging: false });
    const anchor = document.createElement("a");
    anchor.href = canvas.toDataURL("image/png");
    anchor.download = `foto-estado-${stateInfo.uf}-${Date.now()}.png`;
    anchor.click();
  };

  const topAvatarPx = Math.round(150 * photoScale);
  const bottomAvatarPx = Math.round(80 * photoScale);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 overflow-y-auto bg-black/80 p-4 backdrop-blur-sm">
      <div className="mx-auto w-full max-w-[1600px]">
        <div className="mb-4 flex items-center justify-between flex-wrap gap-3">
          <h3 className="text-3xl font-black text-white">Foto estadual - {stateInfo.name}</h3>
          <div className="flex gap-2 items-center flex-wrap">
            <div className="flex rounded-xl border border-white/10 bg-slate-900/80 p-1">
              <button
                type="button"
                onClick={() => setShowMunicipalityPaint(false)}
                className={`rounded-lg px-3 py-1 text-xs font-black ${showMunicipalityPaint ? "text-slate-300" : "bg-violet-600 text-white"}`}
              >
                Sem municipio
              </button>
              <button
                type="button"
                onClick={() => setShowMunicipalityPaint(true)}
                className={`rounded-lg px-3 py-1 text-xs font-black ${showMunicipalityPaint ? "bg-violet-600 text-white" : "text-slate-300"}`}
              >
                Com municipio
              </button>
            </div>
            <MapSizeSlider value={localMapScale} onChange={setLocalMapScale} />
            <button type="button" onClick={handleDownload} className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-black text-zinc-950">Salvar PNG</button>
            <button type="button" onClick={onClose} className="rounded-xl border border-white/15 px-4 py-2 text-sm font-bold text-white">Fechar</button>
          </div>
        </div>

        <div ref={captureRef} className="rounded-[40px] border border-white/10 bg-slate-950 p-8">
          <div className="mb-6 text-center">
            <div className="text-[11px] font-black uppercase tracking-[0.6em] text-slate-500">Resultado Eleicao 2026 - {stateInfo.name}</div>
          </div>

          <div className="flex items-center justify-center gap-4 mb-8 flex-wrap md:flex-nowrap">
            {ranked.first && (
              <div className="flex-1 min-w-[220px]">
                <TopCandidateCard item={ranked.first} rank={0} avatarPx={topAvatarPx} showVice={true} showVotes={true} />
              </div>
            )}
            <StateMapCenter
              stateInfo={stateInfo}
              winnerColor={winnerColor}
              winnerPct={winnerPct}
              mapSizePx={localMapScale}
              showMunicipalityPaint={showMunicipalityPaint}
              municipalityPaint={result?.municipalityPaint ?? {}}
              candidateById={candidateById}
            />
            {ranked.second && (
              <div className="flex-1 min-w-[220px]">
                <TopCandidateCard item={ranked.second} rank={1} avatarPx={topAvatarPx} showVice={true} showVotes={true} />
              </div>
            )}
          </div>

          {(ranked.bottom3.length > 0 || ranked.hasOthers) && (
            <div className="flex justify-center mb-8">
              <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${ranked.bottom3.length + (ranked.hasOthers ? 1 : 0)}, minmax(0, 200px))` }}>
                {ranked.bottom3.map((item) => (
                  <BottomCandidateCard key={item.candidate.id} item={item} avatarPx={bottomAvatarPx} showVotes={true} />
                ))}
                {ranked.hasOthers && <OthersCard othersPct={ranked.othersPct} othersVotes={ranked.othersVotes} avatarPx={bottomAvatarPx} showVotes={true} />}
              </div>
            </div>
          )}

          <div className="mt-4 text-center">
            <div className="inline-block rounded-full bg-white/5 px-12 py-5 border border-white/10 shadow-2xl">
              <div className="text-4xl font-black text-white">{Math.round(ranked.totalVotes).toLocaleString("pt-BR")}</div>
              <div className="text-[11px] font-black uppercase tracking-[0.4em] text-slate-500 mt-1">Votos Estimados</div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function StateModal({ stateInfo, initialResult, candidates, onClose, onSave }: {
  stateInfo: StateInfo;
  initialResult?: StateResult;
  candidates: Candidate[];
  onClose: () => void;
  onSave: (result: StateResult) => void;
}) {
  const [votes, setVotes] = useState<Record<CandidateId, number>>(() => {
    if (initialResult) return initialResult.votes;
    const initialVotes: Record<CandidateId, number> = {};
    const equalShare = 100 / candidates.length;
    candidates.forEach((c) => { initialVotes[c.id] = equalShare; });
    return initialVotes;
  });

  const handleSliderChange = (candidateId: CandidateId, value: number) => {
    const newVotes = { ...votes, [candidateId]: value };
    const total = Object.values(newVotes).reduce((sum, v) => sum + v, 0);
    const scale = 100 / total;
    Object.keys(newVotes).forEach((id) => { newVotes[Number(id)] = newVotes[Number(id)] * scale; });
    setVotes(newVotes);
  };

  const handleSave = () => {
    const normalized: Record<CandidateId, number> = {};
    const total = Object.values(votes).reduce((sum, v) => sum + v, 0);
    Object.keys(votes).forEach((id) => {
      normalized[Number(id)] = total > 0 ? (votes[Number(id)] / total) * 100 : 0;
    });
    const municipalityPaint = initialResult?.municipalityPaint ?? {};
    onSave({
      uf: stateInfo.uf,
      votes: normalized,
      winner: getWinner(normalized),
      usesMunicipalities: Object.keys(municipalityPaint).length > 0,
      municipalities: initialResult?.municipalities ?? {},
      municipalityPaint,
    });
  };

  const currentWinnerId = getWinner(votes);
  const currentWinnerCandidate = currentWinnerId ? candidates.find((c) => c.id === currentWinnerId) : null;
  const currentWinnerPct = currentWinnerId ? (votes[currentWinnerId] ?? 0) : 0;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 overflow-y-auto bg-black/80 p-4 backdrop-blur-sm">
      <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 25, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="mx-auto w-full max-w-4xl rounded-3xl border border-white/10 bg-gradient-to-b from-slate-950 to-slate-900 p-6 shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 px-4 py-2 text-lg font-black text-white shadow-lg">
                {stateInfo.uf}
              </div>
              <h2 className="text-4xl font-black text-white">{stateInfo.name}</h2>
            </div>
            <p className="mt-2 text-sm text-slate-400">{stateInfo.voters.toLocaleString("pt-BR")} votos estimados</p>
          </div>
          <button type="button" onClick={onClose} className="group flex h-12 w-12 items-center justify-center rounded-xl border border-white/15 bg-slate-800 text-white transition-all hover:scale-110 hover:bg-slate-700 hover:border-white/30">
            <svg className="h-6 w-6 transition-transform group-hover:rotate-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-6">
          {candidates.map((candidate) => (
            <div key={candidate.id} className="rounded-2xl border border-white/10 bg-slate-900/50 p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full border-2 bg-slate-950" style={{ borderColor: candidate.color }}>
                    {candidate.photo ? (
                      <img src={candidate.photo} alt={candidate.name} className="h-full w-full rounded-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-sm font-black" style={{ color: candidate.color }}>
                        {candidate.number}
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="text-lg font-black" style={{ color: candidate.color }}>{candidate.name}</div>
                    <div className="text-xs text-slate-400">{candidate.party}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-black text-white">{formatPct(votes[candidate.id] || 0)}</div>
                  <div className="text-xs text-slate-400">{Math.round(((votes[candidate.id] || 0) / 100) * stateInfo.voters).toLocaleString("pt-BR")} votos</div>
                </div>
              </div>
              <input type="range" min={0} max={100} step={0.1} value={votes[candidate.id] || 0}
                onChange={(e) => handleSliderChange(candidate.id, Number(e.target.value))}
                className="h-3 w-full appearance-none rounded-full bg-slate-800 cursor-pointer" />
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-slate-900/60 p-4">
          <div className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
            Visualizacao do estado
            {currentWinnerCandidate && (
              <span className="ml-2" style={{ color: currentWinnerCandidate.color }}>
                {currentWinnerCandidate.name} lidera ({formatPct(currentWinnerPct)})
              </span>
            )}
          </div>
          <StateSilhouetteMap
            uf={stateInfo.uf}
            ibgeCode={stateInfo.ibgeCode}
            winnerColor={currentWinnerCandidate?.color ?? null}
            winnerPct={currentWinnerPct}
          />
        </div>

        <button type="button" onClick={handleSave}
          className="mt-6 w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-4 text-lg font-black text-white shadow-lg shadow-emerald-500/25 transition-all hover:scale-105">
          Salvar Estado
        </button>
      </motion.div>
    </motion.div>
  );
}

function NationalPhotoModal({ candidates, national, paths, results, photoScale, photoMapScale, candidateById, onClose }: {
  candidates: Candidate[];
  national: any;
  paths: PathData[];
  results: Record<string, StateResult>;
  photoScale: number;
  photoMapScale: number;
  candidateById: Record<number, Candidate>;
  onClose: () => void;
}) {
  const captureRef = useRef<HTMLDivElement>(null);
  const [localMapScale, setLocalMapScale] = useState(photoMapScale);

  const ranked = useMemo(() => {
    const rows = candidates.map((c) => ({
      candidate: c,
      pct: national.candidatePcts[c.id] || 0,
      votes: national.candidateVotes[c.id] || 0,
    })).sort((a, b) => b.pct - a.pct);
    const first = rows[0] ?? null;
    const second = rows[1] ?? null;
    const lower = rows.slice(2);
    const bottom3 = lower.slice(0, 3);
    const rest = lower.slice(3);
    const othersPct = rest.reduce((sum, item) => sum + item.pct, 0);
    const othersVotes = rest.reduce((sum, item) => sum + (item.votes ?? 0), 0);
    return { first, second, bottom3, othersPct, othersVotes, hasOthers: rest.length > 0 };
  }, [candidates, national]);

  const topAvatarPx = Math.round(150 * photoScale);
  const bottomAvatarPx = Math.round(80 * photoScale);

  const handleDownload = async () => {
    if (!captureRef.current) return;
    const canvas = await html2canvas(captureRef.current, { backgroundColor: "#0f172a", scale: 2, useCORS: true, logging: false });
    const anchor = document.createElement("a");
    anchor.href = canvas.toDataURL("image/png");
    anchor.download = `foto-nacional-${Date.now()}.png`;
    anchor.click();
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 overflow-y-auto bg-black/80 p-4 backdrop-blur-sm">
      <div className="mx-auto w-full max-w-[1900px]">
        <div className="mb-5 flex items-center justify-between text-white flex-wrap gap-3">
          <h2 className="text-3xl font-black">Foto nacional</h2>
          <div className="flex gap-3 items-center flex-wrap">
            <MapSizeSlider value={localMapScale} onChange={setLocalMapScale} />
            <button type="button" onClick={handleDownload} className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-3 text-sm font-black text-white shadow-lg transition-all hover:scale-105">
              Salvar PNG
            </button>
            <button type="button" onClick={onClose} className="rounded-xl border border-white/15 bg-slate-800/80 px-6 py-3 text-sm font-bold transition-all hover:bg-slate-700">
              Fechar
            </button>
          </div>
        </div>

        <div ref={captureRef} className="rounded-[50px] border border-white/10 bg-slate-950 p-12 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.7)]">
          <div className="mb-6 text-center">
            <div className="text-[11px] font-black uppercase tracking-[0.6em] text-slate-500">Resultado Eleicao 2026</div>
          </div>

          <div className="flex items-center justify-center gap-6 mb-8 flex-wrap md:flex-nowrap">
            {ranked.first && (
              <div className="flex-1 min-w-[220px]">
                <TopCandidateCard item={ranked.first} rank={0} avatarPx={topAvatarPx} showVice={true} showVotes={true} />
              </div>
            )}
            <NationalMapCenter paths={paths} results={results} candidateById={candidateById} mapSizePx={localMapScale} />
            {ranked.second && (
              <div className="flex-1 min-w-[220px]">
                <TopCandidateCard item={ranked.second} rank={1} avatarPx={topAvatarPx} showVice={true} showVotes={true} />
              </div>
            )}
          </div>

          {(ranked.bottom3.length > 0 || ranked.hasOthers) && (
            <div className="flex justify-center mb-8">
              <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${ranked.bottom3.length + (ranked.hasOthers ? 1 : 0)}, minmax(0, 200px))` }}>
                {ranked.bottom3.map((item) => (
                  <BottomCandidateCard key={item.candidate.id} item={item} avatarPx={bottomAvatarPx} showVotes={true} />
                ))}
                {ranked.hasOthers && <OthersCard othersPct={ranked.othersPct} othersVotes={ranked.othersVotes} avatarPx={bottomAvatarPx} showVotes={true} />}
              </div>
            </div>
          )}

          <div className="mt-8 text-center">
            <div className="inline-block rounded-full bg-white/5 px-12 py-5 border border-white/10 shadow-2xl">
              <div className="text-4xl font-black text-white">{Math.round(national.totalVotes).toLocaleString("pt-BR")}</div>
              <div className="text-[11px] font-black uppercase tracking-[0.4em] text-slate-500 mt-1">Votos Validos</div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function RegionalPhotoModal({ region, onRegionChange, candidates, paths, stateGeoData, results, photoScale, photoMapScale, candidateById, onClose }: {
  region: RegionName;
  onRegionChange: (region: RegionName) => void;
  candidates: Candidate[];
  paths: PathData[];
  stateGeoData: any;
  results: Record<string, StateResult>;
  photoScale: number;
  photoMapScale: number;
  candidateById: Record<number, Candidate>;
  onClose: () => void;
}) {
  const captureRef = useRef<HTMLDivElement>(null);
  const [localMapScale, setLocalMapScale] = useState(photoMapScale);
  const [showMunicipalities, setShowMunicipalities] = useState(false);

  const focusedRegionPaths = useMemo(() => {
    if (!stateGeoData) return [];
    return buildRegionPaths(stateGeoData, region);
  }, [stateGeoData, region]);

  const regionalData = useMemo(() => {
    const candidateVotes: Record<CandidateId, number> = {};
    candidates.forEach((c) => { candidateVotes[c.id] = 0; });
    for (const state of STATES) {
      if (state.region !== region) continue;
      const result = results[state.uf];
      if (!result) continue;
      Object.entries(result.votes).forEach(([id, pct]) => {
        const numId = Number(id);
        candidateVotes[numId] = (candidateVotes[numId] || 0) + (pct / 100) * state.voters;
      });
    }
    const total = Object.values(candidateVotes).reduce((sum, v) => sum + v, 0);
    const pcts: Record<CandidateId, number> = {};
    candidates.forEach((c) => { pcts[c.id] = total > 0 ? (candidateVotes[c.id] / total) * 100 : 0; });
    return { candidateVotes, pcts, total, winner: getWinner(pcts) };
  }, [region, results, candidates]);

  const ranked = useMemo(() => {
    const rows = candidates.map((c) => ({
      candidate: c,
      pct: regionalData.pcts[c.id] || 0,
      votes: regionalData.candidateVotes[c.id] || 0,
    })).sort((a, b) => b.pct - a.pct);
    const first = rows[0] ?? null;
    const second = rows[1] ?? null;
    const lower = rows.slice(2);
    const bottom3 = lower.slice(0, 3);
    const rest = lower.slice(3);
    const othersPct = rest.reduce((sum, item) => sum + item.pct, 0);
    const othersVotes = rest.reduce((sum, item) => sum + (item.votes ?? 0), 0);
    return { first, second, bottom3, othersPct, othersVotes, hasOthers: rest.length > 0 };
  }, [candidates, regionalData]);

  const topAvatarPx = Math.round(150 * photoScale);
  const bottomAvatarPx = Math.round(80 * photoScale);

  const handleDownload = async () => {
    if (!captureRef.current) return;
    const canvas = await html2canvas(captureRef.current, { backgroundColor: "#0f172a", scale: 2, useCORS: true, logging: false });
    const anchor = document.createElement("a");
    anchor.href = canvas.toDataURL("image/png");
    anchor.download = `foto-regional-${region}-${Date.now()}.png`;
    anchor.click();
  };

  const mapPaths = focusedRegionPaths.length > 0 ? focusedRegionPaths : paths.filter((pathItem) => STATE_BY_UF[pathItem.uf]?.region === region);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 overflow-y-auto bg-black/80 p-4 backdrop-blur-sm">
      <div className="mx-auto w-full max-w-[1900px]">
        <div className="mb-5 flex items-center justify-between text-white flex-wrap gap-3">
          <div className="flex items-center gap-4 flex-wrap">
            <h2 className="text-3xl font-black">Foto Regional</h2>
            <div className="flex gap-2 flex-wrap">
              {REGIONS.map((r) => (
                <button key={r} onClick={() => onRegionChange(r)}
                  className={`rounded-xl px-4 py-2 text-sm font-bold transition-all ${region === r ? "bg-emerald-500 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}>
                  {r}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-3 items-center flex-wrap">
            <div className="flex rounded-xl border border-white/10 bg-slate-900/80 p-1">
              <button
                type="button"
                onClick={() => setShowMunicipalities(false)}
                className={`rounded-lg px-3 py-1 text-xs font-black ${showMunicipalities ? "text-slate-300" : "bg-blue-600 text-white"}`}
              >
                Por estado
              </button>
              <button
                type="button"
                onClick={() => setShowMunicipalities(true)}
                className={`rounded-lg px-3 py-1 text-xs font-black ${showMunicipalities ? "bg-blue-600 text-white" : "text-slate-300"}`}
              >
                Por municipio
              </button>
            </div>
            <MapSizeSlider value={localMapScale} onChange={setLocalMapScale} />
            <button type="button" onClick={handleDownload} className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-3 text-sm font-black text-white shadow-lg transition-all hover:scale-105">
              Salvar PNG
            </button>
            <button type="button" onClick={onClose} className="rounded-xl border border-white/15 bg-slate-800/80 px-6 py-3 text-sm font-bold transition-all hover:bg-slate-700">
              Fechar
            </button>
          </div>
        </div>

        <div ref={captureRef} className="rounded-[50px] border border-white/10 bg-slate-950 p-12 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.7)]">
          <div className="mb-6 text-center">
            <div className="text-[11px] font-black uppercase tracking-[0.6em] text-slate-500">Eleicao 2026 - Resultado Regional</div>
          </div>

          <div className="flex items-center justify-center gap-6 mb-8 flex-wrap md:flex-nowrap">
            {ranked.first && (
              <div className="flex-1 min-w-[220px]">
                <TopCandidateCard item={ranked.first} rank={0} avatarPx={topAvatarPx} showVice={true} showVotes={true} />
              </div>
            )}
            {showMunicipalities ? (
              <RegionalMunicipalityMapCenter region={region} results={results} candidateById={candidateById} mapSizePx={localMapScale} />
            ) : (
              <RegionalMapCenter regionPaths={mapPaths} results={results} candidateById={candidateById} mapSizePx={localMapScale} />
            )}
            {ranked.second && (
              <div className="flex-1 min-w-[220px]">
                <TopCandidateCard item={ranked.second} rank={1} avatarPx={topAvatarPx} showVice={true} showVotes={true} />
              </div>
            )}
          </div>

          {(ranked.bottom3.length > 0 || ranked.hasOthers) && (
            <div className="flex justify-center mb-8">
              <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${ranked.bottom3.length + (ranked.hasOthers ? 1 : 0)}, minmax(0, 200px))` }}>
                {ranked.bottom3.map((item) => (
                  <BottomCandidateCard key={item.candidate.id} item={item} avatarPx={bottomAvatarPx} showVotes={true} />
                ))}
                {ranked.hasOthers && <OthersCard othersPct={ranked.othersPct} othersVotes={ranked.othersVotes} avatarPx={bottomAvatarPx} showVotes={true} />}
              </div>
            </div>
          )}

          <div className="mt-8 text-center">
            <div className="inline-block rounded-full bg-white/5 px-12 py-5 border border-white/10 shadow-2xl">
              <div className="text-4xl font-black text-white">{Math.round(regionalData.total).toLocaleString("pt-BR")}</div>
              <div className="text-[11px] font-black uppercase tracking-[0.4em] text-slate-500 mt-1">Votos Validos</div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
