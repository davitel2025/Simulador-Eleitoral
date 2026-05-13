import { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ALL_CAPITALS } from "../../data/capitals";
import {
  getCapitalWinnerId,
} from "../../lib/capitalResults";
import { REGIONS, STATES, STATE_BY_UF } from "../../data/states";
import { buildRegionPaths } from "../../lib/geo";
import { getWinner } from "../../lib/utils";
import {
  BottomCandidateCard,
  MapSizeSlider,
  OthersCard,
  TopCandidateCard,
  PhotoBackgroundPicker,
  PhotoFormatDialog,
  WinnerBoxControls,
  AvatarSizeControls,
  DEFAULT_WINNER_BOX,
  VerticalPhotoCard,
  captureAndDownload,
  getCaptureFallbackColor,
  getFrameSurfaceColor,
  getPhotoBackgroundStyle,
  type PhotoExportFormat,
  type PhotoCardShape,
  type WinnerBoxConfig,
} from "../photo/PhotoCards";
import { RegionalMapCenter, RegionalMunicipalityMapCenter } from "../photo/MapCenters";
import type { CapitalMarker } from "../photo/MapCenters";
import type { Candidate, CandidateId, ElectionRound, HistoricalMunicipalityScenarioKey, MunicipalityMapStyle, PathData, RegionName, StateResult } from "../../types";
import {
  clearPersistedStateByPrefix,
  usePersistedState,
} from "../../hooks/usePersistedState";

const REGIONAL_PHOTO_PREFIX = "eleitoral_rfoto_";

interface RegionalPhotoSettings {
  localMapScale: number;
  showMunicipalities: boolean;
  shadeByWinMargin: boolean;
  bgValue: string;
  bgImage?: string;
  cardShape: PhotoCardShape;
  circleTopSize: number;
  circleBottomSize: number;
  portraitTopSize: number;
  fontSizeBase: number;
  fontColor: string;
  useCandidateFontColor: boolean;
  winnerBox: WinnerBoxConfig;
}

