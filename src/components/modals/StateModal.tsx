import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { VIEWBOX_HEIGHT, VIEWBOX_WIDTH } from "../../lib/constants";
import { formatPct, getWinner, normalizeVotesForCandidates } from "../../lib/utils";
import type { Candidate, CandidateId, StateInfo, StateResult } from "../../types";

type StateModalProps = {
  stateInfo: StateInfo;
  initialResult?: StateResult;
  candidates: Candidate[];
  nationalCandidatePcts: Record<CandidateId, number>;
  statePathD?: string;
  onClose: () => void;
  onSave: (result: StateResult) => void;
  onApplyToRegion: (votes: Record<CandidateId, number>, region: string) => void;
  onToast?: (message: string) => void;
};

function normalizeForSave(votes: Record<CandidateId, number>, candidates: Candidate[]) {
  return normalizeVotesForCandidates(votes, candidates.map((candidate) => candidate.id));
}

function createEqualVotes(candidates: Candidate[]) {
  const votes: Record<CandidateId, number> = {};
  const equalShare = candidates.length > 0 ? 100 / candidates.length : 0;
  candidates.forEach((candidate) => {
    votes[candidate.id] = equalShare;
  });
  return votes;
}

function createRandomVotes(candidates: Candidate[]) {
  const weights = candidates.map(() => Math.random() + 0.08);
  const total = weights.reduce((sum, value) => sum + value, 0);
  const votes: Record<CandidateId, number> = {};
  candidates.forEach((candidate, index) => {
    votes[candidate.id] = (weights[index] / total) * 100;
  });
  return votes;
}

