import { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import html2canvas from "html2canvas";
import { REGIONS, STATES, STATE_BY_UF } from "../../data/states";
import { buildRegionPaths } from "../../lib/geo";
import { getWinner } from "../../lib/utils";
import {
  BottomCandidateCard,
  MapSizeSlider,
  OthersCard,
  TopCandidateCard,
  PhotoBackgroundPicker,
  type PhotoCardShape,
} from "../photo/PhotoCards";
import { RegionalMapCenter, RegionalMunicipalityMapCenter } from "../photo/MapCenters";
import type { Candidate, CandidateId, PathData, RegionName, StateResult } from "../../types";

export function RegionalPhotoModal({ region, onRegionChange, candidates, paths, stateGeoData, results, photoScale, photoMapScale, candidateById, onClose, scenarioYear }: {
  region: RegionName;
  onRegionChange: (region: RegionName) => void;
  candidates: Candidate[];
  paths: PathData[];
  stateGeoData: any;
  results: Record<string, StateResult>;
  photoScale: number;
  photoMapScale: number;
  candidateById: Record<number, Candidate>;
  onClose: () => void;
  scenarioYear?: number;
}) {
  const captureRef = useRef<HTMLDivElement>(null);
  const [localMapScale, setLocalMapScale] = useState(photoMapScale);
  const [showMunicipalities, setShowMunicipalities] = useState(false);
  const [bgValue, setBgValue] = useState("#0f172a");
  const [cardShape, setCardShape] = useState<PhotoCardShape>("circle");

  const focusedRegionPaths = useMemo(() => {
    if (!stateGeoData) return [];
    return buildRegionPaths(stateGeoData, region);
  }, [stateGeoData, region]);

  const regionalData = useMemo(() => {
    const candidateVotes: Record<CandidateId, number> = {};
    candidates.forEach((c) => { candidateVotes[c.id] = 0; });
    for (const state of STATES) {
      if (state.region !== region) continue;
      const result = results[state.uf];
      if (!result) continue;
      Object.entries(result.votes).forEach(([id, pct]) => {
        const numId = Number(id);
        candidateVotes[numId] = (candidateVotes[numId] || 0) + (pct / 100) * state.voters;
      });
    }
    const total = Object.values(candidateVotes).reduce((sum, v) => sum + v, 0);
    const pcts: Record<CandidateId, number> = {};
    candidates.forEach((c) => { pcts[c.id] = total > 0 ? (candidateVotes[c.id] / total) * 100 : 0; });
    return { candidateVotes, pcts, total, winner: getWinner(pcts) };
  }, [region, results, candidates]);

  const ranked = useMemo(() => {
    const rows = candidates.map((c) => ({
      candidate: c,
      pct: regionalData.pcts[c.id] || 0,
      votes: regionalData.candidateVotes[c.id] || 0,
    })).sort((a, b) => b.pct - a.pct);
    const first = rows[0] ?? null;
    const second = rows[1] ?? null;
    const lower = rows.slice(2);
    const bottom3 = lower.slice(0, 3);
    const rest = lower.slice(3);
    const othersPct = rest.reduce((sum, item) => sum + item.pct, 0);
    const othersVotes = rest.reduce((sum, item) => sum + (item.votes ?? 0), 0);
    return { first, second, bottom3, othersPct, othersVotes, hasOthers: rest.length > 0 };
  }, [candidates, regionalData]);

  const topAvatarPx = Math.round(150 * photoScale);
  const bottomAvatarPx = Math.round(80 * photoScale);

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
        anchor.download = `foto-regional-${region}-${Date.now()}.png`;
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

  const mapPaths = focusedRegionPaths.length > 0
    ? focusedRegionPaths
    : paths.filter((pathItem) => STATE_BY_UF[pathItem.uf]?.region === region);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 overflow-y-auto bg-black/80 p-4 backdrop-blur-sm">
      <div className="mx-auto w-full max-w-[1900px]">
        <div className="mb-5 flex items-center justify-between text-white flex-wrap gap-3">
          <div className="flex items-center gap-4 flex-wrap">
            <h2 className="text-3xl font-black">Foto Regional</h2>
            <div className="flex gap-2 flex-wrap">
              {REGIONS.map((r) => (
                <button key={r} onClick={() => onRegionChange(r)}
                  className={`rounded-xl px-4 py-2 text-sm font-bold transition-all ${region === r ? "bg-emerald-500 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}>
                  {r}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-3 items-center flex-wrap">
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
              <button type="button" onClick={() => setShowMunicipalities(false)}
                className={`rounded-lg px-3 py-1 text-xs font-black ${showMunicipalities ? "text-slate-300" : "bg-blue-600 text-white"}`}>
                Por estado
              </button>
              <button type="button" onClick={() => setShowMunicipalities(true)}
                className={`rounded-lg px-3 py-1 text-xs font-black ${showMunicipalities ? "bg-blue-600 text-white" : "text-slate-300"}`}>
                Por município
              </button>
            </div>
            <PhotoBackgroundPicker value={bgValue} onChange={setBgValue} />
            <MapSizeSlider value={localMapScale} onChange={setLocalMapScale} />
            <button type="button" onClick={handleDownload}
              className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-3 text-sm font-black text-white shadow-lg transition-all hover:scale-105">
              Salvar PNG
            </button>
            <button type="button" onClick={onClose}
              className="rounded-xl border border-white/15 bg-slate-800/80 px-6 py-3 text-sm font-bold transition-all hover:bg-slate-700">
              Fechar
            </button>
          </div>
        </div>

        <div ref={captureRef} className="rounded-[50px] border border-white/10 p-12 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.7)]"
          style={bgStyle}>
          <div className="mb-6 text-center">
            <div className="text-[11px] font-black uppercase tracking-[0.6em] text-slate-500">
              Eleição {scenarioYear ?? 2026} — Resultado Regional
            </div>
          </div>

          <div className="flex items-center justify-center gap-6 mb-8 flex-wrap md:flex-nowrap">
            {ranked.first && (
              <div className="flex-1 min-w-[220px]">
                <TopCandidateCard item={ranked.first} rank={0} avatarPx={topAvatarPx} showVice={true} showVotes={true} shape={cardShape} />
              </div>
            )}
            {showMunicipalities ? (
              <RegionalMunicipalityMapCenter region={region} results={results} candidateById={candidateById} mapSizePx={localMapScale} />
            ) : (
              <RegionalMapCenter regionPaths={mapPaths} results={results} candidateById={candidateById} mapSizePx={localMapScale} />
            )}
            {ranked.second && (
              <div className="flex-1 min-w-[220px]">
                <TopCandidateCard item={ranked.second} rank={1} avatarPx={topAvatarPx} showVice={true} showVotes={true} shape={cardShape} />
              </div>
            )}
          </div>

          {(ranked.bottom3.length > 0 || ranked.hasOthers) && (
            <div className="flex justify-center mb-8">
              <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${ranked.bottom3.length + (ranked.hasOthers ? 1 : 0)}, minmax(0, 200px))` }}>
                {ranked.bottom3.map((item) => (
                  <BottomCandidateCard key={item.candidate.id} item={item} avatarPx={bottomAvatarPx} showVotes={true} shape={cardShape} />
                ))}
                {ranked.hasOthers && <OthersCard othersPct={ranked.othersPct} othersVotes={ranked.othersVotes} avatarPx={bottomAvatarPx} showVotes={true} />}
              </div>
            </div>
          )}

          <div className="mt-8 text-center">
            <div className="inline-block rounded-full bg-white/5 px-12 py-5 border border-white/10 shadow-2xl">
              <div className="text-4xl font-black text-white">{Math.round(regionalData.total).toLocaleString("pt-BR")}</div>
              <div className="text-[11px] font-black uppercase tracking-[0.4em] text-slate-500 mt-1">Votos Válidos</div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
