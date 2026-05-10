import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { VIEWBOX_HEIGHT, VIEWBOX_WIDTH } from "../../lib/constants";
import { getMunicipalityFillColor, shadeHex } from "../../lib/color";
import { buildMunicipalityPaths, fetchMunicipalityGeo } from "../../lib/geo";
import { usePersistedState } from "../../hooks/usePersistedState";
import {
  getHistoricalMunicipalityCandidatePcts,
  getHistoricalMunicipalityVotes,
} from "../../data/historicalElectionResults";
import type {
  Candidate,
  CandidateId,
  HistoricalMunicipalityScenarioKey,
  MunicipalityMapStyle,
  MunicipalityPath,
  StateInfo,
} from "../../types";

type MunicipalityEditMode = "manual" | "percentage";

const HISTORICAL_IMPORT_NUMBERS: Record<"2018" | "2022", string[]> = {
  "2018": ["17", "13"],
  "2022": ["13", "22"],
};

function getHistoricalImportNumberForCandidate(
  candidate: Candidate,
  keyToImport: HistoricalMunicipalityScenarioKey,
  fallbackNumber?: string
): string {
  const name = candidate.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const party = candidate.party.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (keyToImport === "2018") {
    if (name.includes("bolsonaro") || party === "pl" || party === "psl") return "17";
    if (name.includes("lula") || name.includes("haddad") || party === "pt") return "13";
  }
  if (keyToImport === "2022") {
    if (name.includes("bolsonaro") || party === "pl" || party === "psl") return "22";
    if (name.includes("lula") || name.includes("haddad") || party === "pt") return "13";
  }
  return fallbackNumber ?? candidate.number;
}

