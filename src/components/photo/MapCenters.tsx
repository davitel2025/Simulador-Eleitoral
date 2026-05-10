import { useEffect, useState } from "react";
import { STATES } from "../../data/states";
import {
  getHistoricalMunicipalityCandidatePcts,
  getHistoricalWinnerCandidateId,
} from "../../data/historicalElectionResults";
import { VIEWBOX_HEIGHT, VIEWBOX_WIDTH } from "../../lib/constants";
import { getColorByWinnerPct, getMunicipalityFillColor, shadeHex } from "../../lib/color";
import {
  buildMunicipalityPaths,
  buildRegionalMunicipalityPaths,
  fetchMunicipalityGeo,
} from "../../lib/geo";
import type {
  Candidate,
  CandidateId,
  HistoricalMunicipalityScenarioKey,
  MunicipalityMapStyle,
  MunicipalityPath,
  PathData,
  RegionName,
  RegionalMunicipalityPath,
  StateInfo,
  StateResult,
} from "../../types";

function MunicipalBroadcastDefs() {
  return (
    <defs>
      <pattern id="municipalityTiePattern" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="8" height="8" fill="#64748b" />
        <rect width="3" height="8" fill="#cbd5e1" opacity="0.65" />
      </pattern>
      <filter id="municipalBroadcastGlow" x="-8%" y="-8%" width="116%" height="116%">
        <feGaussianBlur in="SourceAlpha" stdDeviation="1.1" result="blur" />
        <feComposite in="blur" in2="SourceAlpha" operator="out" result="edge" />
        <feColorMatrix in="edge" type="matrix" values="0 0 0 0 0.58 0 0 0 0 0.68 0 0 0 0 0.82 0 0 0 0.45 0" result="glow" />
        <feBlend in="SourceGraphic" in2="glow" mode="screen" />
      </filter>
    </defs>
  );
}

function getCandidateIndex(candidateById: Record<number, Candidate>, candidateId: CandidateId): number {
  const ids = Object.keys(candidateById).map(Number).sort((a, b) => a - b);
  return Math.max(0, ids.indexOf(candidateId));
}

function hasMunicipalityTie(votes: Record<CandidateId, number> | undefined): boolean {
  if (!votes) return false;
  const values = Object.values(votes);
  const best = Math.max(...values);
  return best > 0 && values.filter((value) => value === best).length > 1;
}

