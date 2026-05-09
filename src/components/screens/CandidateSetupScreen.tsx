import { useState, type ChangeEvent } from "react";
import { motion } from "framer-motion";
import { PRESET_CANDIDATES } from "../../data/presetCandidates";
import { DEFAULT_COLORS } from "../../lib/constants";
import { readFileAsBase64 } from "../../lib/utils";
import type { Candidate, CandidateId, ElectionRound } from "../../types";

type SetupTab = "presets" | "candidatos" | "ideologia" | "coligacoes";

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function getIdeologyColor(ideology = "") {
  const value = ideology.toLowerCase();
  if (value.includes("comunista")) return "bg-red-900/50 text-red-300 border-red-500/20";
  if (value.includes("socialista")) return "bg-rose-900/50 text-rose-300 border-rose-500/20";
  if (value.includes("centro-direita")) return "bg-cyan-900/50 text-cyan-300 border-cyan-500/20";
  if (value.includes("centro-esquerda")) return "bg-orange-900/50 text-orange-300 border-orange-500/20";
  if (value.includes("direita liberal")) return "bg-sky-900/50 text-sky-300 border-sky-500/20";
  if (value.includes("conservadora")) return "bg-indigo-900/50 text-indigo-300 border-indigo-500/20";
  if (value.includes("direita")) return "bg-blue-800/50 text-blue-200 border-blue-500/20";
  if (value.includes("esquerda")) return "bg-red-800/50 text-red-200 border-red-500/20";
  if (value.includes("centro")) return "bg-blue-900/50 text-blue-300 border-blue-500/20";
  return "bg-slate-800/70 text-slate-300 border-white/10";
}

function CandidateAvatar({
  candidate,
  size = "h-16 w-16",
}: {
  candidate: Pick<Candidate, "name" | "number" | "color" | "photo">;
  size?: string;
}) {
  const [failed, setFailed] = useState(false);
  const fallback = getInitials(candidate.name) || candidate.number;

  return (
    <div
      className={`${size} flex flex-shrink-0 items-center justify-center overflow-hidden rounded-full border-2 text-sm font-black text-white shadow-lg`}
      style={{ borderColor: candidate.color, backgroundColor: `${candidate.color}33` }}
    >
      {candidate.photo && !failed ? (
        <img
          src={candidate.photo}
          alt={candidate.name}
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        fallback
      )}
    </div>
  );
}

function CandidateField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-slate-500">
        {label}
      </span>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 transition-all focus:border-white/30 focus:outline-none focus:ring-2 focus:ring-white/10"
      />
    </label>
  );
}

function FileUploadField({
  label,
  currentFile,
  onUpload,
  onRemove,
  rounded = "rounded-2xl",
}: {
  label: string;
  currentFile?: string;
  onUpload: (file: string) => void;
  onRemove: () => void;
  rounded?: string;
}) {
  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    readFileAsBase64(file, onUpload);
  };

  return (
    <div>
      <div className="mb-1.5 text-[10px] font-black uppercase tracking-wider text-slate-500">
        {label}
      </div>
      {currentFile ? (
        <div className={`group relative h-24 overflow-hidden ${rounded} border border-white/10 bg-slate-950`}>
          <img src={currentFile} alt={label} className="h-full w-full object-cover" />
          <button
            type="button"
            onClick={onRemove}
            className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-red-500 text-xs font-black text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100"
            aria-label={`Remover ${label}`}
          >
            X
          </button>
        </div>
      ) : (
        <label className={`flex h-24 cursor-pointer flex-col items-center justify-center gap-2 ${rounded} border border-dashed border-slate-600 bg-slate-950/60 text-xs font-bold text-slate-400 transition-all hover:border-white/30 hover:bg-slate-900`}>
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M4 7h3l2-3h6l2 3h3v13H4z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
          Enviar
          <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
        </label>
      )}
    </div>
  );
}

