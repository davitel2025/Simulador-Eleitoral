import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { VIEWBOX_HEIGHT, VIEWBOX_WIDTH } from "../../lib/constants";
import { getColorByWinnerPct, shadeHex } from "../../lib/color";
import { buildMunicipalityPaths, fetchMunicipalityGeo } from "../../lib/geo";
import { formatPct, getWinner } from "../../lib/utils";
import type { Candidate, CandidateId, MunicipalityPath, StateInfo, StateResult } from "../../types";

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

export function StateModal({ stateInfo, initialResult, candidates, onClose, onSave }: {
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