export function NationalMapCenter({
  paths,
  results,
  candidateById,
  mapSizePx,
  showMunicipalities = false,
  municipalityScenarioKey,
  shadeMunicipalitiesByPct = true,
  municipalityMapStyle = "original",
}: {
  paths: PathData[];
  results: Record<string, StateResult>;
  candidateById: Record<number, Candidate>;
  mapSizePx: number;
  showMunicipalities?: boolean;
  municipalityScenarioKey?: HistoricalMunicipalityScenarioKey;
  shadeMunicipalitiesByPct?: boolean;
  municipalityMapStyle?: MunicipalityMapStyle;
}) {
  const [municipalityPaths, setMunicipalityPaths] = useState<RegionalMunicipalityPath[]>([]);
  const [loadingMunicipalities, setLoadingMunicipalities] = useState(false);
  const svgH = Math.round(mapSizePx * (VIEWBOX_HEIGHT / VIEWBOX_WIDTH));

  useEffect(() => {
    if (!showMunicipalities || municipalityPaths.length > 0) return;
    let active = true;
    setLoadingMunicipalities(true);
    Promise.all(
      STATES.map(async (state) => {
        const geo = await fetchMunicipalityGeo(state.ibgeCode);
        return (geo?.features ?? []).map((feature: any) => ({
          ...feature,
          properties: {
            ...(feature.properties ?? {}),
            _uf: state.uf,
          },
        }));
      })
    )
      .then((groups) => {
        if (!active) return;
        setMunicipalityPaths(buildRegionalMunicipalityPaths(groups.flat()));
      })
      .catch(() => {
        if (active) setMunicipalityPaths([]);
      })
      .finally(() => {
        if (active) setLoadingMunicipalities(false);
      });
    return () => {
      active = false;
    };
  }, [showMunicipalities, municipalityPaths.length]);

  if (showMunicipalities && loadingMunicipalities) {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-2 flex-shrink-0" style={{ width: mapSizePx, height: svgH }}>
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-700 border-t-emerald-500" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center px-4 py-2 flex-shrink-0" style={{ width: mapSizePx }}>
      <svg
        viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
        width={mapSizePx}
        height={svgH}
        className="drop-shadow-[0_20px_60px_rgba(0,0,0,0.8)]"
        style={{ display: "block" }}
      >
        {showMunicipalities && <MunicipalBroadcastDefs />}
        {showMunicipalities && municipalityPaths.length > 0 ? municipalityPaths.map((pathItem) => {
          const stateResult = results[pathItem.uf];
          const candidates = Object.values(candidateById);
          const officialVotes = getHistoricalMunicipalityCandidatePcts(
            municipalityScenarioKey,
            pathItem.uf,
            pathItem.name,
            candidates
          );
          const officialWinner = getHistoricalWinnerCandidateId(officialVotes);
          const municipalityVotes = stateResult?.municipalities?.[pathItem.code] ?? officialVotes;
          const isTie = hasMunicipalityTie(municipalityVotes);
          const winnerId = isTie ? null : stateResult?.municipalityPaint?.[pathItem.code] ?? officialWinner;
          const winner = winnerId ? candidateById[winnerId] : null;
          const pct = winnerId ? municipalityVotes?.[winnerId] ?? 55 : 0;
          const stateWinner = stateResult?.winner ? candidateById[stateResult.winner] : null;
          const statePct = stateResult?.winner ? stateResult.votes[stateResult.winner] : 0;
          const winnerIndex = winnerId ? getCandidateIndex(candidateById, winnerId) : 0;
          const fill = isTie
            ? "url(#municipalityTiePattern)"
            : winner
            ? getMunicipalityFillColor({
                baseColor: winner.color,
                winnerPct: pct,
                candidateIndex: winnerIndex,
                shadeByPct: shadeMunicipalitiesByPct,
                mapStyle: municipalityMapStyle,
              })
            : stateWinner
              ? getColorByWinnerPct(stateWinner.color, statePct)
              : "#0f172a";
          const stroke = isTie ? "#cbd5e1" : municipalityMapStyle === "broadcast" ? "#94a3b8" : winner ? shadeHex(winner.color, 0.35, "black") : "#1e293b";
          return (
            <path
              key={`${pathItem.uf}-${pathItem.code}`}
              d={pathItem.d}
              fill={fill}
              stroke={stroke}
              strokeWidth={municipalityMapStyle === "broadcast" ? 0.3 : 0.35}
              filter={municipalityMapStyle === "broadcast" ? "url(#municipalBroadcastGlow)" : undefined}
            />
          );
        }) : paths.map((pathItem) => {
          const result = results[pathItem.uf];
          const winner = result?.winner ? candidateById[result.winner] : null;
          const pct = result?.winner ? result.votes[result.winner] : 0;
          const fill = winner ? getColorByWinnerPct(winner.color, pct) : "#0f172a";
          return (
            <path key={pathItem.uf} d={pathItem.d} fill={fill} stroke="#1e293b" strokeWidth={1.5} />
          );
        })}
      </svg>
    </div>
  );
}

export function RegionalMapCenter({
  regionPaths, results, candidateById, mapSizePx,
}: {
  regionPaths: PathData[];
  results: Record<string, StateResult>;
  candidateById: Record<number, Candidate>;
  mapSizePx: number;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-2 flex-shrink-0" style={{ width: mapSizePx }}>
      <svg
        viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
        width={mapSizePx}
        height={Math.round(mapSizePx * (VIEWBOX_HEIGHT / VIEWBOX_WIDTH))}
        className="drop-shadow-[0_20px_60px_rgba(0,0,0,0.8)]"
        style={{ display: "block" }}
      >
        {regionPaths.map((pathItem) => {
          const result = results[pathItem.uf];
          const winner = result?.winner ? candidateById[result.winner] : null;
          const pct = result?.winner ? result.votes[result.winner] : 0;
          const fill = winner ? getColorByWinnerPct(winner.color, pct) : "#0f172a";
          return (
            <path key={pathItem.uf} d={pathItem.d} fill={fill} stroke="#1e293b" strokeWidth={1.5} />
          );
        })}
      </svg>
    </div>
  );
}

