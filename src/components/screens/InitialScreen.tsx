import { motion } from "framer-motion";
import { useState } from "react";
import { POLITICAL_SCENARIOS } from "../../data/scenarios";
import type { ElectionRound, PoliticalScenario } from "../../types";

export function InitialScreen({ 
  onSelect, 
  onSelectScenario 
}: { 
  onSelect: (round: ElectionRound) => void;
  onSelectScenario: (scenario: PoliticalScenario) => void;
}) {
  const [showScenarios, setShowScenarios] = useState(false);

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
          <p className="text-xl text-slate-400">Brasil 2026 - Eleições Presidenciais</p>
        </div>

        {!showScenarios ? (
          <div className="grid gap-6">
            <motion.button type="button" onClick={() => onSelect("primeiro")} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              className="group relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-violet-600/20 to-purple-900/20 p-8 text-left shadow-2xl transition-all hover:border-white/20">
              <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-violet-500/10 blur-3xl transition-all group-hover:bg-violet-500/20" />
              <div className="relative z-10">
                <div className="mb-4 text-4xl">🗳️</div>
                <h2 className="text-3xl font-black text-white mb-2">Primeiro Turno</h2>
                <p className="text-slate-400">Configure múltiplos candidatos</p>
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

            <motion.button type="button" onClick={() => setShowScenarios(true)} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              className="group relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-amber-600/20 to-orange-900/20 p-8 text-left shadow-2xl transition-all hover:border-white/20">
              <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-amber-500/10 blur-3xl transition-all group-hover:bg-amber-500/20" />
              <div className="relative z-10">
                <div className="mb-4 text-4xl">📊</div>
                <h2 className="text-3xl font-black text-white mb-2">Cenários Históricos</h2>
                <p className="text-slate-400">Carregue dados de eleições anteriores (2018, 2022)</p>
              </div>
            </motion.button>
          </div>
        ) : (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => setShowScenarios(false)}
              className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-white transition-colors"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              Voltar
            </button>

            {POLITICAL_SCENARIOS.map((scenario) => (
              <motion.button
                key={scenario.id}
                type="button"
                onClick={() => onSelectScenario(scenario)}
                whileHover={{ scale: 1.01 }}
                className="w-full rounded-2xl border border-white/10 bg-slate-900/50 p-6 text-left transition-all hover:bg-slate-800 hover:border-white/20"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="text-2xl font-black text-white mb-1">{scenario.name}</div>
                    <p className="text-sm text-slate-400">{scenario.description}</p>
                  </div>
                  <div className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-black text-emerald-400">
                    {scenario.year}
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {scenario.candidates.map((cand, i) => (
                    <div
                      key={i}
                      className="rounded-lg px-3 py-1.5 text-xs font-bold"
                      style={{ backgroundColor: `${cand.color}20`, color: cand.color }}
                    >
                      {cand.name} - {cand.party}
                      {cand.ideology && <span className="ml-1 opacity-70">({cand.ideology})</span>}
                    </div>
                  ))}
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}