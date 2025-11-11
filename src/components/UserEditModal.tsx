import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FaUserEdit, FaIdBadge, FaUserTag, FaTransgender, FaBriefcase, FaMapMarkerAlt, FaToggleOn, FaShieldAlt, FaKey, FaSyncAlt } from 'react-icons/fa';
// Avatar removido
import PinModal from '@/components/PinModal';
import { playUiSound } from '@/utils/sound';

type Genero = 'M'|'F';
type BoardColumn = { id: string; label: string; subtitle?: string; color?: string; iconKey?: string; builtIn?: boolean; visible?: boolean };
type UserDoc = {
  access: string;
  nome: string;
  nick?: string;
  genero?: Genero;
  type: number;
  status: number;
  funcao?: string;
  workspace?: string;
  createdAt?: string;
  updatedAt?: string;
  board?: { columns: BoardColumn[] };
  allowedColumns?: string[];
};

export default function UserEditModal({ open, access, onClose, onSaved }: { open: boolean; access: string; onClose: () => void; onSaved: () => void }) {
  return (
    <AnimatePresence>
      {open && <Content access={access} onClose={onClose} onSaved={onSaved} />}
    </AnimatePresence>
  );
}

function Content({ access, onClose, onSaved }: { access: string; onClose: () => void; onSaved: () => void }) {
  const [loading, setLoading] = React.useState<boolean>(true);
  const [data, setData] = React.useState<UserDoc | null>(null);
  const [newPin, setNewPin] = React.useState<string>('');
  const [pinModal, setPinModal] = React.useState<boolean>(false);
  const [boardCols, setBoardCols] = React.useState<BoardColumn[]>([]);
  const [allowedIds, setAllowedIds] = React.useState<string[]>([]);

  React.useEffect(() => {
    playUiSound('open');
    let mounted = true;
    const DEFAULT_COLS: BoardColumn[] = [
      { id: 'EM_AGUARDO', label: 'Em Aguardo', builtIn: true, visible: true },
      { id: 'EM_PREPARO', label: 'Em Preparo', builtIn: true, visible: true },
      { id: 'PRONTO', label: 'Pronto/Aguardando Motoboy', builtIn: true, visible: true },
      { id: 'EM_ROTA', label: 'Em Rota', builtIn: true, visible: true },
      { id: 'COMPLETO', label: 'Completo', builtIn: true, visible: true },
    ];
    fetch(`/api/users/${access}`)
      .then(r => r.ok ? r.json() : null)
      .then((doc: UserDoc | null) => {
        if (!mounted) return;
        if (!doc) { setLoading(false); return; }
        setData(doc);
        const cols = (Array.isArray(doc.board?.columns) && doc.board!.columns.length) ? doc.board!.columns : DEFAULT_COLS;
        setBoardCols(cols);
        const defIds = ['EM_AGUARDO','EM_PREPARO','PRONTO','EM_ROTA','COMPLETO'];
        const initialAllowed = Array.isArray(doc.allowedColumns) && doc.allowedColumns.length ? doc.allowedColumns : defIds.filter(id => cols.some(c => String(c.id) === id));
        setAllowedIds(initialAllowed);
        setLoading(false);
      })
      .catch(() => { if (!mounted) return; setLoading(false); });
    return () => { mounted = false; };
  }, [access]);

  const close = () => { playUiSound('close'); onClose(); };
  const update = (patch: Partial<UserDoc>) => setData(d => d ? { ...d, ...patch } : d);
  const disabled = !data || !/^\d{3}$/.test(data.access) || !data.nome.trim() || (newPin !== '' && !/^\d{4}$/.test(newPin));

  const roleSuggestions = ['Atendente', 'Caixa', 'Cozinha', 'Chapeiro', 'Expedição', 'Gerente'] as const;
  const workspaceSuggestions = ['atendimento', 'caixa', 'cozinha', 'expedição', 'entregas'] as const;

  const doSave = async (adminPin: string): Promise<boolean> => {
    if (!data) return false;
    const payload: Partial<UserDoc> & { pin: string; newPin?: string; allowedColumns: string[]; board: { columns: Array<{ id: string; label: string; builtIn?: boolean }> } } = {
      access: data.access,
      nome: data.nome.trim(),
      nick: (data.nick || '').trim() || undefined,
      genero: data.genero,
      type: data.type,
      status: data.status,
      funcao: (data.funcao || '').trim() || undefined,
      workspace: (data.workspace || '').trim() || undefined,
      pin: adminPin,
      newPin: newPin || undefined,
      board: { columns: boardCols.map(c => ({ id: c.id, label: c.label, builtIn: !!c.builtIn })) },
      allowedColumns: allowedIds,
    };
    try {
      const res = await fetch(`/api/users/${access}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (res.ok) { playUiSound('success'); onSaved(); onClose(); return true; }
      playUiSound('error');
      return false;
    } catch {
      playUiSound('error');
      return false;
    }
  };

  return (
    <>
      <motion.div className="fixed inset-0 z-70 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <div className="absolute inset-0 bg-black" onClick={close} />
        <motion.div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border theme-border theme-surface bg-zinc-900 shadow-2xl" initial={{ y: 24, scale: 0.96 }} animate={{ y: 0, scale: 1 }} exit={{ y: 24, scale: 0.96 }}>
          <div className="sticky top-0 z-10 theme-surface bg-zinc-900 border-b theme-border px-6 py-4 flex items-center gap-2">
            <FaUserEdit className="text-zinc-400" />
            <h2 className="text-white font-semibold text-lg">Editar Usuário</h2>
          </div>
          <div className="p-6">
            {loading ? (
              <div className="text-zinc-400">Carregando…</div>
            ) : !data ? (
              <div className="text-rose-400">Usuário não encontrado.</div>
            ) : (
              <div className="grid grid-cols-1 gap-6">
                <div className="flex flex-col items-center gap-2" aria-hidden>
                  <div className="text-xs text-zinc-500 text-center">{data.createdAt ? `Criado em ${new Date(data.createdAt).toLocaleDateString('pt-BR')}` : ''}</div>
                </div>

                {/* Formulário - Informações Básicas */}
                <div className="grid grid-cols-1 gap-3">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs text-zinc-400 flex items-center gap-2"><FaIdBadge className="text-zinc-400" /> Access ID (3 dígitos)</span>
                    <input value={data.access} onChange={(e)=> update({ access: e.target.value.replace(/\D/g,'').slice(0,3) })} inputMode="numeric" maxLength={3} className="rounded-lg border theme-border bg-zinc-900 text-zinc-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500" />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs text-zinc-400">Nome</span>
                    <input value={data.nome} onChange={(e)=> update({ nome: e.target.value })} className="rounded-lg border theme-border bg-zinc-900 text-zinc-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500" />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs text-zinc-400 flex items-center gap-2"><FaUserTag className="text-zinc-400" /> Nick</span>
                    <input value={data.nick || ''} onChange={(e)=> update({ nick: e.target.value })} className="rounded-lg border theme-border bg-zinc-900 text-zinc-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500" />
                  </label>
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs text-zinc-400 flex items-center gap-2"><FaTransgender className="text-zinc-400" /> Gênero</span>
                    <div className="flex items-center gap-2">
                      {(['M','F'] as const).map(g => (
                        <button key={g} className={`text-xs px-2 py-1 rounded-md border ${data.genero===g?'bg-orange-500/15 border-orange-600 text-orange-300':'theme-border text-zinc-300 hover:bg-zinc-800'}`} onClick={()=> update({ genero: g })}>
                          {g==='M'?'Masculino':'Feminino'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs text-zinc-400 flex items-center gap-2"><FaShieldAlt className="text-zinc-400" /> Tipo</span>
                    <select value={data.type} onChange={(e)=> update({ type: Number(e.target.value) })} className="rounded-lg border theme-border bg-zinc-900 text-zinc-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500">
                      <option value={1}>Operador (1)</option>
                      <option value={5}>Gerente (5)</option>
                      <option value={10}>Admin Master (10)</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs text-zinc-400 flex items-center gap-2"><FaToggleOn className="text-zinc-400" /> Status</span>
                    <div className="flex items-center gap-2">
                      <button className={`text-xs px-2 py-1 rounded-md border ${data.status===1?'bg-orange-500/15 border-orange-600 text-orange-300':'theme-border text-zinc-300 hover:bg-zinc-800'}`} onClick={()=> update({ status: 1 })}>Ativo</button>
                      <button className={`text-xs px-2 py-1 rounded-md border ${data.status===2?'bg-rose-500/15 border-rose-600 text-rose-300':'theme-border text-zinc-300 hover:bg-zinc-800'}`} onClick={()=> update({ status: 2 })}>Suspenso</button>
                      {data.status===0 && <span className="text-[11px] text-zinc-500">Atual: Novo</span>}
                    </div>
                  </div>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs text-zinc-400 flex items-center gap-2"><FaBriefcase className="text-zinc-400" /> Função</span>
                    <input value={data.funcao || ''} onChange={(e)=> update({ funcao: e.target.value })} className="rounded-lg border theme-border bg-zinc-900 text-zinc-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500" placeholder="Ex: Caixa, Cozinha, Gerente" />
                    <div className="flex flex-wrap gap-2 mt-1">
                      {roleSuggestions.map(r => (
                        <button type="button" key={r} className="text-[11px] px-2 py-1 rounded-md border theme-border text-zinc-300 hover:bg-zinc-800" onClick={()=> update({ funcao: r })}>{r}</button>
                      ))}
                    </div>
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs text-zinc-400 flex items-center gap-2"><FaMapMarkerAlt className="text-zinc-400" /> Espaço de trabalho</span>
                    <input value={data.workspace || ''} onChange={(e)=> update({ workspace: e.target.value })} className="rounded-lg border theme-border bg-zinc-900 text-zinc-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500" placeholder="Ex: cozinha, caixa, atendimento, expedição" />
                    <div className="flex flex-wrap gap-2 mt-1">
                      {workspaceSuggestions.map(w => (
                        <button type="button" key={w} className="text-[11px] px-2 py-1 rounded-md border theme-border text-zinc-300 hover:bg-zinc-800" onClick={()=> update({ workspace: w })}>{w}</button>
                      ))}
                    </div>
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs text-zinc-400 flex items-center gap-2"><FaKey className="text-zinc-400" /> Definir novo PIN (opcional)</span>
                    <div className="flex items-center gap-2">
                      <input value={newPin} onChange={(e)=> setNewPin(e.target.value.replace(/\D/g,'').slice(0,4))} inputMode="numeric" maxLength={4} className="flex-1 rounded-lg border theme-border bg-zinc-900 text-zinc-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500" placeholder="0000" />
                      <button type="button" className="px-3 py-2 rounded-md border theme-border text-zinc-300 hover:bg-zinc-800" onClick={()=> setNewPin('')} title="Limpar"><FaSyncAlt /></button>
                    </div>
                  </label>
                </div>

                {/* Colunas autorizadas (linhas) */}
                <div>
                  <div className="text-sm text-zinc-300 mb-1">Colunas autorizadas</div>
                  <AllowedEditor all={boardCols} value={allowedIds} onChange={setAllowedIds} />
                </div>

              </div>
            )}

            <div className="flex items-center justify-end gap-2 mt-6">
              <button className="px-4 py-2 rounded-lg border theme-border text-zinc-300 hover:bg-zinc-800" onClick={close}>Cancelar</button>
              <button className="px-4 py-2 rounded-lg brand-btn text-white disabled:opacity-50" disabled={disabled} onClick={()=> setPinModal(true)}>Salvar</button>
            </div>
          </div>
        </motion.div>
      </motion.div>
      <PinModal open={pinModal} title="Confirme com seu PIN" message="Digite o PIN do admin para salvar as alterações." onClose={()=> setPinModal(false)} onConfirm={doSave} />
    </>
  );
}

function AllowedEditor({ all, value, onChange }: { all: BoardColumn[]; value: string[]; onChange: (ids: string[]) => void }) {
  const defIds = ['EM_AGUARDO','EM_PREPARO','PRONTO','EM_ROTA','COMPLETO'] as const;
  const defaultMap = new Map<string,string>([
    ['EM_AGUARDO','Em Aguardo'],
    ['EM_PREPARO','Em Preparo'],
    ['PRONTO','Pronto/Aguardando Motoboy'],
    ['EM_ROTA','Em Rota'],
    ['COMPLETO','Completo'],
  ]);
  const defaultColor = new Map<string,string>([
    ['EM_AGUARDO','border-gray-500'],
    ['EM_PREPARO','border-orange-500'],
    ['PRONTO','border-yellow-400'],
    ['EM_ROTA','border-blue-500'],
    ['COMPLETO','border-green-600'],
  ]);
  const map = all.length ? new Map(all.map(c => [String(c.id), c.label])) : defaultMap;
  const colorMap = all.length ? new Map(all.map(c => [String(c.id), c.color || ''])) : defaultColor;
  const ids = (value && value.length) ? value : defIds.filter(id => map.has(id));

  const [drag, setDrag] = React.useState<number | null>(null);
  const onDragStart = (i: number) => (e: React.DragEvent<HTMLDivElement>) => { setDrag(i); e.dataTransfer.effectAllowed = 'move'; };
  const onDragOver = (i: number) => (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };
  const onDrop = (i: number) => (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); if (drag===null || drag===i) return; const next=[...ids]; const [m]=next.splice(drag,1); next.splice(i,0,m); onChange(next); setDrag(null); };
  const removeAt = (i: number) => { const next = ids.filter((_,idx)=> idx!==i); onChange(next); };
  const avail = all.filter(c => !ids.includes(String(c.id)));
  const [toAdd, setToAdd] = React.useState<string>('');

  return (
    <div className="rounded-xl border theme-border p-3">
      <div className="rounded-md border theme-border overflow-hidden">
        {ids.length === 0 && (
          <div className="px-3 py-2 text-zinc-500 text-sm">Sem colunas ativas. Adicione abaixo.</div>
        )}
        {ids.map((id, i) => (
          <div key={`${id}-${i}`}
               draggable
               onDragStart={onDragStart(i)}
               onDragOver={onDragOver(i)}
               onDrop={onDrop(i)}
               className="flex items-center gap-3 px-3 py-2 border-b last:border-b-0 theme-border bg-zinc-900/40">
            <span className="text-zinc-500 select-none cursor-move">≡</span>
            <span className={`w-2.5 h-2.5 rounded-sm ${(colorMap.get(id) || (defaultColor.get(id) || 'border-gray-500')).replace('border-','bg-')}`}></span>
            <span className="text-sm theme-text flex-1">{map.get(id) || defaultMap.get(id) || id}</span>
            <button type="button" className="text-xs px-2 py-1 rounded border theme-border text-zinc-300 hover:bg-zinc-800" onClick={()=> removeAt(i)}>Remover</button>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 mt-3">
        <select className="rounded-md border theme-border bg-zinc-900 text-zinc-200 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                value={toAdd}
                onChange={(e)=> setToAdd(e.target.value)}>
          <option value="">Selecionar coluna…</option>
          {avail.map(c => <option key={String(c.id)} value={String(c.id)}>{c.label}</option>)}
        </select>
        <button type="button" className="px-3 py-1.5 rounded-md border theme-border text-zinc-300 hover:bg-zinc-800 disabled:opacity-50" disabled={!toAdd} onClick={()=> { if (!toAdd) return; onChange([...ids, toAdd]); setToAdd(''); }}>Adicionar</button>
        <span className="text-xs text-zinc-500 ml-auto">Arraste para reordenar</span>
      </div>
    </div>
  );
}
