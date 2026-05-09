import { useEffect, useState } from "react";
import { STATES } from "../../data/states";
import { getMunicipalityResult2022 } from "../../data/municipalityResults2022";
import { VIEWBOX_HEIGHT, VIEWBOX_WIDTH } from "../../lib/constants";
import { getColorByWinnerPct, shadeHex } from "../../lib/color";
import {
  buildMunicipalityPaths,
  buildRegionalMunicipalityPaths,
  fetchMunicipalityGeo,
} from "../../lib/geo";
import type {
  Candidate,
  CandidateId,
  MunicipalityPath,
  PathData,
  RegionName,
  RegionalMunicipalityPath,
  StateInfo,
  StateResult,
} from "../../types";

export function NationalMapCenter({
  paths, results, candidateById, mapSizePx, showMunicipalities = false, useOfficialMunicipalityResults = false,
}: {
  paths: PathData[];
  results: Record<string, StateResult>;
  candidateById: Record<number, Candidate>;
  mapSizePx: number;
  showMunicipalities?: boolean;
  useOfficialMunicipalityResults?: boolean;
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
        {showMunicipalities && municipalityPaths.length > 0 ? municipalityPaths.map((pathItem) => {
          const stateResult = results[pathItem.uf];
          const exactResult = useOfficialMunicipalityResults ? getMunicipalityResult2022(pathItem.uf, pathItem.name) : undefined;
          const lulaCandidate =
            Object.values(candidateById).find((candidate) => candidate.party.toUpperCase() === "PT" && candidate.number === "13");
          const bolsonaroCandidate =
            Object.values(candidateById).find((candidate) => candidate.party.toUpperCase() === "PL" && candidate.number === "22");
          const totalExactVotes = (exactResult?.lulaVotes ?? 0) + (exactResult?.bolsonaroVotes ?? 0);
          const exactVotes =
            exactResult && lulaCandidate && bolsonaroCandidate && totalExactVotes > 0
              ? {
                  [lulaCandidate.id]: (exactResult.lulaVotes / totalExactVotes) * 100,
                  [bolsonaroCandidate.id]: (exactResult.bolsonaroVotes / totalExactVotes) * 100,
                }
              : undefined;
          const exactWinner =
            exactResult && lulaCandidate && bolsonaroCandidate
              ? exactResult.lulaVotes > exactResult.bolsonaroVotes
                ? lulaCandidate.id
                : bolsonaroCandidate.id
              : undefined;
          const winnerId = stateResult?.municipalityPaint?.[pathItem.code] ?? exactWinner;
          const municipalityVotes = stateResult?.municipalities?.[pathItem.code] ?? exactVotes;
          const winner = winnerId ? candidateById[winnerId] : null;
          const pct = winnerId ? municipalityVotes?.[winnerId] ?? 55 : 0;
          const stateWinner = stateResult?.winner ? candidateById[stateResult.winner] : null;
          const statePct = stateResult?.winner ? stateResult.votes[stateResult.winner] : 0;
          const fill = winner
            ? getColorByWinnerPct(winner.color, pct)
            : stateWinner
              ? getColorByWinnerPct(stateWinner.color, statePct)
              : "#0f172a";
          const stroke = winner ? shadeHex(winner.color, 0.35, "black") : "#1e293b";
          return (
            <path key={`${pathItem.uf}-${pathItem.code}`} d={pathItem.d} fill={fill} stroke={stroke} strokeWidth={0.35} />
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
  region, results, candidateById, mapSizePx, useOfficialMunicipalityResults = false,
}: {
  region: RegionName;
  results: Record<string, StateResult>;
  candidateById: Record<number, Candidate>;
  mapSizePx: number;
  useOfficialMunicipalityResults?: boolean;
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
        {paths.map((pathItem) => {
          const stateResult = results[pathItem.uf];
          const exactResult = useOfficialMunicipalityResults ? getMunicipalityResult2022(pathItem.uf, pathItem.name) : undefined;
          const lulaCandidate =
            Object.values(candidateById).find((candidate) => candidate.party.toUpperCase() === "PT" && candidate.number === "13");
          const bolsonaroCandidate =
            Object.values(candidateById).find((candidate) => candidate.party.toUpperCase() === "PL" && candidate.number === "22");
          const exactWinner =
            exactResult && lulaCandidate && bolsonaroCandidate
              ? exactResult.lulaVotes > exactResult.bolsonaroVotes
                ? lulaCandidate.id
                : bolsonaroCandidate.id
              : undefined;
          const paintedId = stateResult?.municipalityPaint?.[pathItem.code] ?? exactWinner;
          const paintedCandidate = paintedId ? candidateById[paintedId] : null;
          let fill = "#0f172a";
          let stroke = "#1e293b";
          if (paintedCandidate) {
            fill = paintedCandidate.color;
            stroke = shadeHex(paintedCandidate.color, 0.35, "black");
          } else if (stateResult?.winner) {
            const winner = candidateById[stateResult.winner];
            const pct = stateResult.votes[stateResult.winner] || 0;
            if (winner) {
              fill = getColorByWinnerPct(winner.color, pct);
              stroke = shadeHex(winner.color, 0.4, "black");
            }
          }
          return (
            <path key={`${pathItem.uf}-${pathItem.code}`} d={pathItem.d} fill={fill} stroke={stroke} strokeWidth={0.4} />
          );
        })}
      </svg>
    </div>
  );
}

export function StateMapCenter({
  stateInfo, winnerColor, winnerPct, mapSizePx, showMunicipalityPaint, municipalityPaint, candidateById,
}: {
  stateInfo: StateInfo;
  winnerColor: string | null;
  winnerPct: number;
  mapSizePx: number;
  showMunicipalityPaint: boolean;
  municipalityPaint: Record<string, CandidateId>;
  candidateById: Record<number, Candidate>;
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
        {municipalityPaths.length > 0 ? (
          municipalityPaths.map((pathItem) => {
            const paintedCandidate = candidateById[municipalityPaint[pathItem.code]];
            const fill = showMunicipalityPaint && paintedCandidate
              ? paintedCandidate.color
              : fallbackFill;
            const stroke = showMunicipalityPaint
              ? (paintedCandidate ? shadeHex(paintedCandidate.color, 0.35, "black") : "#1e293b")
              : fallbackFill;
            return (
              <path key={pathItem.code} d={pathItem.d} fill={fill} stroke={stroke} strokeWidth={showMunicipalityPaint ? 0.55 : 0} />
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
