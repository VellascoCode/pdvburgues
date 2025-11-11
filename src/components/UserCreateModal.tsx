import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FaUserPlus, FaIdBadge, FaUserTag, FaTransgender, FaBriefcase, FaMapMarkerAlt, FaShieldAlt, FaKey } from 'react-icons/fa';
import PinModal from '@/components/PinModal';
import { playUiSound } from '@/utils/sound';

export type NewUserData = {
  access: string; // 3 dígitos
  nome: string;
  nick?: string;
  genero?: 'M'|'F';
  type: number; // 0..10
  funcao?: string;
  workspace?: string;
  icone?: string;
  newPin: string; // PIN inicial (4 dígitos)
};

export default function UserCreateModal({ open, onClose, onConfirm }: { open: boolean; onClose: () => void; onConfirm: (data: NewUserData, pin: string) => Promise<boolean> }) {
  return (
    <AnimatePresence>
      {open && <ModalContent onClose={onClose} onConfirm={onConfirm} />}
    </AnimatePresence>
  );
}

function ModalContent({ onClose, onConfirm }: { onClose: () => void; onConfirm: (data: NewUserData, pin: string) => Promise<boolean> }) {
  const [access, setAccess] = React.useState('');
  const [nome, setNome] = React.useState('');
  const [nick, setNick] = React.useState('');
  const [genero, setGenero] = React.useState<'M'|'F'|null>(null);
  const [type, setType] = React.useState<number>(1);
  const [funcao, setFuncao] = React.useState('');
  const [workspace, setWorkspace] = React.useState('');
  const [newPin, setNewPin] = React.useState('');
  const [pinModal, setPinModal] = React.useState(false);

  React.useEffect(() => { playUiSound('open'); }, []);

  const reset = () => {
    setAccess(''); setNome(''); setNick(''); setGenero(null); setType(1); setFuncao(''); setWorkspace(''); setNewPin('');
  };

  const close = () => { playUiSound('close'); reset(); onClose(); };

  const disabled = !/^\d{3}$/.test(access) || !/^\d{4}$/.test(newPin) || nome.trim().length === 0;

  const handleConfirm = async (pin: string): Promise<boolean> => {
    const ok = await onConfirm({
      access,
      nome: nome.trim(),
      nick: nick.trim() || undefined,
      genero: genero || undefined,
      type,
      funcao: funcao.trim() || undefined,
      workspace: workspace.trim() || undefined,
      newPin,
    }, pin);
    if (ok) { reset(); onClose(); }
    return !!ok;
  };

  const roleSuggestions = ['Atendente', 'Caixa', 'Cozinha', 'Chapeiro', 'Expedição', 'Gerente'];
  const workspaceSuggestions = ['atendimento', 'caixa', 'cozinha', 'expedição', 'entregas'];

  return (
    <>
      <motion.div className="fixed inset-0 z-70 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <div className="absolute inset-0 bg-black" onClick={close} />
        <motion.div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border theme-border theme-surface bg-zinc-900 shadow-2xl" initial={{ y: 24, scale: 0.96 }} animate={{ y: 0, scale: 1 }} exit={{ y: 24, scale: 0.96 }}>
          <div className="sticky top-0 z-10 theme-surface bg-zinc-900 border-b theme-border px-6 py-4 flex items-center gap-2">
            <FaUserPlus className="text-zinc-400" />
            <h2 className="text-white font-semibold text-lg">Criar Usuário</h2>
          </div>
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 gap-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs text-zinc-400 flex items-center gap-2"><FaIdBadge className="text-zinc-400" /> Access ID (3 dígitos)</span>
                  <input value={access} onChange={(e)=> setAccess(e.target.value.replace(/\D/g,'').slice(0,3))} inputMode="numeric" maxLength={3} className="rounded-lg border theme-border bg-zinc-900 text-zinc-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500" placeholder="000" />
                </label>
                <label className="flex flex-col gap-1.5 sm:col-span-2">
                  <span className="text-xs text-zinc-400">Nome</span>
                  <input value={nome} onChange={(e)=> setNome(e.target.value)} className="rounded-lg border theme-border bg-zinc-900 text-zinc-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500" placeholder="Ex: Maria Souza" />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs text-zinc-400 flex items-center gap-2"><FaUserTag className="text-zinc-400" /> Nick</span>
                  <input value={nick} onChange={(e)=> setNick(e.target.value)} className="rounded-lg border theme-border bg-zinc-900 text-zinc-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500" placeholder="Ex: Mari" />
                </label>
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs text-zinc-400 flex items-center gap-2"><FaTransgender className="text-zinc-400" /> Gênero</span>
                  <div className="flex items-center gap-2">
                    {(['M','F'] as const).map(g => (
                      <button key={g} className={`text-xs px-2 py-1 rounded-md border ${genero===g?'bg-orange-500/15 border-orange-600 text-orange-300':'theme-border text-zinc-300 hover:bg-zinc-800'}`} onClick={()=> setGenero(g)}>
                        {g==='M'?'Masculino':'Feminino'}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs text-zinc-400 flex items-center gap-2"><FaShieldAlt className="text-zinc-400" /> Tipo</span>
                  <select value={type} onChange={(e)=> setType(Number(e.target.value))} className="rounded-lg border theme-border bg-zinc-900 text-zinc-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500">
                    <option value={1}>Operador (1)</option>
                    <option value={5}>Gerente (5)</option>
                    <option value={10}>Admin Master (10)</option>
                  </select>
                </div>
                {/* Status removido: sempre "novo" ao criar */}
                <label className="flex flex-col gap-1.5 sm:col-span-2">
                  <span className="text-xs text-zinc-400 flex items-center gap-2"><FaBriefcase className="text-zinc-400" /> Função</span>
                  <input value={funcao} onChange={(e)=> setFuncao(e.target.value)} className="rounded-lg border theme-border bg-zinc-900 text-zinc-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500" placeholder="Ex: Caixa, Cozinha, Gerente" />
                  <div className="flex flex-wrap gap-2 mt-1">
                    {roleSuggestions.map(r => (
                      <button type="button" key={r} className="text-[11px] px-2 py-1 rounded-md border theme-border text-zinc-300 hover:bg-zinc-800" onClick={()=> setFuncao(r)}>{r}</button>
                    ))}
                  </div>
                </label>
                <label className="flex flex-col gap-1.5 sm:col-span-2">
                  <span className="text-xs text-zinc-400 flex items-center gap-2"><FaMapMarkerAlt className="text-zinc-400" /> Espaço de trabalho</span>
                  <input value={workspace} onChange={(e)=> setWorkspace(e.target.value)} className="rounded-lg border theme-border bg-zinc-900 text-zinc-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500" placeholder="Ex: cozinha, caixa, atendimento, expedição" />
                  <div className="flex flex-wrap gap-2 mt-1">
                    {workspaceSuggestions.map(w => (
                      <button type="button" key={w} className="text-[11px] px-2 py-1 rounded-md border theme-border text-zinc-300 hover:bg-zinc-800" onClick={()=> setWorkspace(w)}>{w}</button>
                    ))}
                  </div>
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs text-zinc-400 flex items-center gap-2"><FaKey className="text-zinc-400" /> PIN inicial (4 dígitos)</span>
                  <input value={newPin} onChange={(e)=> setNewPin(e.target.value.replace(/\D/g,'').slice(0,4))} inputMode="numeric" maxLength={4} className="rounded-lg border theme-border bg-zinc-900 text-zinc-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500" placeholder="0000" />
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button className="px-4 py-2 rounded-lg border theme-border text-zinc-300 hover:bg-zinc-800" onClick={close}>Cancelar</button>
              <button className="px-4 py-2 rounded-lg brand-btn text-white disabled:opacity-50" disabled={disabled} onClick={()=> setPinModal(true)}>Salvar</button>
            </div>
          </div>
        </motion.div>
      </motion.div>
      <PinModal open={pinModal} title="Confirme com seu PIN" message="Digite o PIN do admin para confirmar a criação." onClose={()=> setPinModal(false)} onConfirm={async (pin) => { if (disabled) return false; return handleConfirm(pin); }} />
    </>
  );
}
