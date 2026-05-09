import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import type { Candidate, StateInfo, StateResult } from "../../types";
import { formatPct } from "../../lib/utils";

type StateActionModalProps = {
  stateInfo: StateInfo;
  currentResult?: StateResult;
  candidates: Candidate[];
  filledStates: StateInfo[];
  results: Record<string, StateResult>;
  onClose: () => void;
  onEdit: () => void;
  onPhoto: () => void;
  onMunicipalityEdit: () => void;
  onReset: () => void;
  onCopyFromState: (sourceUf: string) => void;
};

export function StateActionModal({
  stateInfo,
  currentResult,
  candidates,
  filledStates,
  results,
  onClose,
  onEdit,
  onPhoto,
  onMunicipalityEdit,
  onReset,
  onCopyFromState,
}: StateActionModalProps) {
  const [copyOpen, setCopyOpen] = useState(false);

  const hasResult = currentResult && (
    Object.values(currentResult.votes).some((value) => value > 0) ||
    Object.keys(currentResult.municipalityPaint ?? {}).length > 0
  );

  const summary = useMemo(() => {
    if (!currentResult?.winner) return null;
    const winner = candidates.find((candidate) => candidate.id === currentResult.winner);
    if (!winner) return null;
    return {
      winner,
      pct: currentResult.votes[currentResult.winner] || 0,
    };
  }, [candidates, currentResult]);

  const actions = [
    { label: "Foto estadual", description: "Resultado visual do estado", icon: "IMG", tone: "violet", onClick: onPhoto },
    { label: "Alterar porcentagens", description: "Editar votos por candidato", icon: "%", tone: "emerald", onClick: onEdit },
    { label: "Alterar municipios", description: "Pintura manual municipal", icon: "MUN", tone: "sky", onClick: onMunicipalityEdit },
    { label: "Copiar de outro estado", description: "Usar votos ja preenchidos", icon: "CPY", tone: "amber", onClick: () => setCopyOpen((prev) => !prev) },
  ];

  const toneClasses: Record<string, string> = {
    violet: "border-violet-500/25 bg-violet-500/10 text-violet-100 hover:bg-violet-500/20",
    emerald: "border-emerald-500/25 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20",
    sky: "border-sky-500/25 bg-sky-500/10 text-sky-100 hover:bg-sky-500/20",
    amber: "border-amber-500/25 bg-amber-500/10 text-amber-100 hover:bg-amber-500/20",
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/80 p-4 backdrop-blur-sm"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 14 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        className="mx-auto mt-20 w-full max-w-2xl rounded-3xl border border-white/10 bg-slate-950 p-6 shadow-2xl"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="text-3xl font-black text-white">{stateInfo.name}</h3>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-black text-slate-300">
                {stateInfo.uf}
              </span>
            </div>
            {summary ? (
              <p className="mt-2 text-sm font-bold" style={{ color: summary.winner.color }}>
                {summary.winner.name} lidera com {formatPct(summary.pct)}
              </p>
            ) : (
              <p className="mt-2 text-sm text-slate-400">Sem dados preenchidos</p>
            )}
          </div>
          <button type="button" onClick={onClose} className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm font-bold text-slate-200 hover:bg-slate-800">
            Fechar
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={action.onClick}
              className={`rounded-2xl border p-5 text-left transition hover:scale-[1.03] ${toneClasses[action.tone]}`}
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-slate-950/70 text-sm font-black">
                {action.icon}
              </div>
              <div className="text-lg font-black text-white">{action.label}</div>
              <div className="mt-1 text-sm text-slate-300">{action.description}</div>
            </button>
          ))}
        </div>

        {copyOpen && (
          <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4">
            <label className="text-xs font-black uppercase tracking-[0.18em] text-amber-200">
              Estado de origem
            </label>
            <select
              className="mt-2 w-full rounded-xl border border-amber-400/30 bg-slate-950 px-3 py-3 text-sm font-bold text-white outline-none"
              defaultValue=""
              onChange={(event) => {
                if (!event.target.value) return;
                onCopyFromState(event.target.value);
                onClose();
              }}
            >
              <option value="" disabled>Selecione um estado preenchido</option>
              {filledStates
                .filter((state) => state.uf !== stateInfo.uf && results[state.uf])
                .map((state) => (
                  <option key={state.uf} value={state.uf}>
                    {state.name} ({state.uf})
                  </option>
                ))}
            </select>
          </div>
        )}

        {hasResult && (
          <button
            type="button"
            onClick={() => { onReset(); onClose(); }}
            className="mt-4 w-full rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-4 text-left text-white transition-all hover:bg-red-500/20"
          >
            <div className="text-lg font-black text-red-300">Resetar resultado</div>
            <div className="text-sm text-red-400/80">Remove os dados deste estado sem afetar os demais.</div>
          </button>
        )}
      </motion.div>
    </motion.div>
  );
}
