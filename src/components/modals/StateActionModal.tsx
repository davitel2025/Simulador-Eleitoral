import { motion } from "framer-motion";
import type { StateInfo } from "../../types";

export function StateActionModal({ stateInfo, onClose, onEdit, onPhoto, onMunicipalityEdit }: {
  stateInfo: StateInfo;
  onClose: () => void;
  onEdit: () => void;
  onPhoto: () => void;
  onMunicipalityEdit: () => void;
}) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/80 p-4 backdrop-blur-sm">
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 14, opacity: 0 }}
        className="mx-auto mt-24 w-full max-w-xl rounded-3xl border border-white/10 bg-slate-950 p-6">
        <div className="mb-6 text-center">
          <h3 className="text-3xl font-black text-white">{stateInfo.name}</h3>
          <p className="text-sm text-slate-400">Escolha uma acao para este estado</p>
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
            <div className="text-lg font-black">Alterar municipios</div>
            <div className="text-sm text-blue-100">Pinte os municipios manualmente por candidato</div>
          </button>
          <button type="button" onClick={onClose} className="rounded-xl border border-white/15 px-4 py-3 text-sm font-bold text-slate-200">
            Fechar
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
