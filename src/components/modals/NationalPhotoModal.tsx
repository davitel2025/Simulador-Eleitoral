import { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  BottomCandidateCard,
  MapSizeSlider,
  OthersCard,
  TopCandidateCard,
  PhotoBackgroundPicker,
  WinnerBoxControls,
  AvatarSizeControls,
  DEFAULT_WINNER_BOX,
  type PhotoCardShape,
  type WinnerBoxConfig,
} from "../photo/PhotoCards";
import { NationalMapCenter } from "../photo/MapCenters";
import type { Candidate, PathData, StateResult } from "../../types";

// ─── Utilitário: captura o elemento e baixa como PNG ─────────────────────────
async function captureAndDownload(
  element: HTMLElement,
  filename: string,
  bgColor: string,
  bgImage?: string
): Promise<void> {
  // Usamos a API nativa de captura via canvas desenhando o elemento
  // Para garantir que imagem de fundo e CORS funcionem corretamente,
  // usamos html-to-image quando disponível, senão fallback para html2canvas.
  try {
    // Tentativa 1: usar html2canvas com configuração robusta
    const html2canvas = (await import("html2canvas")).default;

    // Se tiver imagem de fundo, precisamos garantir que o background color
    // seja definido para o fallback do html2canvas
    const canvas = await html2canvas(element, {
      backgroundColor: bgImage ? null : bgColor,
      scale: 2,
      useCORS: true,
      allowTaint: true,
      logging: false,
      // Remove elementos que possam causar problemas de CORS
      ignoreElements: (el) => {
        return el.tagName === "INPUT" || el.tagName === "BUTTON";
      },
    });

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          alert("Erro ao gerar imagem. Tente novamente.");
          return;
        }
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = filename;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      },
      "image/png"
    );
  } catch (err) {
    console.error("Erro ao gerar PNG:", err);
    alert("Erro ao salvar imagem. Verifique o console para detalhes.");
  }
}

// ─── NationalPhotoModal ───────────────────────────────────────────────────────