export function MunicipalityPaintModal({
  stateInfo,
  candidates,
  initialPaint,
  initialMunicipalities,
  scenarioKey,
  onClose,
  onSave,
}: {
  stateInfo: StateInfo;
  candidates: Candidate[];
  initialPaint: Record<string, CandidateId>;
  initialMunicipalities: Record<string, Record<CandidateId, number>>;
  scenarioKey?: HistoricalMunicipalityScenarioKey;
  onClose: () => void;
  onSave: (
    paint: Record<string, CandidateId>,
    municipalities: Record<string, Record<CandidateId, number>>
  ) => void;
}) {
  const [paths, setPaths] = useState<MunicipalityPath[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateId | null>(candidates[0]?.id ?? null);
  const [paint, setPaint] = useState<Record<string, CandidateId>>(initialPaint);
  const [municipalities, setMunicipalities] =
    useState<Record<string, Record<CandidateId, number>>>(initialMunicipalities);
  const [shadeByPct, setShadeByPct] = useState(true);
  const [editMode, setEditMode] = useState<MunicipalityEditMode>("manual");
  const [searchQuery, setSearchQuery] = useState("");
  const [importScenarioKey, setImportScenarioKey] = useState<HistoricalMunicipalityScenarioKey | null>(null);
  const [importMessage, setImportMessage] = useState("");
  const [municipalityMapStyle, setMunicipalityMapStyle] =
    usePersistedState<MunicipalityMapStyle>("municipalityMapStyle", "original");
  const [fillAllCandidate, setFillAllCandidate] = useState<CandidateId | null>(null);
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
  const candidateIndexById = useMemo(
    () => Object.fromEntries(candidates.map((candidate, index) => [candidate.id, index])),
    [candidates]
  ) as Record<CandidateId, number>;
  const filteredPaths = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase("pt-BR");
    if (!query) return paths;
    return paths.filter((path) => path.name.toLocaleLowerCase("pt-BR").includes(query));
  }, [paths, searchQuery]);

  const getEvenVotes = (): Record<CandidateId, number> => {
    const pct = candidates.length > 0 ? 100 / candidates.length : 0;
    return Object.fromEntries(candidates.map((candidate) => [candidate.id, pct])) as Record<CandidateId, number>;
  };

  const normalizeCandidateVotes = (votes: Record<CandidateId, number>): Record<CandidateId, number> => {
    const candidateIds = candidates.map((candidate) => candidate.id);
    const filtered = Object.fromEntries(
      candidateIds.map((id) => [id, Math.max(0, votes[id] ?? 0)])
    ) as Record<CandidateId, number>;
    const total = Object.values(filtered).reduce((sum, value) => sum + value, 0);
    if (total <= 0) return getEvenVotes();
    return Object.fromEntries(
      candidateIds.map((id) => [id, ((filtered[id] ?? 0) / total) * 100])
    ) as Record<CandidateId, number>;
  };

  const getVotesForPath = (pathItem: MunicipalityPath): Record<CandidateId, number> => {
    const stored = municipalities[pathItem.code];
    if (stored) return normalizeCandidateVotes(stored);
    const paintedId = paint[pathItem.code];
    if (paintedId) {
      return Object.fromEntries(candidates.map((candidate) => [candidate.id, candidate.id === paintedId ? 100 : 0])) as Record<CandidateId, number>;
    }
    const officialVotes = getHistoricalMunicipalityCandidatePcts(
      scenarioKey,
      stateInfo.uf,
      pathItem.name,
      candidates
    );
    return officialVotes ? normalizeCandidateVotes(officialVotes) : getEvenVotes();
  };

  const getWinnerFromVotes = (votes: Record<CandidateId, number>): CandidateId | null => {
    let winner: CandidateId | null = null;
    let best = -Infinity;
    candidates.forEach((candidate) => {
      const pct = votes[candidate.id] ?? 0;
      if (pct > best) {
        best = pct;
        winner = candidate.id;
      }
    });
    return winner;
  };

  const updateMunicipalityPct = (
    pathItem: MunicipalityPath,
    candidateId: CandidateId,
    rawValue: number
  ) => {
    const value = Math.max(0, Math.min(100, rawValue));
    const current = getVotesForPath(pathItem);
    const otherIds = candidates.map((candidate) => candidate.id).filter((id) => id !== candidateId);
    const otherCurrentTotal = otherIds.reduce((sum, id) => sum + (current[id] ?? 0), 0);
    const remaining = 100 - value;
    const next: Record<CandidateId, number> = { ...current, [candidateId]: value };
    otherIds.forEach((id) => {
      next[id] = otherCurrentTotal > 0 ? ((current[id] ?? 0) / otherCurrentTotal) * remaining : remaining / Math.max(1, otherIds.length);
    });
    const winner = getWinnerFromVotes(next);
    setMunicipalities((prev) => ({ ...prev, [pathItem.code]: next }));
    setPaint((prev) => {
      const updated = { ...prev };
      if (winner) updated[pathItem.code] = winner;
      else delete updated[pathItem.code];
      return updated;
    });
  };

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
    setMunicipalities((prev) => {
      const next = { ...prev };
      if (!selectedCandidate) {
        delete next[municipalityCode];
        return next;
      }
      if (prev[municipalityCode]?.[selectedCandidate]) return prev;
      delete next[municipalityCode];
      return next;
    });
  };

  const handleFillAll = () => {
    if (!fillAllCandidate || !paths.length) return;
    const newPaint = { ...paint };
    paths.forEach((path) => {
      newPaint[path.code] = fillAllCandidate;
    });
    setPaint(newPaint);
    setMunicipalities({});
  };

  const handleImportHistoricalScenario = (keyToImport: HistoricalMunicipalityScenarioKey) => {
    if (!paths.length) return;
    setImportScenarioKey(keyToImport);
    const nextPaint: Record<string, CandidateId> = {};
    const nextMunicipalities: Record<string, Record<CandidateId, number>> = {};
    const importNumbers = HISTORICAL_IMPORT_NUMBERS[keyToImport === "2022" ? "2022" : "2018"];
    paths.forEach((path) => {
      const votesByNumber = getHistoricalMunicipalityVotes(
        keyToImport,
        stateInfo.uf,
        path.name
      );
      if (!votesByNumber) return;
      const total = Object.values(votesByNumber).reduce((sum, votes) => sum + votes, 0);
      if (total <= 0) return;
      const votes = Object.fromEntries(
        candidates.map((candidate, index) => {
          const fallbackNumber = importNumbers[index];
          const mappedNumber = getHistoricalImportNumberForCandidate(candidate, keyToImport, fallbackNumber);
          const rawVotes =
            votesByNumber[mappedNumber] ??
            votesByNumber[candidate.number] ??
            (fallbackNumber ? votesByNumber[fallbackNumber] : 0) ??
            0;
          return [candidate.id, (rawVotes / total) * 100];
        })
      ) as Record<CandidateId, number>;
      const winner = getWinnerFromVotes(votes);
      if (!winner) return;
      nextPaint[path.code] = winner;
      nextMunicipalities[path.code] = votes;
    });
    setPaint(nextPaint);
    setMunicipalities(nextMunicipalities);
    setImportMessage(`Municipios de ${keyToImport.startsWith("2022") ? "2022" : "2018"} importados!`);
    window.setTimeout(() => setImportMessage(""), 2500);
  };

  const handleApplyFirstVisibleToAll = () => {
    const source = filteredPaths[0];
    if (!source) return;
    const sourceVotes = getVotesForPath(source);
    const sourceWinner = getWinnerFromVotes(sourceVotes);
    const nextMunicipalities = { ...municipalities };
    const nextPaint = { ...paint };
    filteredPaths.forEach((pathItem) => {
      nextMunicipalities[pathItem.code] = { ...sourceVotes };
      if (sourceWinner) nextPaint[pathItem.code] = sourceWinner;
    });
    setMunicipalities(nextMunicipalities);
    setPaint(nextPaint);
  };

  const handleMunicipalityMouseDown = (municipalityCode: string, event: React.MouseEvent) => {
    if (event.button !== 0) return;
    event.preventDefault();
    isPaintingRef.current = true;
    applyPaint(municipalityCode);
  };

  const handleMunicipalityMouseEnter = (municipalityCode: string, event: React.MouseEvent) => {
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
            <h3 className="text-3xl font-black text-white">Alterar municípios - {stateInfo.name}</h3>
            <p className="text-sm text-slate-400">Selecione um candidato e clique (ou segure e arraste) sobre os municípios para colorir.</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => onSave(paint, municipalities)} className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-black text-zinc-950">Salvar municípios</button>
            <button type="button" onClick={onClose} className="rounded-xl border border-white/15 px-4 py-2 text-sm font-bold text-white">Fechar</button>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="mr-2 flex rounded-xl border border-white/10 bg-slate-900/80 p-1">
            <button
              type="button"
              onClick={() => setEditMode("manual")}
              className={`rounded-lg px-3 py-1.5 text-xs font-black ${editMode === "manual" ? "bg-violet-600 text-white" : "text-slate-300"}`}
            >
              Pintura manual
            </button>
            <button
              type="button"
              onClick={() => setEditMode("percentage")}
              className={`rounded-lg px-3 py-1.5 text-xs font-black ${editMode === "percentage" ? "bg-violet-600 text-white" : "text-slate-300"}`}
            >
              Editar por porcentagem
            </button>
          </div>
          <div className="mr-2 flex rounded-xl border border-white/10 bg-slate-900/80 p-1">
            <button
              type="button"
              onClick={() => setMunicipalityMapStyle("original")}
              className={`rounded-lg px-3 py-1.5 text-xs font-black ${municipalityMapStyle === "original" ? "bg-cyan-600 text-white" : "text-slate-300"}`}
            >
              Original
            </button>
            <button
              type="button"
              onClick={() => setMunicipalityMapStyle("broadcast")}
              className={`rounded-lg px-3 py-1.5 text-xs font-black ${municipalityMapStyle === "broadcast" ? "bg-cyan-600 text-white" : "text-slate-300"}`}
            >
              Broadcast
            </button>
          </div>
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
          <button type="button" onClick={() => { setPaint({}); setMunicipalities({}); }} className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs font-black text-red-300">
            Limpar pintura
          </button>
          <button
            type="button"
            onClick={() => setShadeByPct((prev) => !prev)}
            className={`rounded-xl border px-3 py-2 text-xs font-black transition-all ${
              shadeByPct ? "border-emerald-400/60 bg-emerald-500/15 text-emerald-200" : "border-slate-600 text-slate-300"
            }`}
          >
            {shadeByPct ? "Com porcentagem" : "Sem porcentagem"}
          </button>
        </div>

        <div className="mb-4 rounded-xl border border-cyan-400/20 bg-cyan-500/10 p-4">
          <div className="mb-3 flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="text-sm font-black text-cyan-100">Importar municipios de cenário histórico</div>
              <div className="text-xs text-cyan-200/70">Substitui a pintura atual deste estado por dados oficiais do turno selecionado.</div>
            </div>
            {importMessage && <span className="text-xs font-black text-emerald-300">{importMessage}</span>}
          </div>
          <div className="flex gap-2 flex-wrap">
            {(["2018", "2022"] as HistoricalMunicipalityScenarioKey[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => handleImportHistoricalScenario(key)}
                disabled={loading || paths.length === 0}
                className={`rounded-xl border px-3 py-2 text-xs font-black transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
                  importScenarioKey === key ? "border-cyan-300 bg-cyan-400/20 text-cyan-100" : "border-cyan-400/40 bg-slate-950/40 text-cyan-200"
                }`}
              >
                Baixar municipios de {key}
              </button>
            ))}
          </div>
        </div>

        {editMode === "manual" && (
        <div className="mb-4 rounded-xl border border-white/10 bg-slate-900/60 p-4">
          <div className="mb-2 text-sm font-bold text-white">Preencher todos os municípios</div>
          <div className="flex gap-2">
            <select
              value={fillAllCandidate || ""}
              onChange={(e) => setFillAllCandidate(e.target.value ? Number(e.target.value) : null)}
              className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
            >
              <option value="">Selecione um candidato</option>
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.party})
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleFillAll}
              disabled={!fillAllCandidate}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-emerald-700 transition-colors"
            >
              Preencher Tudo
            </button>
          </div>
        </div>
        )}

        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-3">
          {loading ? (
            <div className="flex h-[68vh] items-center justify-center">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-700 border-t-emerald-500" />
            </div>
          ) : paths.length === 0 ? (
            <div className="flex h-[68vh] items-center justify-center text-slate-400">Não foi possível carregar os municípios.</div>
          ) : editMode === "percentage" ? (
            <div className="max-h-[68vh] overflow-y-auto pr-2">
              <div className="sticky top-0 z-10 mb-3 rounded-xl border border-white/10 bg-slate-950/95 p-3 backdrop-blur">
                <div className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                  {stateInfo.name} &gt; Municipio
                </div>
                <div className="flex gap-2 flex-wrap">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Buscar municipio"
                    className="min-w-[220px] flex-1 rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm font-bold text-white outline-none placeholder:text-slate-500"
                  />
                  <button
                    type="button"
                    onClick={handleApplyFirstVisibleToAll}
                    disabled={filteredPaths.length === 0}
                    className="rounded-xl bg-violet-600 px-3 py-2 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Aplicar a todos os municipios visiveis
                  </button>
                </div>
              </div>
              <div className="space-y-3">
                {filteredPaths.map((pathItem) => {
                  const votes = getVotesForPath(pathItem);
                  const winner = getWinnerFromVotes(votes);
                  const winnerCandidate = winner ? candidateById[winner] : null;
                  return (
                    <div key={pathItem.code} className="rounded-xl border border-white/10 bg-slate-950/70 p-3">
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <div>
                          <div className="text-sm font-black text-white">{pathItem.name}</div>
                          <div className="text-xs text-slate-500">{stateInfo.name}</div>
                        </div>
                        {winnerCandidate && (
                          <div className="rounded-full border px-3 py-1 text-xs font-black" style={{ borderColor: `${winnerCandidate.color}66`, color: winnerCandidate.color }}>
                            Vence: {winnerCandidate.name}
                          </div>
                        )}
                      </div>
                      <div className="grid gap-2 md:grid-cols-2">
                        {candidates.map((candidate) => (
                          <label key={candidate.id} className="flex items-center gap-2 rounded-lg bg-slate-900/70 px-3 py-2">
                            <span className="w-28 truncate text-xs font-bold" style={{ color: candidate.color }}>{candidate.name}</span>
                            <input
                              type="range"
                              min={0}
                              max={100}
                              step={0.1}
                              value={votes[candidate.id] ?? 0}
                              onChange={(event) => updateMunicipalityPct(pathItem, candidate.id, Number(event.target.value))}
                              className="h-2 min-w-0 flex-1 appearance-none rounded-full bg-slate-700 accent-violet-500"
                            />
                            <input
                              type="number"
                              min={0}
                              max={100}
                              step={0.1}
                              value={(votes[candidate.id] ?? 0).toFixed(1)}
                              onChange={(event) => updateMunicipalityPct(pathItem, candidate.id, Number(event.target.value))}
                              className="w-20 rounded-lg border border-white/10 bg-slate-950 px-2 py-1 text-right text-xs font-bold text-white"
                            />
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <svg
              viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
              className="h-[68vh] w-full select-none"
              onMouseLeave={() => { isPaintingRef.current = false; }}
              onContextMenu={(event) => event.preventDefault()}
              style={{ touchAction: "none" }}
            >
              <defs>
                <filter id="municipalBroadcastGlow" x="-8%" y="-8%" width="116%" height="116%">
                  <feGaussianBlur in="SourceAlpha" stdDeviation="1.1" result="blur" />
                  <feComposite in="blur" in2="SourceAlpha" operator="out" result="edge" />
                  <feColorMatrix in="edge" type="matrix" values="0 0 0 0 0.58 0 0 0 0 0.68 0 0 0 0 0.82 0 0 0 0.45 0" result="glow" />
                  <feBlend in="SourceGraphic" in2="glow" mode="screen" />
                </filter>
              </defs>
              {paths.map((pathItem) => {
                const candidate = candidateById[paint[pathItem.code]];
                const candidatePct = candidate ? municipalities[pathItem.code]?.[candidate.id] ?? 55 : 0;
                const candidateIndex = candidate ? candidateIndexById[candidate.id] ?? 0 : 0;
                const fill = candidate
                  ? getMunicipalityFillColor({
                      baseColor: candidate.color,
                      winnerPct: candidatePct,
                      candidateIndex,
                      shadeByPct,
                      mapStyle: municipalityMapStyle,
                    })
                  : "#0f172a";
                const stroke = municipalityMapStyle === "broadcast" ? "#94a3b8" : candidate ? shadeHex(candidate.color, 0.3, "black") : "#1f2937";
                return (
                  <path
                    key={pathItem.code}
                    d={pathItem.d}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={municipalityMapStyle === "broadcast" ? 0.3 : 0.7}
                    filter={municipalityMapStyle === "broadcast" ? "url(#municipalBroadcastGlow)" : undefined}
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
