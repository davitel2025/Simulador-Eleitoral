import { motion } from "framer-motion";
import { useState } from "react";
import { POLITICAL_SCENARIOS } from "../../data/scenarios";
import { STATES } from "../../data/states";
import type { ElectionRound, PoliticalScenario, CustomStateInfo } from "../../types";

type InitialView = "home" | "scenarios" | "custom";

function CustomScenarioBuilder({ onBack, onSelectScenario }: {
  onBack: () => void;
  onSelectScenario: (scenario: PoliticalScenario) => void;
}) {
  const [year, setYear] = useState(2026);
  const [selectedUFs, setSelectedUFs] = useState<string[]>(STATES.map(s => s.uf));
  const [customVoters, setCustomVoters] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    STATES.forEach(s => { map[s.uf] = s.voters; });
    return map;
  });

  const toggleUF = (uf: string) => {
    setSelectedUFs(prev =>
      prev.includes(uf) ? prev.filter(u => u !== uf) : [...prev, uf]
    );
  };

  const toggleAll = () => {
    if (selectedUFs.length === STATES.length) {
      setSelectedUFs([]);
    } else {
      setSelectedUFs(STATES.map(s => s.uf));
    }
  };

  const handleConfirm = () => {
    if (selectedUFs.length === 0) {
      alert("Selecione ao menos um estado.");
      return;
    }
    const customStates: CustomStateInfo[] = selectedUFs.map(uf => ({
      uf,
      voters: customVoters[uf] ?? STATES.find(s => s.uf === uf)?.voters ?? 1000000,
    }));

    const scenario: PoliticalScenario = {
      id: `custom_${Date.now()}`,
      name: `Cenário Personalizado ${year}`,
      year,
      description: `Cenário criado manualmente para ${year} com ${selectedUFs.length} estado(s)`,
      candidates: [
        { name: "Candidato A", vice: "Vice A", party: "Partido A", number: "1", color: "#dc2626" },
        { name: "Candidato B", vice: "Vice B", party: "Partido B", number: "2", color: "#1e40af" },
      ],
      customStates,
      isCustom: true,
    };
    onSelectScenario(scenario);
  };

  const REGIONS = ["Norte", "Nordeste", "Centro-Oeste", "Sudeste", "Sul"] as const;

  return (
    <div className="space-y-5">
      <button type="button" onClick={onBack}
        className="flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-white transition-colors">
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        Voltar
      </button>

      <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-5">
        <h3 className="text-lg font-black text-white mb-4">📅 Ano do Cenário</h3>
        <div className="flex items-center gap-3">
          <input
            type="number"
            value={year}
            onChange={e => setYear(Number(e.target.value))}
            min={1900}
            max={2100}
            className="w-36 rounded-xl border border-slate-600 bg-slate-950 px-4 py-2.5 text-lg font-black text-white focus:outline-none focus:border-emerald-500"
          />
          <span className="text-slate-400 text-sm">O ano aparecerá nas fotos e exibições</span>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-black text-white">🗺️ Estados Participantes</h3>
          <button
            type="button"
            onClick={toggleAll}
            className="rounded-xl border border-white/15 bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-300 hover:bg-slate-700"
          >
            {selectedUFs.length === STATES.length ? "Desmarcar todos" : "Selecionar todos"}
          </button>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          {selectedUFs.length} de {STATES.length} estados selecionados • Clique para incluir/excluir do cenário
        </p>

        {REGIONS.map(region => {
          const regionStates = STATES.filter(s => s.region === region);
          return (
            <div key={region} className="mb-4">
              <div className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2">{region}</div>
              <div className="flex flex-wrap gap-2">
                {regionStates.map(state => {
                  const selected = selectedUFs.includes(state.uf);
                  return (
                    <button
                      key={state.uf}
                      type="button"
                      onClick={() => toggleUF(state.uf)}
                      className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all border ${
                        selected
                          ? "bg-emerald-500/20 border-emerald-500/60 text-emerald-300"
                          : "bg-slate-800/60 border-white/10 text-slate-500 hover:border-white/20"
                      }`}
                    >
                      {state.uf}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-5">
        <h3 className="text-lg font-black text-white mb-4">👥 Eleitorado por Estado</h3>
        <p className="text-xs text-slate-500 mb-4">
          Ajuste a quantidade de eleitores de cada estado participante (padrão: projeção 2026)
        </p>
        <div className="grid gap-2 md:grid-cols-2">
          {STATES.filter(s => selectedUFs.includes(s.uf)).map(state => (
            <div key={state.uf} className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-950/50 px-3 py-2">
              <div className="w-10 text-xs font-black text-slate-400">{state.uf}</div>
              <div className="flex-1 text-xs text-slate-500 truncate">{state.name}</div>
              <input
                type="number"
                value={customVoters[state.uf] ?? state.voters}
                min={1}
                onChange={e => setCustomVoters(prev => ({ ...prev, [state.uf]: Number(e.target.value) }))}
                className="w-28 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200 text-right focus:outline-none focus:border-emerald-500"
              />
            </div>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={handleConfirm}
        disabled={selectedUFs.length === 0}
        className="w-full rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 px-8 py-5 text-lg font-black text-white shadow-2xl transition-all hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Configurar Candidatos →
      </button>
    </div>
  );
}

export function InitialScreen({
  onSelect,
  onSelectScenario,
}: {
  onSelect: (round: ElectionRound) => void;
  onSelectScenario: (scenario: PoliticalScenario) => void;
}) {
  const [view, setView] = useState<InitialView>("home");

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
          <p className="text-xl text-slate-400">Brasil — Eleições Presidenciais</p>
        </div>

        {view === "home" && (
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

            <motion.button type="button" onClick={() => setView("scenarios")} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              className="group relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-amber-600/20 to-orange-900/20 p-8 text-left shadow-2xl transition-all hover:border-white/20">
              <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-amber-500/10 blur-3xl transition-all group-hover:bg-amber-500/20" />
              <div className="relative z-10">
                <div className="mb-4 text-4xl">📊</div>
                <h2 className="text-3xl font-black text-white mb-2">Cenários Históricos</h2>
                <p className="text-slate-400">Carregue dados de eleições anteriores (2018, 2022)</p>
              </div>
            </motion.button>

            <motion.button type="button" onClick={() => setView("custom")} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              className="group relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-purple-600/20 to-pink-900/20 p-8 text-left shadow-2xl transition-all hover:border-white/20">
              <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-purple-500/10 blur-3xl transition-all group-hover:bg-purple-500/20" />
              <div className="relative z-10">
                <div className="mb-4 text-4xl">⚙️</div>
                <h2 className="text-3xl font-black text-white mb-2">Cenário Personalizado</h2>
                <p className="text-slate-400">Defina ano, eleitores e quais estados participam</p>
              </div>
            </motion.button>
          </div>
        )}

        {view === "scenarios" && (
          <div className="space-y-4">
            <button type="button" onClick={() => setView("home")}
              className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-white transition-colors">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              Voltar
            </button>

            {POLITICAL_SCENARIOS.map((scenario) => (
              <motion.button key={scenario.id} type="button" onClick={() => onSelectScenario(scenario)}
                whileHover={{ scale: 1.01 }}
                className="w-full rounded-2xl border border-white/10 bg-slate-900/50 p-6 text-left transition-all hover:bg-slate-800 hover:border-white/20">
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
                    <div key={i} className="rounded-lg px-3 py-1.5 text-xs font-bold"
                      style={{ backgroundColor: `${cand.color}20`, color: cand.color }}>
                      {cand.name} - {cand.party}
                      {cand.ideology && <span className="ml-1 opacity-70">({cand.ideology})</span>}
                    </div>
                  ))}
                </div>
              </motion.button>
            ))}
          </div>
        )}

        {view === "custom" && (
          <CustomScenarioBuilder
            onBack={() => setView("home")}
            onSelectScenario={onSelectScenario}
          />
        )}
      </motion.div>
    </div>
  );
}
