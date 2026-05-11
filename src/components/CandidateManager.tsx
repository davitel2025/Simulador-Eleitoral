import { useState } from "react";
import { DEFAULT_COLORS } from "../lib/constants";
import { readFileAsBase64 } from "../lib/utils";
import type { Candidate, CandidateId, ElectionRound } from "../types";

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

function CandidateAvatar({ candidate }: { candidate: Candidate }) {
  const [failed, setFailed] = useState(false);

  return (
    <div
      className="flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border-2 text-sm font-black text-white"
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
        getInitials(candidate.name) || candidate.number
      )}
    </div>
  );
}

function SimpleUpload({
  label,
  image,
  onUpload,
  onRemove,
  borderColor = "#475569",
  rounded,
}: {
  label: string;
  image?: string;
  onUpload: (base64: string) => void;
  onRemove: () => void;
  borderColor?: string;
  rounded: "full" | "lg";
}) {
  return (
    <div>
      <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</div>
      {image ? (
        <div className="group relative h-16 overflow-hidden rounded-xl border bg-slate-950" style={{ borderColor }}>
          <img
            src={image}
            alt={label}
            className={`h-full w-full object-cover ${rounded === "full" ? "rounded-full" : "rounded-xl"}`}
          />
          <button
            type="button"
            onClick={onRemove}
            className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-[10px] font-black text-white opacity-0 transition-opacity group-hover:opacity-100"
          >
            X
          </button>
        </div>
      ) : (
        <label className="flex h-16 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-slate-600 bg-slate-950/70 text-[10px] font-bold text-slate-400 transition-all hover:border-white/30 hover:bg-slate-800">
          IMG
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) readFileAsBase64(file, onUpload);
            }}
          />
        </label>
      )}
    </div>
  );
}

