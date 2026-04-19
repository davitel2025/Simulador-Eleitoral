import { DEFAULT_COLORS } from "../lib/constants";
import { readFileAsBase64 } from "../lib/utils";
import type { Candidate, CandidateId, ElectionRound } from "../types";

function SimpleUpload({ label, image, onUpload, onRemove, borderColor = "#475569", rounded }: {
  label: string;
  image?: string;
  onUpload: (base64: string) => void;
  onRemove: () => void;
  borderColor?: string;
  rounded: "full" | "lg";
}) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">{label}</div>
      {image ? (
        <div className="flex flex-col items-center gap-1">
          <div
            className={`h-12 w-12 overflow-hidden border-2 ${rounded === "full" ? "rounded-full" : "rounded-lg bg-slate-800"}`}
            style={{ borderColor }}
          >
            <img src={image} alt={label} className="h-full w-full object-cover" />
          </div>
          <button type="button" onClick={onRemove} className="text-[10px] font-bold text-red-400 hover:text-red-300">Remover</button>
        </div>
      ) : (
        <label className="flex h-14 cursor-pointer items-center justify-center rounded-lg border border-dashed border-slate-600 bg-slate-900/50 text-[10px] font-bold text-slate-400 hover:border-white/30 hover:bg-slate-800 transition-all">
          Upload
          <input type="file" accept="image/*" className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) readFileAsBase64(file, onUpload);
            }} />
        </label>
      )}
    </div>
  );
}

export function CandidateManager({
  round, candidates, neonStates, photoScale, photoMapScale, onNeonStatesChange, onPhotoScaleChange, onPhotoMapScaleChange, onChange,
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
    onChange([...candidates, { id: nextId, name: `Candidato ${nextId}`, vice: `Vice ${nextId}`, party: `Partido ${nextId}`, number: String(nextId), color }]);
  };

  const removeCandidate = (id: CandidateId) => {
    if (candidates.length <= 2) return;
    onChange(candidates.filter((candidate) => candidate.id !== id));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-black text-white">Candidatos</h3>
        {round === "primeiro" && (
          <button type="button" onClick={addCandidate} className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-300">
            + Adicionar
          </button>
        )}
      </div>
      <div className="grid gap-4">
        {candidates.map((candidate) => (
          <div key={candidate.id} className="rounded-xl border border-white/10 bg-slate-900/50 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-black text-white">{candidate.name || `Candidato ${candidate.id}`}</div>
              {round === "primeiro" && candidates.length > 2 && (
                <button type="button" onClick={() => removeCandidate(candidate.id)} className="text-xs font-bold text-red-300 hover:text-red-200">Remover</button>
              )}
            </div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-4 mb-2">
              <input type="text" value={candidate.name} onChange={(event) => updateCandidate(candidate.id, { name: event.target.value })}
                className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200" placeholder="Nome" />
              <input type="text" value={candidate.vice} onChange={(event) => updateCandidate(candidate.id, { vice: event.target.value })}
                className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200" placeholder="Vice" />
              <input type="text" value={candidate.party} onChange={(event) => updateCandidate(candidate.id, { party: event.target.value })}
                className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200" placeholder="Partido" />
              <input type="text" value={candidate.ideology || ""} onChange={(event) => updateCandidate(candidate.id, { ideology: event.target.value })}
                className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200" placeholder="Ideologia (opcional)" />
            </div>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <input type="text" value={candidate.number} onChange={(event) => updateCandidate(candidate.id, { number: event.target.value })}
                className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200" placeholder="Numero" />
              <input type="color" value={candidate.color} onChange={(event) => updateCandidate(candidate.id, { color: event.target.value })}
                className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950 cursor-pointer" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <SimpleUpload label="Foto" image={candidate.photo} borderColor={candidate.color}
                onUpload={(photo) => updateCandidate(candidate.id, { photo })}
                onRemove={() => updateCandidate(candidate.id, { photo: undefined })} rounded="full" />
              <SimpleUpload label="Foto Vice" image={candidate.vicePhoto} borderColor={candidate.color}
                onUpload={(vicePhoto) => updateCandidate(candidate.id, { vicePhoto })}
                onRemove={() => updateCandidate(candidate.id, { vicePhoto: undefined })} rounded="full" />
              <SimpleUpload label="Logo" image={candidate.partyLogo}
                onUpload={(partyLogo) => updateCandidate(candidate.id, { partyLogo })}
                onRemove={() => updateCandidate(candidate.id, { partyLogo: undefined })} rounded="lg" />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <label className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-sm font-semibold text-slate-300">
          Efeito neon
          <input type="checkbox" checked={neonStates} onChange={(event) => onNeonStatesChange(event.target.checked)} className="h-4 w-4 accent-emerald-500" />
        </label>
        <div className="rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2">
          <div className="mb-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Escala avatar foto</div>
          <input type="range" min={1.1} max={1.9} step={0.05} value={photoScale}
            onChange={(event) => onPhotoScaleChange(Number(event.target.value))}
            className="h-2 w-full appearance-none rounded-full bg-slate-700" />
          <div className="text-right text-[10px] text-slate-500 mt-0.5">{photoScale.toFixed(2)}x</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2">
          <div className="mb-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Tamanho mapa foto</div>
          <input type="range" min={280} max={800} step={20} value={photoMapScale}
            onChange={(event) => onPhotoMapScaleChange(Number(event.target.value))}
            className="h-2 w-full appearance-none rounded-full bg-slate-700" />
          <div className="text-right text-[10px] text-slate-500 mt-0.5">{photoMapScale}px</div>
        </div>
      </div>
    </div>
  );
}