export function RegionalMunicipalityMapCenter({
  region,
  results,
  candidateById,
  mapSizePx,
  municipalityScenarioKey,
  shadeMunicipalitiesByPct = true,
  municipalityMapStyle = "original",
}: {
  region: RegionName;
  results: Record<string, StateResult>;
  candidateById: Record<number, Candidate>;
  mapSizePx: number;
  municipalityScenarioKey?: HistoricalMunicipalityScenarioKey;
  shadeMunicipalitiesByPct?: boolean;
  municipalityMapStyle?: MunicipalityMapStyle;
}) {
  const [paths, setPaths] = useState<RegionalMunicipalityPath[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setPaths([]);
    const run = async () => {
      const statesInRegion = STATES.filter((state) => state.region === region);
      const collected: any[] = [];
      await Promise.all(statesInRegion.map(async (state) => {
        const geo = await fetchMunicipalityGeo(state.ibgeCode);
        if (geo?.features) {
          for (const feature of geo.features) {
            if (!feature.properties) feature.properties = {};
            feature.properties._uf = state.uf;
            collected.push(feature);
          }
        }
      }));
      if (!active) return;
      setPaths(buildRegionalMunicipalityPaths(collected));
      setLoading(false);
    };
    run().catch(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [region]);

  const svgH = Math.round(mapSizePx * (VIEWBOX_HEIGHT / VIEWBOX_WIDTH));

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-2 flex-shrink-0" style={{ width: mapSizePx, height: svgH }}>
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-700 border-t-emerald-500" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center px-4 py-2 flex-shrink-0" style={{ width: mapSizePx }}>
      <svg
        viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
        width={mapSizePx}
        height={svgH}
        className="drop-shadow-[0_20px_60px_rgba(0,0,0,0.8)]"
        style={{ display: "block" }}
      >
        <MunicipalBroadcastDefs />
        {paths.map((pathItem) => {
          const stateResult = results[pathItem.uf];
          const candidates = Object.values(candidateById);
          const officialVotes = getHistoricalMunicipalityCandidatePcts(
            municipalityScenarioKey,
            pathItem.uf,
            pathItem.name,
            candidates
          );
          const officialWinner = getHistoricalWinnerCandidateId(officialVotes);
          const municipalityVotes = stateResult?.municipalities?.[pathItem.code] ?? officialVotes;
          const isTie = hasMunicipalityTie(municipalityVotes);
          const paintedId = isTie ? null : stateResult?.municipalityPaint?.[pathItem.code] ?? officialWinner;
          const paintedCandidate = paintedId ? candidateById[paintedId] : null;
          const pct = paintedId ? municipalityVotes?.[paintedId] ?? 55 : 0;
          const winnerIndex = paintedId ? getCandidateIndex(candidateById, paintedId) : 0;
          let fill = "#0f172a";
          let stroke = "#1e293b";
          if (isTie) {
            fill = "url(#municipalityTiePattern)";
            stroke = "#cbd5e1";
          } else if (paintedCandidate) {
            fill = getMunicipalityFillColor({
              baseColor: paintedCandidate.color,
              winnerPct: pct,
              candidateIndex: winnerIndex,
              shadeByPct: shadeMunicipalitiesByPct,
              mapStyle: municipalityMapStyle,
            });
            stroke = municipalityMapStyle === "broadcast" ? "#94a3b8" : shadeHex(paintedCandidate.color, 0.35, "black");
          } else if (stateResult?.winner) {
            const winner = candidateById[stateResult.winner];
            const pct = stateResult.votes[stateResult.winner] || 0;
            if (winner) {
              fill = getColorByWinnerPct(winner.color, pct);
              stroke = shadeHex(winner.color, 0.4, "black");
            }
          }
          return (
            <path
              key={`${pathItem.uf}-${pathItem.code}`}
              d={pathItem.d}
              fill={fill}
              stroke={stroke}
              strokeWidth={municipalityMapStyle === "broadcast" ? 0.3 : 0.4}
              filter={municipalityMapStyle === "broadcast" ? "url(#municipalBroadcastGlow)" : undefined}
            />
          );
        })}
      </svg>
    </div>
  );
}

