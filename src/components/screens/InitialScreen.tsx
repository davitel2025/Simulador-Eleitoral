import { motion } from "framer-motion";
import { useState } from "react";
import { POLITICAL_SCENARIOS } from "../../data/scenarios";
import { STATES } from "../../data/states";
import type { ElectionRound, PoliticalScenario, CustomStateInfo } from "../../types";

type InitialView = "home" | "scenarios" | "custom";

// Total padrão do eleitorado nacional (projeção 2026)
const DEFAULT_NATIONAL_VOTERS = STATES.reduce((sum, s) => sum + s.voters, 0);

function getScenarioRound(scenario: PoliticalScenario): ElectionRound {
  return scenario.round ?? "segundo";
}

function getScenarioGroupTitle(scenario: PoliticalScenario): string {
  return scenario.year === 2026 ? "Projeção 2026" : `Eleições ${scenario.year}`;
}

function getScenarioBadge(scenario: PoliticalScenario) {
  if (scenario.id.includes("simulado")) {
    return {
      label: getScenarioRound(scenario) === "primeiro" ? "1º Turno — Simulação" : "Simulação",
      className: "border-purple-500/30 bg-purple-500/20 text-purple-300",
    };
  }
  if (getScenarioRound(scenario) === "primeiro") {
    return {
      label: "1º Turno",
      className: "border-blue-500/30 bg-blue-500/20 text-blue-300",
    };
  }
  return {
    label: "2º Turno",
    className: "border-amber-500/30 bg-amber-500/20 text-amber-300",
  };
}

function CandidateThumb({
  candidate,
}: {
  candidate: PoliticalScenario["candidates"][number];
}) {
  const [hasImageError, setHasImageError] = useState(false);
  const initials = candidate.name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-950/50 px-2.5 py-2">
      <div
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border text-[10px] font-black text-white"
        style={{ borderColor: candidate.color, backgroundColor: `${candidate.color}33` }}
      >
        {candidate.photo && !hasImageError ? (
          <img
            src={candidate.photo}
            alt={candidate.name}
            className="h-full w-full object-cover"
            onError={() => setHasImageError(true)}
          />
        ) : (
          initials || candidate.number
        )}
      </div>
      <div className="min-w-0">
        <div className="truncate text-xs font-black text-slate-200">{candidate.name}</div>
        <div className="text-[10px] font-bold text-slate-500">
          {candidate.party} · {candidate.number}
        </div>
      </div>
    </div>
  );
}

