import type { RankedItem } from "../../types";
import { formatPct } from "../../lib/utils";
import { UserIcon } from "../UserIcon";

export type PhotoCardShape = "circle" | "portrait";

// ─── Configuração do retângulo ao redor dos top candidatos ───────────────────
export interface WinnerBoxConfig {
  show: boolean;
  color: string;
  borderRadius: number; // px
  padding: number;      // px
  borderWidth: number;  // px
}

export const DEFAULT_WINNER_BOX: WinnerBoxConfig = {
  show: true,
  color: "#ffffff22",
  borderRadius: 24,
  padding: 12,
  borderWidth: 2,
};

// ─── TopCandidateCard ────────────────────────────────────────────────────────

export function TopCandidateCard({
  item,
  rank,
  avatarPx,
  portraitPx,
  showVice = true,
  showVotes = false,
  shape = "circle",
}: {
  item: RankedItem;
  rank: number;
  avatarPx: number;        // tamanho da BOLINHA
  portraitPx?: number;     // tamanho do RETRATO (altura); se omitido usa avatarPx * proporção padrão
  showVice?: boolean;
  showVotes?: boolean;
  shape?: PhotoCardShape;
}) {
  const { candidate, pct, votes } = item;

  // Retrato: largura = 75% da altura
  const portraitH = portraitPx ?? Math.round(avatarPx * 1.18);
  const portraitW = Math.round(portraitH * 0.75);

  return (
    <div
      className="rounded-3xl border bg-slate-900/60 p-6 text-center flex flex-col items-center"
      style={{ borderColor: `${candidate.color}40` }}
    >
      {candidate.partyLogo && (
        <div className="mb-3 h-10 w-auto flex items-center justify-center">
          <img src={candidate.partyLogo} alt={candidate.party} className="h-10 object-contain" />
        </div>
      )}

      {shape === "portrait" ? (
        <div
          className="mb-3 overflow-hidden border-4 bg-slate-900 flex-shrink-0"
          style={{
            width: portraitW,
            height: portraitH,
            borderColor: candidate.color,
            borderRadius: "16px",
          }}
        >
          {candidate.photo ? (
            <img src={candidate.photo} alt={candidate.name} className="h-full w-full object-cover" />
          ) : (
            <div
              className="flex h-full w-full items-center justify-center text-3xl font-black"
              style={{ color: candidate.color }}
            >
              {candidate.number}
            </div>
          )}
        </div>
      ) : (
        <div
          className="mb-3 overflow-hidden rounded-full border-4 bg-slate-900 flex-shrink-0"
          style={{ width: avatarPx, height: avatarPx, borderColor: candidate.color }}
        >
          {candidate.photo ? (
            <img src={candidate.photo} alt={candidate.name} className="h-full w-full object-cover" />
          ) : (
            <div
              className="flex h-full w-full items-center justify-center text-3xl font-black"
              style={{ color: candidate.color }}
            >
              {candidate.number}
            </div>
          )}
        </div>
      )}

      <div className="text-3xl font-black mb-1" style={{ color: candidate.color }}>
        {candidate.name}
      </div>
      {showVice && candidate.vice && (
        <div className="flex items-center gap-2 mb-2">
          {candidate.vicePhoto && (
            <div
              className="h-8 w-8 overflow-hidden rounded-full border-2"
              style={{ borderColor: candidate.color }}
            >
              <img src={candidate.vicePhoto} alt={candidate.vice} className="h-full w-full object-cover" />
            </div>
          )}
          <div className="text-xs font-semibold text-slate-400">Vice: {candidate.vice}</div>
        </div>
      )}
      {!candidate.partyLogo && (
        <div className="text-xs font-bold text-slate-500 mb-2">{candidate.party}</div>
      )}
      {candidate.ideology && (
        <div className="mb-1 rounded-lg px-3 py-1 text-xs font-bold text-slate-400 bg-slate-800/50">
          {candidate.ideology}
        </div>
      )}
      {candidate.coalition && (
        <div className="mb-2 rounded-lg px-3 py-1 text-xs font-bold text-slate-500 bg-slate-800/30 max-w-[200px] leading-relaxed">
          🤝 {candidate.coalition}
        </div>
      )}
      <div className="text-6xl font-black text-white">{formatPct(pct)}</div>
      {showVotes && votes !== undefined && (
        <div className="mt-1 text-sm text-slate-500">
          {Math.round(votes).toLocaleString("pt-BR")} votos
        </div>
      )}
    </div>
  );
}

