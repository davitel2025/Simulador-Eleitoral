import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { REGIONS, STATES, STATE_BY_UF } from "../../data/states";
import { STATE_GEO_URL, VIEWBOX_HEIGHT, VIEWBOX_WIDTH } from "../../lib/constants";
import { getColorByWinnerPct } from "../../lib/color";
import { buildStatePaths } from "../../lib/geo";
import {
  clamp,
  formatPct,
  getWinner,
  normalizeVotesForCandidates,
} from "../../lib/utils";
import type { 
  AnalyticsTab, 
  Candidate, 
  CandidateId, 
  ElectionRound, 
  PathData, 
  RegionName, 
  StateResult,
  PoliticalScenario   // <-- ADICIONE ESTE
} from "../../types";
import { CandidateManager } from "../CandidateManager";
import { StateActionModal } from "../modals/StateActionModal";
import { StateModal } from "../modals/StateModal";
import { MunicipalityPaintModal } from "../modals/MunicipalityPaintModal";
import { StatePhotoModal } from "../modals/StatePhotoModal";
import { NationalPhotoModal } from "../modals/NationalPhotoModal";
import { RegionalPhotoModal } from "../modals/RegionalPhotoModal";

export function ElectionSimulator({ 
  round, 
  candidates, 
  onCandidatesChange, 
  onRestart, 
  loadedScenario 
}: { 
  round: ElectionRound;
  candidates: Candidate[];
  onCandidatesChange: (candidates: Candidate[]) => void;
  onRestart: () => void;
  loadedScenario?: PoliticalScenario | null;  // <-- ADICIONE ESTA LINHA
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
  useEffect(() => {
  if (!loadedScenario?.results) return;
  
  const candidateIds = candidates.map(c => c.id);
  if (candidateIds.length === 0) return;

  const newResults: Record<string, StateResult> = {};
  
  for (const [uf, candidatePcts] of Object.entries(loadedScenario.results)) {
    // Converte os percentuais do cenário (indexado por posição do candidato) para o formato com candidateId
    const votes: Record<CandidateId, number> = {};
    for (let i = 0; i < candidateIds.length; i++) {
      const candidateId = candidateIds[i];
      const pct = candidatePcts[i + 1]; // candidatePcts é {1: pct1, 2: pct2}
      if (pct !== undefined) {
        votes[candidateId] = pct;
      }
    }
    // Normaliza para garantir soma 100
    const total = Object.values(votes).reduce((sum, v) => sum + v, 0);
    if (total > 0) {
      Object.keys(votes).forEach(id => {
        votes[Number(id)] = (votes[Number(id)] / total) * 100;
      });
    }
    
    newResults[uf] = {
      uf,
      votes,
      winner: getWinner(votes),
      usesMunicipalities: false,
      municipalities: {},
      municipalityPaint: {},
    };
  }
  
  setResults(newResults);
}, [loadedScenario, candidates]); // Depende do cenário e dos candidatos
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

  // Determina qual campo de eleitores usar baseado no ano do cenário carregado
  const getVotersForState = (state: StateInfo): number => {
    if (loadedScenario?.year === 2018) return state.voters2018;
    if (loadedScenario?.year === 2022) return state.voters2022;
    return state.voters; // 2026 ou fallback
  };

  for (const state of STATES) {
    const result = results[state.uf];
    if (!result) continue;
    statesCounted += 1;
    const votersCount = getVotersForState(state);
    totalVoters += votersCount;
    Object.entries(result.votes).forEach(([candidateId, pct]) => {
      const id = Number(candidateId);
      candidateVotes[id] = (candidateVotes[id] || 0) + (pct / 100) * votersCount;
    });
  }
  const totalVotes = Object.values(candidateVotes).reduce((sum, v) => sum + v, 0);
  const candidatePcts: Record<CandidateId, number> = {};
  Object.keys(candidateVotes).forEach((id) => {
    const numId = Number(id);
    candidatePcts[numId] = totalVotes > 0 ? (candidateVotes[numId] / totalVotes) * 100 : 0;
  });
  return { candidateVotes, candidatePcts, totalVotes, totalVoters, statesCounted, winner: getWinner(candidatePcts) };
}, [results, candidates, loadedScenario]);

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
