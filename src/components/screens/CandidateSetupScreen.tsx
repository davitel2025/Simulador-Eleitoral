import { useState, type ChangeEvent } from "react";
import { motion } from "framer-motion";
import { DEFAULT_COLORS } from "../../lib/constants";
import { readFileAsBase64 } from "../../lib/utils";
import type { Candidate, CandidateId, ElectionRound } from "../../types";

function CandidateField({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (value: string) => void; placeholder: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">{label}</label>
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full rounded-xl border border-slate-600 bg-slate-900/80 px-4 py-3 text-slate-200 placeholder:text-slate-600 focus:border-white/30 focus:outline-none focus:ring-2 focus:ring-white/10 transition-all" />
    </div>
  );
}

function FileUploadField({ label, currentFile, onUpload, onRemove }: {
  label: string; currentFile?: string; onUpload: (file: string) => void; onRemove: () => void;
}) {
  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    readFileAsBase64(file, onUpload);
  };

  return (
    <div>
      <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">{label}</label>
      {currentFile ? (
        <div className="space-y-2">
          <div className="h-12 w-12 overflow-hidden rounded-lg border-2 border-emerald-500/50">
            <img src={currentFile} alt={label} className="h-full w-full object-cover" />
          </div>
          <button type="button" onClick={onRemove} className="text-xs font-bold text-red-300 hover:text-red-200">Remover</button>
        </div>
      ) : (
        <label className="flex h-12 cursor-pointer items-center justify-center rounded-xl border border-dashed border-slate-600 bg-slate-900/50 text-xs font-bold text-slate-400 transition-all hover:border-white/30 hover:bg-slate-800">
          Upload
          <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
        </label>
      )}
    </div>
  );
}

export function CandidateSetupScreen({ round, initialCandidates, onComplete, onBack }: {
  round: ElectionRound;
  initialCandidates: Candidate[];
  onComplete: (candidates: Candidate[]) => void;
  onBack: () => void;
}) {
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
    const newId = Math.max(...candidates.map((c) => c.id), 0) + 1;
    setCandidates([...candidates, {
      id: newId, name: `Candidato ${newId}`, vice: `Vice ${newId}`, party: `Partido ${newId}`,
      number: String(newId), color: DEFAULT_COLORS[newId % DEFAULT_COLORS.length],
    }]);
  };

  const removeCandidate = (id: CandidateId) => {
    if (candidates.length <= 2) return;
    setCandidates(candidates.filter((c) => c.id !== id));
  };

  const updateCandidate = (id: CandidateId, updates: Partial<Candidate>) => {
    setCandidates(candidates.map((c) => (c.id === id ? { ...c, ...updates } : c)));
  };

  const canProceed = candidates.length >= 2 && candidates.every((c) => c.name.trim() && c.party.trim());

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-zinc-950 p-4 overflow-y-auto">
      <div className="max-w-6xl mx-auto py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-black text-white mb-2">
              Configurar {round === "primeiro" ? "Primeiro" : "Segundo"} Turno
            </h1>
            <p className="text-slate-400">Configure os candidatos</p>
          </div>
          <button type="button" onClick={onBack} className="rounded-xl border border-white/15 bg-slate-800/80 px-6 py-3 text-sm font-bold text-white transition-all hover:bg-slate-700">
            ← Voltar
          </button>
        </div>

        <div className="grid gap-6 mb-8">
          {candidates.map((candidate, index) => (
            <motion.div key={candidate.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.1 }}
              className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-800/40 p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-2xl font-black text-white">Candidato #{candidate.id}</h3>
                {candidates.length > 2 && (
                  <button type="button" onClick={() => removeCandidate(candidate.id)}
                    className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-bold text-red-300 transition-all hover:bg-red-500/20">
                    Remover
                  </button>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5 mb-4">
                <CandidateField label="Nome" value={candidate.name} onChange={(value) => updateCandidate(candidate.id, { name: value })} placeholder="Nome" />
                <CandidateField label="Vice" value={candidate.vice} onChange={(value) => updateCandidate(candidate.id, { vice: value })} placeholder="Vice" />
                <CandidateField label="Partido" value={candidate.party} onChange={(value) => updateCandidate(candidate.id, { party: value })} placeholder="Partido" />
                <CandidateField label="Ideologia" value={candidate.ideology || ""} onChange={(value) => updateCandidate(candidate.id, { ideology: value })} placeholder="Opcional" />
                <CandidateField label="Número" value={candidate.number} onChange={(value) => updateCandidate(candidate.id, { number: value })} placeholder="Número" />
              </div>

              <div className="grid gap-4 md:grid-cols-4">
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">Cor</label>
                  <input type="color" value={candidate.color} onChange={(e) => updateCandidate(candidate.id, { color: e.target.value })}
                    className="h-12 w-full cursor-pointer rounded-xl border border-slate-600 bg-slate-900" />
                </div>
                <FileUploadField label="Foto" currentFile={candidate.photo}
                  onUpload={(photo) => updateCandidate(candidate.id, { photo })}
                  onRemove={() => updateCandidate(candidate.id, { photo: undefined })} />
                <FileUploadField label="Foto Vice" currentFile={candidate.vicePhoto}
                  onUpload={(vicePhoto) => updateCandidate(candidate.id, { vicePhoto })}
                  onRemove={() => updateCandidate(candidate.id, { vicePhoto: undefined })} />
                <FileUploadField label="Logo Partido" currentFile={candidate.partyLogo}
                  onUpload={(partyLogo) => updateCandidate(candidate.id, { partyLogo })}
                  onRemove={() => updateCandidate(candidate.id, { partyLogo: undefined })} />
              </div>
            </motion.div>
          ))}
        </div>

        {round === "primeiro" && (
          <button type="button" onClick={addCandidate}
            className="mb-8 w-full rounded-2xl border-2 border-dashed border-white/20 bg-white/5 py-6 text-sm font-bold text-slate-300 transition-all hover:border-white/30 hover:bg-white/10">
            + Adicionar Candidato
          </button>
        )}

        <button type="button" onClick={() => onComplete(candidates)} disabled={!canProceed}
          className="w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 px-8 py-5 text-lg font-black text-white shadow-2xl shadow-emerald-500/25 transition-all hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100">
          Iniciar Simulação
        </button>
      </div>
    </div>
  );
}