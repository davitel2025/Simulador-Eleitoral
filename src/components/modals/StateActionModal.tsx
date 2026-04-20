import { motion } from "framer-motion";
import type { StateInfo, StateResult } from "../../types";

export function StateActionModal({ stateInfo, currentResult, onClose, onEdit, onPhoto, onMunicipalityEdit, onReset }: {
  stateInfo: StateInfo;
  currentResult?: StateResult;
  onClose: () => void;
  onEdit: () => void;
  onPhoto: () => void;
  onMunicipalityEdit: () => void;
  onReset: () => void;
}) {
  const hasResult = currentResult && (
    Object.values(currentResult.votes).some(v => v > 0) ||
    Object.keys(currentResult.municipalityPaint ?? {}).length > 0
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/80 p-4 backdrop-blur-sm">
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 14, opacity: 0 }}
        className="mx-auto mt-24 w-full max-w-xl rounded-3xl border border-white/10 bg-slate-950 p-6">
        <div className="mb-6 text-center">
          <h3 className="text-3xl font-black text-white">{stateInfo.name}</h3>
          <p className="text-sm text-slate-400">Escolha uma ação para este estado</p>
        </div>
        <div className="grid gap-3">
          <button type="button" onClick={onPhoto} className="rounded-xl bg-violet-600 px-4 py-4 text-left text-white">
            <div className="text-lg font-black">Foto estadual</div>
            <div className="text-sm text-violet-100">Visual completo do resultado no estado</div>
          </button>
          <button type="button" onClick={onEdit} className="rounded-xl bg-emerald-600 px-4 py-4 text-left text-white">
            <div className="text-lg font-black">Alterar porcentagens</div>
            <div className="text-sm text-emerald-100">Editar votos de todos os candidatos</div>
          </button>
          <button type="button" onClick={onMunicipalityEdit} className="rounded-xl bg-blue-600 px-4 py-4 text-left text-white">
            <div className="text-lg font-black">Alterar municípios</div>
            <div className="text-sm text-blue-100">Pinte os municípios manualmente por candidato</div>
          </button>
          {hasResult && (
            <button
              type="button"
              onClick={() => { onReset(); onClose(); }}
              className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-4 text-left text-white hover:bg-red-500/20 transition-all"
            >
              <div className="text-lg font-black text-red-300">🗑️ Resetar resultado</div>
              <div className="text-sm text-red-400/80">Remove os dados deste estado (não afeta outros estados)</div>
            </button>
          )}
          <button type="button" onClick={onClose} className="rounded-xl border border-white/15 px-4 py-3 text-sm font-bold text-slate-200">
            Fechar
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