// ─── BottomCandidateCard ─────────────────────────────────────────────────────
// Candidatos menores ficam SEMPRE em bolinha (só top 2 usam o modo retrato)

export function BottomCandidateCard({
  item,
  avatarPx,
  showVotes = false,
}: {
  item: RankedItem;
  avatarPx: number;
  showVotes?: boolean;
  /** shape ignorado — bottom cards são sempre circle */
  shape?: PhotoCardShape;
}) {
  const { candidate, pct, votes } = item;

  return (
    <div
      className="rounded-2xl border bg-slate-900/40 p-4 text-center flex flex-col items-center"
      style={{ borderColor: `${candidate.color}30` }}
    >
      {candidate.partyLogo && (
        <div className="mb-2 h-7 flex items-center justify-center">
          <img src={candidate.partyLogo} alt={candidate.party} className="h-7 object-contain" />
        </div>
      )}

      {/* Sempre bolinha para candidatos menores */}
      <div
        className="mb-2 overflow-hidden rounded-full border-2 bg-slate-900"
        style={{ width: avatarPx, height: avatarPx, borderColor: candidate.color }}
      >
        {candidate.photo ? (
          <img src={candidate.photo} alt={candidate.name} className="h-full w-full object-cover" />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center text-sm font-black"
            style={{ color: candidate.color }}
          >
            {candidate.number}
          </div>
        )}
      </div>

      <div className="text-lg font-black mb-0.5" style={{ color: candidate.color }}>
        {candidate.name}
      </div>
      {!candidate.partyLogo && (
        <div className="text-xs text-slate-500 mb-0.5">{candidate.party}</div>
      )}
      {candidate.ideology && (
        <div className="text-xs text-slate-400 mb-1">{candidate.ideology}</div>
      )}
      {candidate.coalition && (
        <div className="text-xs text-slate-500 mb-1 max-w-[160px] leading-snug">
          🤝 {candidate.coalition}
        </div>
      )}
      <div className="text-2xl font-black text-white">{formatPct(pct)}</div>
      {showVotes && votes !== undefined && (
        <div className="text-xs text-slate-500">{Math.round(votes).toLocaleString("pt-BR")}</div>
      )}
    </div>
  );
}

// ─── OthersCard ──────────────────────────────────────────────────────────────

