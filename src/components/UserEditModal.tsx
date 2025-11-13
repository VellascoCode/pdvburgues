import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FaUserEdit, FaUserTag, FaTransgender, FaBriefcase, FaMapMarkerAlt, FaToggleOn, FaShieldAlt, FaKey } from 'react-icons/fa';
// Avatar removido
import PinModal from '@/components/PinModal';
import { playUiSound } from '@/utils/sound';
import { useSession } from 'next-auth/react';

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

function NewPinModal({ open, pin, onClose, onConfirm }: { open: boolean; pin?: string; onClose: () => void; onConfirm: (pin: string) => void }) {
  const [value, setValue] = React.useState<string>(pin || '');
  React.useEffect(() => { if (open) setValue(pin || ''); }, [open, pin]);
  const valid = /^\d{4}$/.test(value);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-80 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/80" onClick={onClose} />
          <motion.div className="relative w-full max-w-sm rounded-2xl border theme-border theme-surface bg-zinc-900 p-4 shadow-2xl" initial={{ y: 24, scale: 0.98 }} animate={{ y: 0, scale: 1 }} exit={{ y: 24, scale: 0.98 }}>
            <div className="text-white font-semibold mb-2">Definir novo PIN</div>
            <div className="text-sm text-zinc-400 mb-3">Informe um PIN de 4 dígitos.</div>
            <input
              value={value}
              onChange={(e)=> setValue(e.target.value.replace(/\D/g,'').slice(0,4))}
              inputMode="numeric"
              maxLength={4}
              placeholder="0000"
              className="w-full rounded-lg border theme-border bg-zinc-900 text-zinc-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
            <div className="flex items-center justify-end gap-2 mt-4">
              <button className="px-3 py-2 rounded-lg border theme-border text-zinc-300 hover:bg-zinc-800" onClick={onClose}>Cancelar</button>
              <button className="px-3 py-2 rounded-lg brand-btn text-white disabled:opacity-50" disabled={!valid} onClick={()=> onConfirm(value)}>Confirmar</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Content({ access, onClose, onSaved }: { access: string; onClose: () => void; onSaved: () => void }) {
  const [loading, setLoading] = React.useState<boolean>(true);
  const [data, setData] = React.useState<UserDoc | null>(null);
  const [newPin, setNewPin] = React.useState<string>('');
  const [pinModal, setPinModal] = React.useState<boolean>(false);
  const [newPinOpen, setNewPinOpen] = React.useState<boolean>(false);
  const [boardCols, setBoardCols] = React.useState<BoardColumn[]>([]);
  const [allowedIds, setAllowedIds] = React.useState<string[]>([]);
  const { data: sess } = useSession();
  const adminAccess = (sess as unknown as { user?: { access?: string } } | null)?.user?.access;
  const [allowTyping, setAllowTyping] = React.useState<boolean>(false);
  const [wsName, setWsName] = React.useState<string>('ws');
  const [roleName, setRoleName] = React.useState<string>('role');

  React.useEffect(() => {
    playUiSound('open');
    let mounted = true;
    // pequena janela anti-autofill: libera digitação após breve atraso
    const t = setTimeout(() => { if (mounted) setAllowTyping(true); }, 700);
    // ids/names únicos (fora do render para evitar regra de pureza)
    const token = () => `${Date.now().toString(36)}${Math.floor(Math.random()*1e6).toString(36)}`;
    setWsName(`ws-${token()}`);
    setRoleName(`role-${token()}`);
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
        const isEmail = (v?: string) => !!v && /[^@\s]+@[^@\s]+\.[^@\s]+/.test(v);
        const sanitized: UserDoc = { ...doc, workspace: isEmail(doc.workspace) ? undefined : doc.workspace };
        setData(sanitized);
        const cols = (Array.isArray(doc.board?.columns) && doc.board!.columns.length) ? doc.board!.columns : DEFAULT_COLS;
        setBoardCols(cols);
        const defIds = ['EM_AGUARDO','EM_PREPARO','PRONTO','EM_ROTA','COMPLETO'];
        const initialAllowed = Array.isArray(doc.allowedColumns) && doc.allowedColumns.length ? doc.allowedColumns : defIds.filter(id => cols.some(c => String(c.id) === id));
        setAllowedIds(initialAllowed);
        setLoading(false);
      })
      .catch(() => { if (!mounted) return; setLoading(false); });
    return () => { mounted = false; clearTimeout(t); };
  }, [access]);

  const close = () => { playUiSound('close'); onClose(); };
  const update = (patch: Partial<UserDoc>) => setData(d => d ? { ...d, ...patch } : d);
  const disabled = !data || !data.nome.trim() || (newPin !== '' && !/^\d{4}$/.test(newPin));

  const roleSuggestions = ['Atendente', 'Caixa', 'Cozinha', 'Chapeiro', 'Expedição', 'Gerente'] as const;
  const workspaceSuggestions = ['atendimento', 'caixa', 'cozinha', 'expedição', 'entregas'] as const;

  const doSave = async (adminPin: string): Promise<boolean> => {
    if (!data) return false;
    const w = (data.workspace || '').trim();
    const emailRx = /[^@\s]+@[^@\s]+\.[^@\s]+/;
    const payload: Partial<UserDoc> & { pin: string; newPin?: string; allowedColumns: string[]; board: { columns: Array<{ id: string; label: string; builtIn?: boolean }> } } = {
      nome: data.nome.trim(),
      nick: (data.nick || '').trim() || undefined,
      genero: data.genero,
      type: data.type,
      status: data.status,
      funcao: (data.funcao || '').trim() || undefined,
      workspace: (emailRx.test(w) ? '' : w) || undefined,
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
          <form className="p-6" autoComplete="off" onSubmit={(e)=> { e.preventDefault(); e.stopPropagation(); }}>
            {/* honeypot para capturar autofill de email/senha */}
            <div aria-hidden className="hidden">
              <input type="email" name="email" autoComplete="email" tabIndex={-1} />
              <input type="password" name="password" autoComplete="current-password" tabIndex={-1} />
            </div>
            {loading ? (
              <div className="text-zinc-400">Carregando…</div>
            ) : !data ? (
              <div className="text-rose-400">Usuário não encontrado.</div>
            ) : (
              <div className="grid grid-cols-1 gap-6">
                {/* Linha 1: Nome | Nick | Novo PIN */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs text-zinc-400">Nome</span>
                    <input value={data.nome} onChange={(e)=> update({ nome: e.target.value })} autoComplete="off" autoCorrect="off" spellCheck={false} autoCapitalize="none" name="user-name" className="rounded-lg border theme-border bg-zinc-900 text-zinc-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500" />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs text-zinc-400 flex items-center gap-2"><FaUserTag className="text-zinc-400" /> Nick</span>
                    <input value={data.nick || ''} onChange={(e)=> update({ nick: e.target.value })} autoComplete="off" autoCorrect="off" spellCheck={false} autoCapitalize="none" name="user-nick" className="rounded-lg border theme-border bg-zinc-900 text-zinc-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500" />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs text-zinc-400 flex items-center gap-2"><FaKey className="text-zinc-400" /> Novo PIN (opcional)</span>
                    <button type="button" className="px-3 py-2 rounded-md border theme-border text-zinc-300 hover:bg-zinc-800 text-left" onClick={()=> setNewPinOpen(true)}>
                      {newPin ? 'PIN definido (oculto) – tocar para alterar' : 'Definir novo PIN'}
                    </button>
                  </label>
                </div>

                {/* Linha 2: Gênero | Tipo | Status */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
                    <select id="user-type" name="user-type" value={data.type} onChange={(e)=> update({ type: Number(e.target.value) })} className="rounded-lg border theme-border bg-zinc-900 text-zinc-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500">
                      <option value={1}>Operador (1)</option>
                      <option value={5}>Gerente (5)</option>
                      <option value={10}>Admin Master (10)</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs text-zinc-400 flex items-center gap-2"><FaToggleOn className="text-zinc-400" /> Status</span>
                    <div className="flex items-center gap-2">
                      <button className={`text-xs px-2 py-1 rounded-md border ${data.status===1?'bg-orange-500/15 border-orange-600 text-orange-300':'theme-border text-zinc-300 hover:bg-zinc-800'}`} onClick={()=> update({ status: 1 })}>Ativo</button>
                      <button className={`text-xs px-2 py-1 rounded-md border ${data.status===2?'bg-rose-500/15 border-rose-600 text-rose-300':'theme-border text-zinc-300 hover:bg-zinc-800'} disabled:opacity-50`} disabled={Boolean(adminAccess && data.access === adminAccess)} title={adminAccess && data.access === adminAccess ? 'Admin não pode se suspender' : undefined} onClick={()=> update({ status: 2 })}>Suspenso</button>
                      {data.status===0 && <span className="text-[11px] text-zinc-500">Atual: Novo</span>}
                    </div>
                  </div>
                </div>

                {/* Linha 3: Função | Espaço de trabalho */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs text-zinc-400 flex items-center gap-2"><FaBriefcase className="text-zinc-400" /> Função</span>
                    <input value={data.funcao || ''} onChange={(e)=> update({ funcao: e.target.value })} autoComplete="off" autoCorrect="off" spellCheck={false} autoCapitalize="none" name={roleName} className="rounded-lg border theme-border bg-zinc-900 text-zinc-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500" placeholder="Ex: Caixa, Cozinha, Gerente" />
                    <div className="flex flex-wrap gap-2 mt-1">
                      {roleSuggestions.map(r => (
                        <button type="button" key={r} className="text-[11px] px-2 py-1 rounded-md border theme-border text-zinc-300 hover:bg-zinc-800" onClick={()=> update({ funcao: r })}>{r}</button>
                      ))}
                    </div>
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs text-zinc-400 flex items-center gap-2"><FaMapMarkerAlt className="text-zinc-400" /> Espaço de trabalho</span>
                    <input key={wsName} value={data.workspace || ''} onChange={(e)=> update({ workspace: e.target.value })} onFocus={()=> setAllowTyping(true)} readOnly={!allowTyping} autoComplete={`section-${wsName} off`} autoCorrect="off" spellCheck={false} autoCapitalize="none" name={wsName} id={wsName} data-lpignore="true" data-form-type="other" className="rounded-lg border theme-border bg-zinc-900 text-zinc-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500" placeholder="Ex: cozinha, caixa, atendimento, expedição" />
                    <div className="flex flex-wrap gap-2 mt-1">
                      {workspaceSuggestions.map(w => (
                        <button type="button" key={w} className="text-[11px] px-2 py-1 rounded-md border theme-border text-zinc-300 hover:bg-zinc-800" onClick={()=> update({ workspace: w })}>{w}</button>
                      ))}
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
              <button type="button" className="px-4 py-2 rounded-lg border theme-border text-zinc-300 hover:bg-zinc-800" onClick={close}>Cancelar</button>
              <button type="button" className="px-4 py-2 rounded-lg brand-btn text-white disabled:opacity-50" disabled={disabled} onClick={()=> setPinModal(true)}>Salvar</button>
            </div>
          </form>
        </motion.div>
      </motion.div>
      <PinModal open={pinModal} title="Confirme com seu PIN" message="Digite o PIN do admin para salvar as alterações." onClose={()=> setPinModal(false)} onConfirm={doSave} />
      <NewPinModal open={newPinOpen} pin={newPin} onClose={()=> setNewPinOpen(false)} onConfirm={(p)=> { setNewPin(p); setNewPinOpen(false); }} />
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
  const onDragOver = () => (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };
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
               onDragOver={onDragOver()}
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
        <select name="allowed-add" id="allowed-add" className="rounded-md border theme-border bg-zinc-900 text-zinc-200 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
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
