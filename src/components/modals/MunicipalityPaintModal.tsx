import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { VIEWBOX_HEIGHT, VIEWBOX_WIDTH } from "../../lib/constants";
import { shadeHex } from "../../lib/color";
import { buildMunicipalityPaths, fetchMunicipalityGeo } from "../../lib/geo";
import type { Candidate, CandidateId, MunicipalityPath, StateInfo } from "../../types";

export function MunicipalityPaintModal({ stateInfo, candidates, initialPaint, onClose, onSave }: {
  stateInfo: StateInfo;
  candidates: Candidate[];
  initialPaint: Record<string, CandidateId>;
  onClose: () => void;
  onSave: (paint: Record<string, CandidateId>) => void;
}) {
  const [paths, setPaths] = useState<MunicipalityPath[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateId | null>(candidates[0]?.id ?? null);
  const [paint, setPaint] = useState<Record<string, CandidateId>>(initialPaint);
  const [fillAllCandidate, setFillAllCandidate] = useState<CandidateId | null>(null);
  const isPaintingRef = useRef(false);

  useEffect(() => {
    let active = true;
    fetchMunicipalityGeo(stateInfo.ibgeCode).then((geo) => {
      if (!active) return;
      if (geo) setPaths(buildMunicipalityPaths(geo));
      setLoading(false);
    }).catch(() => {
      if (!active) return;
      setLoading(false);
    });
    return () => { active = false; };
  }, [stateInfo.ibgeCode]);

  useEffect(() => {
    const stopPainting = () => { isPaintingRef.current = false; };
    window.addEventListener("mouseup", stopPainting);
    window.addEventListener("blur", stopPainting);
    return () => {
      window.removeEventListener("mouseup", stopPainting);
      window.removeEventListener("blur", stopPainting);
    };
  }, []);

  const candidateById = useMemo(() => Object.fromEntries(candidates.map((candidate) => [candidate.id, candidate])), [candidates]);

  const applyPaint = (municipalityCode: string) => {
    setPaint((prev) => {
      const next = { ...prev };
      if (!selectedCandidate) {
        if (!(municipalityCode in next)) return prev;
        delete next[municipalityCode];
        return next;
      }
      if (next[municipalityCode] === selectedCandidate) return prev;
      next[municipalityCode] = selectedCandidate;
      return next;
    });
  };

  const handleFillAll = () => {
    if (!fillAllCandidate || !paths.length) return;
    const newPaint = { ...paint };
    paths.forEach((path) => {
      newPaint[path.code] = fillAllCandidate;
    });
    setPaint(newPaint);
  };

  const handleMunicipalityMouseDown = (municipalityCode: string, event: React.MouseEvent) => {
    if (event.button !== 0) return;
    event.preventDefault();
    isPaintingRef.current = true;
    applyPaint(municipalityCode);
  };

  const handleMunicipalityMouseEnter = (municipalityCode: string, event: React.MouseEvent) => {
    if (!isPaintingRef.current) {
      if (event.buttons === 1) {
        isPaintingRef.current = true;
      } else {
        return;
      }
    }
    applyPaint(municipalityCode);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 overflow-y-auto bg-black/80 p-4 backdrop-blur-sm">
      <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }} className="mx-auto w-full max-w-6xl rounded-3xl border border-white/10 bg-slate-950 p-6">
        <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-3xl font-black text-white">Alterar municípios - {stateInfo.name}</h3>
            <p className="text-sm text-slate-400">Selecione um candidato e clique (ou segure e arraste) sobre os municípios para colorir.</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => onSave(paint)} className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-black text-zinc-950">Salvar municípios</button>
            <button type="button" onClick={onClose} className="rounded-xl border border-white/15 px-4 py-2 text-sm font-bold text-white">Fechar</button>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          {candidates.map((candidate) => (
            <button
              key={candidate.id}
              type="button"
              onClick={() => setSelectedCandidate(candidate.id)}
              className={`rounded-xl px-3 py-2 text-xs font-black transition-all ${selectedCandidate === candidate.id ? "ring-2 ring-white" : "opacity-85"}`}
              style={{ backgroundColor: `${candidate.color}33`, color: candidate.color, border: `1px solid ${candidate.color}66` }}
            >
              {candidate.name}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setSelectedCandidate(null)}
            className={`rounded-xl border px-3 py-2 text-xs font-black transition-all ${selectedCandidate === null ? "border-white text-white" : "border-slate-600 text-slate-300"}`}
          >
            Borracha
          </button>
          <button type="button" onClick={() => setPaint({})} className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs font-black text-red-300">
            Limpar pintura
          </button>
        </div>

        <div className="mb-4 rounded-xl border border-white/10 bg-slate-900/60 p-4">
          <div className="mb-2 text-sm font-bold text-white">Preencher todos os municípios</div>
          <div className="flex gap-2">
            <select
              value={fillAllCandidate || ""}
              onChange={(e) => setFillAllCandidate(e.target.value ? Number(e.target.value) : null)}
              className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
            >
              <option value="">Selecione um candidato</option>
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.party})
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleFillAll}
              disabled={!fillAllCandidate}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-emerald-700 transition-colors"
            >
              Preencher Tudo
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-3">
          {loading ? (
            <div className="flex h-[68vh] items-center justify-center">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-700 border-t-emerald-500" />
            </div>
          ) : paths.length === 0 ? (
            <div className="flex h-[68vh] items-center justify-center text-slate-400">Não foi possível carregar os municípios.</div>
          ) : (
            <svg
              viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
              className="h-[68vh] w-full select-none"
              onMouseLeave={() => { isPaintingRef.current = false; }}
              onContextMenu={(event) => event.preventDefault()}
              style={{ touchAction: "none" }}
            >
              {paths.map((pathItem) => {
                const candidate = candidateById[paint[pathItem.code]];
                return (
                  <path
                    key={pathItem.code}
                    d={pathItem.d}
                    fill={candidate ? candidate.color : "#0f172a"}
                    stroke={candidate ? shadeHex(candidate.color, 0.3, "black") : "#1f2937"}
                    strokeWidth={0.7}
                    className="cursor-pointer transition-colors duration-150 hover:brightness-125"
                    onMouseDown={(event) => handleMunicipalityMouseDown(pathItem.code, event)}
                    onMouseEnter={(event) => handleMunicipalityMouseEnter(pathItem.code, event)}
                  />
                );
              })}
            </svg>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}