export function OthersCard({
  othersPct,
  othersVotes,
  avatarPx,
  showVotes = false,
}: {
  othersPct: number;
  othersVotes?: number;
  avatarPx: number;
  showVotes?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-600/40 bg-slate-900/40 p-4 text-center flex flex-col items-center">
      <div
        className="mb-2 overflow-hidden rounded-full border-2 border-slate-500 bg-slate-800 flex items-center justify-center"
        style={{ width: avatarPx, height: avatarPx }}
      >
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

// ─── MapSizeSlider ───────────────────────────────────────────────────────────

export function MapSizeSlider({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-900/80 px-4 py-2 backdrop-blur-sm">
      <span className="text-xs font-black uppercase tracking-widest text-slate-400 whitespace-nowrap">
        Mapa
      </span>
      <input
        type="range"
        min={280}
        max={800}
        step={20}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-28 appearance-none rounded-full bg-slate-700 accent-violet-500"
      />
      <span className="text-xs font-bold text-slate-400 w-12 text-right">{value}px</span>
    </div>
  );
}

// ─── Preset de backgrounds ───────────────────────────────────────────────────

export const PHOTO_BACKGROUNDS = [
  { id: "dark", label: "Escuro (padrão)", value: "#0f172a", isGradient: false },
  { id: "slate", label: "Slate", value: "#1e293b", isGradient: false },
  { id: "black", label: "Preto", value: "#000000", isGradient: false },
  {
    id: "grad-dark",
    label: "Gradiente azul",
    value: "linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%)",
    isGradient: true,
  },
  {
    id: "grad-purple",
    label: "Gradiente roxo",
    value: "linear-gradient(135deg,#0f172a 0%,#2d1b69 100%)",
    isGradient: true,
  },
  {
    id: "grad-emerald",
    label: "Gradiente verde",
    value: "linear-gradient(135deg,#0f172a 0%,#064e3b 100%)",
    isGradient: true,
  },
  {
    id: "grad-red",
    label: "Gradiente vermelho",
    value: "linear-gradient(135deg,#0f172a 0%,#450a0a 100%)",
    isGradient: true,
  },
];

// ─── PhotoBackgroundPicker ───────────────────────────────────────────────────
// Agora suporta upload de imagem como background

export function PhotoBackgroundPicker({
  value,
  onChange,
  onImageUpload,
  bgImage,
  onRemoveImage,
}: {
  value: string;
  onChange: (v: string) => void;
  onImageUpload?: (dataUrl: string) => void;
  bgImage?: string;
  onRemoveImage?: () => void;
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap rounded-xl border border-white/10 bg-slate-900/80 px-4 py-2">
      <span className="text-xs font-black uppercase tracking-widest text-slate-400 whitespace-nowrap">
        BG
      </span>

      {/* Presets de cor/gradiente */}
      {PHOTO_BACKGROUNDS.map((bg) => (
        <button
          key={bg.id}
          type="button"
          title={bg.label}
          onClick={() => {
            onChange(bg.value);
            if (onRemoveImage) onRemoveImage();
          }}
          className={`h-6 w-6 rounded-lg border-2 transition-all ${
            !bgImage && value === bg.value
              ? "border-white scale-110"
              : "border-transparent opacity-70 hover:opacity-100"
          }`}
          style={bg.isGradient ? { background: bg.value } : { backgroundColor: bg.value }}
        />
      ))}

      {/* Cor personalizada */}
      <div className="relative" title="Cor personalizada">
        <input
          type="color"
          value={value.startsWith("#") ? value : "#0f172a"}
          onChange={(e) => {
            onChange(e.target.value);
            if (onRemoveImage) onRemoveImage();
          }}
          className="h-6 w-6 rounded-lg border-2 border-transparent cursor-pointer opacity-70 hover:opacity-100"
          style={{ padding: "1px" }}
        />
      </div>

      {/* Upload de imagem */}
      {onImageUpload && (
        <div className="flex items-center gap-1">
          <label
            title="Imagem de fundo"
            className={`flex h-6 w-6 cursor-pointer items-center justify-center rounded-lg border-2 transition-all text-[10px] font-black ${
              bgImage
                ? "border-emerald-400 bg-emerald-500/20 text-emerald-300 scale-110"
                : "border-transparent bg-slate-700 text-slate-300 opacity-70 hover:opacity-100"
            }`}
          >
            🖼
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => {
                  const result = ev.target?.result;
                  if (typeof result === "string") onImageUpload(result);
                };
                reader.readAsDataURL(file);
                e.target.value = "";
              }}
            />
          </label>
          {bgImage && onRemoveImage && (
            <button
              type="button"
              onClick={onRemoveImage}
              title="Remover imagem de fundo"
              className="text-[10px] font-black text-red-400 hover:text-red-300 leading-none"
            >
              ✕
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── WinnerBoxControls ───────────────────────────────────────────────────────
// Controles para o retângulo ao redor dos top 2

export function WinnerBoxControls({
  config,
  onChange,
}: {
  config: WinnerBoxConfig;
  onChange: (c: WinnerBoxConfig) => void;
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2">
      <span className="text-xs font-black uppercase tracking-widest text-slate-400 whitespace-nowrap">
        Moldura
      </span>

      {/* Toggle visibilidade */}
      <button
        type="button"
        onClick={() => onChange({ ...config, show: !config.show })}
        className={`rounded-lg px-2 py-0.5 text-[10px] font-black transition-all border ${
          config.show
            ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300"
            : "bg-slate-800 border-white/10 text-slate-500"
        }`}
      >
        {config.show ? "ON" : "OFF"}
      </button>

      {config.show && (
        <>
          {/* Cor */}
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-slate-500">Cor</span>
            <input
              type="color"
              value={config.color.startsWith("#") ? config.color : "#ffffff"}
              onChange={(e) => onChange({ ...config, color: e.target.value })}
              className="h-5 w-5 rounded border border-slate-600 cursor-pointer"
              style={{ padding: "1px" }}
            />
            {/* Opacidade via hex alpha — slider simples de 0–100% */}
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={Math.round(
                parseInt(config.color.slice(7, 9) || "22", 16) / 2.55
              )}
              onChange={(e) => {
                const alpha = Math.round((Number(e.target.value) / 100) * 255)
                  .toString(16)
                  .padStart(2, "0");
                onChange({
                  ...config,
                  color: config.color.slice(0, 7) + alpha,
                });
              }}
              className="h-1.5 w-16 appearance-none rounded-full bg-slate-700 accent-violet-400"
              title="Opacidade"
            />
          </div>

          {/* Border radius */}
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-slate-500">Raio</span>
            <input
              type="range"
              min={0}
              max={60}
              step={4}
              value={config.borderRadius}
              onChange={(e) => onChange({ ...config, borderRadius: Number(e.target.value) })}
              className="h-1.5 w-14 appearance-none rounded-full bg-slate-700 accent-violet-400"
            />
            <span className="text-[10px] text-slate-500 w-6">{config.borderRadius}</span>
          </div>

          {/* Padding */}
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-slate-500">Pad</span>
            <input
              type="range"
              min={0}
              max={40}
              step={4}
              value={config.padding}
              onChange={(e) => onChange({ ...config, padding: Number(e.target.value) })}
              className="h-1.5 w-14 appearance-none rounded-full bg-slate-700 accent-violet-400"
            />
            <span className="text-[10px] text-slate-500 w-6">{config.padding}</span>
          </div>

          {/* Border width */}
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-slate-500">Borda</span>
            <input
              type="range"
              min={0}
              max={8}
              step={1}
              value={config.borderWidth}
              onChange={(e) => onChange({ ...config, borderWidth: Number(e.target.value) })}
              className="h-1.5 w-12 appearance-none rounded-full bg-slate-700 accent-violet-400"
            />
            <span className="text-[10px] text-slate-500 w-4">{config.borderWidth}</span>
          </div>
        </>
      )}
    </div>
  );
}

// ─── AvatarSizeControls ──────────────────────────────────────────────────────
// Slider separado para tamanho de bolinha e retrato

export function AvatarSizeControls({
  circleSize,
  portraitSize,
  onCircleChange,
  onPortraitChange,
  shape,
}: {
  circleSize: number;
  portraitSize: number;
  onCircleChange: (v: number) => void;
  onPortraitChange: (v: number) => void;
  shape: PhotoCardShape;
}) {
  if (shape === "portrait") {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-900/80 px-4 py-2 backdrop-blur-sm">
        <span className="text-xs font-black uppercase tracking-widest text-slate-400 whitespace-nowrap">
          Retrato
        </span>
        <input
          type="range"
          min={100}
          max={500}
          step={10}
          value={portraitSize}
          onChange={(e) => onPortraitChange(Number(e.target.value))}
          className="h-2 w-24 appearance-none rounded-full bg-slate-700 accent-violet-500"
        />
        <span className="text-xs font-bold text-slate-400 w-12 text-right">{portraitSize}px</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-900/80 px-4 py-2 backdrop-blur-sm">
      <span className="text-xs font-black uppercase tracking-widest text-slate-400 whitespace-nowrap">
        Bola
      </span>
      <input
        type="range"
        min={60}
        max={300}
        step={10}
        value={circleSize}
        onChange={(e) => onCircleChange(Number(e.target.value))}
        className="h-2 w-24 appearance-none rounded-full bg-slate-700 accent-violet-500"
      />
      <span className="text-xs font-bold text-slate-400 w-12 text-right">{circleSize}px</span>
    </div>
  );
}
