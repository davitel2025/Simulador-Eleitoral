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
  ElectionRound,
  HistoricalMunicipalityScenarioKey,
  MunicipalityMapStyle,
  MunicipalityPath,
  StateInfo,
} from "../../types";

type MunicipalityEditMode = "manual" | "percentage";
type MunicipalityContextMenu = { name: string; x: number; y: number; municipalityId: string };
type MunicipalityPercentageEditor = {
  code: string;
  name: string;
  votes: Record<CandidateId, number>;
} | null;
type HoveredMunicipality = { name: string; x: number; y: number };

const HISTORICAL_IMPORT_NUMBERS: Record<HistoricalMunicipalityScenarioKey, string[]> = {
  "2018_1t": ["17", "13", "12", "45", "30", "15", "51", "18", "19", "50", "16", "27", "54"],
  "2018": ["17", "13"],
  "2022_1t": ["13", "22", "15", "12", "44", "30", "14", "21", "16", "27", "80"],
  "2022": ["13", "22"],
};

function getHistoricalBaseYear(key: HistoricalMunicipalityScenarioKey): "2018" | "2022" {
  return key.startsWith("2022") ? "2022" : "2018";
}

function getHistoricalImportLabel(key: HistoricalMunicipalityScenarioKey): string {
  return `${getHistoricalBaseYear(key)} (${key.includes("_1t") ? "1o turno" : "2o turno"})`;
}

function getHistoricalImportNumberForCandidate(
  candidate: Candidate,
  keyToImport: HistoricalMunicipalityScenarioKey,
  fallbackNumber?: string
): string {
  const name = candidate.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const party = candidate.party.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const importNumbers = HISTORICAL_IMPORT_NUMBERS[keyToImport] ?? [];
  if (importNumbers.includes(candidate.number)) return candidate.number;
  if (getHistoricalBaseYear(keyToImport) === "2018") {
    if (candidate.number === "22") return "17";
    if (name.includes("bolsonaro") || party === "pl" || party === "psl") return "17";
    if (name.includes("lula") || name.includes("haddad") || party === "pt") return "13";
    if (name.includes("ciro") || party === "pdt") return "12";
    if (name.includes("alckmin") || party === "psdb") return "45";
    if (name.includes("amoedo") || party === "novo") return "30";
    if (name.includes("meirelles") || party === "mdb") return "15";
    if (name.includes("daciolo") || party === "patri") return "51";
    if (name.includes("marina") || party === "rede") return "18";
    if (name.includes("alvaro") || party === "pode") return "19";
    if (name.includes("boulos") || party === "psol") return "50";
    if (name.includes("vera") || party === "pstu") return "16";
    if (name.includes("eymael") || party === "dc") return "27";
    if (name.includes("goulart") || party === "ppl") return "54";
  }
  if (getHistoricalBaseYear(keyToImport) === "2022") {
    if (candidate.number === "17") return "22";
    if (name.includes("bolsonaro") || party === "pl" || party === "psl") return "22";
    if (name.includes("lula") || name.includes("haddad") || party === "pt") return "13";
    if (name.includes("tebet") || party === "mdb") return "15";
    if (name.includes("ciro") || party === "pdt") return "12";
    if (name.includes("soraya") || party.includes("uniao")) return "44";
    if (name.includes("felipe") || party === "novo") return "30";
    if (name.includes("kelmon") || party === "ptb") return "14";
    if (name.includes("sofia") || party === "pcb") return "21";
    if (name.includes("vera") || party === "pstu") return "16";
    if (name.includes("eymael") || party === "dc") return "27";
    if (name.includes("leo") || party === "up") return "80";
  }
  return fallbackNumber ?? candidate.number;
}