export function NationalPhotoModal({
  candidates,
  national,
  paths,
  results,
  photoScale,
  photoMapScale,
  candidateById,
  onClose,
  scenarioYear,
}: {
  candidates: Candidate[];
  national: any;
  paths: PathData[];
  results: Record<string, StateResult>;
  photoScale: number;
  photoMapScale: number;
  candidateById: Record<number, Candidate>;
  onClose: () => void;
  scenarioYear?: number;
}) {
  const captureRef = useRef<HTMLDivElement>(null);

  // ── Estados de controle ────────────────────────────────────────────────
  const [localMapScale, setLocalMapScale] = useState(photoMapScale);
  const [bgValue, setBgValue] = useState("#0f172a");
  const [bgImage, setBgImage] = useState<string | undefined>(undefined);
  const [cardShape, setCardShape] = useState<PhotoCardShape>("circle");

  // Tamanho da bolinha (top) e da bolinha menor (bottom)
  const [circleTopSize, setCircleTopSize] = useState(Math.round(150 * photoScale));
  const [circleBottomSize, setCircleBottomSize] = useState(Math.round(80 * photoScale));

  // Tamanho do retrato (top) — altura em px
  const [portraitTopSize, setPortraitTopSize] = useState(Math.round(150 * photoScale * 1.18));

  // Retângulo ao redor dos top 2
  const [winnerBox, setWinnerBox] = useState<WinnerBoxConfig>(DEFAULT_WINNER_BOX);

  // ── Ranking ────────────────────────────────────────────────────────────
  const ranked = useMemo(() => {
    const rows = candidates
      .map((c) => ({
        candidate: c,
        pct: national.candidatePcts[c.id] || 0,
        votes: national.candidateVotes[c.id] || 0,
      }))
      .sort((a, b) => b.pct - a.pct);

    const first = rows[0] ?? null;
    const second = rows[1] ?? null;
    const lower = rows.slice(2);
    const bottom3 = lower.slice(0, 3);
    const rest = lower.slice(3);
    const othersPct = rest.reduce((sum, item) => sum + item.pct, 0);
    const othersVotes = rest.reduce((sum, item) => sum + (item.votes ?? 0), 0);

    return { first, second, bottom3, othersPct, othersVotes, hasOthers: rest.length > 0 };
  }, [candidates, national]);

  // ── Estilos de background ──────────────────────────────────────────────
  const isGradientBg = bgValue.startsWith("linear-gradient");

  const bgStyle: React.CSSProperties = bgImage
    ? {
        backgroundImage: `url(${bgImage})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }
    : isGradientBg
    ? { background: bgValue }
    : { backgroundColor: bgValue };

  // Cor de fallback para html2canvas (quando usa gradiente ou imagem)
  const bgFallbackColor =
    bgImage || isGradientBg ? "#0f172a" : bgValue;

  // ── Download ────────────────────────────────────────────────────────────
  const handleDownload = async () => {
    if (!captureRef.current) return;
    await captureAndDownload(
      captureRef.current,
      `foto-nacional-${Date.now()}.png`,
      bgFallbackColor,
      bgImage
    );
  };

  // ── Estilo do retângulo vencedores ─────────────────────────────────────
  const winnerBoxStyle: React.CSSProperties = winnerBox.show
    ? {
        border: `${winnerBox.borderWidth}px solid ${winnerBox.color}`,
        borderRadius: winnerBox.borderRadius,
        padding: winnerBox.padding,
        backgroundColor: winnerBox.color
          .slice(0, 7)
          .concat(
            Math.round(
              (parseInt(winnerBox.color.slice(7, 9) || "22", 16) / 255) * 30
            )
              .toString(16)
              .padStart(2, "0")
          ),
      }
    : {};

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 overflow-y-auto bg-black/80 p-4 backdrop-blur-sm"
    >
      <div className="mx-auto w-full max-w-[1900px]">
        {/* ── Barra de controles ──────────────────────────────────────── */}
        <div className="mb-5 flex items-center justify-between text-white flex-wrap gap-3">
          <h2 className="text-3xl font-black">Foto nacional</h2>

          <div className="flex gap-3 items-center flex-wrap">
            {/* Shape toggle */}
            <div className="flex rounded-xl border border-white/10 bg-slate-900/80 p-1">
              <button
                type="button"
                onClick={() => setCardShape("circle")}
                className={`rounded-lg px-3 py-1 text-xs font-black transition-all ${
                  cardShape === "circle" ? "bg-violet-600 text-white" : "text-slate-300"
                }`}
              >
                ⚪ Bola
              </button>
              <button
                type="button"
                onClick={() => setCardShape("portrait")}
                className={`rounded-lg px-3 py-1 text-xs font-black transition-all ${
                  cardShape === "portrait" ? "bg-violet-600 text-white" : "text-slate-300"
                }`}
              >
                🟦 Retrato
              </button>
            </div>

            {/* Tamanho avatar (bola ou retrato conforme modo) */}
            <AvatarSizeControls
              circleSize={circleTopSize}
              portraitSize={portraitTopSize}
              onCircleChange={setCircleTopSize}
              onPortraitChange={setPortraitTopSize}
              shape={cardShape}
            />

            {/* Tamanho bolinha dos candidatos menores */}
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2">
              <span className="text-xs font-black uppercase tracking-widest text-slate-400 whitespace-nowrap">
                Bola 2º
              </span>
              <input
                type="range"
                min={40}
                max={160}
                step={10}
                value={circleBottomSize}
                onChange={(e) => setCircleBottomSize(Number(e.target.value))}
                className="h-2 w-20 appearance-none rounded-full bg-slate-700 accent-violet-500"
              />
              <span className="text-xs font-bold text-slate-400 w-10 text-right">
                {circleBottomSize}px
              </span>
            </div>

            {/* Retângulo dos vencedores */}
            <WinnerBoxControls config={winnerBox} onChange={setWinnerBox} />

            {/* Background */}
            <PhotoBackgroundPicker
              value={bgValue}
              onChange={setBgValue}
              bgImage={bgImage}
              onImageUpload={setBgImage}
              onRemoveImage={() => setBgImage(undefined)}
            />

            {/* Mapa */}
            <MapSizeSlider value={localMapScale} onChange={setLocalMapScale} />

            {/* Salvar */}
            <button
              type="button"
              onClick={handleDownload}
              className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-3 text-sm font-black text-white shadow-lg transition-all hover:scale-105 active:scale-95"
            >
              💾 Salvar PNG
            </button>

            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-white/15 bg-slate-800/80 px-6 py-3 text-sm font-bold transition-all hover:bg-slate-700"
            >
              Fechar
            </button>
          </div>
        </div>

        {/* ── Área capturada ──────────────────────────────────────────── */}
        <div
          ref={captureRef}
          className="rounded-[50px] border border-white/10 p-12 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.7)]"
          style={bgStyle}
        >
          {/* Título */}
          <div className="mb-6 text-center">
            <div className="text-[11px] font-black uppercase tracking-[0.6em] text-slate-500">
              Resultado Eleição {scenarioYear ?? 2026}
            </div>
          </div>

          {/* Top 2 candidatos + mapa — envoltos pelo retângulo configurável */}
          <div
            className="flex items-center justify-center gap-6 mb-8 flex-wrap md:flex-nowrap"
            style={winnerBoxStyle}
          >
            {ranked.first && (
              <div className="flex-1 min-w-[220px]">
                <TopCandidateCard
                  item={ranked.first}
                  rank={0}
                  avatarPx={circleTopSize}
                  portraitPx={portraitTopSize}
                  showVice={true}
                  showVotes={true}
                  shape={cardShape}
                />
              </div>
            )}

            <NationalMapCenter
              paths={paths}
              results={results}
              candidateById={candidateById}
              mapSizePx={localMapScale}
            />

            {ranked.second && (
              <div className="flex-1 min-w-[220px]">
                <TopCandidateCard
                  item={ranked.second}
                  rank={1}
                  avatarPx={circleTopSize}
                  portraitPx={portraitTopSize}
                  showVice={true}
                  showVotes={true}
                  shape={cardShape}
                />
              </div>
            )}
          </div>

          {/* Candidatos menores — SEMPRE em bolinha */}
          {(ranked.bottom3.length > 0 || ranked.hasOthers) && (
            <div className="flex justify-center mb-8">
              <div
                className="grid gap-4"
                style={{
                  gridTemplateColumns: `repeat(${
                    ranked.bottom3.length + (ranked.hasOthers ? 1 : 0)
                  }, minmax(0, 200px))`,
                }}
              >
                {ranked.bottom3.map((item) => (
                  <BottomCandidateCard
                    key={item.candidate.id}
                    item={item}
                    avatarPx={circleBottomSize}
                    showVotes={true}
                  />
                ))}
                {ranked.hasOthers && (
                  <OthersCard
                    othersPct={ranked.othersPct}
                    othersVotes={ranked.othersVotes}
                    avatarPx={circleBottomSize}
                    showVotes={true}
                  />
                )}
              </div>
            </div>
          )}

          {/* Total de votos */}
          <div className="mt-8 text-center">
            <div className="inline-block rounded-full bg-white/5 px-12 py-5 border border-white/10 shadow-2xl">
              <div className="text-4xl font-black text-white">
                {Math.round(national.totalVotes).toLocaleString("pt-BR")}
              </div>
              <div className="text-[11px] font-black uppercase tracking-[0.4em] text-slate-500 mt-1">
                Votos Válidos
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