export function StateMapCenter({
  stateInfo,
  winnerColor,
  winnerPct,
  mapSizePx,
  showMunicipalityPaint,
  municipalityPaint,
  municipalityVotes,
  candidateById,
  candidates = [],
  municipalityScenarioKey,
  shadeMunicipalitiesByPct = true,
  municipalityMapStyle = "original",
}: {
  stateInfo: StateInfo;
  winnerColor: string | null;
  winnerPct: number;
  mapSizePx: number;
  showMunicipalityPaint: boolean;
  municipalityPaint: Record<string, CandidateId>;
  municipalityVotes?: Record<string, Record<CandidateId, number>>;
  candidateById: Record<number, Candidate>;
  candidates?: Candidate[];
  municipalityScenarioKey?: HistoricalMunicipalityScenarioKey;
  shadeMunicipalitiesByPct?: boolean;
  municipalityMapStyle?: MunicipalityMapStyle;
}) {
  const [municipalityPaths, setMunicipalityPaths] = useState<MunicipalityPath[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchMunicipalityGeo(stateInfo.ibgeCode).then((geo) => {
      if (!active) return;
      if (geo) setMunicipalityPaths(buildMunicipalityPaths(geo));
      setLoading(false);
    }).catch(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [stateInfo.ibgeCode]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-8 flex-shrink-0" style={{ width: mapSizePx }}>
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-700 border-t-emerald-500" />
      </div>
    );
  }

  const fallbackFill = winnerColor ? getColorByWinnerPct(winnerColor, winnerPct) : "#1e293b";
  const svgH = Math.round(mapSizePx * (VIEWBOX_HEIGHT / VIEWBOX_WIDTH));

  return (
    <div className="flex flex-col items-center justify-center px-4 py-2 flex-shrink-0" style={{ width: mapSizePx }}>
      <svg
        viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
        width={mapSizePx}
        height={svgH}
        className="drop-shadow-[0_20px_60px_rgba(0,0,0,0.8)]"
        style={{ display: "block" }}
      >
        {showMunicipalityPaint && <MunicipalBroadcastDefs />}
        {municipalityPaths.length > 0 ? (
          municipalityPaths.map((pathItem) => {
            const officialVotes = getHistoricalMunicipalityCandidatePcts(
              municipalityScenarioKey,
              stateInfo.uf,
              pathItem.name,
              candidates
            );
            const officialWinner = getHistoricalWinnerCandidateId(officialVotes);
            const pathVotes = municipalityVotes?.[pathItem.code] ?? officialVotes;
            const isTie = hasMunicipalityTie(pathVotes);
            const paintedId = isTie ? null : municipalityPaint[pathItem.code] ?? officialWinner;
            const paintedCandidate = candidateById[paintedId];
            const paintedPct = paintedId ? pathVotes?.[paintedId] ?? 55 : 0;
            const winnerIndex = paintedId ? getCandidateIndex(candidateById, paintedId) : 0;
            const fill = showMunicipalityPaint && isTie
              ? "url(#municipalityTiePattern)"
              : showMunicipalityPaint && paintedCandidate
              ? getMunicipalityFillColor({
                  baseColor: paintedCandidate.color,
                  winnerPct: paintedPct,
                  candidateIndex: winnerIndex,
                  shadeByPct: shadeMunicipalitiesByPct,
                  mapStyle: municipalityMapStyle,
                })
              : fallbackFill;
            const stroke = showMunicipalityPaint
              ? municipalityMapStyle === "broadcast"
                ? "#94a3b8"
                : isTie ? "#cbd5e1" : (paintedCandidate ? shadeHex(paintedCandidate.color, 0.35, "black") : "#1e293b")
              : fallbackFill;
            return (
              <path
                key={pathItem.code}
                d={pathItem.d}
                fill={fill}
                stroke={stroke}
                strokeWidth={showMunicipalityPaint ? (municipalityMapStyle === "broadcast" ? 0.3 : 0.55) : 0}
                filter={showMunicipalityPaint && municipalityMapStyle === "broadcast" ? "url(#municipalBroadcastGlow)" : undefined}
              />
            );
          })
        ) : (
          <text x={VIEWBOX_WIDTH / 2} y={VIEWBOX_HEIGHT / 2} textAnchor="middle" dominantBaseline="central"
            fill={winnerColor || "#64748b"} style={{ fontSize: "220px", fontWeight: 900, opacity: 0.4 }}>
            {stateInfo.uf}
          </text>
        )}
      </svg>
    </div>
  );
}
