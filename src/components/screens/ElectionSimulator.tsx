import {
  useEffect,
  useCallback,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type MouseEvent as ReactMouseEvent,
  type TouchEvent as ReactTouchEvent,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { REGIONS, STATES, STATE_BY_UF } from "../../data/states";
import { STATE_GEO_URL, VIEWBOX_HEIGHT, VIEWBOX_WIDTH } from "../../lib/constants";
import { getColorByWinnerPct, shadeHex } from "../../lib/color";
import { buildStatePaths } from "../../lib/geo";
import {
  clamp,
  formatPct,
  getWinner,
  normalizeVotesForCandidates,
} from "../../lib/utils";
import type {
  Candidate,
  CandidateId,
  ElectionRound,
  PathData,
  RegionName,
  StateInfo,
  StateResult,
  PoliticalScenario,
} from "../../types";
import { CandidateManager } from "../CandidateManager";
import { StateActionModal } from "../modals/StateActionModal";
import { StateModal } from "../modals/StateModal";
import { MunicipalityPaintModal } from "../modals/MunicipalityPaintModal";
import { StatePhotoModal } from "../modals/StatePhotoModal";
import { NationalPhotoModal } from "../modals/NationalPhotoModal";
import { RegionalPhotoModal } from "../modals/RegionalPhotoModal";
import { ToastViewport, type ToastMessage } from "../ui/Toast";
import { usePersistedState } from "../../hooks/usePersistedState";

type AnalyticsTab = "regioes" | "desempenho" | "ranking" | "candidatos";
type Point = { x: number; y: number };
type MapTooltip = { uf: string; x: number; y: number };
type MapContextMenu = { uf: string; x: number; y: number } | null;
type MapTheme = "dark" | "light";
type PinchState = {
  distance: number;
  midpoint: Point;
  zoom: number;
  offset: Point;
};

const DEFAULT_PHOTO_SCALE = 1.45;
const DEFAULT_PHOTO_MAP_SCALE = 520;
const MIN_MAP_ZOOM = 1;
const MAX_MAP_ZOOM = 8;
const ZOOM_BUTTON_FACTOR = 1.3;
const WHEEL_ZOOM_FACTOR = 1.15;
const SMALL_LABEL_UFS = new Set(["SE", "AL", "PB", "RN", "ES", "DF"]);
const REGION_BORDER_COLORS: Record<RegionName, string> = {
  Norte: "#22c55e",
  Nordeste: "#f59e0b",
  "Centro-Oeste": "#06b6d4",
  Sudeste: "#a855f7",
  Sul: "#ef4444",
};

function getTouchPoint(touch: Touch, rect: DOMRect): Point {
  return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
}

function getTouchMidpoint(touches: ReactTouchEvent<HTMLDivElement>["touches"], rect: DOMRect): Point {
  const first = getTouchPoint(touches[0], rect);
  const second = getTouchPoint(touches[1], rect);
  return { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
}

function getTouchDistance(touches: ReactTouchEvent<HTMLDivElement>["touches"]): number {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.hypot(dx, dy);
}

// ─── Helper: votos de um estado conforme cenário ──────────────────────────────
// Se o cenário tem nationalVoters + customStates, os voters já foram distribuídos
// proporcionalmente na InitialScreen e gravados em customStates[].voters.
// Portanto basta ler customStates normalmente.
function getVotersForState(
  state: StateInfo,
  scenario?: PoliticalScenario | null
): number {
  if (scenario?.customStates) {
    const custom = scenario.customStates.find((cs) => cs.uf === state.uf);
    if (custom) return custom.voters;
  }
  if (scenario?.year === 2018) return state.voters2018;
  if (scenario?.year === 2022) return state.voters2022;
  return state.voters;
}

// ─── Helper: estados ativos ───────────────────────────────────────────────────
function getActiveStates(scenario?: PoliticalScenario | null): StateInfo[] {
  if (scenario?.customStates) {
    const ufs = new Set(scenario.customStates.map((cs) => cs.uf));
    return STATES.filter((s) => ufs.has(s.uf));
  }
  return STATES;
}

function createRandomDistribution(candidates: Candidate[]): Record<CandidateId, number> {
  const weights = candidates.map(() => Math.random() + 0.08);
  const total = weights.reduce((sum, value) => sum + value, 0);
  const votes: Record<CandidateId, number> = {};
  candidates.forEach((candidate, index) => {
    votes[candidate.id] = total > 0 ? (weights[index] / total) * 100 : 0;
  });
  return votes;
}

// ─── ElectionSimulator ────────────────────────────────────────────────────────
export function ElectionSimulator({
  round,
  candidates,
  onCandidatesChange,
  onRoundChange,
  onRestart,
  loadedScenario,
}: {
  round: ElectionRound;
  candidates: Candidate[];
  onCandidatesChange: (candidates: Candidate[]) => void;
  onRoundChange: (round: ElectionRound) => void;
  onRestart: () => void;
  loadedScenario?: PoliticalScenario | null;
}) {
  const [results, setResults] = useState<Record<string, StateResult>>({});
  const [paths, setPaths] = useState<PathData[]>([]);
  const [stateGeoData, setStateGeoData] = useState<any>(null);
  const [stateDialog, setStateDialog] = useState<{
    uf: string;
    view: "menu" | "edit" | "photo" | "municipios";
  } | null>(null);
  const [hoveredState, setHoveredState] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [nationalPhotoOpen, setNationalPhotoOpen] = useState(false);
  const [regionalPhotoOpen, setRegionalPhotoOpen] = useState(false);
  const [selectedPhotoRegion, setSelectedPhotoRegion] = useState<RegionName>("Sudeste");
  const [analyticsTab, setAnalyticsTab] = useState<AnalyticsTab>("regioes");
  const [regionFocus, setRegionFocus] = useState<RegionName | null>(null);
  const [rankingRegionFilter, setRankingRegionFilter] = useState<RegionName | "Todos">("Todos");
  const [rankingSearch, setRankingSearch] = useState("");
  const [highlightCandidate, setHighlightCandidate] = useState<CandidateId | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [neonStates, setNeonStates] = useState(true);
  const [showRegionBorders, setShowRegionBorders] = useState(false);
  const [mapTooltip, setMapTooltip] = useState<MapTooltip | null>(null);
  const [contextMenu, setContextMenu] = useState<MapContextMenu>(null);
  const [mapViewport, setMapViewport] = useState({ width: 0, height: 0 });
  const [autoMapTransition, setAutoMapTransition] = useState(false);
  const [highlightedState, setHighlightedState] = useState<string | null>(null);
  const [flashedState, setFlashedState] = useState<string | null>(null);
  const [mapTheme, setMapTheme] = usePersistedState<MapTheme>(
    "eleitoral_map_theme",
    "dark"
  );
  const [nationalPhotoScale, setNationalPhotoScale] = usePersistedState(
    "eleitoral_nfoto_photoScale",
    DEFAULT_PHOTO_SCALE
  );
  const [photoMapScale, setPhotoMapScale] = usePersistedState(
    "eleitoral_nfoto_mapScale",
    DEFAULT_PHOTO_MAP_SCALE
  );

  const importRef = useRef<HTMLInputElement>(null);
  const [mapZoom, setMapZoom] = useState(1);
  const [mapOffset, setMapOffset] = useState({ x: 0, y: 0 });
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const regionDetailsRef = useRef<HTMLDivElement>(null);
  const initialNationalSnapshotRef = useRef<Record<CandidateId, number> | null>(null);
  const toastIdRef = useRef(1);
  const mapZoomRef = useRef(1);
  const mapOffsetRef = useRef<Point>({ x: 0, y: 0 });
  const mapViewportRef = useRef({ width: 0, height: 0 });
  const pinchStateRef = useRef<PinchState | null>(null);
  const mapTransitionTimeoutRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const highlightTimeoutRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const flashTimeoutRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const isDraggingRef = useRef(false);
  const lastMousePosRef = useRef({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  const activeStates = useMemo(
    () => getActiveStates(loadedScenario),
    [loadedScenario]
  );

  const pushToast = useCallback((message: string) => {
    const id = toastIdRef.current++;
    setToasts((prev) => [...prev, { id, message }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 3000);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const getViewportSize = useCallback(() => {
    const rect = mapContainerRef.current?.getBoundingClientRect();
    if (rect?.width && rect?.height) {
      return { width: rect.width, height: rect.height };
    }
    return mapViewportRef.current;
  }, []);

  const clampMapOffset = useCallback((offset: Point, zoom: number): Point => {
    const viewport = getViewportSize();
    if (zoom <= MIN_MAP_ZOOM || viewport.width === 0 || viewport.height === 0) {
      return { x: 0, y: 0 };
    }
    return {
      x: clamp(offset.x, viewport.width * (1 - zoom), 0),
      y: clamp(offset.y, viewport.height * (1 - zoom), 0),
    };
  }, [getViewportSize]);

  const setMapTransform = useCallback(
    (nextZoom: number, nextOffset: Point, animated = false) => {
      const zoom = clamp(nextZoom, MIN_MAP_ZOOM, MAX_MAP_ZOOM);
      const offset = clampMapOffset(nextOffset, zoom);

      if (mapTransitionTimeoutRef.current) {
        window.clearTimeout(mapTransitionTimeoutRef.current);
        mapTransitionTimeoutRef.current = null;
      }
      setAutoMapTransition(animated);
      if (animated) {
        mapTransitionTimeoutRef.current = window.setTimeout(() => {
          setAutoMapTransition(false);
          mapTransitionTimeoutRef.current = null;
        }, 450);
      }

      mapZoomRef.current = zoom;
      mapOffsetRef.current = offset;
      setMapZoom(zoom);
      setMapOffset(offset);
    },
    [clampMapOffset]
  );

  const zoomAtPoint = useCallback(
    (point: Point, zoomFactor: number, animated = false) => {
      const currentZoom = mapZoomRef.current;
      const currentOffset = mapOffsetRef.current;
      const nextZoom = clamp(currentZoom * zoomFactor, MIN_MAP_ZOOM, MAX_MAP_ZOOM);
      const scaleChange = nextZoom / currentZoom;
      setMapTransform(
        nextZoom,
        {
          x: point.x - scaleChange * (point.x - currentOffset.x),
          y: point.y - scaleChange * (point.y - currentOffset.y),
        },
        animated
      );
    },
    [setMapTransform]
  );

  const zoomAtCenter = useCallback(
    (zoomFactor: number) => {
      const viewport = getViewportSize();
      zoomAtPoint({ x: viewport.width / 2, y: viewport.height / 2 }, zoomFactor, true);
    },
    [getViewportSize, zoomAtPoint]
  );

  const resetMapView = useCallback(() => {
    setMapTransform(MIN_MAP_ZOOM, { x: 0, y: 0 }, true);
  }, [setMapTransform]);

  const markStateHighlight = useCallback((uf: string) => {
    if (highlightTimeoutRef.current) {
      window.clearTimeout(highlightTimeoutRef.current);
    }
    setHighlightedState(uf);
    highlightTimeoutRef.current = window.setTimeout(() => {
      setHighlightedState(null);
      highlightTimeoutRef.current = null;
    }, 1300);
  }, []);

  const flashState = useCallback((uf: string) => {
    if (flashTimeoutRef.current) {
      window.clearTimeout(flashTimeoutRef.current);
    }
    setFlashedState(uf);
    flashTimeoutRef.current = window.setTimeout(() => {
      setFlashedState(null);
      flashTimeoutRef.current = null;
    }, 650);
  }, []);

  const panMapBy = useCallback(
    (dx: number, dy: number) => {
      const current = mapOffsetRef.current;
      setMapTransform(mapZoomRef.current, { x: current.x + dx, y: current.y + dy });
    },
    [setMapTransform]
  );

  const getViewBoxLayout = useCallback(() => {
    const viewport = getViewportSize();
    const scale = Math.min(viewport.width / VIEWBOX_WIDTH, viewport.height / VIEWBOX_HEIGHT) || 1;
    const renderedWidth = VIEWBOX_WIDTH * scale;
    const renderedHeight = VIEWBOX_HEIGHT * scale;
    return {
      viewport,
      scale,
      padX: (viewport.width - renderedWidth) / 2,
      padY: (viewport.height - renderedHeight) / 2,
    };
  }, [getViewportSize]);

  const focusPathItem = useCallback(
    (pathItem: PathData) => {
      if (mapZoomRef.current > MIN_MAP_ZOOM + 0.05 && highlightedState === pathItem.uf) {
        resetMapView();
        setHighlightedState(null);
        return;
      }

      const { viewport, scale, padX, padY } = getViewBoxLayout();
      const centerX = padX + pathItem.centroid[0] * scale;
      const centerY = padY + pathItem.centroid[1] * scale;
      const targetZoom = clamp(3, MIN_MAP_ZOOM, MAX_MAP_ZOOM);
      setMapTransform(
        targetZoom,
        {
          x: viewport.width / 2 - centerX * targetZoom,
          y: viewport.height / 2 - centerY * targetZoom,
        },
        true
      );
      markStateHighlight(pathItem.uf);
    },
    [getViewBoxLayout, highlightedState, markStateHighlight, resetMapView, setMapTransform]
  );

  const panToViewBoxPoint = useCallback(
    (viewBoxPoint: Point) => {
      const { viewport, scale, padX, padY } = getViewBoxLayout();
      const baseX = padX + viewBoxPoint.x * scale;
      const baseY = padY + viewBoxPoint.y * scale;
      setMapTransform(
        mapZoomRef.current,
        {
          x: viewport.width / 2 - baseX * mapZoomRef.current,
          y: viewport.height / 2 - baseY * mapZoomRef.current,
        },
        true
      );
    },
    [getViewBoxLayout, setMapTransform]
  );

  const updateMapTooltip = useCallback((uf: string, event: ReactMouseEvent<SVGPathElement>) => {
    const rect = mapContainerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setMapTooltip({
      uf,
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    });
  }, []);

  useEffect(() => {
    mapZoomRef.current = mapZoom;
  }, [mapZoom]);

  useEffect(() => {
    mapOffsetRef.current = mapOffset;
  }, [mapOffset]);

  useEffect(() => {
    const mapNode = mapContainerRef.current;
    if (!mapNode) return;

    const updateViewport = () => {
      const rect = mapNode.getBoundingClientRect();
      const viewport = { width: rect.width, height: rect.height };
      mapViewportRef.current = viewport;
      setMapViewport(viewport);
      setMapOffset((prev) => {
        const next = clampMapOffset(prev, mapZoomRef.current);
        mapOffsetRef.current = next;
        return next;
      });
    };

    updateViewport();
    const observer = new ResizeObserver(updateViewport);
    observer.observe(mapNode);
    return () => observer.disconnect();
  }, [clampMapOffset]);

  useEffect(() => {
    return () => {
      if (mapTransitionTimeoutRef.current) {
        window.clearTimeout(mapTransitionTimeoutRef.current);
      }
      if (highlightTimeoutRef.current) {
        window.clearTimeout(highlightTimeoutRef.current);
      }
      if (flashTimeoutRef.current) {
        window.clearTimeout(flashTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("keydown", close);
    };
  }, [contextMenu]);

  // ── Carrega resultados do cenário histórico ──────────────────────────────
  useEffect(() => {
    if (!loadedScenario?.results) return;
    const candidateIds = candidates.map((c) => c.id);
    if (candidateIds.length === 0) return;

    const newResults: Record<string, StateResult> = {};
    for (const [uf, candidatePcts] of Object.entries(loadedScenario.results)) {
      const votes: Record<CandidateId, number> = {};
      for (let i = 0; i < candidateIds.length; i++) {
        const candidateId = candidateIds[i];
        const pct = candidatePcts[i + 1];
        if (pct !== undefined) votes[candidateId] = pct;
      }
      const total = Object.values(votes).reduce((sum, v) => sum + v, 0);
      if (total > 0) {
        Object.keys(votes).forEach((id) => {
          votes[Number(id)] = (votes[Number(id)] / total) * 100;
        });
      }
      newResults[uf] = {
        uf,
        votes,
        winner: getWinner(votes),
        usesMunicipalities: false,
        municipalities: {},
        municipalityPaint: {},
      };
    }
    setResults(newResults);
  }, [loadedScenario, candidates]);

  // ── Carrega mapa GeoJSON ─────────────────────────────────────────────────
  useEffect(() => {
    const loadMap = async () => {
      const response = await fetch(STATE_GEO_URL);
      const data = await response.json();
      setStateGeoData(data);
      setPaths(buildStatePaths(data));
    };
    loadMap().catch(() => {
      setStateGeoData(null);
      setPaths([]);
    });
  }, []);

  // ── Scroll wheel zoom ────────────────────────────────────────────────────
  useEffect(() => {
    const mapNode = mapContainerRef.current;
    if (!mapNode) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = mapNode.getBoundingClientRect();
      zoomAtPoint(
        { x: event.clientX - rect.left, y: event.clientY - rect.top },
        event.deltaY < 0 ? WHEEL_ZOOM_FACTOR : 1 / WHEEL_ZOOM_FACTOR
      );
    };
    mapNode.addEventListener("wheel", onWheel, { passive: false });
    return () => mapNode.removeEventListener("wheel", onWheel);
  }, [zoomAtPoint]);

  // ── Normaliza votos quando candidatos mudam ──────────────────────────────
  useEffect(() => {
    const candidateIds = candidates.map((candidate) => candidate.id);
    if (candidateIds.length === 0) return;
    setResults((prev) => {
      const next: Record<string, StateResult> = {};
      for (const [uf, result] of Object.entries(prev)) {
        const normalizedVotes = normalizeVotesForCandidates(result.votes, candidateIds);
        next[uf] = {
          ...result,
          votes: normalizedVotes,
          winner: getWinner(normalizedVotes),
          municipalityPaint: result.municipalityPaint ?? {},
        };
      }
      return next;
    });
  }, [candidates]);

  // ── Totais nacionais ─────────────────────────────────────────────────────
  // Se o cenário tem nationalVoters, usa esse total como base para os votos
  // (os voters por estado já foram distribuídos proporcionalmente)
  const national = useMemo(() => {
    const candidateVotes: Record<CandidateId, number> = {};
    candidates.forEach((c) => { candidateVotes[c.id] = 0; });
    let totalVoters = 0;
    let statesCounted = 0;

    for (const state of activeStates) {
      const result = results[state.uf];
      if (!result || result.excluded) continue;
      statesCounted += 1;
      const votersCount = getVotersForState(state, loadedScenario);
      totalVoters += votersCount;
      Object.entries(result.votes).forEach(([candidateId, pct]) => {
        const id = Number(candidateId);
        candidateVotes[id] = (candidateVotes[id] || 0) + (pct / 100) * votersCount;
      });
    }

    const totalVotes = Object.values(candidateVotes).reduce((sum, v) => sum + v, 0);
    const candidatePcts: Record<CandidateId, number> = {};
    Object.keys(candidateVotes).forEach((id) => {
      const numId = Number(id);
      candidatePcts[numId] =
        totalVotes > 0 ? (candidateVotes[numId] / totalVotes) * 100 : 0;
    });

    return {
      candidateVotes,
      candidatePcts,
      totalVotes,
      totalVoters,
      statesCounted,
      winner: getWinner(candidatePcts),
    };
  }, [results, candidates, loadedScenario, activeStates]);

  useEffect(() => {
    if (initialNationalSnapshotRef.current || candidates.length === 0) return;
    if (loadedScenario?.results && national.totalVotes <= 0) return;
    initialNationalSnapshotRef.current = { ...national.candidatePcts };
  }, [candidates.length, loadedScenario, national.candidatePcts, national.totalVotes]);

  const candidateById = useMemo(
    () => Object.fromEntries(candidates.map((c) => [c.id, c])),
    [candidates]
  );

  const getStateFill = (uf: string): string => {
    if (activeStates.length < STATES.length && !activeStates.find((s) => s.uf === uf)) {
      return "#0f172a";
    }
    const result = results[uf];
    if (!result || !result.winner) return "#1e293b";
    const winnerPct = result.votes[result.winner] || 0;
    const candidate = candidateById[result.winner];
    if (!candidate) return "#1e293b";
    return getColorByWinnerPct(candidate.color, winnerPct);
  };

  const getStateGradientColors = (uf: string): [string, string] => {
    const result = results[uf];
    if (!result?.winner) {
      return mapTheme === "light" ? ["#f8fafc", "#cbd5e1"] : ["#1e293b", "#334155"];
    }
    const base = getStateFill(uf);
    return [shadeHex(base, 0.18, "white"), shadeHex(base, 0.2, "black")];
  };

  const getStateVoteBreakdown = (result?: StateResult) => {
    if (!result) return [];
    return Object.entries(result.votes)
      .map(([candidateId, pct]) => ({
        candidate: candidateById[Number(candidateId)],
        pct,
      }))
      .filter((item): item is { candidate: Candidate; pct: number } => Boolean(item.candidate))
      .sort((a, b) => b.pct - a.pct);
  };

  const getVictoryMargin = (result?: StateResult) => {
    const sorted = getStateVoteBreakdown(result);
    if (sorted.length < 2) return 0;
    return sorted[0].pct - sorted[1].pct;
  };

  const handleStateSave = (result: StateResult) => {
    const hasMunicipalityPaint = Object.keys(result.municipalityPaint ?? {}).length > 0;
    setResults((prev) => ({
      ...prev,
      [result.uf]: {
        ...result,
        municipalityPaint: result.municipalityPaint ?? {},
        usesMunicipalities: hasMunicipalityPaint,
      },
    }));
    flashState(result.uf);
    setStateDialog(null);
    pushToast(`Estado ${result.uf} salvo com sucesso!`);
  };

  const handleMunicipalitySave = (
    uf: string,
    municipalityPaint: Record<string, CandidateId>
  ) => {
    setResults((prev) => {
      const existing = prev[uf];
      const candidateIds = candidates.map((candidate) => candidate.id);
      const fallbackVotes = normalizeVotesForCandidates({}, candidateIds);
      const nextState: StateResult = existing ?? {
        uf,
        votes: fallbackVotes,
        winner: getWinner(fallbackVotes),
        municipalities: {},
        usesMunicipalities: false,
        municipalityPaint: {},
      };
      return {
        ...prev,
        [uf]: {
          ...nextState,
          municipalityPaint,
          usesMunicipalities: Object.keys(municipalityPaint).length > 0,
        },
      };
    });
    flashState(uf);
    setStateDialog(null);
  };

  const handleResetState = (uf: string) => {
    setResults((prev) => {
      const next = { ...prev };
      delete next[uf];
      return next;
    });
    flashState(uf);
  };

  const handleApplyVotesToRegion = (votes: Record<CandidateId, number>, region: string) => {
    setResults((prev) => {
      const next = { ...prev };
      activeStates
        .filter((state) => state.region === region)
        .forEach((state) => {
          const normalizedVotes = normalizeVotesForCandidates(votes, candidates.map((candidate) => candidate.id));
          next[state.uf] = {
            uf: state.uf,
            votes: normalizedVotes,
            winner: getWinner(normalizedVotes),
            usesMunicipalities: false,
            municipalities: prev[state.uf]?.municipalities ?? {},
            municipalityPaint: {},
            excluded: prev[state.uf]?.excluded,
          };
        });
      return next;
    });
    pushToast(`Porcentagens aplicadas na regiao ${region}.`);
  };

  const handleFillAllRandom = () => {
    setResults((prev) => {
      const next = { ...prev };
      activeStates.forEach((state) => {
        const votes = createRandomDistribution(candidates);
        next[state.uf] = {
          uf: state.uf,
          votes,
          winner: getWinner(votes),
          usesMunicipalities: false,
          municipalities: prev[state.uf]?.municipalities ?? {},
          municipalityPaint: {},
          excluded: prev[state.uf]?.excluded,
        };
      });
      return next;
    });
    pushToast("Dados aleatorios aplicados a todos os estados!");
  };

  const handleClearAllStates = () => {
    if (!window.confirm("Zerar todos os estados preenchidos?")) return;
    setResults({});
    pushToast("Todos os estados foram zerados.");
  };

  const handleCopyScenarioLink = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      pushToast("Link do cenario copiado.");
    } catch {
      pushToast("Nao foi possivel copiar o link.");
    }
  };

  const handleCopyStateVotes = (targetUf: string, sourceUf: string) => {
    const source = results[sourceUf];
    if (!source) return;
    const votes = normalizeVotesForCandidates(source.votes, candidates.map((candidate) => candidate.id));
    setResults((prev) => ({
      ...prev,
      [targetUf]: {
        uf: targetUf,
        votes,
        winner: getWinner(votes),
        usesMunicipalities: false,
        municipalities: prev[targetUf]?.municipalities ?? {},
        municipalityPaint: {},
        excluded: prev[targetUf]?.excluded,
      },
    }));
    flashState(targetUf);
    pushToast(`Dados de ${sourceUf} copiados para ${targetUf}.`);
  };

  const handleExport = () => {
    const roundSlug = round === "primeiro" ? "1turno" : "2turno";
    const yearSlug = scenarioYear ?? new Date().getFullYear();
    const payload = {
      round,
      candidates,
      results,
      generatedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `cenario_${yearSlug}_${roundSlug}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    pushToast("Cenario exportado!");
  };

  const handleImport = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = String(e.target?.result ?? "");
        const payload = JSON.parse(text);
        if (payload.candidates && Array.isArray(payload.candidates)) {
          onCandidatesChange(payload.candidates);
        }
        if (payload.round === "primeiro" || payload.round === "segundo") {
          onRoundChange(payload.round);
        }
        if (payload.results && typeof payload.results === "object") {
          const normalized: Record<string, StateResult> = {};
          for (const [uf, result] of Object.entries(
            payload.results as Record<string, any>
          )) {
            const votes = result.votes ?? {};
            normalized[uf] = {
              uf,
              votes,
              winner: result.winner ?? getWinner(votes),
              municipalities: result.municipalities ?? {},
              municipalityPaint: result.municipalityPaint ?? {},
              usesMunicipalities:
                Object.keys(result.municipalityPaint ?? {}).length > 0,
            };
          }
          setResults(normalized);
        }
        pushToast("Cenario importado com sucesso!");
      } catch {
        alert(
          "Arquivo inválido. Certifique-se de importar um JSON exportado pelo simulador."
        );
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  const toggleStateExcluded = (uf: string) => {
    setResults((prev) => {
      const existing = prev[uf];
      if (!existing) return prev;
      return {
        ...prev,
        [uf]: {
          ...existing,
          excluded: !existing.excluded,
        },
      };
    });
    flashState(uf);
  };

  const selectedStateInfo = stateDialog ? STATE_BY_UF[stateDialog.uf] : null;
  const hoveredStateInfo = hoveredState ? STATE_BY_UF[hoveredState] : null;
  const hoveredResult = hoveredState ? results[hoveredState] : undefined;
  const hoveredWinner = hoveredResult?.winner
    ? candidateById[hoveredResult.winner]
    : null;
  const hoveredWinnerPct = hoveredResult?.winner
    ? hoveredResult.votes[hoveredResult.winner] || 0
    : 0;
  const hoveredBreakdown = getStateVoteBreakdown(hoveredResult);
  const hoveredMargin = getVictoryMargin(hoveredResult);
  const filledPct =
    activeStates.length > 0 ? (national.statesCounted / activeStates.length) * 100 : 0;
  const contextStateInfo = contextMenu ? STATE_BY_UF[contextMenu.uf] : null;
  const contextResult = contextMenu ? results[contextMenu.uf] : undefined;
  const contextPathItem = contextMenu
    ? paths.find((item) => item.uf === contextMenu.uf)
    : undefined;
  const tooltipPlacement = mapTooltip
    ? {
        left:
          mapTooltip.x + 300 > mapViewport.width
            ? Math.max(12, mapTooltip.x - 292)
            : mapTooltip.x + 16,
        top:
          mapTooltip.y + 190 > mapViewport.height
            ? Math.max(12, mapTooltip.y - 174)
            : mapTooltip.y + 16,
      }
    : { left: 0, top: 0 };
  const viewBoxLayout = getViewBoxLayout();
  const minimapViewport = {
    x: clamp((-mapOffset.x / mapZoom - viewBoxLayout.padX) / viewBoxLayout.scale, 0, VIEWBOX_WIDTH),
    y: clamp((-mapOffset.y / mapZoom - viewBoxLayout.padY) / viewBoxLayout.scale, 0, VIEWBOX_HEIGHT),
    width: clamp(mapViewport.width / mapZoom / viewBoxLayout.scale, 8, VIEWBOX_WIDTH),
    height: clamp(mapViewport.height / mapZoom / viewBoxLayout.scale, 8, VIEWBOX_HEIGHT),
  };

  const sortedCandidates = useMemo(() => {
    return [...candidates].sort((a, b) => {
      const aPct = national.candidatePcts[a.id] || 0;
      const bPct = national.candidatePcts[b.id] || 0;
      return bPct - aPct;
    });
  }, [candidates, national.candidatePcts]);
  const legendCandidates = sortedCandidates.slice(0, 4);

  const rankingStates = useMemo(() => {
    const query = rankingSearch.trim().toLocaleLowerCase("pt-BR");
    return activeStates.filter((state) => {
      const regionMatches = rankingRegionFilter === "Todos" || state.region === rankingRegionFilter;
      const searchMatches =
        query.length === 0 ||
        state.name.toLocaleLowerCase("pt-BR").includes(query) ||
        state.uf.toLocaleLowerCase("pt-BR").includes(query);
      return regionMatches && searchMatches && Boolean(results[state.uf]);
    });
  }, [activeStates, rankingRegionFilter, rankingSearch, results]);

  const performanceStats = useMemo(() => {
    const candidateWins: Record<CandidateId, number> = {};
    candidates.forEach((c) => { candidateWins[c.id] = 0; });
    const allResults = Object.values(results).filter((r) => !r.excluded);
    allResults.forEach((result) => {
      if (result.winner)
        candidateWins[result.winner] = (candidateWins[result.winner] || 0) + 1;
    });
    const averageMargin =
      allResults.length === 0
        ? 0
        : allResults.reduce((sum, result) => {
            const sorted = Object.values(result.votes).sort((a, b) => b - a);
            return sum + (sorted[0] - (sorted[1] || 0));
          }, 0) / allResults.length;
    return { candidateWins, averageMargin };
  }, [results, candidates]);

  const regionalStats = useMemo(() => {
    const grouped = new Map<
      RegionName,
      {
        votes: Record<CandidateId, number>;
        wins: Record<CandidateId, number>;
        statesCounted: number;
      }
    >();
    for (const state of activeStates) {
      const current = grouped.get(state.region) ?? {
        votes: {},
        wins: {},
        statesCounted: 0,
      };
      candidates.forEach((c) => {
        if (!current.votes[c.id]) current.votes[c.id] = 0;
        if (!current.wins[c.id]) current.wins[c.id] = 0;
      });
      const result = results[state.uf];
      if (result && !result.excluded) {
        current.statesCounted += 1;
        const votersCount = getVotersForState(state, loadedScenario);
        Object.entries(result.votes).forEach(([id, pct]) => {
          const numId = Number(id);
          current.votes[numId] += (pct / 100) * votersCount;
        });
        if (result.winner) current.wins[result.winner] += 1;
      }
      grouped.set(state.region, current);
    }
    return REGIONS.map((region) => {
      const value = grouped.get(region) ?? {
        votes: {},
        wins: {},
        statesCounted: 0,
      };
      const total = Object.values(value.votes).reduce((sum, v) => sum + v, 0);
      const pcts: Record<CandidateId, number> = {};
      candidates.forEach((c) => {
        pcts[c.id] = total > 0 ? ((value.votes[c.id] || 0) / total) * 100 : 0;
      });
      return {
        region,
        pcts,
        wins: value.wins,
        statesCounted: value.statesCounted,
        winner: getWinner(pcts),
      };
    });
  }, [results, candidates, activeStates, loadedScenario]);

  const scenarioYear = loadedScenario?.year;
  const totalActiveStates = activeStates.length;
  const roundBadgeClass =
    round === "primeiro"
      ? "border-blue-500/30 bg-blue-500/20 text-blue-300"
      : "border-amber-500/30 bg-amber-500/20 text-amber-300";
  const roundLabel = round === "primeiro" ? "1º Turno" : "2º Turno";

  const focusRegionDetails = (region: RegionName) => {
    setRegionFocus(region);
    window.setTimeout(() => {
      regionDetailsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  };

  const stopMapDrag = () => {
    isDraggingRef.current = false;
    pinchStateRef.current = null;
    setIsDragging(false);
  };

  const shouldIgnoreMapDrag = (target: EventTarget | null) =>
    target instanceof HTMLElement &&
    Boolean(target.closest("button, input, select, textarea, a"));

  const handleMapMouseDown = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    if (shouldIgnoreMapDrag(event.target)) return;
    isDraggingRef.current = true;
    setIsDragging(true);
    lastMousePosRef.current = { x: event.clientX, y: event.clientY };
    event.preventDefault();
  };

  const handleMapMouseMove = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    const dx = event.clientX - lastMousePosRef.current.x;
    const dy = event.clientY - lastMousePosRef.current.y;
    lastMousePosRef.current = { x: event.clientX, y: event.clientY };
    panMapBy(dx, dy);
  };

  const handleMapTouchStart = (event: ReactTouchEvent<HTMLDivElement>) => {
    if (shouldIgnoreMapDrag(event.target) || event.touches.length === 0) return;
    const rect = mapContainerRef.current?.getBoundingClientRect();
    if (!rect) return;
    isDraggingRef.current = true;
    setIsDragging(true);
    if (event.touches.length >= 2) {
      pinchStateRef.current = {
        distance: getTouchDistance(event.touches),
        midpoint: getTouchMidpoint(event.touches, rect),
        zoom: mapZoomRef.current,
        offset: mapOffsetRef.current,
      };
      return;
    }
    const touch = event.touches[0];
    pinchStateRef.current = null;
    lastMousePosRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleMapTouchMove = (event: ReactTouchEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || event.touches.length === 0) return;
    const rect = mapContainerRef.current?.getBoundingClientRect();
    if (!rect) return;
    if (event.touches.length >= 2) {
      event.preventDefault();
      const currentPinch = pinchStateRef.current;
      if (!currentPinch) return;
      const midpoint = getTouchMidpoint(event.touches, rect);
      const nextZoom = clamp(
        currentPinch.zoom * (getTouchDistance(event.touches) / currentPinch.distance),
        MIN_MAP_ZOOM,
        MAX_MAP_ZOOM
      );
      const scaleChange = nextZoom / currentPinch.zoom;
      setMapTransform(nextZoom, {
        x:
          midpoint.x -
          scaleChange * (currentPinch.midpoint.x - currentPinch.offset.x),
        y:
          midpoint.y -
          scaleChange * (currentPinch.midpoint.y - currentPinch.offset.y),
      });
      return;
    }
    const touch = event.touches[0];
    const dx = touch.clientX - lastMousePosRef.current.x;
    const dy = touch.clientY - lastMousePosRef.current.y;
    lastMousePosRef.current = { x: touch.clientX, y: touch.clientY };
    panMapBy(dx, dy);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-zinc-950 text-slate-100">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-slate-700/50 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-4 py-4 shadow-2xl backdrop-blur-xl md:px-6">
        <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-4 xl:flex-row xl:items-center">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/25">
              <svg
                className="h-6 w-6 text-white"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
              >
                <rect x="4" y="4" width="16" height="16" rx="2" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-400">
                {round === "primeiro" ? "Primeiro" : "Segundo"} Turno
                {loadedScenario?.isCustom && (
                  <span className="ml-2 text-purple-400">• Cenário Personalizado</span>
                )}
                {loadedScenario?.nationalVoters && (
                  <span className="ml-2 text-violet-400">
                    • {loadedScenario.nationalVoters.toLocaleString("pt-BR")} eleitores nacionais
                  </span>
                )}
              </p>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-black tracking-tight text-white">
                  {loadedScenario?.name ?? `Brasil ${scenarioYear ?? 2026}`}
                </h1>
                <span className={`rounded-full border px-3 py-1 text-xs font-black ${roundBadgeClass}`} style={{ boxShadow: "0 0 12px currentColor" }}>
                  {roundLabel}
                </span>
              </div>
            </div>
          </div>

          <div className="flex-1 space-y-2">
            <div className="flex items-end justify-between text-xs font-bold">
              {sortedCandidates.slice(0, 3).map((candidate) => {
                const pct = national.candidatePcts[candidate.id] || 0;
                return (
                  <div
                    key={candidate.id}
                    className="flex items-center gap-2"
                    style={{ color: candidate.color }}
                  >
                    <div className="text-lg font-black">{formatPct(pct)}</div>
                    <span className="hidden md:inline">{candidate.name}</span>
                  </div>
                );
              })}
              <div className={`rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-400 ${national.statesCounted < totalActiveStates ? "animate-pulse" : ""}`}>
                <span className="mr-1">MAP</span>
                {national.statesCounted} estados preenchidos de {totalActiveStates}
              </div>
            </div>
            <div className="relative h-5 overflow-hidden rounded-full bg-slate-800/80 shadow-inner flex">
              {sortedCandidates.map((candidate) => {
                const pct = national.candidatePcts[candidate.id] || 0;
                return (
                  <motion.div
                    key={candidate.id}
                    className="h-full transition-all duration-700 ease-in-out"
                    style={{ backgroundColor: candidate.color, width: `${pct}%` }}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ type: "spring", stiffness: 120, damping: 20 }}
                  />
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSettingsOpen((prev) => !prev)}
              className="rounded-xl border border-white/15 bg-gradient-to-r from-slate-800 to-slate-700/50 px-4 py-2.5 text-sm font-semibold text-slate-200 shadow-lg transition-all hover:bg-slate-700"
            >
              Candidatos
            </button>
            <button
              type="button"
              onClick={() => setNationalPhotoOpen(true)}
              className="rounded-xl bg-gradient-to-r from-violet-600 to-violet-700 px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition-all hover:scale-105"
            >
              Foto Nacional
            </button>
            <button
              type="button"
              onClick={() => setRegionalPhotoOpen(true)}
              className="rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition-all hover:scale-105"
            >
              Foto Regional
            </button>
            <button
              type="button"
              onClick={handleExport}
              className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm font-semibold text-emerald-300 shadow-lg transition-all hover:bg-emerald-500/20"
            >
              Exportar
            </button>
            <button
              type="button"
              onClick={() => importRef.current?.click()}
              className="rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-2.5 text-sm font-semibold text-sky-300 shadow-lg transition-all hover:bg-sky-500/20"
            >
              Importar
            </button>
            <input
              ref={importRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleImport}
            />
            <button
              type="button"
              onClick={() => setResults({})}
              className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-2.5 text-sm font-semibold text-amber-300 shadow-lg transition-all hover:bg-amber-500/20"
            >
              Limpar
            </button>
            <button
              type="button"
              onClick={onRestart}
              className="rounded-xl border border-red-500/35 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-300 shadow-lg transition-all hover:bg-red-500/20"
            >
              Reiniciar
            </button>
          </div>
        </div>
      </header>

      {/* ── Main ────────────────────────────────────────────────────────── */}
      <main className="mx-auto grid w-full max-w-[1800px] grid-cols-1 gap-6 px-4 py-6 xl:grid-cols-[320px_minmax(0,1fr)] xl:px-6">
        {/* Sidebar */}
        <aside className="max-h-[calc(100vh-180px)] overflow-y-auto rounded-2xl border border-white/10 bg-gradient-to-b from-slate-900/80 to-slate-900/40 p-4 shadow-2xl backdrop-blur-sm">
          <div className="mb-4">
            <h2 className="mb-3 text-sm font-black uppercase tracking-[0.18em] text-slate-400">
              Acoes rapidas
            </h2>
            <div className="grid gap-2">
              <button
                type="button"
                onClick={handleFillAllRandom}
                className="rounded-xl border border-violet-400/30 bg-violet-500/10 px-3 py-2.5 text-left text-xs font-black text-violet-200 transition hover:bg-violet-500/20"
              >
                Preencher todos aleatorio
              </button>
              <button
                type="button"
                onClick={handleClearAllStates}
                className="rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2.5 text-left text-xs font-black text-red-200 transition hover:bg-red-500/20"
              >
                Zerar todos os estados
              </button>
              <button
                type="button"
                onClick={handleCopyScenarioLink}
                className="rounded-xl border border-sky-400/30 bg-sky-500/10 px-3 py-2.5 text-left text-xs font-black text-sky-200 transition hover:bg-sky-500/20"
              >
                Copiar link do cenario
              </button>
            </div>
          </div>
          <hr className="my-3 border-slate-700/50" />
          <div className="mb-4">
            <h2 className="mb-3 text-sm font-black uppercase tracking-[0.18em] text-slate-400">
              Candidatos
            </h2>
            <div className="space-y-2">
              {sortedCandidates.map((candidate) => {
                const pct = national.candidatePcts[candidate.id] || 0;
                return (
                  <div
                    key={candidate.id}
                    onMouseEnter={() => setHighlightCandidate(candidate.id)}
                    onMouseLeave={() => setHighlightCandidate(null)}
                    className="rounded-xl border border-white/10 bg-slate-950/40 p-3 transition hover:bg-white/5"
                  >
                    <div className="mb-2 flex items-center justify-between gap-2 text-xs font-bold">
                      <span className="truncate" style={{ color: candidate.color }}>{candidate.name}</span>
                      <span className="text-slate-200">{formatPct(pct)}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: candidate.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <hr className="my-3 border-slate-700/50" />
          <h2 className="mb-4 text-sm font-black uppercase tracking-[0.18em] text-slate-400">
            Estados
          </h2>
          <div className="space-y-1.5">
            {activeStates.map((state) => {
              const result = results[state.uf];
              const winner = result?.winner ? candidateById[result.winner] : null;
              const winnerPct = result?.winner ? result.votes[result.winner] : null;
              const isExcluded = result?.excluded;
              return (
                <motion.button
                  key={state.uf}
                  type="button"
                  whileHover={{ x: 4 }}
                  onClick={() => setStateDialog({ uf: state.uf, view: "menu" })}
                  onMouseEnter={() => setHoveredState(state.uf)}
                  onMouseLeave={() => setHoveredState(null)}
                  className={`group flex w-full items-center justify-between rounded-xl border border-transparent px-4 py-3 text-left transition-all hover:border-white/15 hover:bg-white/5 active:scale-[0.98] ${
                    isExcluded ? "opacity-40" : ""
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-bold text-slate-200">{state.name}</div>
                      {isExcluded && (
                        <span className="text-[10px] font-black text-red-400 border border-red-400/30 rounded px-1">
                          EXCLUÍDO
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-medium text-slate-500">{state.uf}</div>
                  </div>
                  <div className="text-right">
                    <div
                      className="text-sm font-black"
                      style={{ color: winner?.color || "#64748b" }}
                    >
                      {winnerPct ? formatPct(winnerPct) : "--"}
                    </div>
                    <div className="text-[11px] font-medium text-slate-500">
                      {result?.usesMunicipalities ? "Municípios" : "Estado"}
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </aside>

        <section className="space-y-6">
          <AnimatePresence initial={false}>
            {settingsOpen && (
              <motion.div
                initial={{ opacity: 0, y: -10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.98 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="rounded-2xl border border-white/10 bg-gradient-to-b from-slate-900/90 to-slate-900/60 p-5 shadow-2xl backdrop-blur-sm"
              >
                <CandidateManager
                  round={round}
                  candidates={candidates}
                  neonStates={neonStates}
                  photoScale={nationalPhotoScale}
                  photoMapScale={photoMapScale}
                  onNeonStatesChange={setNeonStates}
                  onPhotoScaleChange={setNationalPhotoScale}
                  onPhotoMapScaleChange={setPhotoMapScale}
                  onChange={onCandidatesChange}
                />
                <div className="mt-4 rounded-xl border border-white/10 bg-slate-900/60 px-3 py-3">
                  <label className="flex items-center justify-between gap-4 text-sm font-semibold text-slate-300">
                    Modo claro do mapa
                    <input
                      type="checkbox"
                      checked={mapTheme === "light"}
                      onChange={(event) => setMapTheme(event.target.checked ? "light" : "dark")}
                      className="h-4 w-4 accent-emerald-500"
                    />
                  </label>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Map */}
          <div
            ref={mapContainerRef}
            className={`relative overflow-hidden rounded-2xl border shadow-2xl touch-none overscroll-contain ${
              mapTheme === "light"
                ? "border-slate-300 bg-gradient-to-b from-sky-50 to-slate-100"
                : "border-white/10 bg-gradient-to-b from-slate-950 to-slate-900"
            }`}
            style={{ cursor: isDragging ? "grabbing" : "grab" }}
            onMouseDown={handleMapMouseDown}
            onMouseMove={handleMapMouseMove}
            onMouseUp={stopMapDrag}
            onMouseLeave={stopMapDrag}
            onTouchStart={handleMapTouchStart}
            onTouchMove={handleMapTouchMove}
            onTouchEnd={stopMapDrag}
            onTouchCancel={stopMapDrag}
          >
            <div className="absolute left-4 top-4 z-20 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setShowRegionBorders((prev) => !prev)}
                className={`rounded-xl border px-3 py-2 text-[10px] font-black uppercase tracking-widest backdrop-blur-md shadow-2xl transition-all ${
                  showRegionBorders
                    ? "border-emerald-400/50 bg-emerald-500/20 text-emerald-100"
                    : "border-white/15 bg-black/60 text-slate-200 hover:bg-white/10"
                }`}
              >
                RegiÃµes
              </button>
            </div>

            <div className="absolute left-1/2 top-4 z-20 w-[min(420px,calc(100%-220px))] -translate-x-1/2 rounded-xl border border-white/15 bg-slate-950/75 px-3 py-2 shadow-2xl backdrop-blur-md">
              <div className="mb-1 flex items-center justify-between text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                <span>Estados preenchidos</span>
                <span>{Math.round(filledPct)}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                <motion.div
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-400"
                  initial={{ width: 0 }}
                  animate={{ width: `${filledPct}%` }}
                  transition={{ duration: 0.35 }}
                />
              </div>
            </div>

            <div className="absolute right-4 bottom-4 z-20 flex flex-col gap-2">
              <div className="flex flex-col items-center gap-1 rounded-full border border-slate-600 bg-slate-950/75 p-1.5 backdrop-blur-md shadow-2xl">
                <button
                  type="button"
                  onClick={() => zoomAtCenter(1 / ZOOM_BUTTON_FACTOR)}
                  title="Reduzir zoom"
                  disabled={mapZoom <= MIN_MAP_ZOOM}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-800 text-xl font-bold text-white shadow-lg transition-all hover:bg-slate-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  -
                </button>
                <div className="min-w-[54px] text-center text-[10px] font-black tracking-tighter uppercase text-slate-400">
                  {Math.round(mapZoom * 100)}%
                </div>
                <button
                  type="button"
                  onClick={() => zoomAtCenter(ZOOM_BUTTON_FACTOR)}
                  title="Aumentar zoom"
                  disabled={mapZoom >= MAX_MAP_ZOOM}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-800 text-xl font-bold text-white shadow-lg transition-all hover:bg-slate-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={resetMapView}
                  title="Ajustar a tela"
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-800 text-sm font-black text-white shadow-lg transition-all hover:bg-slate-700 active:scale-95"
                >
                  Fit
                </button>
              </div>
              <button
                type="button"
                onClick={resetMapView}
                title="Centralizar mapa"
                className="rounded-xl border border-slate-600 bg-slate-950/75 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white shadow-2xl backdrop-blur-md transition-all hover:bg-slate-700 active:scale-95"
              >
                + Centralizar mapa
              </button>
            </div>

            {false && hoveredStateInfo && hoveredResult && (
              <motion.div>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                    {hoveredStateInfo.name}
                  </div>
                  <div className="rounded-lg bg-white/10 px-2 py-0.5 text-xs font-bold text-white">
                    {hoveredStateInfo.uf}
                  </div>
                </div>
                {Object.entries(hoveredResult.votes).map(([candidateId, pct]) => {
                  const candidate = candidateById[Number(candidateId)];
                  if (!candidate) return null;
                  return (
                    <div
                      key={candidateId}
                      className="flex items-center justify-between text-sm py-1"
                    >
                      <span className="font-semibold" style={{ color: candidate.color }}>
                        {candidate.name}
                      </span>
                      <span className="font-black text-white">{formatPct(pct)}</span>
                    </div>
                  );
                })}
                {hoveredResult.excluded && (
                  <div className="mt-2 text-xs font-black text-red-400 border border-red-400/30 rounded px-2 py-1">
                    Excluído da contagem nacional
                  </div>
                )}
              </motion.div>
            )}

            <AnimatePresence>
              {hoveredStateInfo && mapTooltip && (
                <motion.div
                  key={hoveredStateInfo.uf}
                  initial={{ opacity: 0, y: -6, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.96 }}
                  transition={{ duration: 0.16 }}
                  className="pointer-events-none absolute z-30 w-72 rounded-xl border border-white/15 bg-slate-950/90 px-4 py-4 shadow-2xl backdrop-blur-xl"
                  style={tooltipPlacement}
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <img
                        src={`https://raw.githubusercontent.com/brazilflags/svg/master/flags/${hoveredStateInfo.uf.toLowerCase()}.svg`}
                        alt=""
                        className="mt-0.5 h-8 w-10 rounded border border-white/10 object-cover"
                        onError={(event) => {
                          event.currentTarget.style.display = "none";
                        }}
                      />
                      <div className="min-w-0">
                      <div className="text-sm font-black text-white">
                        {hoveredStateInfo.name} ({hoveredStateInfo.uf})
                      </div>
                      <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
                        {hoveredStateInfo.region}
                      </div>
                      </div>
                    </div>
                    <div className="rounded-lg bg-white/10 px-2 py-1 text-[11px] font-black text-white">
                      {hoveredStateInfo.uf}
                    </div>
                  </div>
                  <div className="mb-3 text-xs font-semibold text-slate-300">
                    {getVotersForState(hoveredStateInfo, loadedScenario).toLocaleString("pt-BR")} eleitores
                  </div>
                  {hoveredResult?.winner && hoveredWinner ? (
                    <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                      <div className="mb-2 flex items-center gap-2">
                        <span
                          className="h-3 w-3 rounded-sm"
                          style={{ backgroundColor: hoveredWinner.color }}
                        />
                        <span className="text-xs font-black text-white">
                          Vencedor: {hoveredWinner.name} ({hoveredWinner.party})
                        </span>
                      </div>
                      <div className="text-2xl font-black" style={{ color: hoveredWinner.color }}>
                        {formatPct(hoveredWinnerPct)}
                      </div>
                      <div className="mt-1 text-[11px] font-bold text-slate-400">
                        Margem: {formatPct(hoveredMargin)}
                      </div>
                      <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-slate-800">
                        {hoveredBreakdown.map(({ candidate, pct }) => (
                          <span
                            key={candidate.id}
                            className="h-full"
                            style={{ width: `${pct}%`, backgroundColor: candidate.color }}
                          />
                        ))}
                      </div>
                      <div className="mt-3 flex h-12 items-end gap-1">
                        {hoveredBreakdown.map(({ candidate, pct }) => (
                          <div
                            key={`${candidate.id}-spark`}
                            className="flex flex-1 items-end rounded-t-sm"
                            title={`${candidate.name}: ${formatPct(pct)}`}
                          >
                            <span
                              className="w-full rounded-t-sm"
                              style={{
                                height: `${Math.max(8, pct)}%`,
                                backgroundColor: candidate.color,
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-slate-600/60 bg-slate-800/60 px-3 py-2 text-xs font-bold text-slate-300">
                      Sem resultado definido
                    </div>
                  )}
                  {hoveredResult?.excluded && (
                    <div className="mt-2 rounded border border-red-400/30 px-2 py-1 text-xs font-black text-red-400">
                      ExcluÃ­do da contagem nacional
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {contextMenu && contextStateInfo && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.94 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.94 }}
                  transition={{ duration: 0.12 }}
                  className="absolute z-40 w-56 overflow-hidden rounded-xl border border-white/15 bg-slate-950/95 p-1 shadow-2xl backdrop-blur-xl"
                  style={{
                    left: Math.min(contextMenu.x, Math.max(12, mapViewport.width - 236)),
                    top: Math.min(contextMenu.y, Math.max(12, mapViewport.height - 286)),
                  }}
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="border-b border-white/10 px-3 py-2 text-xs font-black text-white">
                    {contextStateInfo.name}
                  </div>
                  {[
                    { label: `Editar votos de ${contextStateInfo.uf}`, action: () => setStateDialog({ uf: contextStateInfo.uf, view: "edit" }) },
                    { label: `Gerar foto de ${contextStateInfo.uf}`, action: () => setStateDialog({ uf: contextStateInfo.uf, view: "photo" }) },
                    { label: "Pintar municipios", action: () => setStateDialog({ uf: contextStateInfo.uf, view: "municipios" }) },
                    { label: "Resetar estado", action: () => handleResetState(contextStateInfo.uf) },
                    { label: "Zoom neste estado", action: () => contextPathItem && focusPathItem(contextPathItem) },
                    {
                      label: contextResult?.excluded ? "Incluir na contagem" : "Excluir da contagem",
                      action: () => toggleStateExcluded(contextStateInfo.uf),
                      disabled: !contextResult,
                    },
                  ].map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      disabled={item.disabled}
                      onClick={() => {
                        item.action();
                        setContextMenu(null);
                      }}
                      className="block w-full rounded-lg px-3 py-2 text-left text-xs font-bold text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {item.label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {paths.length === 0 ? (
              <div className="flex h-[70vh] items-center justify-center text-slate-400">
                <div className="text-center">
                  <div className="mx-auto mb-4 h-16 w-16 animate-spin rounded-full border-4 border-slate-800 border-t-emerald-500 shadow-[0_0_30px_-5px_rgba(16,185,129,0.3)]" />
                  <p className="text-sm font-black uppercase tracking-widest text-emerald-500/80 animate-pulse">
                    Carregando mapa...
                  </p>
                </div>
              </div>
            ) : (
              <div className="h-[70vh] w-full overflow-hidden">
                <motion.div
                  className="h-full w-full origin-top-left"
                  style={{ x: mapOffset.x, y: mapOffset.y, scale: mapZoom }}
                  transition={
                    autoMapTransition
                      ? { duration: 0.4, ease: "easeInOut" }
                      : { duration: 0 }
                  }
                >
                  <svg
                    viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
                    className="h-full w-full pointer-events-none"
                    style={{ filter: "drop-shadow(0 20px 50px rgba(0,0,0,0.5))" }}
                  >
                    <defs>
                      <radialGradient id="mapOceanGradient" cx="50%" cy="42%" r="76%">
                        <stop offset="0%" stopColor={mapTheme === "light" ? "#ffffff" : "#0f172a"} />
                        <stop offset="100%" stopColor={mapTheme === "light" ? "#dbeafe" : "#020617"} />
                      </radialGradient>
                      <pattern id="mapGridPattern" width="70" height="70" patternUnits="userSpaceOnUse">
                        <path
                          d="M 70 0 L 0 0 0 70"
                          fill="none"
                          stroke={mapTheme === "light" ? "#94a3b8" : "#334155"}
                          strokeWidth="0.8"
                          opacity="0.22"
                        />
                      </pattern>
                      <linearGradient id="unresolvedStateGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor={mapTheme === "light" ? "#f8fafc" : "#1e293b"} />
                        <stop offset="100%" stopColor={mapTheme === "light" ? "#cbd5e1" : "#334155"} />
                      </linearGradient>
                      <pattern
                        id="unresolvedStatePattern"
                        width="10"
                        height="10"
                        patternUnits="userSpaceOnUse"
                      >
                        <rect width="10" height="10" fill="url(#unresolvedStateGradient)" />
                        <path d="M-2 10 L10 -2 M2 12 L12 2" stroke="#64748b" strokeWidth="1.2" opacity="0.3" />
                      </pattern>
                      {paths.map((pathItem) => {
                        const [start, end] = getStateGradientColors(pathItem.uf);
                        return (
                          <linearGradient
                            key={`stateGradient-${pathItem.uf}`}
                            id={`stateGradient-${pathItem.uf}`}
                            x1="0%"
                            y1="0%"
                            x2="0%"
                            y2="100%"
                          >
                            <stop offset="0%" stopColor={start} />
                            <stop offset="100%" stopColor={end} />
                          </linearGradient>
                        );
                      })}
                    </defs>
                    <rect width={VIEWBOX_WIDTH} height={VIEWBOX_HEIGHT} fill="url(#mapOceanGradient)" />
                    <rect width={VIEWBOX_WIDTH} height={VIEWBOX_HEIGHT} fill="url(#mapGridPattern)" />
                    {paths.map((pathItem) => {
                      const isHovered = hoveredState === pathItem.uf;
                      const result = results[pathItem.uf];
                      const winnerColor = result?.winner
                        ? candidateById[result.winner]?.color
                        : null;
                      const isActive = activeStates.find((s) => s.uf === pathItem.uf);
                      const stateInfo = STATE_BY_UF[pathItem.uf];
                      const hasResult = Boolean(result?.winner);
                      const isCandidateHighlighted = Boolean(
                        highlightCandidate && result?.winner === highlightCandidate
                      );
                      const isHighlighted = highlightedState === pathItem.uf;
                      const isFlashed = flashedState === pathItem.uf;
                      return (
                        <g key={pathItem.uf} className="pointer-events-auto">
                          <motion.path
                            d={pathItem.d}
                            fill={
                              isActive
                                ? hasResult
                                  ? `url(#stateGradient-${pathItem.uf})`
                                  : "url(#unresolvedStatePattern)"
                                : "#0a0f1a"
                            }
                            stroke={
                              isCandidateHighlighted || isHighlighted
                                ? "#ffffff"
                                : isHovered && winnerColor
                                  ? winnerColor
                                  : mapTheme === "light"
                                    ? "#94a3b8"
                                    : "#334155"
                            }
                            strokeWidth={(isHovered ? 2.5 : 1) / mapZoom}
                            strokeDasharray={result?.excluded ? "8 6" : undefined}
                            className="cursor-pointer transition-colors duration-200"
                            style={{
                              animation: isActive && !hasResult ? "pulse-border 1.8s ease-in-out infinite" : undefined,
                              filter:
                                isCandidateHighlighted && winnerColor
                                  ? `drop-shadow(0 0 ${12 / mapZoom}px ${winnerColor}) brightness(1.25)`
                                  : isHovered && winnerColor && neonStates
                                  ? `drop-shadow(0 0 ${8 / mapZoom}px ${winnerColor}) drop-shadow(0 0 ${20 / mapZoom}px ${winnerColor}) brightness(1.18)`
                                  : isHovered
                                    ? "brightness(1.18)"
                                    : "none",
                              opacity: isActive ? (highlightCandidate && !isCandidateHighlighted ? 0.35 : 1) : 0.2,
                            }}
                            initial={{ opacity: 0, scale: 0.82 }}
                            onMouseEnter={(event) => {
                              setHoveredState(pathItem.uf);
                              updateMapTooltip(pathItem.uf, event);
                            }}
                            onMouseMove={(event) => updateMapTooltip(pathItem.uf, event)}
                            onMouseLeave={() => {
                              setHoveredState(null);
                              setMapTooltip(null);
                            }}
                            onClick={(event) => {
                              if (event.detail > 1) return;
                              if (isActive) setStateDialog({ uf: pathItem.uf, view: "menu" });
                            }}
                            onContextMenu={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              if (!isActive) return;
                              const rect = mapContainerRef.current?.getBoundingClientRect();
                              if (!rect) return;
                              setContextMenu({
                                uf: pathItem.uf,
                                x: event.clientX - rect.left,
                                y: event.clientY - rect.top,
                              });
                            }}
                            onDoubleClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              if (isActive) focusPathItem(pathItem);
                            }}
                            animate={
                              isFlashed
                                ? { opacity: [1, 0.35, 1], scale: [1, 1.018, 1] }
                                : isHovered || isHighlighted || isCandidateHighlighted
                                  ? { opacity: 1, scale: [1, 1.012, 1], y: -2 / mapZoom }
                                  : { opacity: isActive ? (highlightCandidate ? 0.35 : 1) : 0.2, scale: 1, y: 0 }
                            }
                            transition={
                              isHovered || isHighlighted || isCandidateHighlighted
                                ? { duration: 1.2, repeat: isHovered ? Infinity : 0, ease: "easeInOut" }
                                : { duration: 0.5, delay: paths.findIndex((item) => item.uf === pathItem.uf) * 0.03 }
                            }
                          />
                          {showRegionBorders && stateInfo && isActive && (
                            <path
                              d={pathItem.d}
                              fill="none"
                              stroke={REGION_BORDER_COLORS[stateInfo.region]}
                              strokeDasharray="8 7"
                              strokeWidth={3 / mapZoom}
                              opacity={0.42}
                              className="pointer-events-none"
                            />
                          )}
                          {isActive && !(mapZoom < 1.5 && SMALL_LABEL_UFS.has(pathItem.uf) && !isHovered) && (
                            <g className="pointer-events-none select-none">
                              <rect
                                x={pathItem.centroid[0] - (mapZoom > 2 && stateInfo ? 36 : 14)}
                                y={pathItem.centroid[1] - 9}
                                width={mapZoom > 2 && stateInfo ? 72 : 28}
                                height={18}
                                rx={9}
                                fill={mapTheme === "light" ? "rgba(255,255,255,0.78)" : "rgba(15,23,42,0.68)"}
                                stroke="rgba(255,255,255,0.18)"
                                strokeWidth={0.8 / mapZoom}
                                opacity={isHovered || mapZoom >= 1.2 ? 1 : 0.75}
                              />
                              <text
                                x={pathItem.centroid[0]}
                                y={pathItem.centroid[1] + 4}
                                className={`font-black ${
                                  isHovered ? "fill-white" : mapTheme === "light" ? "fill-slate-700" : "fill-slate-200"
                                }`}
                                style={{
                                  fontSize: mapZoom > 2 ? "10px" : "11px",
                                  textShadow: mapTheme === "light" ? "none" : "0 1px 3px rgba(0,0,0,0.8)",
                                  opacity: isActive ? 1 : 0.3,
                                }}
                                textAnchor="middle"
                              >
                                {mapZoom > 2 && stateInfo ? stateInfo.name : pathItem.uf}
                              </text>
                            </g>
                          )}
                          {isActive && !hasResult && (
                            <g className="pointer-events-none">
                              <circle
                                cx={pathItem.centroid[0] + 17}
                                cy={pathItem.centroid[1] - 18}
                                r={8}
                                fill="#f59e0b"
                                opacity={0.95}
                              />
                              <text
                                x={pathItem.centroid[0] + 17}
                                y={pathItem.centroid[1] - 14.5}
                                textAnchor="middle"
                                className="fill-slate-950 text-[11px] font-black"
                              >
                                !
                              </text>
                            </g>
                          )}
                          {isActive && result?.usesMunicipalities && (
                            <g className="pointer-events-none">
                              <rect
                                x={pathItem.centroid[0] - 21}
                                y={pathItem.centroid[1] + 13}
                                width={16}
                                height={16}
                                rx={4}
                                fill="#0f172a"
                                stroke="#38bdf8"
                                strokeWidth={1 / mapZoom}
                              />
                              <text
                                x={pathItem.centroid[0] - 13}
                                y={pathItem.centroid[1] + 25}
                                textAnchor="middle"
                                className="fill-sky-300 text-[10px] font-black"
                              >
                                M
                              </text>
                            </g>
                          )}
                        </g>
                      );
                    })}
                  </svg>
                </motion.div>
              </div>
            )}

            {paths.length > 0 && (
              <>
                <div className="absolute left-4 top-16 z-20 max-w-[calc(100%-220px)] rounded-xl border border-white/15 bg-slate-950/75 p-3 shadow-2xl backdrop-blur-md">
                  <div className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                    Legenda
                  </div>
                  <div className="flex max-h-28 flex-col gap-1 overflow-y-auto pr-1">
                    {legendCandidates.map((candidate) => (
                      <div key={candidate.id} className="flex items-center gap-2 text-xs font-bold text-slate-200">
                        <span
                          className="h-3 w-3 shrink-0 rounded-sm"
                          style={{ backgroundColor: candidate.color }}
                        />
                        <span className="truncate">
                          {candidate.name} ({candidate.party})
                        </span>
                      </div>
                    ))}
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                      <span className="h-3 w-3 shrink-0 rounded-sm border border-slate-500 bg-slate-700" />
                      <span>Sem resultado</span>
                    </div>
                    <div className="mt-2 border-t border-white/10 pt-2 text-[10px] font-bold text-slate-400">
                      <div className="mb-1">Intensidade da vitÃ³ria</div>
                      <div className="h-2 w-32 rounded-full bg-gradient-to-r from-white/80 via-slate-400 to-slate-900" />
                      <div className="mt-1 flex w-32 justify-between">
                        <span>Apertada</span>
                        <span>Folgada</span>
                      </div>
                    </div>
                  </div>
                </div>

                <AnimatePresence>
                  {mapZoom > 1.5 && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      className="absolute bottom-4 left-4 z-20 rounded-xl border border-white/15 bg-slate-950/75 p-2 shadow-2xl backdrop-blur-md"
                    >
                  <svg
                    viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
                    className="h-[120px] w-[150px] cursor-crosshair"
                    onClick={(event) => {
                      const rect = event.currentTarget.getBoundingClientRect();
                      panToViewBoxPoint({
                        x: ((event.clientX - rect.left) / rect.width) * VIEWBOX_WIDTH,
                        y: ((event.clientY - rect.top) / rect.height) * VIEWBOX_HEIGHT,
                      });
                    }}
                  >
                    {paths.map((pathItem) => {
                      const result = results[pathItem.uf];
                      return (
                        <path
                          key={pathItem.uf}
                          d={pathItem.d}
                          fill={result?.winner ? getStateFill(pathItem.uf) : "#334155"}
                          stroke="#0f172a"
                          strokeWidth={2}
                          opacity={activeStates.find((s) => s.uf === pathItem.uf) ? 0.95 : 0.2}
                        />
                      );
                    })}
                    <rect
                      x={minimapViewport.x}
                      y={minimapViewport.y}
                      width={minimapViewport.width}
                      height={minimapViewport.height}
                      fill="rgba(255,255,255,0.14)"
                      stroke="#ffffff"
                      strokeWidth={8 / mapZoom}
                      rx={10}
                    />
                  </svg>
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            )}
          </div>

          {/* Analytics */}
          <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-slate-900/90 to-slate-900/60 p-5 shadow-2xl">
            <div className="mb-5 flex flex-wrap gap-2">
              {[
                { id: "regioes", label: "🗺️ Ganhos por região" },
                { id: "desempenho", label: "📊 Desempenho geral" },
                { id: "ranking", label: "🏆 Ranking de estados" },
                { id: "candidatos", label: "🎯 Candidatos" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setAnalyticsTab(tab.id as AnalyticsTab)}
                  className={`relative overflow-hidden rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${
                    analyticsTab === tab.id
                      ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/25"
                      : "bg-slate-800/60 text-slate-300 hover:bg-slate-700/80"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab: Regiões */}
            {analyticsTab === "regioes" && (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setRegionFocus(null)}
                    className={`rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${
                      regionFocus === null
                        ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg"
                        : "bg-slate-800/60 text-slate-300 hover:bg-slate-700/80"
                    }`}
                  >
                    Brasil inteiro
                  </button>
                  {regionalStats.map((row) => (
                    <button
                      type="button"
                      key={row.region}
                      onClick={() => focusRegionDetails(row.region)}
                      className={`rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${
                        regionFocus === row.region
                          ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg"
                          : "bg-slate-800/60 text-slate-300 hover:bg-slate-700/80"
                      }`}
                    >
                      {row.region}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_1fr]">
                  <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-slate-950/80 to-slate-900/50 p-4 shadow-xl">
                    <div className="mb-3 text-sm font-bold text-slate-300">
                      {regionFocus
                        ? `Mapa da região ${regionFocus}`
                        : "Mapa do Brasil por regiões"}
                    </div>
                    <div className="relative overflow-hidden group">
                      <svg
                        viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
                        className="h-[420px] w-full transition-transform duration-500 group-hover:scale-[1.05]"
                      >
                        {paths.map((pathItem) => {
                          const state = STATE_BY_UF[pathItem.uf];
                          if (!state) return null;
                          const inFocus = regionFocus
                            ? state.region === regionFocus
                            : true;
                          const isActive = !!activeStates.find(
                            (s) => s.uf === pathItem.uf
                          );
                          const result = results[pathItem.uf];
                          const winnerColor = result?.winner
                            ? candidateById[result.winner]?.color
                            : null;
                          return (
                            <g key={pathItem.uf}>
                              <path
                                d={pathItem.d}
                                fill={
                                  inFocus && isActive
                                    ? getStateFill(pathItem.uf)
                                    : "#020617"
                                }
                                stroke={
                                  inFocus && isActive
                                    ? winnerColor
                                      ? winnerColor
                                      : "#1e293b"
                                    : "#0f172a"
                                }
                                strokeWidth={
                                  inFocus && isActive
                                    ? winnerColor
                                      ? 1.5
                                      : 1
                                    : 0.2
                                }
                                className={`transition-all duration-500 ${
                                  inFocus && isActive
                                    ? "cursor-pointer"
                                    : "cursor-default"
                                }`}
                                style={{ opacity: inFocus && isActive ? 1 : 0.3 }}
                                onClick={() => {
                                  if (inFocus && isActive) {
                                    focusRegionDetails(state.region);
                                  }
                                }}
                              />
                              {inFocus && isActive && (
                                <text
                                  x={pathItem.centroid[0]}
                                  y={pathItem.centroid[1]}
                                  className="pointer-events-none select-none fill-white/80 text-[10px] font-black"
                                  textAnchor="middle"
                                  style={{ textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}
                                >
                                  {pathItem.uf}
                                </text>
                              )}
                            </g>
                          );
                        })}
                      </svg>
                    </div>
                  </div>

                  <div ref={regionDetailsRef} className="space-y-3">
                    {regionalStats
                      .filter((row) =>
                        regionFocus ? row.region === regionFocus : true
                      )
                      .map((row) => {
                        const winner = row.winner ? candidateById[row.winner] : null;
                        return (
                          <motion.div
                            key={row.region}
                            className="rounded-xl border border-white/10 bg-gradient-to-br from-slate-800/50 to-slate-900/30 p-4 shadow-lg hover:shadow-xl transition-shadow"
                            whileHover={{ scale: 1.02 }}
                          >
                            <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                              {row.region}
                            </div>
                            <div
                              className="mt-2 text-2xl font-black"
                              style={{ color: winner?.color || "#a1a1aa" }}
                            >
                              {winner?.name || "Sem dados"}
                            </div>
                            <div className="mt-2 space-y-1">
                              {candidates.map((c) => (
                                <div
                                  key={c.id}
                                  className="flex items-center justify-between text-xs"
                                >
                                  <span style={{ color: c.color }}>{c.name}</span>
                                  <span className="font-bold text-slate-300">
                                    {formatPct(row.pcts[c.id] || 0)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        );
                      })}
                  </div>
                </div>
              </div>
            )}

            {/* Tab: Desempenho */}
            {analyticsTab === "desempenho" && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <motion.div
                  className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-800/60 to-slate-900/40 p-5 shadow-lg"
                  whileHover={{ scale: 1.02 }}
                >
                  <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500 flex items-center gap-2">
                    <span className="text-xl">👑</span> Liderança nacional
                  </div>
                  {sortedCandidates[0] && (
                    <div
                      className="mt-3 text-3xl font-black"
                      style={{
                        color: sortedCandidates[0].color,
                        textShadow: `0 0 40px ${sortedCandidates[0].color}40`,
                      }}
                    >
                      {sortedCandidates[0].name}
                    </div>
                  )}
                </motion.div>
                <motion.div
                  className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-800/60 to-slate-900/40 p-5 shadow-lg"
                  whileHover={{ scale: 1.02 }}
                >
                  <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500 flex items-center gap-2">
                    <span className="text-xl">🗺️</span> Estados vencidos
                  </div>
                  <div className="mt-3 space-y-1">
                    {candidates.map((c) => (
                      <div key={c.id} className="flex items-center justify-between text-sm">
                        <span style={{ color: c.color }}>{c.name}</span>
                        <span className="font-black text-white">
                          {performanceStats.candidateWins[c.id] || 0}
                        </span>
                      </div>
                    ))}
                  </div>
                </motion.div>
                <motion.div
                  className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-800/60 to-slate-900/40 p-5 shadow-lg"
                  whileHover={{ scale: 1.02 }}
                >
                  <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500 flex items-center gap-2">
                    <span className="text-xl">📈</span> Margem média
                  </div>
                  <div className="mt-3 text-3xl font-black text-white drop-shadow-lg">
                    {performanceStats.averageMargin.toFixed(2)}{" "}
                    <span className="text-lg text-slate-400">pp</span>
                  </div>
                </motion.div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-5">
                  <div className="mb-4 text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                    Voto nacional por candidato
                  </div>
                  <div className="space-y-3">
                    {sortedCandidates.map((candidate, index) => {
                      const pct = national.candidatePcts[candidate.id] || 0;
                      return (
                        <div key={candidate.id}>
                          <div className="mb-1 flex items-center justify-between text-xs font-bold">
                            <span style={{ color: candidate.color }}>{candidate.name}</span>
                            <span className="text-slate-200">{formatPct(pct)}</span>
                          </div>
                          <div className="h-4 overflow-hidden rounded-full bg-slate-800">
                            <motion.div
                              className="h-full rounded-full"
                              style={{ backgroundColor: candidate.color }}
                              initial={{ width: 0 }}
                              animate={{ width: `${pct}%` }}
                              transition={{ duration: 1, delay: index * 0.04 }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Tab: Ranking */}
            {analyticsTab === "ranking" && (
              <div className="space-y-3">
                <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-slate-950/40 p-4 md:flex-row">
                  <select
                    value={rankingRegionFilter}
                    onChange={(event) => setRankingRegionFilter(event.target.value as RegionName | "Todos")}
                    className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm font-bold text-white outline-none"
                  >
                    <option value="Todos">Todas as regioes</option>
                    {REGIONS.map((region) => (
                      <option key={region} value={region}>{region}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={rankingSearch}
                    onChange={(event) => setRankingSearch(event.target.value)}
                    placeholder="Buscar estado"
                    className="min-w-0 flex-1 rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm font-bold text-white outline-none placeholder:text-slate-500"
                  />
                </div>
                {rankingStates.map((state, index) => {
                  const result = results[state.uf];
                  if (!result) return null;
                  const winner = result.winner ? candidateById[result.winner] : null;
                  return (
                    <motion.div
                      key={state.uf}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.02 }}
                      className="group flex items-center justify-between rounded-xl border border-white/10 bg-gradient-to-r from-slate-800/50 to-slate-900/30 px-4 py-3 shadow-lg hover:border-white/20 hover:scale-[1.01] transition-all"
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-slate-700 to-slate-800 text-lg font-black text-slate-400 ring-2 ring-white/10">
                          {index + 1}
                        </div>
                        <div>
                          <div className="font-bold text-slate-200">{state.name}</div>
                          <div className="text-xs font-medium text-slate-500">{state.uf}</div>
                          <div className="mt-2 flex h-2 w-44 overflow-hidden rounded-full bg-slate-800">
                            {getStateVoteBreakdown(result).map(({ candidate, pct }) => (
                              <span
                                key={candidate.id}
                                className="h-full"
                                style={{ width: `${pct}%`, backgroundColor: candidate.color }}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {result.excluded && (
                          <span className="text-[10px] font-black text-red-400 border border-red-400/30 rounded px-2 py-0.5">
                            EXCLUÍDO
                          </span>
                        )}
                        <div className="text-right">
                          {winner && (
                            <>
                              <div
                                className="text-lg font-black"
                                style={{
                                  color: winner.color,
                                  textShadow: `0 0 20px ${winner.color}40`,
                                }}
                              >
                                {winner.name}
                              </div>
                              <div className="text-sm font-medium text-slate-400">
                                {formatPct(result.votes[result.winner!])}
                              </div>
                            </>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleResetState(state.uf)}
                          title="Resetar resultado deste estado"
                          className="rounded-lg border border-red-500/30 bg-red-500/10 px-2 py-1 text-xs font-bold text-red-300 hover:bg-red-500/20 transition-all flex-shrink-0"
                        >
                          Reset
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}

            {/* Tab: Candidatos */}
            {analyticsTab === "candidatos" && (
              <div className="space-y-4">
                <p className="text-xs text-slate-500 mb-2">
                  Classificação nacional com base nos estados preenchidos.
                </p>
                <div className="space-y-3">
                  {sortedCandidates.map((candidate, index) => {
                    const pct = national.candidatePcts[candidate.id] || 0;
                    const votes = national.candidateVotes[candidate.id] || 0;
                    const winsCount = performanceStats.candidateWins[candidate.id] || 0;
                    return (
                      <motion.div
                        key={candidate.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="rounded-2xl border bg-gradient-to-r from-slate-800/60 to-slate-900/40 p-5 shadow-lg"
                        style={{ borderColor: `${candidate.color}30` }}
                      >
                        <div className="flex items-center gap-4">
                          <div
                            className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl text-2xl font-black text-white shadow-lg"
                            style={{
                              backgroundColor: `${candidate.color}25`,
                              border: `2px solid ${candidate.color}60`,
                            }}
                          >
                            {index === 0
                              ? "🥇"
                              : index === 1
                              ? "🥈"
                              : index === 2
                              ? "🥉"
                              : `#${index + 1}`}
                          </div>
                          <div
                            className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-full border-2"
                            style={{ borderColor: candidate.color }}
                          >
                            {candidate.photo ? (
                              <img
                                src={candidate.photo}
                                alt={candidate.name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div
                                className="flex h-full w-full items-center justify-center text-sm font-black"
                                style={{ color: candidate.color }}
                              >
                                {candidate.number}
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className="text-xl font-black"
                                style={{ color: candidate.color }}
                              >
                                {candidate.name}
                              </span>
                              {candidate.ideology && (
                                <span className="rounded-lg bg-slate-800 px-2 py-0.5 text-xs font-bold text-slate-400">
                                  {candidate.ideology}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5">
                              {candidate.party} · Vice: {candidate.vice}
                            </div>
                            {candidate.coalition && (
                              <div className="text-xs text-slate-600 mt-0.5">
                                🤝 {candidate.coalition}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-6 flex-shrink-0">
                            <div className="text-center">
                              <div className="text-3xl font-black text-white">
                                {formatPct(pct)}
                              </div>
                              <div className="text-xs text-slate-500">Nacional</div>
                            </div>
                            <div className="text-center hidden md:block">
                              <div className="text-xl font-black text-white">
                                {Math.round(votes).toLocaleString("pt-BR")}
                              </div>
                              <div className="text-xs text-slate-500">Votos</div>
                            </div>
                            <div className="text-center hidden md:block">
                              <div className="text-xl font-black text-white">{winsCount}</div>
                              <div className="text-xs text-slate-500">Estados</div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setSettingsOpen(true)}
                              className="rounded-xl border border-white/10 bg-slate-800 px-3 py-2 text-xs font-black text-slate-200 transition hover:bg-slate-700"
                            >
                              Editar candidato
                            </button>
                          </div>
                        </div>
                        <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-800">
                          <motion.div
                            className="h-full rounded-full"
                            style={{ backgroundColor: candidate.color }}
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{
                              type: "spring",
                              stiffness: 100,
                              damping: 20,
                              delay: index * 0.05,
                            }}
                          />
                        </div>
                        <div className="mt-3 text-xs font-bold text-emerald-300">
                          Tendencia: {((pct - (initialNationalSnapshotRef.current?.[candidate.id] ?? pct)) >= 0 ? "+" : "")}
                          {(pct - (initialNationalSnapshotRef.current?.[candidate.id] ?? pct)).toFixed(1)}pp desde o ultimo save
                        </div>
                      </motion.div>
                    );
                  })}
                </div>

                <div className="mt-4 rounded-2xl border border-white/10 bg-slate-900/60 p-4 text-center">
                  <div className="text-sm text-slate-500">
                    Total de votos válidos contabilizados
                  </div>
                  <div className="text-3xl font-black text-white">
                    {Math.round(national.totalVotes).toLocaleString("pt-BR")}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {national.statesCounted} de {totalActiveStates} estados preenchidos
                  </div>
                  {loadedScenario?.nationalVoters && (
                    <div className="text-xs text-violet-400 mt-1">
                      Eleitorado nacional configurado:{" "}
                      {loadedScenario.nationalVoters.toLocaleString("pt-BR")}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* ── Modals ──────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {selectedStateInfo && stateDialog?.view === "menu" && (
          <StateActionModal
            key={`${selectedStateInfo.uf}-menu`}
            stateInfo={selectedStateInfo}
            currentResult={results[selectedStateInfo.uf]}
            candidates={candidates}
            filledStates={activeStates.filter((state) => Boolean(results[state.uf]))}
            results={results}
            onClose={() => setStateDialog(null)}
            onEdit={() => setStateDialog({ uf: selectedStateInfo.uf, view: "edit" })}
            onPhoto={() => setStateDialog({ uf: selectedStateInfo.uf, view: "photo" })}
            onMunicipalityEdit={() =>
              setStateDialog({ uf: selectedStateInfo.uf, view: "municipios" })
            }
            onReset={() => handleResetState(selectedStateInfo.uf)}
            onCopyFromState={(sourceUf) => handleCopyStateVotes(selectedStateInfo.uf, sourceUf)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedStateInfo && stateDialog?.view === "edit" && (
          <StateModal
            key={`${selectedStateInfo.uf}-edit`}
            stateInfo={selectedStateInfo}
            initialResult={results[selectedStateInfo.uf]}
            candidates={candidates}
            nationalCandidatePcts={national.candidatePcts}
            statePathD={paths.find((pathItem) => pathItem.uf === selectedStateInfo.uf)?.d}
            onClose={() => setStateDialog(null)}
            onSave={handleStateSave}
            onApplyToRegion={handleApplyVotesToRegion}
            onToast={pushToast}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedStateInfo && stateDialog?.view === "municipios" && (
          <MunicipalityPaintModal
            key={`${selectedStateInfo.uf}-municipios`}
            stateInfo={selectedStateInfo}
            candidates={candidates}
            initialPaint={results[selectedStateInfo.uf]?.municipalityPaint ?? {}}
            onClose={() => setStateDialog(null)}
            onSave={(paint) => handleMunicipalitySave(selectedStateInfo.uf, paint)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedStateInfo && stateDialog?.view === "photo" && (
          <StatePhotoModal
            key={`${selectedStateInfo.uf}-photo`}
            stateInfo={selectedStateInfo}
            candidates={candidates}
            result={results[selectedStateInfo.uf]}
            photoScale={nationalPhotoScale}
            photoMapScale={photoMapScale}
            onClose={() => setStateDialog(null)}
            scenarioYear={scenarioYear}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {nationalPhotoOpen && (
          <NationalPhotoModal
            candidates={sortedCandidates}
            national={national}
            paths={paths}
            results={results}
            photoScale={nationalPhotoScale}
            photoMapScale={photoMapScale}
            candidateById={candidateById}
            onClose={() => setNationalPhotoOpen(false)}
            scenarioYear={scenarioYear}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {regionalPhotoOpen && (
          <RegionalPhotoModal
            region={selectedPhotoRegion}
            onRegionChange={setSelectedPhotoRegion}
            candidates={sortedCandidates}
            paths={paths}
            stateGeoData={stateGeoData}
            results={results}
            photoScale={nationalPhotoScale}
            photoMapScale={photoMapScale}
            candidateById={candidateById}
            onClose={() => setRegionalPhotoOpen(false)}
            scenarioYear={scenarioYear}
          />
        )}
      </AnimatePresence>
      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