function StateMiniMap({
  uf,
  name,
  pathD,
  fill,
}: {
  uf: string;
  name: string;
  pathD?: string;
  fill: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
      <svg viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`} className="mx-auto h-32 w-full">
        {pathD ? (
          <path d={pathD} fill={fill} stroke="rgba(255,255,255,0.42)" strokeWidth={2.2} />
        ) : (
          <text
            x={VIEWBOX_WIDTH / 2}
            y={VIEWBOX_HEIGHT / 2}
            textAnchor="middle"
            dominantBaseline="central"
            fill={fill}
            style={{ fontSize: 150, fontWeight: 900 }}
          >
            {uf}
          </text>
        )}
      </svg>
      <div className="mt-2 text-center">
        <div className="text-lg font-black text-white">{name}</div>
        <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">{uf}</div>
      </div>
    </div>
  );
}

export function StateModal({
  stateInfo,
  initialResult,
  candidates,
  nationalCandidatePcts,
  statePathD,
  onClose,
  onSave,
  onApplyToRegion,
  onToast,
}: StateModalProps) {
  const initialVotes = useMemo(() => {
    if (initialResult) {
      return normalizeVotesForCandidates(
        initialResult.votes,
        candidates.map((candidate) => candidate.id),
      );
    }
    return createEqualVotes(candidates);
  }, [candidates, initialResult]);

  const [votes, setVotes] = useState<Record<CandidateId, number>>(initialVotes);
  const [lockedCandidates, setLockedCandidates] = useState<Set<CandidateId>>(() => new Set());
  const [activeTooltip, setActiveTooltip] = useState<CandidateId | null>(null);
  const [confirmRegionOpen, setConfirmRegionOpen] = useState(false);
  const [historyDepth, setHistoryDepth] = useState(0);
  const historyRef = useRef<Record<CandidateId, number>[]>([]);
  const lastSnapshotRef = useRef<Record<CandidateId, number>>(initialVotes);
  const skipHistoryRef = useRef(false);
  const historyTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (historyTimerRef.current) window.clearTimeout(historyTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (skipHistoryRef.current) {
      skipHistoryRef.current = false;
      lastSnapshotRef.current = votes;
      return;
    }

    if (historyTimerRef.current) window.clearTimeout(historyTimerRef.current);
    historyTimerRef.current = window.setTimeout(() => {
      const previous = lastSnapshotRef.current;
      const previousJson = JSON.stringify(previous);
      const nextJson = JSON.stringify(votes);
      if (previousJson !== nextJson) {
        historyRef.current = [...historyRef.current, previous].slice(-10);
        setHistoryDepth(historyRef.current.length);
        lastSnapshotRef.current = votes;
      }
    }, 300);
  }, [votes]);

  const total = useMemo(
    () => candidates.reduce((sum, candidate) => sum + (votes[candidate.id] || 0), 0),
    [candidates, votes],
  );

  const currentWinnerId = getWinner(votes);
  const currentWinnerCandidate = currentWinnerId
    ? candidates.find((candidate) => candidate.id === currentWinnerId)
    : null;
  const currentWinnerPct = currentWinnerId ? votes[currentWinnerId] || 0 : 0;

  const redistributeCandidateValue = useCallback(
    (candidateId: CandidateId, rawValue: number) => {
      if (lockedCandidates.has(candidateId)) return;

      const lockedOtherTotal = candidates
        .filter((candidate) => candidate.id !== candidateId && lockedCandidates.has(candidate.id))
        .reduce((sum, candidate) => sum + (votes[candidate.id] || 0), 0);
      const maxValue = Math.max(0, 100 - lockedOtherTotal);
      const clampedValue = Math.min(maxValue, Math.max(0, rawValue));
      const adjustableOthers = candidates.filter(
        (candidate) => candidate.id !== candidateId && !lockedCandidates.has(candidate.id),
      );
      const otherCurrentTotal = adjustableOthers.reduce(
        (sum, candidate) => sum + (votes[candidate.id] || 0),
        0,
      );
      const remaining = Math.max(0, 100 - lockedOtherTotal - clampedValue);
      const nextVotes: Record<CandidateId, number> = { ...votes, [candidateId]: clampedValue };

      adjustableOthers.forEach((candidate) => {
        nextVotes[candidate.id] =
          otherCurrentTotal > 0
            ? ((votes[candidate.id] || 0) / otherCurrentTotal) * remaining
            : remaining / Math.max(adjustableOthers.length, 1);
      });

      setVotes(nextVotes);
    },
    [candidates, lockedCandidates, votes],
  );

  const applyPreset = (nextVotes: Record<CandidateId, number>) => {
    setVotes(normalizeForSave(nextVotes, candidates));
  };

  const handleAdvantagePreset = (candidateId: CandidateId) => {
    const others = candidates.filter((candidate) => candidate.id !== candidateId);
    const nextVotes: Record<CandidateId, number> = {};
    candidates.forEach((candidate) => {
      nextVotes[candidate.id] = candidate.id === candidateId ? 60 : 40 / Math.max(others.length, 1);
    });
    applyPreset(nextVotes);
  };

  const handleUndo = () => {
    const previous = historyRef.current.pop();
    if (!previous) return;
    setHistoryDepth(historyRef.current.length);
    skipHistoryRef.current = true;
    setVotes(previous);
    onToast?.("Alteracao desfeita!");
  };

  const handleSave = () => {
    const normalized = normalizeForSave(votes, candidates);
    const municipalityPaint = initialResult?.municipalityPaint ?? {};
    onSave({
      uf: stateInfo.uf,
      votes: normalized,
      winner: getWinner(normalized),
      usesMunicipalities: Object.keys(municipalityPaint).length > 0,
      municipalities: initialResult?.municipalities ?? {},
      municipalityPaint,
      excluded: initialResult?.excluded,
    });
  };

  const handleApplyRegion = () => {
    onApplyToRegion(normalizeForSave(votes, candidates), stateInfo.region);
    setConfirmRegionOpen(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 overflow-y-auto bg-black/80 p-4 backdrop-blur-sm"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 20 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
        className="mx-auto w-full max-w-5xl rounded-3xl border border-white/10 bg-gradient-to-b from-slate-950 to-slate-900 p-6 shadow-2xl"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="grid flex-1 gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
            <StateMiniMap
              uf={stateInfo.uf}
              name={stateInfo.name}
              pathD={statePathD}
              fill={currentWinnerCandidate?.color ?? "#334155"}
            />
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-3xl font-black text-white">Alterar porcentagens</h2>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-black text-slate-300">
                  {stateInfo.region}
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-400">
                {stateInfo.voters.toLocaleString("pt-BR")} votos estimados
              </p>
              {currentWinnerCandidate && (
                <div className="mt-4 rounded-xl border border-white/10 bg-slate-900/70 p-3">
                  <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                    Previa do vencedor
                  </div>
                  <div className="mt-1 text-2xl font-black" style={{ color: currentWinnerCandidate.color }}>
                    {currentWinnerCandidate.name} - {formatPct(currentWinnerPct)}
                  </div>
                </div>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="group flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-slate-800 text-white transition-all hover:scale-105 hover:bg-slate-700"
            aria-label="Fechar"
          >
            <svg className="h-6 w-6 transition-transform group-hover:rotate-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mb-5 rounded-2xl border border-white/10 bg-slate-900/60 p-4">
          <div className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-slate-500">Presets rapidos</div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => applyPreset(createEqualVotes(candidates))} className="rounded-full border border-slate-500 px-3 py-1.5 text-xs font-bold text-slate-200 transition hover:bg-slate-700">
              Empate tecnico
            </button>
            {candidates.map((candidate) => (
              <button
                key={candidate.id}
                type="button"
                onClick={() => handleAdvantagePreset(candidate.id)}
                className="flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold transition hover:bg-white/10"
                style={{ borderColor: `${candidate.color}80`, color: candidate.color }}
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: candidate.color }} />
                Vantagem {candidate.name}
              </button>
            ))}
            <button type="button" onClick={() => applyPreset(createRandomVotes(candidates))} className="rounded-full border border-violet-400/70 px-3 py-1.5 text-xs font-bold text-violet-200 transition hover:bg-violet-500/15">
              Aleatorio
            </button>
            <button type="button" onClick={() => applyPreset(createEqualVotes(candidates))} className="rounded-full border border-amber-400/70 px-3 py-1.5 text-xs font-bold text-amber-200 transition hover:bg-amber-500/15">
              Limpar
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {candidates.map((candidate) => {
            const value = votes[candidate.id] || 0;
            const isLocked = lockedCandidates.has(candidate.id);
            const nationalPct = nationalCandidatePcts[candidate.id] || 0;
            return (
              <div key={candidate.id} className="rounded-2xl border border-white/10 bg-slate-900/50 p-5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="h-12 w-12 shrink-0 rounded-full border-2 bg-slate-950" style={{ borderColor: candidate.color }}>
                      {candidate.photo ? (
                        <img src={candidate.photo} alt={candidate.name} className="h-full w-full rounded-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-sm font-black" style={{ color: candidate.color }}>
                          {candidate.number}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-lg font-black" style={{ color: candidate.color }}>{candidate.name}</div>
                      <div className="text-xs text-slate-400">{candidate.party}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setLockedCandidates((prev) => {
                          const next = new Set(prev);
                          if (next.has(candidate.id)) next.delete(candidate.id);
                          else next.add(candidate.id);
                          return next;
                        });
                      }}
                      className={`rounded-lg border px-2 py-1 text-xs font-black transition ${
                        isLocked
                          ? "border-amber-400/50 bg-amber-400/10 text-amber-300"
                          : "border-slate-600 bg-slate-800 text-slate-400 hover:text-white"
                      }`}
                    >
                      {isLocked ? "Travado" : "Livre"}
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-2xl font-black text-white">{formatPct(value)}</div>
                      <div className="text-xs text-slate-400">
                        {Math.round((value / 100) * stateInfo.voters).toLocaleString("pt-BR")} votos
                      </div>
                    </div>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.1}
                      value={value.toFixed(1)}
                      disabled={isLocked}
                      onChange={(event) => redistributeCandidateValue(candidate.id, Number(event.target.value))}
                      className="h-11 w-20 rounded-xl border bg-slate-800 text-center text-sm font-black text-white outline-none transition disabled:opacity-50"
                      style={{
                        borderColor: `${candidate.color}80`,
                        boxShadow: `0 0 0 0 ${candidate.color}`,
                      }}
                    />
                  </div>
                </div>

                <div className={`relative pt-6 ${isLocked ? "pointer-events-none opacity-50" : ""}`}>
                  {activeTooltip === candidate.id && (
                    <div
                      className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg border border-white/10 bg-slate-950 px-2 py-1 text-xs font-black text-white shadow-xl"
                      style={{ left: `${value}%` }}
                    >
                      {value.toFixed(1)}%
                    </div>
                  )}
                  <div className="relative">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={0.1}
                      value={value}
                      disabled={isLocked}
                      onInput={(event) => {
                        setActiveTooltip(candidate.id);
                        redistributeCandidateValue(candidate.id, Number(event.currentTarget.value));
                      }}
                      onMouseMove={() => setActiveTooltip(candidate.id)}
                      onMouseLeave={() => setActiveTooltip(null)}
                      onFocus={() => setActiveTooltip(candidate.id)}
                      onBlur={() => setActiveTooltip(null)}
                      className="candidate-range"
                      style={{
                        "--candidate-color": candidate.color,
                        "--track-pct": `${value}%`,
                      } as CSSProperties}
                    />
                    <span
                      className="pointer-events-none absolute top-1/2 h-5 -translate-x-1/2 -translate-y-1/2 border-l border-dashed border-white/70"
                      style={{ left: `${Math.min(100, Math.max(0, nationalPct))}%` }}
                    />
                  </div>
                  <div className="mt-2 text-xs text-slate-400">Media nacional: {formatPct(nationalPct)}</div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-5 rounded-2xl border border-white/10 bg-slate-900/60 p-4">
          <div className="mb-2 flex h-8 overflow-hidden rounded-full bg-slate-800">
            {candidates.map((candidate) => {
              const pct = votes[candidate.id] || 0;
              return (
                <div
                  key={candidate.id}
                  className="flex h-full items-center justify-center overflow-hidden whitespace-nowrap text-[11px] font-black text-white transition-[width] duration-300 ease-in-out"
                  style={{ width: `${pct}%`, backgroundColor: candidate.color }}
                >
                  {pct > 10 ? `${candidate.number} ${pct.toFixed(1)}%` : ""}
                </div>
              );
            })}
          </div>
          <div className={`text-sm font-black ${Math.abs(total - 100) < 0.05 ? "text-emerald-300" : "text-amber-300"}`}>
            Total: {total.toFixed(1)}%
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 border-t border-white/10 pt-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {historyDepth > 0 && (
              <button
                type="button"
                onClick={handleUndo}
                className="rounded-xl border border-slate-500/60 bg-slate-800 px-4 py-3 text-sm font-black text-slate-100 transition hover:bg-slate-700"
              >
                Desfazer
              </button>
            )}
            <button
              type="button"
              onClick={() => setConfirmRegionOpen(true)}
              className="rounded-xl border border-sky-500/40 bg-sky-500/10 px-4 py-3 text-sm font-black text-sky-200 transition hover:bg-sky-500/20"
            >
              Aplicar a toda a regiao {stateInfo.region}
            </button>
          </div>
          <button
            type="button"
            onClick={handleSave}
            className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-4 text-lg font-black text-white shadow-lg shadow-emerald-500/25 transition-all hover:scale-[1.02]"
          >
            Salvar Estado
          </button>
        </div>

        <AnimatePresence>
          {confirmRegionOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.94, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.94, y: 10 }}
                className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-950 p-5 shadow-2xl"
              >
                <div className="text-xl font-black text-white">Aplicar na regiao {stateInfo.region}?</div>
                <p className="mt-2 text-sm text-slate-400">
                  Esta acao substituira os dados existentes de todos os estados dessa regiao.
                </p>
                <div className="mt-5 flex justify-end gap-2">
                  <button type="button" onClick={() => setConfirmRegionOpen(false)} className="rounded-xl border border-white/10 px-4 py-2 text-sm font-bold text-slate-200 hover:bg-white/5">
                    Cancelar
                  </button>
                  <button type="button" onClick={handleApplyRegion} className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-black text-white hover:bg-sky-400">
                    Confirmar
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