function CustomScenarioBuilder({
  onBack,
  onSelectScenario,
}: {
  onBack: () => void;
  onSelectScenario: (scenario: PoliticalScenario) => void;
}) {
  const [year, setYear] = useState(2026);
  const [selectedUFs, setSelectedUFs] = useState<string[]>(STATES.map((s) => s.uf));

  // Modo de eleitorado: "estado" = por estado individual | "nacional" = total nacional distribuído
  const [electorateMode, setElectorateMode] = useState<"estado" | "nacional">("estado");

  // Eleitorado nacional total (quando modo = "nacional")
  const [nationalVotersInput, setNationalVotersInput] = useState(DEFAULT_NATIONAL_VOTERS);

  // Eleitorado por estado (quando modo = "estado")
  const [customVoters, setCustomVoters] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    STATES.forEach((s) => { map[s.uf] = s.voters; });
    return map;
  });

  const toggleUF = (uf: string) => {
    setSelectedUFs((prev) =>
      prev.includes(uf) ? prev.filter((u) => u !== uf) : [...prev, uf]
    );
  };

  const toggleAll = () => {
    if (selectedUFs.length === STATES.length) {
      setSelectedUFs([]);
    } else {
      setSelectedUFs(STATES.map((s) => s.uf));
    }
  };

  // Calcula o peso proporcional de cada estado selecionado em relação ao total dos selecionados
  const getTotalDefaultVoters = () =>
    STATES.filter((s) => selectedUFs.includes(s.uf)).reduce(
      (sum, s) => sum + s.voters,
      0
    );

  // Quando modo nacional: calcula os voters de cada estado proporcional ao eleitorado padrão
  const getNationalDistributedVoters = (): Record<string, number> => {
    const totalDefault = getTotalDefaultVoters();
    if (totalDefault === 0) return {};
    const result: Record<string, number> = {};
    STATES.filter((s) => selectedUFs.includes(s.uf)).forEach((s) => {
      result[s.uf] = Math.round((s.voters / totalDefault) * nationalVotersInput);
    });
    return result;
  };

  const handleConfirm = () => {
    if (selectedUFs.length === 0) {
      alert("Selecione ao menos um estado.");
      return;
    }

    let finalVoters: Record<string, number>;
    if (electorateMode === "nacional") {
      finalVoters = getNationalDistributedVoters();
    } else {
      finalVoters = customVoters;
    }

    const customStates: CustomStateInfo[] = selectedUFs.map((uf) => ({
      uf,
      voters: finalVoters[uf] ?? STATES.find((s) => s.uf === uf)?.voters ?? 1000000,
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
      nationalVoters: electorateMode === "nacional" ? nationalVotersInput : undefined,
      isCustom: true,
    };
    onSelectScenario(scenario);
  };

  const REGIONS = ["Norte", "Nordeste", "Centro-Oeste", "Sudeste", "Sul"] as const;

  // Para exibir os voters distribuídos quando modo = "nacional"
  const distributedVoters = electorateMode === "nacional" ? getNationalDistributedVoters() : {};

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-white transition-colors"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        Voltar
      </button>

      {/* Ano */}
      <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-5">
        <h3 className="text-lg font-black text-white mb-4">📅 Ano do Cenário</h3>
        <div className="flex items-center gap-3">
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            min={1900}
            max={2100}
            className="w-36 rounded-xl border border-slate-600 bg-slate-950 px-4 py-2.5 text-lg font-black text-white focus:outline-none focus:border-emerald-500"
          />
          <span className="text-slate-400 text-sm">O ano aparecerá nas fotos e exibições</span>
        </div>
      </div>

      {/* Estados */}
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
          {selectedUFs.length} de {STATES.length} estados selecionados • Clique para incluir/excluir
        </p>

        {REGIONS.map((region) => {
          const regionStates = STATES.filter((s) => s.region === region);
          return (
            <div key={region} className="mb-4">
              <div className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2">
                {region}
              </div>
              <div className="flex flex-wrap gap-2">
                {regionStates.map((state) => {
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

      {/* Eleitorado — modo */}
      <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-5">
        <h3 className="text-lg font-black text-white mb-2">👥 Eleitorado</h3>
        <p className="text-xs text-slate-500 mb-4">
          Escolha como definir o número de eleitores: por estado individual ou um total nacional
          distribuído proporcionalmente.
        </p>

        {/* Toggle de modo */}
        <div className="flex rounded-xl border border-white/10 bg-slate-900 p-1 w-fit mb-5">
          <button
            type="button"
            onClick={() => setElectorateMode("estado")}
            className={`rounded-lg px-4 py-2 text-xs font-black transition-all ${
              electorateMode === "estado"
                ? "bg-emerald-600 text-white"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            🗺️ Por estado
          </button>
          <button
            type="button"
            onClick={() => setElectorateMode("nacional")}
            className={`rounded-lg px-4 py-2 text-xs font-black transition-all ${
              electorateMode === "nacional"
                ? "bg-violet-600 text-white"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            🌎 Total nacional
          </button>
        </div>

        {/* Modo: Total Nacional */}
        {electorateMode === "nacional" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-4">
              <label className="block text-xs font-black uppercase tracking-widest text-violet-400 mb-2">
                Total de votos válidos no país
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  value={nationalVotersInput}
                  min={1}
                  onChange={(e) => setNationalVotersInput(Number(e.target.value))}
                  className="w-52 rounded-xl border border-violet-500/40 bg-slate-950 px-4 py-2.5 text-lg font-black text-white focus:outline-none focus:border-violet-400"
                />
                <span className="text-sm text-slate-400">eleitores</span>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Os votos serão distribuídos proporcionalmente entre os estados selecionados,
                respeitando o peso eleitoral histórico de cada um.
              </p>
            </div>

            {/* Preview da distribuição */}
            {selectedUFs.length > 0 && (
              <div>
                <div className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2">
                  Preview da distribuição
                </div>
                <div className="grid gap-1.5 md:grid-cols-2 max-h-64 overflow-y-auto pr-1">
                  {STATES.filter((s) => selectedUFs.includes(s.uf)).map((state) => (
                    <div
                      key={state.uf}
                      className="flex items-center gap-2 rounded-lg border border-white/5 bg-slate-950/60 px-3 py-1.5"
                    >
                      <div className="w-8 text-xs font-black text-slate-400">{state.uf}</div>
                      <div className="flex-1 text-xs text-slate-500 truncate">{state.name}</div>
                      <div className="text-xs font-bold text-violet-300">
                        {(distributedVoters[state.uf] ?? 0).toLocaleString("pt-BR")}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-2 text-right text-xs text-slate-500">
                  Total distribuído:{" "}
                  <span className="font-black text-violet-300">
                    {Object.values(distributedVoters)
                      .reduce((a, b) => a + b, 0)
                      .toLocaleString("pt-BR")}
                  </span>{" "}
                  (pode diferir por arredondamento)
                </div>
              </div>
            )}
          </div>
        )}

        {/* Modo: Por estado */}
        {electorateMode === "estado" && (
          <div>
            <p className="text-xs text-slate-500 mb-3">
              Ajuste a quantidade de eleitores de cada estado participante (padrão: projeção 2026)
            </p>
            <div className="grid gap-2 md:grid-cols-2">
              {STATES.filter((s) => selectedUFs.includes(s.uf)).map((state) => (
                <div
                  key={state.uf}
                  className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-950/50 px-3 py-2"
                >
                  <div className="w-10 text-xs font-black text-slate-400">{state.uf}</div>
                  <div className="flex-1 text-xs text-slate-500 truncate">{state.name}</div>
                  <input
                    type="number"
                    value={customVoters[state.uf] ?? state.voters}
                    min={1}
                    onChange={(e) =>
                      setCustomVoters((prev) => ({
                        ...prev,
                        [state.uf]: Number(e.target.value),
                      }))
                    }
                    className="w-28 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200 text-right focus:outline-none focus:border-emerald-500"
                  />
                </div>
              ))}
            </div>
          </div>
        )}
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
  const groupedScenarios = POLITICAL_SCENARIOS.reduce<Record<string, PoliticalScenario[]>>(
    (groups, scenario) => {
      const title = getScenarioGroupTitle(scenario);
      groups[title] = [...(groups[title] ?? []), scenario];
      return groups;
    },
    {}
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-zinc-950 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-2xl w-full"
      >
        <div className="text-center mb-12">
          <div className="inline-flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-2xl shadow-emerald-500/25 mb-6">
            <svg
              className="h-10 w-10 text-white"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              <rect x="4" y="4" width="16" height="16" rx="2" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </div>
          <h1 className="text-5xl font-black tracking-tight text-white mb-3">
            Simulador Eleitoral
          </h1>
          <p className="text-xl text-slate-400">Brasil — Eleições Presidenciais</p>
        </div>

        {view === "home" && (
          <div className="grid gap-6">
            <motion.button
              type="button"
              onClick={() => onSelect("primeiro")}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="group relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-violet-600/20 to-purple-900/20 p-8 text-left shadow-2xl transition-all hover:border-white/20"
            >
              <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-violet-500/10 blur-3xl transition-all group-hover:bg-violet-500/20" />
              <div className="relative z-10">
                <div className="mb-4 text-4xl">🗳️</div>
                <h2 className="text-3xl font-black text-white mb-2">Primeiro Turno</h2>
                <p className="text-slate-400">Configure múltiplos candidatos</p>
              </div>
            </motion.button>

            <motion.button
              type="button"
              onClick={() => onSelect("segundo")}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="group relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-emerald-600/20 to-teal-900/20 p-8 text-left shadow-2xl transition-all hover:border-white/20"
            >
              <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-emerald-500/10 blur-3xl transition-all group-hover:bg-emerald-500/20" />
              <div className="relative z-10">
                <div className="mb-4 text-4xl">🏆</div>
                <h2 className="text-3xl font-black text-white mb-2">Segundo Turno</h2>
                <p className="text-slate-400">Confronto entre 2 candidatos</p>
              </div>
            </motion.button>

            <motion.button
              type="button"
              onClick={() => setView("scenarios")}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="group relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-amber-600/20 to-orange-900/20 p-8 text-left shadow-2xl transition-all hover:border-white/20"
            >
              <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-amber-500/10 blur-3xl transition-all group-hover:bg-amber-500/20" />
              <div className="relative z-10">
                <div className="mb-4 text-4xl">📊</div>
                <h2 className="text-3xl font-black text-white mb-2">Cenários Históricos</h2>
                <p className="text-slate-400">Carregue dados de eleições anteriores (2018, 2022)</p>
              </div>
            </motion.button>

            <motion.button
              type="button"
              onClick={() => setView("custom")}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="group relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-purple-600/20 to-pink-900/20 p-8 text-left shadow-2xl transition-all hover:border-white/20"
            >
              <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-purple-500/10 blur-3xl transition-all group-hover:bg-purple-500/20" />
              <div className="relative z-10">
                <div className="mb-4 text-4xl">⚙️</div>
                <h2 className="text-3xl font-black text-white mb-2">Cenário Personalizado</h2>
                <p className="text-slate-400">
                  Defina ano, eleitorado (por estado ou nacional) e quais estados participam
                </p>
              </div>
            </motion.button>
          </div>
        )}

        {view === "scenarios" && (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => setView("home")}
              className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-white transition-colors"
            >
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              Voltar
            </button>

            {Object.entries(groupedScenarios).map(([groupTitle, scenarios]) => {
              const orderedScenarios = [...scenarios].sort((a, b) => {
                if (getScenarioRound(a) === getScenarioRound(b)) return 0;
                return getScenarioRound(a) === "primeiro" ? -1 : 1;
              });
              return (
              <section
                key={groupTitle}
                className="rounded-3xl border border-white/10 bg-slate-950/40 p-4"
              >
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-xl font-black text-white">{groupTitle}</h2>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-black text-slate-400">
                    {scenarios.length} cenário{scenarios.length > 1 ? "s" : ""}
                  </span>
                </div>

                <div className="grid gap-3">
                  {orderedScenarios.map((scenario) => {
                    const badge = getScenarioBadge(scenario);
                    return (
                      <motion.button
                        key={scenario.id}
                        type="button"
                        onClick={() => onSelectScenario(scenario)}
                        whileHover={{ scale: 1.01 }}
                        className="w-full rounded-2xl border border-white/10 bg-slate-900/60 p-5 text-left transition-all hover:bg-slate-800 hover:border-white/20"
                      >
                        <div className="mb-4 flex items-start justify-between gap-4">
                          <div>
                            <div className="mb-1 text-2xl font-black text-white">
                              {scenario.name}
                            </div>
                            <p className="text-sm text-slate-400">{scenario.description}</p>
                          </div>
                          <div className={`rounded-full border px-3 py-1 text-xs font-black ${badge.className}`}>
                            {badge.label}
                          </div>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {scenario.candidates.map((candidate, index) => (
                            <CandidateThumb key={`${scenario.id}-${index}`} candidate={candidate} />
                          ))}
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </section>
              );
            })}
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
