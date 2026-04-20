import { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import html2canvas from "html2canvas";
import {
  BottomCandidateCard,
  MapSizeSlider,
  OthersCard,
  TopCandidateCard,
  PhotoBackgroundPicker,
  type PhotoCardShape,
} from "../photo/PhotoCards";
import { StateMapCenter } from "../photo/MapCenters";
import type { Candidate, StateInfo, StateResult } from "../../types";

export function StatePhotoModal({ stateInfo, candidates, result, photoScale, photoMapScale, onClose, scenarioYear }: {
  stateInfo: StateInfo;
  candidates: Candidate[];
  result?: StateResult;
  photoScale: number;
  photoMapScale: number;
  onClose: () => void;
  scenarioYear?: number;
}) {
  const captureRef = useRef<HTMLDivElement>(null);
  const [localMapScale, setLocalMapScale] = useState(photoMapScale);
  const [showMunicipalityPaint, setShowMunicipalityPaint] = useState(result?.usesMunicipalities ?? false);
  const [bgValue, setBgValue] = useState("#0f172a");
  const [cardShape, setCardShape] = useState<PhotoCardShape>("circle");

  const ranked = useMemo(() => {
    const rows = candidates
      .map((candidate) => {
        const pct = result?.votes?.[candidate.id] ?? 0;
        const votes = (pct / 100) * stateInfo.voters;
        return { candidate, pct, votes };
      })
      .sort((a, b) => b.pct - a.pct);
    const totalVotes = rows.reduce((sum, item) => sum + item.votes, 0);
    const first = rows[0] ?? null;
    const second = rows[1] ?? null;
    const lower = rows.slice(2);
    const bottom3 = lower.slice(0, 3);
    const rest = lower.slice(3);
    const othersPct = rest.reduce((sum, item) => sum + item.pct, 0);
    const othersVotes = rest.reduce((sum, item) => sum + item.votes, 0);
    return { first, second, bottom3, othersPct, othersVotes, totalVotes, hasOthers: rest.length > 0 };
  }, [candidates, result, stateInfo.voters]);

  const candidateById = useMemo(() => Object.fromEntries(candidates.map((candidate) => [candidate.id, candidate])), [candidates]);

  const winnerCandidate = ranked.first?.candidate;
  const winnerColor = winnerCandidate?.color ?? null;
  const winnerPct = ranked.first?.pct ?? 0;

  const isGradientBg = bgValue.startsWith("linear-gradient");
  const bgStyle = isGradientBg ? { background: bgValue } : { backgroundColor: bgValue };

  const handleDownload = async () => {
    if (!captureRef.current) return;
    try {
      const canvas = await html2canvas(captureRef.current, {
        backgroundColor: isGradientBg ? "#0f172a" : bgValue,
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
      });
      canvas.toBlob((blob: Blob | null) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `foto-estado-${stateInfo.uf}-${Date.now()}.png`;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);
      }, "image/png");
    } catch (error) {
      console.error("Erro ao gerar imagem:", error);
      alert("Erro ao salvar imagem. Tente novamente.");
    }
  };

  const topAvatarPx = Math.round(150 * photoScale);
  const bottomAvatarPx = Math.round(80 * photoScale);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 overflow-y-auto bg-black/80 p-4 backdrop-blur-sm">
      <div className="mx-auto w-full max-w-[1600px]">
        <div className="mb-4 flex items-center justify-between flex-wrap gap-3">
          <h3 className="text-3xl font-black text-white">Foto estadual — {stateInfo.name}</h3>
          <div className="flex gap-2 items-center flex-wrap">
            {/* Shape toggle */}
            <div className="flex rounded-xl border border-white/10 bg-slate-900/80 p-1">
              <button type="button" onClick={() => setCardShape("circle")}
                className={`rounded-lg px-3 py-1 text-xs font-black transition-all ${cardShape === "circle" ? "bg-violet-600 text-white" : "text-slate-300"}`}>
                ⚪ Bola
              </button>
              <button type="button" onClick={() => setCardShape("portrait")}
                className={`rounded-lg px-3 py-1 text-xs font-black transition-all ${cardShape === "portrait" ? "bg-violet-600 text-white" : "text-slate-300"}`}>
                🟦 Retrato
              </button>
            </div>
            <div className="flex rounded-xl border border-white/10 bg-slate-900/80 p-1">
              <button type="button" onClick={() => setShowMunicipalityPaint(false)}
                className={`rounded-lg px-3 py-1 text-xs font-black ${showMunicipalityPaint ? "text-slate-300" : "bg-violet-600 text-white"}`}>
                Sem município
              </button>
              <button type="button" onClick={() => setShowMunicipalityPaint(true)}
                className={`rounded-lg px-3 py-1 text-xs font-black ${showMunicipalityPaint ? "bg-violet-600 text-white" : "text-slate-300"}`}>
                Com município
              </button>
            </div>
            <PhotoBackgroundPicker value={bgValue} onChange={setBgValue} />
            <MapSizeSlider value={localMapScale} onChange={setLocalMapScale} />
            <button type="button" onClick={handleDownload} className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-black text-zinc-950">Salvar PNG</button>
            <button type="button" onClick={onClose} className="rounded-xl border border-white/15 px-4 py-2 text-sm font-bold text-white">Fechar</button>
          </div>
        </div>

        <div ref={captureRef} className="rounded-[40px] border border-white/10 p-8" style={bgStyle}>
          <div className="mb-6 text-center">
            <div className="text-[11px] font-black uppercase tracking-[0.6em] text-slate-500">
              Resultado Eleição {scenarioYear ?? 2026} — {stateInfo.name}
            </div>
          </div>

          <div className="flex items-center justify-center gap-4 mb-8 flex-wrap md:flex-nowrap">
            {ranked.first && (
              <div className="flex-1 min-w-[220px]">
                <TopCandidateCard item={ranked.first} rank={0} avatarPx={topAvatarPx} showVice={true} showVotes={true} shape={cardShape} />
              </div>
            )}
            <StateMapCenter
              stateInfo={stateInfo}
              winnerColor={winnerColor}
              winnerPct={winnerPct}
              mapSizePx={localMapScale}
              showMunicipalityPaint={showMunicipalityPaint}
              municipalityPaint={result?.municipalityPaint ?? {}}
              candidateById={candidateById}
            />
            {ranked.second && (
              <div className="flex-1 min-w-[220px]">
                <TopCandidateCard item={ranked.second} rank={1} avatarPx={topAvatarPx} showVice={true} showVotes={true} shape={cardShape} />
              </div>
            )}
          </div>

          {(ranked.bottom3.length > 0 || ranked.hasOthers) && (
            <div className="flex justify-center">
              <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${ranked.bottom3.length + (ranked.hasOthers ? 1 : 0)}, minmax(0, 200px))` }}>
                {ranked.bottom3.map((item) => (
                  <BottomCandidateCard key={item.candidate.id} item={item} avatarPx={bottomAvatarPx} showVotes={true} shape={cardShape} />
                ))}
                {ranked.hasOthers && <OthersCard othersPct={ranked.othersPct} othersVotes={ranked.othersVotes} avatarPx={bottomAvatarPx} showVotes={true} />}
              </div>
            </div>
          )}

          <div className="mt-4 text-center">
            <div className="inline-block rounded-full bg-white/5 px-12 py-5 border border-white/10 shadow-2xl">
              <div className="text-4xl font-black text-white">{Math.round(ranked.totalVotes).toLocaleString("pt-BR")}</div>
              <div className="text-[11px] font-black uppercase tracking-[0.4em] text-slate-500 mt-1">Votos Estimados</div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