export function CandidateSetupScreen({
  round,
  initialCandidates,
  onComplete,
  onBack,
}: {
  round: ElectionRound;
  initialCandidates: Candidate[];
  onComplete: (candidates: Candidate[]) => void;
  onBack: () => void;
}) {
  const [activeTab, setActiveTab] = useState<SetupTab>("candidatos");
  const [selectedPresets, setSelectedPresets] = useState<number[]>([]);
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
    const newId = Math.max(...candidates.map((candidate) => candidate.id), 0) + 1;
    setCandidates([
      ...candidates,
      {
        id: newId,
        name: `Candidato ${newId}`,
        vice: `Vice ${newId}`,
        party: `Partido ${newId}`,
        number: String(newId),
        color: DEFAULT_COLORS[(newId - 1) % DEFAULT_COLORS.length],
      },
    ]);
  };

  const removeCandidate = (id: CandidateId) => {
    if (candidates.length <= 2) return;
    setCandidates(candidates.filter((candidate) => candidate.id !== id));
  };

  const updateCandidate = (id: CandidateId, updates: Partial<Candidate>) => {
    setCandidates(candidates.map((candidate) => (candidate.id === id ? { ...candidate, ...updates } : candidate)));
  };

  const togglePreset = (index: number) => {
    setSelectedPresets((current) => {
      if (current.includes(index)) return current.filter((item) => item !== index);
      if (round === "segundo" && current.length >= 2) return current;
      return [...current, index];
    });
  };

  const applySelectedPresets = () => {
    if (selectedPresets.length === 0) return;
    const shouldReplace = candidates.length === 0 || window.confirm("Isso substituira os candidatos atuais. Deseja continuar?");
    if (!shouldReplace) return;

    const nextCandidates: Candidate[] = selectedPresets.map((presetIndex, index) => ({
      ...PRESET_CANDIDATES[presetIndex],
      id: index + 1,
      locked: true,
    }));

    setCandidates(nextCandidates);
    setActiveTab("candidatos");
  };

  const canApplyPresets = round === "segundo" ? selectedPresets.length === 2 : selectedPresets.length >= 2;
  const canProceed = candidates.length >= 2 && candidates.every((candidate) => candidate.name.trim() && candidate.party.trim());

  const tabs: { id: SetupTab; label: string; emoji: string }[] = [
    { id: "presets", label: "Candidatos Prontos", emoji: "P" },
    { id: "candidatos", label: "Candidatos", emoji: "C" },
    { id: "ideologia", label: "Ideologia Politica", emoji: "I" },
    { id: "coligacoes", label: "Coligacoes", emoji: "L" },
  ];

  return (
    <div className="min-h-screen overflow-y-auto bg-gradient-to-br from-slate-950 via-slate-900 to-zinc-950 p-4">
      <div className="mx-auto max-w-7xl py-8">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="mb-2 text-4xl font-black text-white">
              Configurar {round === "primeiro" ? "Primeiro" : "Segundo"} Turno
            </h1>
            <p className="text-slate-400">
              Configure os candidatos manualmente ou comece por templates prontos e edite depois.
            </p>
          </div>
          <button
            type="button"
            onClick={onBack}
            className="w-fit rounded-xl border border-white/15 bg-slate-800/80 px-6 py-3 text-sm font-bold text-white transition-all hover:bg-slate-700"
          >
            Voltar
          </button>
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition-all ${
                activeTab === tab.id
                  ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/25"
                  : "border border-white/10 bg-slate-800/60 text-slate-300 hover:bg-slate-700"
              }`}
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-white/10 text-[10px]">
                {tab.emoji}
              </span>
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "presets" && (
          <div className="mb-8 space-y-5">
            <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-2xl font-black text-white">Candidatos prontos</h2>
                  <p className="mt-1 max-w-3xl text-sm text-slate-400">
                    Selecione candidatos prontos para preencher automaticamente todas as informacoes. Os candidatos selecionados substituirao a lista atual.
                  </p>
                  {round === "segundo" && (
                    <div className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm font-bold text-amber-200">
                      No 2o turno, apenas 2 candidatos sao permitidos. Selecione no maximo 2.
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={applySelectedPresets}
                  disabled={!canApplyPresets}
                  className="rounded-2xl bg-emerald-500 px-6 py-3 text-sm font-black text-slate-950 shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Aplicar Selecionados ({selectedPresets.length})
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {PRESET_CANDIDATES.map((candidate, index) => {
                const selected = selectedPresets.includes(index);
                const disabled = round === "segundo" && selectedPresets.length >= 2 && !selected;
                return (
                  <motion.button
                    key={`${candidate.name}-${candidate.party}-${index}`}
                    type="button"
                    onClick={() => !disabled && togglePreset(index)}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                    whileHover={!disabled ? { scale: 1.02 } : undefined}
                    className={`relative rounded-3xl border bg-slate-900/70 p-5 text-left shadow-lg transition-all ${
                      selected ? "border-white/30 shadow-xl" : "border-white/10 hover:border-white/20"
                    } ${disabled ? "cursor-not-allowed opacity-45" : ""}`}
                    style={selected ? { boxShadow: `0 0 0 2px ${candidate.color}, 0 24px 60px rgba(0,0,0,.35)` } : undefined}
                  >
                    <div
                      className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-lg border text-xs font-black"
                      style={{
                        borderColor: selected ? candidate.color : "rgba(255,255,255,.18)",
                        backgroundColor: selected ? candidate.color : "rgba(15,23,42,.8)",
                        color: selected ? "#020617" : "#94a3b8",
                      }}
                    >
                      {selected ? "OK" : ""}
                    </div>
                    <div className="mb-4 flex justify-center">
                      <CandidateAvatar candidate={candidate} size="h-20 w-20" />
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-black text-white">{candidate.name}</div>
                      <div className="mt-1 text-sm font-bold text-slate-400">
                        {candidate.party} {candidate.number}
                      </div>
                      <div className={`mt-3 inline-flex rounded-full border px-3 py-1 text-[11px] font-black ${getIdeologyColor(candidate.ideology)}`}>
                        {candidate.ideology}
                      </div>
                      <p className="mt-3 line-clamp-2 text-xs leading-5 text-slate-500">
                        {candidate.coalition}
                      </p>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === "candidatos" && (
          <>
            <div className="mb-5 flex flex-col gap-3 rounded-3xl border border-white/10 bg-slate-900/50 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-3xl font-black text-white">{candidates.length} candidatos configurados</div>
                <p className="text-sm text-slate-500">Edite nome, vice, partido, numero, cor, fotos e logo.</p>
              </div>
              <div className="text-sm font-bold text-slate-400">
                {round === "primeiro" ? "Primeiro turno" : "Segundo turno"}
              </div>
            </div>

            <div className="mb-8 grid gap-5">
              {candidates.map((candidate, index) => (
                <motion.div
                  key={candidate.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/90 to-slate-800/40 p-5 shadow-2xl"
                  style={{ borderLeft: `5px solid ${candidate.color}` }}
                >
                  <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="flex min-w-0 items-center gap-4">
                      <CandidateAvatar candidate={candidate} />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-2xl font-black text-white">{candidate.name}</h3>
                          {candidate.locked && (
                            <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-300">
                              preset
                            </span>
                          )}
                        </div>
                        <div className="mt-1 text-sm font-bold text-slate-400">
                          {candidate.party} {candidate.number}
                        </div>
                      </div>
                    </div>
                    {candidates.length > 2 && (
                      <button
                        type="button"
                        onClick={() => removeCandidate(candidate.id)}
                        className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-bold text-red-300 transition-all hover:bg-red-500/20"
                      >
                        Remover
                      </button>
                    )}
                  </div>

                  <div className="mb-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                    <CandidateField label="Nome" value={candidate.name} onChange={(value) => updateCandidate(candidate.id, { name: value })} placeholder="Nome" />
                    <CandidateField label="Vice" value={candidate.vice} onChange={(value) => updateCandidate(candidate.id, { vice: value })} placeholder="Vice" />
                    <CandidateField label="Partido" value={candidate.party} onChange={(value) => updateCandidate(candidate.id, { party: value })} placeholder="Partido" />
                    <CandidateField label="Numero" value={candidate.number} onChange={(value) => updateCandidate(candidate.id, { number: value })} placeholder="Numero" />
                  </div>

                  <div className="grid gap-3 md:grid-cols-[140px_1fr_1fr_1fr]">
                    <label>
                      <span className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-slate-500">Cor</span>
                      <input
                        type="color"
                        value={candidate.color}
                        onChange={(event) => updateCandidate(candidate.id, { color: event.target.value })}
                        className="h-24 w-full cursor-pointer rounded-2xl border border-slate-700 bg-slate-950"
                      />
                    </label>
                    <FileUploadField label="Foto" currentFile={candidate.photo} onUpload={(photo) => updateCandidate(candidate.id, { photo })} onRemove={() => updateCandidate(candidate.id, { photo: undefined })} rounded="rounded-full" />
                    <FileUploadField label="Foto Vice" currentFile={candidate.vicePhoto} onUpload={(vicePhoto) => updateCandidate(candidate.id, { vicePhoto })} onRemove={() => updateCandidate(candidate.id, { vicePhoto: undefined })} rounded="rounded-full" />
                    <FileUploadField label="Logo" currentFile={candidate.partyLogo} onUpload={(partyLogo) => updateCandidate(candidate.id, { partyLogo })} onRemove={() => updateCandidate(candidate.id, { partyLogo: undefined })} />
                  </div>
                </motion.div>
              ))}
            </div>

            {round === "primeiro" && (
              <motion.button
                type="button"
                onClick={addCandidate}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                className="mb-8 flex w-full items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-white/20 bg-white/5 py-7 text-sm font-black text-slate-300 transition-all hover:border-emerald-400/40 hover:bg-emerald-500/10 hover:text-emerald-200"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 text-xl">+</span>
                Adicionar candidato
              </motion.button>
            )}
          </>
        )}

        {activeTab === "ideologia" && (
          <div className="mb-8 grid gap-5">
            {candidates.map((candidate) => (
              <div key={candidate.id} className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-slate-900/50 p-4 md:flex-row md:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <CandidateAvatar candidate={candidate} size="h-11 w-11" />
                  <div className="min-w-0">
                    <div className="truncate font-black text-white">{candidate.name}</div>
                    <div className="text-xs text-slate-500">{candidate.party}</div>
                  </div>
                </div>
                <input
                  type="text"
                  value={candidate.ideology || ""}
                  onChange={(event) => updateCandidate(candidate.id, { ideology: event.target.value })}
                  placeholder="Ex: Centro-esquerda, Direita liberal..."
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 md:max-w-xl"
                />
              </div>
            ))}
          </div>
        )}

        {activeTab === "coligacoes" && (
          <div className="mb-8 grid gap-5">
            {candidates.map((candidate) => (
              <div key={candidate.id} className="rounded-2xl border border-white/10 bg-slate-900/50 p-4">
                <div className="mb-3 flex items-center gap-3">
                  <CandidateAvatar candidate={candidate} size="h-11 w-11" />
                  <div>
                    <div className="font-black text-white">{candidate.name}</div>
                    <div className="text-xs text-slate-500">{candidate.party}</div>
                  </div>
                </div>
                <textarea
                  value={candidate.coalition || ""}
                  onChange={(event) => updateCandidate(candidate.id, { coalition: event.target.value })}
                  placeholder="Ex: PT, MDB, PSDB, PDT..."
                  rows={2}
                  className="w-full resize-none rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-slate-200 placeholder:text-slate-600"
                />
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={() => onComplete(candidates)}
          disabled={!canProceed}
          className="w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 px-8 py-5 text-lg font-black text-white shadow-2xl shadow-emerald-500/25 transition-all hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
        >
          Iniciar Simulacao
        </button>
      </div>
    </div>
  );
}