export function MunicipalityPaintModal({
  stateInfo,
  candidates,
  initialPaint,
  initialMunicipalities,
  scenarioKey,
  electionRound,
  onClose,
  onSave,
}: {
  stateInfo: StateInfo;
  candidates: Candidate[];
  initialPaint: Record<string, CandidateId>;
  initialMunicipalities: Record<string, Record<CandidateId, number>>;
  scenarioKey?: HistoricalMunicipalityScenarioKey;
  electionRound: ElectionRound;
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
  const [hoveredMunicipality, setHoveredMunicipality] = useState<HoveredMunicipality | null>(null);
  const [contextMenu, setContextMenu] = useState<MunicipalityContextMenu | null>(null);
  const [percentageEditor, setPercentageEditor] = useState<MunicipalityPercentageEditor>(null);
  const isPaintingRef = useRef(false);
  const historicalImportOptions: HistoricalMunicipalityScenarioKey[] =
    electionRound === "primeiro" ? ["2018_1t", "2022_1t"] : ["2018", "2022"];

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

  useEffect(() => {
    if (!contextMenu) return undefined;
    const closeContextMenu = () => setContextMenu(null);
    window.addEventListener("mousedown", closeContextMenu);
    return () => window.removeEventListener("mousedown", closeContextMenu);
  }, [contextMenu]);

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
    let ties = 0;
    candidates.forEach((candidate) => {
      const pct = votes[candidate.id] ?? 0;
      if (pct > best) {
        best = pct;
        winner = candidate.id;
        ties = 1;
      } else if (pct === best) {
        ties += 1;
      }
    });
    return best > 0 && ties === 1 ? winner : null;
  };

  const getTieCandidateIds = (votes: Record<CandidateId, number> | undefined): CandidateId[] => {
    if (!votes) return [];
    const values = candidates.map((candidate) => ({
      id: candidate.id,
      pct: votes[candidate.id] ?? 0,
    }));
    const best = Math.max(...values.map((item) => item.pct));
    if (best <= 0) return [];
    const tied = values.filter((item) => item.pct === best).map((item) => item.id);
    return tied.length > 1 ? tied : [];
  };

  const getContextVotesForPath = (pathItem: MunicipalityPath): Record<CandidateId, number> | null => {
    const stored = municipalities[pathItem.code];
    if (stored) return normalizeCandidateVotes(stored);
    const paintedId = paint[pathItem.code];
    if (!paintedId) return null;
    return Object.fromEntries(
      candidates.map((candidate) => [candidate.id, candidate.id === paintedId ? 100 : 0])
    ) as Record<CandidateId, number>;
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

  const openPercentageEditor = (pathItem: MunicipalityPath) => {
    setPercentageEditor({
      code: pathItem.code,
      name: pathItem.name,
      votes: getVotesForPath(pathItem),
    });
    setContextMenu(null);
  };

  const updatePercentageEditorPct = (candidateId: CandidateId, rawValue: number) => {
    setPercentageEditor((prev) => {
      if (!prev) return prev;
      const value = Math.max(0, Math.min(100, rawValue));
      const otherIds = candidates.map((candidate) => candidate.id).filter((id) => id !== candidateId);
      const otherCurrentTotal = otherIds.reduce((sum, id) => sum + (prev.votes[id] ?? 0), 0);
      const remaining = 100 - value;
      const nextVotes: Record<CandidateId, number> = { ...prev.votes, [candidateId]: value };
      otherIds.forEach((id) => {
        nextVotes[id] = otherCurrentTotal > 0
          ? ((prev.votes[id] ?? 0) / otherCurrentTotal) * remaining
          : remaining / Math.max(1, otherIds.length);
      });
      return { ...prev, votes: nextVotes };
    });
  };

  const savePercentageEditor = () => {
    if (!percentageEditor) return;
    const votes = normalizeCandidateVotes(percentageEditor.votes);
    const winner = getWinnerFromVotes(votes);
    setMunicipalities((prev) => ({ ...prev, [percentageEditor.code]: votes }));
    setPaint((prev) => {
      const next = { ...prev };
      if (winner) next[percentageEditor.code] = winner;
      else delete next[percentageEditor.code];
      return next;
    });
    setPercentageEditor(null);
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
    const importNumbers = HISTORICAL_IMPORT_NUMBERS[keyToImport];
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
      nextMunicipalities[path.code] = votes;
      if (winner) nextPaint[path.code] = winner;
    });
    setPaint(nextPaint);
    setMunicipalities(nextMunicipalities);
    setImportMessage(`Municipios de ${getHistoricalImportLabel(keyToImport)} importados!`);
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
    setContextMenu(null);
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

  const updateHoveredMunicipality = (pathItem: MunicipalityPath, event: React.MouseEvent) => {
    setHoveredMunicipality({
      name: pathItem.name,
      x: event.clientX,
      y: event.clientY,
    });
  };

  const handleMunicipalityContextMenu = (pathItem: MunicipalityPath, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    isPaintingRef.current = false;
    setContextMenu({
      name: pathItem.name,
      x: event.clientX,
      y: event.clientY,
      municipalityId: pathItem.code,
    });
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
            {historicalImportOptions.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => handleImportHistoricalScenario(key)}
                disabled={loading || paths.length === 0}
                className={`rounded-xl border px-3 py-2 text-xs font-black transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
                  importScenarioKey === key ? "border-cyan-300 bg-cyan-400/20 text-cyan-100" : "border-cyan-400/40 bg-slate-950/40 text-cyan-200"
                }`}
              >
                Baixar municipios de {getHistoricalImportLabel(key)}
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
              onMouseLeave={() => { isPaintingRef.current = false; setHoveredMunicipality(null); }}
              onContextMenu={(event) => event.preventDefault()}
              style={{ touchAction: "none" }}
            >
              <defs>
                <pattern id="municipalityTiePattern" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                  <rect width="8" height="8" fill="#64748b" />
                  <rect width="3" height="8" fill="#cbd5e1" opacity="0.65" />
                </pattern>
                <filter id="municipalBroadcastGlow" x="-8%" y="-8%" width="116%" height="116%">
                  <feGaussianBlur in="SourceAlpha" stdDeviation="1.1" result="blur" />
                  <feComposite in="blur" in2="SourceAlpha" operator="out" result="edge" />
                  <feColorMatrix in="edge" type="matrix" values="0 0 0 0 0.58 0 0 0 0 0.68 0 0 0 0 0.82 0 0 0 0.45 0" result="glow" />
                  <feBlend in="SourceGraphic" in2="glow" mode="screen" />
                </filter>
              </defs>
              {paths.map((pathItem) => {
                const municipalityVotes = municipalities[pathItem.code];
                const tieCandidateIds = getTieCandidateIds(municipalityVotes);
                const isTie = tieCandidateIds.length > 1;
                const candidate = isTie ? null : candidateById[paint[pathItem.code]];
                const candidatePct = candidate ? municipalityVotes?.[candidate.id] ?? 55 : 0;
                const candidateIndex = candidate ? candidateIndexById[candidate.id] ?? 0 : 0;
                const fill = isTie
                  ? "url(#municipalityTiePattern)"
                  : candidate
                  ? getMunicipalityFillColor({
                      baseColor: candidate.color,
                      winnerPct: candidatePct,
                      candidateIndex,
                      shadeByPct,
                      mapStyle: municipalityMapStyle,
                    })
                  : "#0f172a";
                const stroke = isTie
                  ? "#cbd5e1"
                  : municipalityMapStyle === "broadcast" ? "#94a3b8" : candidate ? shadeHex(candidate.color, 0.3, "black") : "#1f2937";
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
                    onMouseEnter={(event) => {
                      updateHoveredMunicipality(pathItem, event);
                      handleMunicipalityMouseEnter(pathItem.code, event);
                    }}
                    onMouseMove={(event) => updateHoveredMunicipality(pathItem, event)}
                    onMouseLeave={() => setHoveredMunicipality(null)}
                    onContextMenu={(event) => handleMunicipalityContextMenu(pathItem, event)}
                  />
                );
              })}
            </svg>
          )}
        </div>
        {hoveredMunicipality && (
          <div
            className="pointer-events-none fixed z-[80] rounded-lg border border-slate-600 bg-slate-800/90 px-2.5 py-1.5 text-xs font-bold text-white shadow-xl"
            style={{ left: hoveredMunicipality.x + 14, top: hoveredMunicipality.y - 28 }}
          >
            {hoveredMunicipality.name}
          </div>
        )}
        {contextMenu && (() => {
          const pathItem = paths.find((path) => path.code === contextMenu.municipalityId);
          const contextVotes = pathItem ? getContextVotesForPath(pathItem) : null;
          const tieCandidateIds = getTieCandidateIds(contextVotes ?? undefined);
          return (
            <div
              className="fixed z-[90] w-72 rounded-2xl border border-slate-600 bg-slate-900 p-4 text-white opacity-100 shadow-xl transition-opacity"
              style={{ left: contextMenu.x + 10, top: contextMenu.y + 10 }}
              onMouseDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-3 text-base font-black">{contextMenu.name}</div>
              {contextVotes ? (
                <div className="mb-4 space-y-2">
                  {tieCandidateIds.length > 1 && (
                    <div className="rounded-lg border border-slate-600 bg-slate-800 px-2 py-1 text-xs font-black text-slate-100">
                      Empate
                    </div>
                  )}
                  {candidates.map((candidate) => (
                    <div key={candidate.id} className="flex items-center justify-between gap-3 text-xs">
                      <span className="flex min-w-0 items-center gap-2 font-bold text-slate-200">
                        <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: candidate.color }} />
                        <span className="truncate">{candidate.name}</span>
                      </span>
                      <span className="font-black" style={{ color: candidate.color }}>
                        {(contextVotes[candidate.id] ?? 0).toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mb-4 rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm font-bold text-slate-300">
                  Nenhum dado pintado ainda
                </div>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    if (pathItem) openPercentageEditor(pathItem);
                  }}
                  className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-black text-slate-200"
                >
                  Alterar
                </button>
                <button
                  type="button"
                  onClick={() => setContextMenu(null)}
                  className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs font-black text-white"
                >
                  Cancelar
                </button>
              </div>
            </div>
          );
        })()}
        {percentageEditor && (() => {
          const winnerId = getWinnerFromVotes(percentageEditor.votes);
          const winnerCandidate = winnerId ? candidateById[winnerId] : null;
          return (
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.14 }}
              className="fixed left-1/2 top-8 z-[100] w-[min(520px,calc(100%-32px))] -translate-x-1/2 rounded-2xl border border-white/15 bg-slate-950/95 p-4 text-white shadow-2xl backdrop-blur-xl"
              onMouseDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-black">{percentageEditor.name}</div>
                  <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
                    {stateInfo.name} - {stateInfo.uf}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPercentageEditor(null)}
                  className="rounded-lg border border-white/10 px-2 py-1 text-xs font-black text-slate-300 hover:bg-white/10"
                >
                  Fechar
                </button>
              </div>
              {winnerCandidate && (
                <div
                  className="mb-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-black"
                  style={{ color: winnerCandidate.color }}
                >
                  Vence: {winnerCandidate.name}
                </div>
              )}
              <div className="space-y-2">
                {candidates.map((candidate) => (
                  <label key={candidate.id} className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2">
                    <span className="w-28 truncate text-xs font-black" style={{ color: candidate.color }}>
                      {candidate.name}
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={0.1}
                      value={percentageEditor.votes[candidate.id] ?? 0}
                      onChange={(event) => updatePercentageEditorPct(candidate.id, Number(event.target.value))}
                      className="h-2 min-w-0 flex-1 appearance-none rounded-full bg-slate-700 accent-emerald-500"
                    />
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.1}
                      value={(percentageEditor.votes[candidate.id] ?? 0).toFixed(1)}
                      onChange={(event) => updatePercentageEditorPct(candidate.id, Number(event.target.value))}
                      className="w-20 rounded-lg border border-white/10 bg-slate-950 px-2 py-1 text-right text-xs font-bold text-white"
                    />
                  </label>
                ))}
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPercentageEditor(null)}
                  className="rounded-xl border border-white/10 px-4 py-2 text-xs font-bold text-slate-300 hover:bg-white/10"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={savePercentageEditor}
                  className="rounded-xl bg-emerald-500 px-4 py-2 text-xs font-black text-zinc-950 hover:bg-emerald-400"
                >
                  Confirmar
                </button>
              </div>
            </motion.div>
          );
        })()}
      </motion.div>
    </motion.div>
  );
}