export function RegionalPhotoModal({ region, onRegionChange, candidates, paths, stateGeoData, results, photoScale, photoMapScale, candidateById, onClose, scenarioYear, municipalityScenarioKey, electionRound }: {
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
  municipalityScenarioKey?: HistoricalMunicipalityScenarioKey;
  electionRound: ElectionRound;
}) {
  const captureRef = useRef<HTMLDivElement>(null);
  const verticalCaptureRef = useRef<HTMLDivElement>(null);
  const defaultSettings = useMemo<RegionalPhotoSettings>(
    () => ({
      localMapScale: photoMapScale,
      showMunicipalities: false,
      shadeByWinMargin: true,
      bgValue: "#0f172a",
      bgImage: undefined,
      cardShape: "circle",
      circleTopSize: Math.round(150 * photoScale),
      circleBottomSize: Math.round(80 * photoScale),
      portraitTopSize: Math.round(150 * photoScale * 1.18),
      fontSizeBase: 14,
      fontColor: "#ffffff",
      useCandidateFontColor: false,
      winnerBox: DEFAULT_WINNER_BOX,
    }),
    [photoMapScale, photoScale]
  );
  const [settings, setSettings] = usePersistedState(
    `${REGIONAL_PHOTO_PREFIX}settings`,
    defaultSettings
  );
  const [resetMessage, setResetMessage] = useState("");
  const [formatDialogOpen, setFormatDialogOpen] = useState(false);
  const [showAllCapitals, setShowAllCapitals] = usePersistedState("regionalShowAllCapitals", false);
  const {
    localMapScale,
    showMunicipalities,
    shadeByWinMargin = true,
    bgValue,
    bgImage,
    cardShape,
    circleTopSize,
    circleBottomSize,
    portraitTopSize,
    fontSizeBase = 14,
    fontColor = "#ffffff",
    useCandidateFontColor = false,
    winnerBox,
  } = settings;
  const [municipalityMapStyle, setMunicipalityMapStyle] =
    usePersistedState<MunicipalityMapStyle>("municipalityMapStyle", "original");
  const updateSettings = (updates: Partial<RegionalPhotoSettings>) => {
    setSettings((previous) => ({ ...previous, ...updates }));
  };
  const handleResetDefaults = () => {
    clearPersistedStateByPrefix(REGIONAL_PHOTO_PREFIX);
    setSettings(defaultSettings);
    setResetMessage("Padrões restaurados");
    window.setTimeout(() => setResetMessage(""), 2000);
  };

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

  const bgStyle = getPhotoBackgroundStyle(bgValue, bgImage);
  const bgFallbackColor = getCaptureFallbackColor(bgValue, bgImage);
  const frameSurfaceColor = getFrameSurfaceColor(bgValue, bgImage);
  const photoMapSize = Math.round(localMapScale * 1.35);
  const canUseVertical = electionRound === "segundo" && Boolean(ranked.first && ranked.second);
  const capitalMarkers = useMemo<CapitalMarker[]>(() => {
    if (!showAllCapitals) return [];
    return ALL_CAPITALS
      .filter((capital) => STATE_BY_UF[capital.uf]?.region === region)
      .map((capital) => {
        const winnerId = getCapitalWinnerId({
          capital,
          candidates: Object.values(candidateById),
          results,
          municipalityScenarioKey,
        });
        const winner = winnerId ? candidateById[winnerId] : null;
        return { ...capital, color: winner?.color ?? "#f8fafc" };
      });
  }, [candidateById, municipalityScenarioKey, region, results, showAllCapitals]);

  const handleDownloadFormat = async (format: PhotoExportFormat) => {
    setFormatDialogOpen(false);
    const target = format === "9:16" ? verticalCaptureRef.current : captureRef.current;
    if (!target) return;
    await captureAndDownload(
      target,
      `foto-regional-${region}-${format.replace(":", "x")}-${Date.now()}.png`,
      bgFallbackColor
    );
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
              <button type="button" onClick={() => updateSettings({ cardShape: "circle" })}
                className={`rounded-lg px-3 py-1 text-xs font-black transition-all ${cardShape === "circle" ? "bg-violet-600 text-white" : "text-slate-300"}`}>
                ⚪ Bola
              </button>
              <button type="button" onClick={() => updateSettings({ cardShape: "portrait" })}
                className={`rounded-lg px-3 py-1 text-xs font-black transition-all ${cardShape === "portrait" ? "bg-violet-600 text-white" : "text-slate-300"}`}>
                🟦 Retrato
              </button>
            </div>
            <div className="flex rounded-xl border border-white/10 bg-slate-900/80 p-1">
              <button type="button" onClick={() => updateSettings({ showMunicipalities: false })}
                className={`rounded-lg px-3 py-1 text-xs font-black ${showMunicipalities ? "text-slate-300" : "bg-blue-600 text-white"}`}>
                Por estado
              </button>
              <button type="button" onClick={() => updateSettings({ showMunicipalities: true })}
                className={`rounded-lg px-3 py-1 text-xs font-black ${showMunicipalities ? "bg-blue-600 text-white" : "text-slate-300"}`}>
                Por município
              </button>
            </div>
            {showMunicipalities && (
                <button
                  type="button"
                  onClick={() => updateSettings({ shadeByWinMargin: !shadeByWinMargin })}
                  className={`rounded-xl border px-3 py-2 text-xs font-black transition-all ${
                    shadeByWinMargin ? "border-emerald-400/60 bg-emerald-500/15 text-emerald-200" : "border-slate-600 bg-slate-900/80 text-slate-300"
                  }`}
                >
                  Estratificar por intensidade
                </button>
            )}
            <div className="flex rounded-xl border border-white/10 bg-slate-900/80 p-1">
              <button
                type="button"
                onClick={() => setMunicipalityMapStyle("original")}
                className={`rounded-lg px-3 py-1 text-xs font-black ${municipalityMapStyle === "original" ? "bg-violet-600 text-white" : "text-slate-300"}`}
              >
                Original
              </button>
              <button
                type="button"
                onClick={() => setMunicipalityMapStyle("broadcast")}
                className={`rounded-lg px-3 py-1 text-xs font-black ${municipalityMapStyle === "broadcast" ? "bg-violet-600 text-white" : "text-slate-300"}`}
              >
                Broadcast
              </button>
            </div>
            <AvatarSizeControls
              circleSize={circleTopSize}
              portraitSize={portraitTopSize}
              onCircleChange={(circleTopSize) => updateSettings({ circleTopSize })}
              onPortraitChange={(portraitTopSize) => updateSettings({ portraitTopSize })}
              shape={cardShape}
            />
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2">
              <span className="text-xs font-black uppercase tracking-widest text-slate-400 whitespace-nowrap">
                Bola 2Âº
              </span>
              <input
                type="range"
                min={40}
                max={160}
                step={10}
                value={circleBottomSize}
                onChange={(e) => updateSettings({ circleBottomSize: Number(e.target.value) })}
                className="h-2 w-20 appearance-none rounded-full bg-slate-700 accent-violet-500"
              />
              <span className="text-xs font-bold text-slate-400 w-10 text-right">
                {circleBottomSize}px
              </span>
            </div>
            <WinnerBoxControls
              config={winnerBox}
              onChange={(winnerBox) => updateSettings({ winnerBox })}
            />
            <PhotoBackgroundPicker
              value={bgValue}
              onChange={(bgValue) => updateSettings({ bgValue })}
              bgImage={bgImage}
              onImageUpload={(bgImage) => updateSettings({ bgImage })}
              onRemoveImage={() => updateSettings({ bgImage: undefined })}
            />
            <MapSizeSlider
              value={localMapScale}
              onChange={(localMapScale) => updateSettings({ localMapScale })}
            />
            <button
              type="button"
              onClick={() => setShowAllCapitals((previous) => !previous)}
              className={`rounded-xl border px-3 py-2 text-xs font-black transition-all ${
                showAllCapitals ? "border-yellow-300/60 bg-yellow-400/20 text-yellow-100" : "border-white/10 bg-slate-900/80 text-slate-300"
              }`}
            >
              Todas Capitais
            </button>
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2">
              <span className="text-xs font-black uppercase tracking-widest text-slate-400 whitespace-nowrap">Fonte</span>
              <input
                type="range"
                min={8}
                max={32}
                step={1}
                value={fontSizeBase}
                onChange={(e) => updateSettings({ fontSizeBase: Number(e.target.value) })}
                className="h-2 w-20 appearance-none rounded-full bg-slate-700 accent-violet-500"
              />
              <span className="w-9 text-right text-xs font-bold text-slate-400">{fontSizeBase}px</span>
            </div>
            <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-xs font-black uppercase tracking-widest text-slate-400">
              Cor texto
              <input
                type="color"
                value={fontColor}
                onChange={(e) => updateSettings({ fontColor: e.target.value })}
                className="h-6 w-6 cursor-pointer rounded border border-slate-600"
                style={{ padding: "1px" }}
              />
            </label>
            <button
              type="button"
              onClick={() => updateSettings({ useCandidateFontColor: !useCandidateFontColor })}
              className={`rounded-xl border px-3 py-2 text-xs font-black transition-all ${
                useCandidateFontColor ? "border-amber-300/60 bg-amber-400/20 text-amber-100" : "border-white/10 bg-slate-900/80 text-slate-300"
              }`}
            >
              Cor dos candidatos
            </button>
            <button
              type="button"
              onClick={handleResetDefaults}
              className="rounded-xl border border-white/15 bg-slate-800/80 px-4 py-3 text-sm font-bold transition-all hover:bg-slate-700"
            >
              Restaurar Padrões
            </button>
            {resetMessage && (
              <span className="text-xs font-bold text-emerald-300">{resetMessage}</span>
            )}
            <button type="button" onClick={() => setFormatDialogOpen(true)}
              className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-3 text-sm font-black text-white shadow-lg transition-all hover:scale-105">
              Salvar PNG
            </button>
            <button type="button" onClick={onClose}
              className="rounded-xl border border-white/15 bg-slate-800/80 px-6 py-3 text-sm font-bold transition-all hover:bg-slate-700">
              Fechar
            </button>
          </div>
        </div>

        <div
          ref={captureRef}
          className="relative mx-auto rounded-[50px] border border-white/10 p-12 pb-20 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.7)]"
          style={{ ...bgStyle, width: 1920, minHeight: 1080, aspectRatio: "16 / 9" }}
        >
          <div className="absolute right-8 top-8 rounded-full border border-white/10 bg-white/5 px-6 py-3 text-right shadow-2xl backdrop-blur-sm">
            <div className="text-xl font-black text-white">{Math.round(regionalData.total).toLocaleString("pt-BR")}</div>
            <div className="mt-0.5 text-[9px] font-black uppercase tracking-[0.28em] text-slate-500">Votos Válidos</div>
          </div>

          <div className="mb-6 text-center">
            <div className="text-[11px] font-black uppercase tracking-[0.6em] text-slate-500">
              Eleição {scenarioYear ?? 2026} — Resultado Regional
            </div>
          </div>

          <div className="flex items-center justify-center gap-6 mb-8 flex-wrap md:flex-nowrap">
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
                  frameConfig={winnerBox}
                  frameSurfaceColor={frameSurfaceColor}
                  fontSizeBase={fontSizeBase}
                  fontColor={fontColor}
                  useCandidateFontColor={useCandidateFontColor}
                />
              </div>
            )}
            {showMunicipalities ? (
              <RegionalMunicipalityMapCenter
                region={region}
                results={results}
                candidateById={candidateById}
                mapSizePx={photoMapSize}
                municipalityScenarioKey={municipalityScenarioKey}
                shadeMunicipalitiesByPct={shadeByWinMargin}
                municipalityMapStyle={municipalityMapStyle}
                capitalMarkers={capitalMarkers}
              />
            ) : (
              <RegionalMapCenter
                regionPaths={mapPaths}
                results={results}
                candidateById={candidateById}
                mapSizePx={photoMapSize}
                stateGeoData={stateGeoData}
                region={region}
                capitalMarkers={capitalMarkers}
              />
            )}
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
                  frameConfig={winnerBox}
                  frameSurfaceColor={frameSurfaceColor}
                  fontSizeBase={fontSizeBase}
                  fontColor={fontColor}
                  useCandidateFontColor={useCandidateFontColor}
                />
              </div>
            )}
          </div>

          {(ranked.bottom3.length > 0 || ranked.hasOthers) && (
            <div className="flex justify-center mb-8">
              <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${ranked.bottom3.length + (ranked.hasOthers ? 1 : 0)}, minmax(0, 200px))` }}>
                {ranked.bottom3.map((item) => (
                  <BottomCandidateCard key={item.candidate.id} item={item} avatarPx={circleBottomSize} showVotes={true} fontSizeBase={fontSizeBase} fontColor={fontColor} useCandidateFontColor={useCandidateFontColor} />
                ))}
                {ranked.hasOthers && <OthersCard othersPct={ranked.othersPct} othersVotes={ranked.othersVotes} avatarPx={circleBottomSize} showVotes={true} fontSizeBase={fontSizeBase} fontColor={fontColor} />}
              </div>
            </div>
          )}

        </div>
        <div className="absolute left-[-12000px] top-0">
          {ranked.first && ranked.second && (
            <div ref={verticalCaptureRef}>
              <VerticalPhotoCard
                title={`Resultado - 2o Turno ${scenarioYear ?? 2026} - ${region}`}
                left={ranked.first}
                right={ranked.second}
                bgStyle={bgStyle}
                totalVotes={regionalData.total}
                fontColor={fontColor}
                useCandidateFontColor={useCandidateFontColor}
                map={
                  showMunicipalities ? (
                    <RegionalMunicipalityMapCenter
                      region={region}
                      results={results}
                      candidateById={candidateById}
                      mapSizePx={760}
                      municipalityScenarioKey={municipalityScenarioKey}
                      shadeMunicipalitiesByPct={shadeByWinMargin}
                      municipalityMapStyle={municipalityMapStyle}
                      capitalMarkers={capitalMarkers}
                    />
                  ) : (
                    <RegionalMapCenter
                      regionPaths={mapPaths}
                      results={results}
                      candidateById={candidateById}
                      mapSizePx={760}
                      stateGeoData={stateGeoData}
                      region={region}
                      capitalMarkers={capitalMarkers}
                    />
                  )
                }
              />
            </div>
          )}
        </div>
        {formatDialogOpen && (
          <PhotoFormatDialog
            canUseVertical={canUseVertical}
            onSelect={handleDownloadFormat}
            onClose={() => setFormatDialogOpen(false)}
          />
        )}
      </div>
    </motion.div>
  );
}