export function CandidateManager({
  round,
  candidates,
  neonStates,
  photoScale,
  photoMapScale,
  onNeonStatesChange,
  onPhotoScaleChange,
  onPhotoMapScaleChange,
  onChange,
}: {
  round: ElectionRound;
  candidates: Candidate[];
  neonStates: boolean;
  photoScale: number;
  photoMapScale: number;
  onNeonStatesChange: (value: boolean) => void;
  onPhotoScaleChange: (value: number) => void;
  onPhotoMapScaleChange: (value: number) => void;
  onChange: (candidates: Candidate[]) => void;
}) {
  const updateCandidate = (id: CandidateId, updates: Partial<Candidate>) => {
    onChange(candidates.map((candidate) => (candidate.id === id ? { ...candidate, ...updates } : candidate)));
  };

  const addCandidate = () => {
    const nextId = Math.max(...candidates.map((candidate) => candidate.id), 0) + 1;
    const color = DEFAULT_COLORS[(nextId - 1) % DEFAULT_COLORS.length];
    onChange([
      ...candidates,
      {
        id: nextId,
        name: `Candidato ${nextId}`,
        vice: `Vice ${nextId}`,
        party: `Partido ${nextId}`,
        number: String(nextId),
        color,
      },
    ]);
  };

  const removeCandidate = (id: CandidateId) => {
    if (candidates.length <= 2) return;
    onChange(candidates.filter((candidate) => candidate.id !== id));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-black text-white">Candidatos</h3>
          <div className="text-xs text-slate-500">{candidates.length} configurados</div>
        </div>
        {round === "primeiro" && (
          <button
            type="button"
            onClick={addCandidate}
            className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-300"
          >
            + Adicionar
          </button>
        )}
      </div>

      <div className="grid gap-4">
        {candidates.map((candidate) => (
          <div
            key={candidate.id}
            className="rounded-2xl border border-white/10 bg-slate-900/60 p-4"
            style={{ borderLeft: `4px solid ${candidate.color}` }}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <CandidateAvatar candidate={candidate} />
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-2">
                    {candidate.partyLogo && (
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white p-1">
                        <img src={candidate.partyLogo} alt={candidate.party} className="max-h-full max-w-full object-contain" />
                      </div>
                    )}
                    <div className="truncate text-sm font-black text-white">
                      {candidate.name || `Candidato ${candidate.id}`}
                    </div>
                  </div>
                  <div className="mt-1 text-xs font-bold text-slate-500">
                    {candidate.party} {candidate.number}
                  </div>
                  {candidate.ideology && (
                    <div className={`mt-2 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-black ${getIdeologyColor(candidate.ideology)}`}>
                      {candidate.ideology}
                    </div>
                  )}
                </div>
              </div>
              {round === "primeiro" && candidates.length > 2 && (
                <button
                  type="button"
                  onClick={() => removeCandidate(candidate.id)}
                  className="text-xs font-bold text-red-300 hover:text-red-200"
                >
                  Remover
                </button>
              )}
            </div>

            <div className="mb-2 grid grid-cols-1 gap-2 md:grid-cols-4">
              <input
                type="text"
                value={candidate.name}
                onChange={(event) => updateCandidate(candidate.id, { name: event.target.value })}
                className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
                placeholder="Nome"
              />
              <input
                type="text"
                value={candidate.vice}
                onChange={(event) => updateCandidate(candidate.id, { vice: event.target.value })}
                className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
                placeholder="Vice"
              />
              <input
                type="text"
                value={candidate.titular || ""}
                onChange={(event) => updateCandidate(candidate.id, { titular: event.target.value })}
                list="candidate-manager-titular-options"
                className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
                placeholder="Titular"
              />
              <input
                type="text"
                value={candidate.party}
                onChange={(event) => updateCandidate(candidate.id, { party: event.target.value })}
                className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
                placeholder="Partido"
              />
            </div>
            <datalist id="candidate-manager-titular-options">
              {candidates.map((candidateOption) => (
                <option key={candidateOption.id} value={candidateOption.name} />
              ))}
            </datalist>

            <div className="mb-2 grid grid-cols-1 gap-2 md:grid-cols-2">
              <input
                type="text"
                value={candidate.ideology || ""}
                onChange={(event) => updateCandidate(candidate.id, { ideology: event.target.value })}
                className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
                placeholder="Ideologia"
              />
              <input
                type="text"
                value={candidate.coalition || ""}
                onChange={(event) => updateCandidate(candidate.id, { coalition: event.target.value })}
                className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
                placeholder="Coligacao"
              />
            </div>

            <div className="mb-3 grid grid-cols-2 gap-2">
              <input
                type="text"
                value={candidate.number}
                onChange={(event) => updateCandidate(candidate.id, { number: event.target.value })}
                className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
                placeholder="Numero"
              />
              <input
                type="color"
                value={candidate.color}
                onChange={(event) => updateCandidate(candidate.id, { color: event.target.value })}
                className="h-10 w-full cursor-pointer rounded-lg border border-slate-700 bg-slate-950"
              />
            </div>

            <div className="grid grid-cols-4 gap-2">
              <SimpleUpload
                label="Foto"
                image={candidate.photo}
                borderColor={candidate.color}
                onUpload={(photo) => updateCandidate(candidate.id, { photo })}
                onRemove={() => updateCandidate(candidate.id, { photo: undefined })}
                rounded="full"
              />
              <SimpleUpload
                label="Foto Vice"
                image={candidate.vicePhoto}
                borderColor={candidate.color}
                onUpload={(vicePhoto) => updateCandidate(candidate.id, { vicePhoto })}
                onRemove={() => updateCandidate(candidate.id, { vicePhoto: undefined })}
                rounded="full"
              />
              <SimpleUpload
                label="Foto Titular"
                image={candidate.titularPhoto}
                borderColor={candidate.color}
                onUpload={(titularPhoto) => updateCandidate(candidate.id, { titularPhoto })}
                onRemove={() => updateCandidate(candidate.id, { titularPhoto: undefined })}
                rounded="full"
              />
              <SimpleUpload
                label="Logo"
                image={candidate.partyLogo}
                onUpload={(partyLogo) => updateCandidate(candidate.id, { partyLogo })}
                onRemove={() => updateCandidate(candidate.id, { partyLogo: undefined })}
                rounded="lg"
              />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <label className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-sm font-semibold text-slate-300">
          Efeito neon
          <input
            type="checkbox"
            checked={neonStates}
            onChange={(event) => onNeonStatesChange(event.target.checked)}
            className="h-4 w-4 accent-emerald-500"
          />
        </label>
        <div className="rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2">
          <div className="mb-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Escala avatar foto</div>
          <input
            type="range"
            min={1.1}
            max={1.9}
            step={0.05}
            value={photoScale}
            onChange={(event) => onPhotoScaleChange(Number(event.target.value))}
            className="h-2 w-full appearance-none rounded-full bg-slate-700"
          />
          <div className="mt-0.5 text-right text-[10px] text-slate-500">{photoScale.toFixed(2)}x</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2">
          <div className="mb-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Tamanho mapa foto</div>
          <input
            type="range"
            min={280}
            max={800}
            step={20}
            value={photoMapScale}
            onChange={(event) => onPhotoMapScaleChange(Number(event.target.value))}
            className="h-2 w-full appearance-none rounded-full bg-slate-700"
          />
          <div className="mt-0.5 text-right text-[10px] text-slate-500">{photoMapScale}px</div>
        </div>
      </div>
    </div>
  );
}
