import type { RankedItem } from "../../types";
import { formatPct } from "../../lib/utils";
import { UserIcon } from "../UserIcon";

export function TopCandidateCard({ item, rank, avatarPx, showVice = true, showVotes = false }: {
  item: RankedItem; rank: number; avatarPx: number; showVice?: boolean; showVotes?: boolean;
}) {
  const { candidate, pct, votes } = item;
  return (
    <div className="rounded-3xl border bg-slate-900/60 p-6 text-center flex flex-col items-center" style={{ borderColor: `${candidate.color}40` }}>
      {candidate.partyLogo && (
        <div className="mb-3 h-10 w-auto flex items-center justify-center">
          <img src={candidate.partyLogo} alt={candidate.party} className="h-10 object-contain" />
        </div>
      )}
      <div className="mb-3 overflow-hidden rounded-full border-4 bg-slate-900 flex-shrink-0"
        style={{ width: avatarPx, height: avatarPx, borderColor: candidate.color }}>
        {candidate.photo ? (
          <img src={candidate.photo} alt={candidate.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-3xl font-black" style={{ color: candidate.color }}>
            {candidate.number}
          </div>
        )}
      </div>
      <div className="text-3xl font-black mb-1" style={{ color: candidate.color }}>{candidate.name}</div>
      {showVice && candidate.vice && (
        <div className="flex items-center gap-2 mb-2">
          {candidate.vicePhoto && (
            <div className="h-8 w-8 overflow-hidden rounded-full border-2" style={{ borderColor: candidate.color }}>
              <img src={candidate.vicePhoto} alt={candidate.vice} className="h-full w-full object-cover" />
            </div>
          )}
          <div className="text-xs font-semibold text-slate-400">Vice: {candidate.vice}</div>
        </div>
      )}
      {!candidate.partyLogo && <div className="text-xs font-bold text-slate-500 mb-2">{candidate.party}</div>}
      {candidate.ideology && (
        <div className="mb-2 rounded-lg px-3 py-1 text-xs font-bold text-slate-400 bg-slate-800/50">
          {candidate.ideology}
        </div>
      )}
      <div className="text-6xl font-black text-white">{formatPct(pct)}</div>
      {showVotes && votes !== undefined && (
        <div className="mt-1 text-sm text-slate-500">{Math.round(votes).toLocaleString("pt-BR")} votos</div>
      )}
    </div>
  );
}

export function BottomCandidateCard({ item, avatarPx, showVotes = false }: {
  item: RankedItem; avatarPx: number; showVotes?: boolean;
}) {
  const { candidate, pct, votes } = item;
  return (
    <div className="rounded-2xl border bg-slate-900/40 p-4 text-center flex flex-col items-center" style={{ borderColor: `${candidate.color}30` }}>
      {candidate.partyLogo && (
        <div className="mb-2 h-7 flex items-center justify-center">
          <img src={candidate.partyLogo} alt={candidate.party} className="h-7 object-contain" />
        </div>
      )}
      <div className="mb-2 overflow-hidden rounded-full border-2 bg-slate-900" style={{ width: avatarPx, height: avatarPx, borderColor: candidate.color }}>
        {candidate.photo ? (
          <img src={candidate.photo} alt={candidate.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm font-black" style={{ color: candidate.color }}>
            {candidate.number}
          </div>
        )}
      </div>
      <div className="text-lg font-black mb-0.5" style={{ color: candidate.color }}>{candidate.name}</div>
      {!candidate.partyLogo && <div className="text-xs text-slate-500 mb-0.5">{candidate.party}</div>}
      {candidate.ideology && (
        <div className="text-xs text-slate-400 mb-1">{candidate.ideology}</div>
      )}
      <div className="text-2xl font-black text-white">{formatPct(pct)}</div>
      {showVotes && votes !== undefined && (
        <div className="text-xs text-slate-500">{Math.round(votes).toLocaleString("pt-BR")}</div>
      )}
    </div>
  );
}

export function OthersCard({ othersPct, othersVotes, avatarPx, showVotes = false }: {
  othersPct: number; othersVotes?: number; avatarPx: number; showVotes?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-600/40 bg-slate-900/40 p-4 text-center flex flex-col items-center">
      <div className="mb-2 overflow-hidden rounded-full border-2 border-slate-500 bg-slate-800 flex items-center justify-center" style={{ width: avatarPx, height: avatarPx }}>
        <UserIcon className="h-3/5 w-3/5 text-slate-400" />
      </div>
      <div className="text-lg font-black mb-0.5 text-slate-300">Outros</div>
      <div className="text-xs text-slate-500 mb-1">Demais candidatos</div>
      <div className="text-2xl font-black text-white">{formatPct(othersPct)}</div>
      {showVotes && othersVotes !== undefined && (
        <div className="text-xs text-slate-500">{Math.round(othersVotes).toLocaleString("pt-BR")}</div>
      )}
    </div>
  );
}

export function MapSizeSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-900/80 px-4 py-2 backdrop-blur-sm">
      <span className="text-xs font-black uppercase tracking-widest text-slate-400 whitespace-nowrap">Mapa</span>
      <input
        type="range" min={280} max={800} step={20} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-28 appearance-none rounded-full bg-slate-700 accent-violet-500"
      />
      <span className="text-xs font-bold text-slate-400 w-12 text-right">{value}px</span>
    </div>
  );
}