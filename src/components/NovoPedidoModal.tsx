import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaTimes, FaPlus, FaUser, FaClipboardList, FaShoppingBag, FaCheck } from 'react-icons/fa';
import type { Pedido } from '@/utils/indexedDB';
import { createPedido } from '@/lib/pedidosClient';
import { playUiSound } from '@/utils/sound';
import { ICONS, type IconKey } from '@/components/food-icons';
import ClientesModal from '@/components/ClientesModal';
import NovoClienteModal from '@/components/NovoClienteModal';

type CatalogItem = {
  id: string;
  nome: string;
  preco: number;
  promo?: number;
  categoria: string;
  icon: React.ComponentType<{ className?: string }>;
  cor: string; // classes de cor tailwind (ícone)
  bg: string;  // classes de fundo do topo (2/5)
  ativo?: boolean;
  combo?: boolean;
  desc: string;
  stock: number | 'inf';
};

type ApiProduct = {
  _id?: string;
  nome: string;
  categoria: string;
  preco: number;
  promo?: number;
  promoAtiva?: boolean;
  ativo: boolean;
  combo?: boolean;
  desc: string;
  stock: number | 'inf';
  iconKey: string;
  cor: string;
  bg: string;
};

function currencyFromInput(s: string): number {
  const digits = s.replace(/\D/g, '');
  if (!digits) return 0;
  return Number(digits) / 100;
}
function currencyToInput(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

type Props = {
  onClose: () => void;
  onSaved: () => Promise<void> | void;
};

export default function NovoPedidoModal({ onClose, onSaved }: Props) {
  const [stepPin, setStepPin] = useState(false);
  const [pin, setPin] = useState(['','','','']);
  const [pinErr, setPinErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [categoria, setCategoria] = useState<'todos'|string>('todos');
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  type CatChip = { key: string; label: string };
  const [cats, setCats] = useState<CatChip[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState<boolean>(true);
  const [itens, setItens] = useState<Array<{id:string; nome:string; preco:number; quantidade:number; categoria?: string}>>([]);
  const [cliente, setCliente] = useState<{ id: string; nick: string; estrelas?: number; gasto?: number; simpatia?: number; compras?: number }>({ id:'BALC', nick:'Balcão', estrelas: 0, gasto: 0, simpatia: 0, compras: 0 });
  const [entregaTipo, setEntregaTipo] = useState<'MOTOBOY'|'RETIRADA'|'TRANSPORTADORA'|'OUTRO'>('RETIRADA');
  const [pagamento, setPagamento] = useState<'DINHEIRO'|'CARTAO'|'PIX'|'ONLINE'|'PENDENTE'>('PENDENTE');
  const [valorRecebidoInput, setValorRecebidoInput] = useState('');
  const [entregaValorInput, setEntregaValorInput] = useState('');
  const [taxaOn, setTaxaOn] = useState(false);
  const [precisaTroco, setPrecisaTroco] = useState(false);
  const [observacoes, setObservacoes] = useState('');
  const [fidelidadeOn, setFidelidadeOn] = useState(false);
  const [evento, setEvento] = useState('');
  const [toast, setToast] = useState<{ msg: string; type: 'info'|'warn'|'ok' }|null>(null);
  const [flashIds, setFlashIds] = useState<Record<string, number>>({});
  const [confirmClose, setConfirmClose] = useState(false);
  const [showClientes, setShowClientes] = useState(false);
  const [clientesLoaded, setClientesLoaded] = useState(false);
  const [showNovoCliente, setShowNovoCliente] = useState(false);
  const pinInputs = useRef<Array<HTMLInputElement|null>>([null,null,null,null]);

  const subtotal = useMemo(() => itens.reduce((a, it) => a + it.preco*it.quantidade, 0), [itens]);
  const entregaValor = useMemo(() => currencyFromInput(entregaValorInput), [entregaValorInput]);
  const total = useMemo(() => subtotal + (taxaOn && isFinite(entregaValor) ? entregaValor : 0), [subtotal, entregaValor, taxaOn]);
  const valorRecebido = useMemo(() => currencyFromInput(valorRecebidoInput), [valorRecebidoInput]);
  const troco = useMemo(() => precisaTroco ? Math.max(0, valorRecebido - total) : 0, [valorRecebido, total, precisaTroco]);
  const trocoInsuficiente = precisaTroco && valorRecebido < total;

  // Carrega catálogo real da API ao abrir o modal
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoadingCatalog(true);
      try {
        const [rp, rc] = await Promise.all([
          fetch('/api/produtos?ativo=1&cats=active&pageSize=200'),
          fetch('/api/categorias?active=1&pageSize=200'),
        ]);
        if (!rp.ok) throw new Error('erro ao buscar produtos');
        const data = await rp.json() as { items?: ApiProduct[] };
        const items = Array.isArray(data.items) ? data.items : [];
        let catMap: Record<string, string> = {};
        if (rc.ok) {
          const catsResp = await rc.json() as { items?: Array<{ key: string; label: string }> };
          const arr = Array.isArray(catsResp.items) ? catsResp.items : [];
          catMap = Object.fromEntries(arr.map(c => [c.key, c.label]));
        }
        const mapped: CatalogItem[] = items.map((p) => {
          const key = (p.iconKey || 'hamburger') as IconKey;
          const Icon = ICONS[key] || ICONS.hamburger;
          const precoBase = p.preco;
          const precoPromo = p.promoAtiva && typeof p.promo === 'number' ? p.promo : undefined;
          return {
            id: String(p._id || p.nome),
            nome: p.nome,
            categoria: p.categoria,
            preco: precoBase,
            promo: precoPromo,
            icon: Icon,
            cor: p.cor,
            bg: p.bg,
            ativo: p.ativo,
            combo: p.combo,
            desc: p.desc,
            stock: p.stock,
          };
        }).filter(it => it.ativo !== false);
        const available = mapped.filter(it => it.stock === 'inf' || (typeof it.stock === 'number' && it.stock > 0));
        if (!cancelled) {
          setCatalog(available);
          const uniqKeys = Array.from(new Set(available.map(m => m.categoria))).sort();
          const chips: CatChip[] = uniqKeys.map(key => ({ key, label: catMap[key] || key.toUpperCase() }));
          setCats(chips);
        }
      } catch {
        if (!cancelled) { setCatalog([]); setCats([]); }
      }
      if (!cancelled) setLoadingCatalog(false);
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const filteredCatalog = useMemo(() => catalog.filter(c => (categoria==='todos' ? true : c.categoria===categoria) && (c.ativo ?? true)), [catalog, categoria]);
  const stockById = useMemo(() => Object.fromEntries(catalog.map(c => [c.id, c.stock])), [catalog]);
  const usedById = useMemo(() => itens.reduce((acc, it) => { acc[it.id] = (acc[it.id]||0) + (it.quantidade||1); return acc; }, {} as Record<string, number>), [itens]);
  const remainingOf = (id: string) => {
    const s = stockById[id];
    if (s === 'inf' || typeof s !== 'number') return Infinity;
    const used = usedById[id] || 0;
    return Math.max(0, s - used);
  };

  function addItem(c: CatalogItem) {
    setItens(prev => {
      const idx = prev.findIndex(p => p.id === c.id);
      const preco = c.promo ?? c.preco;
      const rem = remainingOf(c.id);
      if (rem <= 0) {
        setToast({ msg: 'Sem estoque disponível', type: 'warn' });
        setTimeout(() => setToast(null), 1500);
        return prev; // sem estoque
      }
      if (idx >= 0) {
        const copy = [...prev];
        const nextQty = Math.min(copy[idx].quantidade + 1, (stockById[c.id]==='inf' ? Number.MAX_SAFE_INTEGER : (typeof stockById[c.id]==='number' ? stockById[c.id] as number : Number.MAX_SAFE_INTEGER)));
        copy[idx] = { ...copy[idx], quantidade: Math.max(1, nextQty) };
        return copy;
      }
      return [...prev, { id: c.id, nome: c.nome, preco, quantidade: 1, categoria: c.categoria }];
    });
    playUiSound('click');
    setFlashIds((m: Record<string, number>) => ({ ...m, [c.id]: Date.now() }));
    setTimeout(() => setFlashIds((m: Record<string, number>) => { const cp = { ...m }; delete cp[c.id]; return cp; }), 220);
    setToast({ msg: 'Item adicionado ✅', type: 'ok' });
    setTimeout(() => setToast(null), 1000);
  }
  function inc(id: string, d=1) {
    setItens(prev => prev.map(it => {
      if (it.id !== id) return it;
      const s = stockById[id];
      const max = s==='inf' || typeof s !== 'number' ? Number.MAX_SAFE_INTEGER : s;
      const next = Math.max(1, Math.min(it.quantidade + d, max));
      return { ...it, quantidade: next };
    }));
  }
  function remove(id: string) {
    setItens(prev => prev.filter(it => it.id!==id));
  }

  async function confirmarPedido() {
    setSaving(true);
    try {
      const taxaNorm = (() => {
        if (!taxaOn) return 0;
        const base = entregaValor;
        const n = isFinite(base) ? Math.max(0, base) : 0;
        const rounded = Math.round(n * 100) / 100;
        return rounded < 0.005 ? 0 : rounded;
      })();
      const fidelidadePayload = (cliente.id !== 'BALC' && fidelidadeOn && evento) ? { fidelidade: { enabled: true, evento } } : {};
      type ApiPedidoItem = { pid?: string; id?: string; nome: string; quantidade?: number; preco?: number; categoria?: string };
      type ClientePayload = { id: string; nick: string; genero?: 'M'|'F'|'O'; estrelas?: number; gasto?: number; simpatia?: number; compras?: number };
      const novo: Pedido = {
        id: Math.random().toString(36).slice(2,8).toUpperCase(),
        status: 'EM_AGUARDO',
        itens: itens.map(it => ({ pid: it.id, id: it.id, nome: it.nome, quantidade: it.quantidade, preco: it.preco, categoria: it.categoria } as ApiPedidoItem)),
        pagamento: pagamento,
        entrega: entregaTipo,
        troco: troco || 0,
        observacoes,
        ...(taxaOn && taxaNorm > 0 ? { taxaEntrega: taxaNorm } : {}),
        cliente: (() => {
          const c: ClientePayload = { id: cliente.id, nick: cliente.nick };
          if (cliente.id === 'BALC') {
            c.estrelas = 0; c.gasto = 0; c.simpatia = 0; c.compras = 0;
          } else {
            if (typeof cliente.estrelas === 'number') c.estrelas = Math.max(0, Math.min(5, cliente.estrelas));
            if (typeof cliente.gasto === 'number') c.gasto = Math.max(0, Math.min(5, cliente.gasto));
            if (typeof cliente.simpatia === 'number') c.simpatia = Math.max(0, Math.min(5, cliente.simpatia));
            const baseCompras = typeof cliente.compras === 'number' ? (cliente.compras|0) : 0;
            // Mostra já +1 no card ao criar novo pedido
            c.compras = Math.max(0, baseCompras + 1);
          }
          c.genero = 'O';
          return c;
        })(),
        ...fidelidadePayload,
      } as unknown as Pedido;
      const r = await createPedido(novo);
      if (!r.ok) {
        setToast({ msg: r.error || 'Falha ao salvar', type: 'warn' });
        setTimeout(() => setToast(null), 2000);
        return;
      }
      await onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const handleConfirmClick = React.useCallback(() => {
    if (pagamento === 'PENDENTE') {
      setToast({ msg: 'Selecione o método de pagamento antes de confirmar.', type: 'warn' });
      setTimeout(() => setToast(null), 2000);
      return;
    }
    if (trocoInsuficiente) {
      setToast({ msg: 'Valor recebido menor que o total.', type: 'warn' });
      setTimeout(() => setToast(null), 2000);
      return;
    }
    setStepPin(true);
  }, [pagamento, trocoInsuficiente]);

  function checkPinAndConfirm() {
    const pinStr = pin.join('');
    if (pinStr === '1234') {
      playUiSound('success');
      confirmarPedido();
    } else {
      playUiSound('error');
      setPinErr('PIN inválido. Verifique e tente novamente.');
      setTimeout(()=> setPinErr(''), 1200);
    }
  }

  // Atalhos: Enter confirma, Esc cancela, Ctrl+1..9 troca categoria
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (showNovoCliente || stepPin) return;
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
      if (e.key === 'Enter') { e.preventDefault(); handleConfirmClick(); }
      if ((e.ctrlKey || e.metaKey) && /^[1-9]$/.test(e.key)) {
        const idx = Number(e.key);
        const cats = ['todos','burger','bebida','pizza','hotdog','frango','sobremesa','veg'] as const;
        if (idx < cats.length) setCategoria(cats[idx]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showNovoCliente, stepPin, handleConfirmClick, onClose]);

  useEffect(() => {
    if (!stepPin) return;
    playUiSound('open');
    const t = setTimeout(() => pinInputs.current[0]?.focus(), 50);
    return () => clearTimeout(t);
  }, [stepPin]);

  return (
    <AnimatePresence>
      <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <div className="absolute inset-0 bg-black" />
        <motion.div className="relative w-full max-w-6xl max-h-[90vh] overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900" initial={{ y: 20, scale: 0.98 }} animate={{ y:0, scale:1 }}>
          {toast && (
            <div className={`absolute right-4 top-4 z-10 px-3 py-2 rounded-lg text-sm border ${toast.type==='ok' ? 'bg-emerald-600/15 text-emerald-300 border-emerald-600/40' : toast.type==='warn' ? 'bg-yellow-600/15 text-yellow-300 border-yellow-600/40' : 'bg-zinc-700/30 text-zinc-300 border-zinc-600'}`}>{toast.msg}</div>
          )}
          {/* Header */}
          <div className="px-5 py-4 border-b theme-border flex items-center justify-between">
            <div>
              <h3 className="text-white font-bold flex items-center gap-2"><FaShoppingBag className="opacity-80" /> Novo Pedido</h3>
              <p className="text-xs text-zinc-500">Simulação com catálogo e resumo</p>
            </div>
            <button onClick={() => setConfirmClose(true)} className="p-2 rounded hover:bg-zinc-800 text-zinc-300" aria-label="Fechar"><FaTimes /></button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-0">
            {/* Esquerda: Catálogo e filtros */}
            <div className="lg:col-span-2 p-4 overflow-y-auto max-h-[calc(90vh-140px)]">
              {/* Seções: Cliente / Pedido */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                {/* Cliente (com fidelidade) */}
                <div className="rounded-xl border theme-border p-3">
                  <div className="text-sm font-semibold theme-text mb-2 flex items-center gap-2"><FaUser className="opacity-80" /> Cliente</div>
                  <div className="grid grid-cols-1 gap-2 mb-2 sm:grid-cols-3">
                    <button className={`px-2.5 py-1.5 text-xs rounded border ${cliente.id==='BALC' ? 'border-emerald-600 bg-emerald-500/10 text-emerald-300' : 'border-zinc-700 text-zinc-300 hover:bg-zinc-800'}`} onClick={()=> setCliente({ id:'BALC', nick:'Balcão' })}>
                      <span className="inline-flex items-center gap-2">Balcão</span>
                    </button>
                    <button className="px-2.5 py-1.5 text-xs rounded border border-zinc-700 text-zinc-300 hover:bg-zinc-800 inline-flex items-center gap-2" onClick={()=> setShowNovoCliente(true)}>
                      <FaPlus className="opacity-80" /> Novo cliente
                    </button>
                    <button className="px-2.5 py-1.5 text-xs rounded border border-zinc-700 text-zinc-300 hover:bg-zinc-800 inline-flex items-center gap-2" onClick={async()=>{
                      try {
                        const r = await fetch('/api/clientes?page=1&pageSize=1');
                        const j = r.ok ? await r.json() : { total: 0 };
                        const has = Number(j.total || 0) > 0;
                        if (!has) {
                          setToast({ msg: 'Nenhum cliente cadastrado.', type: 'warn' });
                          setTimeout(() => setToast(null), 2000);
                          setClientesLoaded(false);
                          return;
                        }
                        setClientesLoaded(true);
                        setShowClientes(true);
                      } catch {
                        setToast({ msg: 'Falha ao carregar clientes.', type: 'warn' });
                        setTimeout(() => setToast(null), 2000);
                      }
                    }}>
                      <FaUser className="opacity-80" /> Clientes
                    </button>
                  </div>
                  <div className="text-xs text-zinc-500">Atual: <span className="text-zinc-300 font-mono">{cliente.nick} ({cliente.id})</span></div>
                  {/* Fidelidade inline */}
                  <div className="mt-3 flex items-center gap-3">
                    <div className="flex items-center gap-2 text-xs text-zinc-400">
                      <span>Ganha pontos?</span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={fidelidadeOn && cliente.id!=='BALC'}
                        onClick={()=> { if (cliente.id==='BALC') return; setFidelidadeOn(v=>!v); }}
                        className={`w-10 h-6 rounded-full border transition relative ${(fidelidadeOn && cliente.id!=='BALC') ? 'bg-emerald-600 border-emerald-500' : 'bg-zinc-700 border-zinc-600'} ${cliente.id==='BALC' ? 'opacity-50 cursor-not-allowed' : ''}`}
                        aria-label="Alternar fidelidade"
                      >
                        <span className={`absolute top-0.5 ${(fidelidadeOn && cliente.id!=='BALC') ? 'left-5' : 'left-0.5'} w-5 h-5 rounded-full bg-white transition`}></span>
                      </button>
                    </div>
                    <select className="rounded border theme-border bg-zinc-900/50 text-zinc-200 text-sm px-2 py-1.5" value={evento} onChange={e=> setEvento(e.target.value)} disabled={!fidelidadeOn || cliente.id==='BALC'}>
                      <option value="">Evento</option>
                      <option value="primeira_compra">Primeira compra</option>
                      <option value="combo">Combo</option>
                      <option value="aniversario">Aniversário</option>
                    </select>
                  </div>
                </div>
                {/* Pedido */}
                <div className="rounded-xl border theme-border p-3">
                  <div className="text-sm font-semibold theme-text mb-2 flex items-center gap-2"><FaClipboardList className="opacity-80" /> Pedido</div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-xs text-zinc-400">Entrega
                      <select className="mt-1 w-full rounded border theme-border bg-zinc-900/50 text-zinc-200 text-sm px-2 py-1.5" value={entregaTipo} onChange={(e: React.ChangeEvent<HTMLSelectElement>)=> setEntregaTipo(e.target.value as 'MOTOBOY'|'RETIRADA'|'TRANSPORTADORA'|'OUTRO')}>
                        <option value="MOTOBOY">Motoboy</option>
                        <option value="RETIRADA">Retirada</option>
                        <option value="TRANSPORTADORA">Transportadora</option>
                        <option value="OUTRO">Outro</option>
                      </select>
                    </label>
                  <label className="text-xs text-zinc-400">Pagamento
                      <select
                        className="mt-1 w-full rounded border theme-border bg-zinc-900/50 text-zinc-200 text-sm px-2 py-1.5"
                        value={pagamento}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                          setPagamento(e.target.value as 'DINHEIRO'|'CARTAO'|'PIX'|'ONLINE'|'PENDENTE')
                        }
                      >
                        <option value="PENDENTE">PENDENTE</option>
                        <option value="DINHEIRO">DINHEIRO</option>
                        <option value="CARTAO">CARTÃO</option>
                        <option value="PIX">PIX</option>
                        <option value="ONLINE">ONLINE</option>
                      </select>
                    </label>
                  <label className="text-xs text-zinc-400 col-span-2">Valor recebido (se dinheiro)
                      <input className="mt-1 w-full rounded border theme-border bg-zinc-900/50 text-zinc-200 text-sm px-2 py-1.5" placeholder="R$ 0,00" value={valorRecebidoInput} onChange={(e)=> {
                        const v = currencyFromInput(e.target.value);
                        setValorRecebidoInput(v ? v.toLocaleString('pt-BR', { style:'currency', currency:'BRL' }) : '');
                      }} />
                  </label>
                  <div className="col-span-2 grid grid-cols-3 gap-2 items-end">
                    <label className="text-xs text-zinc-400 col-span-1">Cobrar taxa?
                      <button
                        type="button"
                        aria-label="Alternar taxa de entrega"
                        aria-checked={taxaOn}
                        role="switch"
                        onClick={() => setTaxaOn(v=>!v)}
                        className={`mt-1 w-12 h-7 rounded-full border transition relative ${taxaOn ? 'bg-emerald-600 border-emerald-500' : 'bg-zinc-700 border-zinc-600'}`}
                      >
                        <span className={`absolute top-0.5 ${taxaOn ? 'left-6' : 'left-0.5'} w-6 h-6 rounded-full bg-white transition`} />
                      </button>
                    </label>
                    <label className="text-xs text-zinc-400 col-span-2">Taxa de entrega
                      <input
                        className="mt-1 w-full rounded border theme-border bg-zinc-900/50 text-zinc-200 text-sm px-2 py-1.5 disabled:opacity-50"
                        placeholder="R$ 0,00"
                        value={entregaValorInput}
                        onChange={(e)=> {
                          const v = currencyFromInput(e.target.value);
                          setEntregaValorInput(v ? v.toLocaleString('pt-BR', { style:'currency', currency:'BRL' }) : '');
                        }}
                        disabled={!taxaOn}
                      />
                    </label>
                  </div>
                    <div className="col-span-2 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs text-zinc-400">
                        <span>Precisa de troco?</span>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={precisaTroco}
                          onClick={()=> setPrecisaTroco(v=>!v)}
                          className={`w-10 h-6 rounded-full border transition relative ${precisaTroco ? 'bg-emerald-600 border-emerald-500' : 'bg-zinc-700 border-zinc-600'}`}
                          aria-label="Alternar troco"
                        >
                          <span className={`absolute top-0.5 ${precisaTroco ? 'left-5' : 'left-0.5'} w-5 h-5 rounded-full bg-white transition`}></span>
                        </button>
                      </div>
                      <div className={`text-xs ${trocoInsuficiente ? 'text-red-400' : 'text-zinc-400'}`}>
                        {trocoInsuficiente ? (
                          <>
                            Saldo: <span className="font-mono">-{currencyToInput(total - valorRecebido)}</span>
                          </>
                        ) : (
                          <>Troco: <span className="font-mono text-zinc-200">{currencyToInput(troco)}</span></>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Filtros de categoria (dinâmicos, apenas onde há itens disponíveis) */}
              <div className="flex flex-wrap gap-2 mb-3">
                <button className={`px-3 py-1.5 text-xs rounded-full border ${categoria==='todos' ? 'border-orange-600 bg-orange-500/15 text-orange-300' : 'border-zinc-700 text-zinc-300 hover:bg-zinc-800'}`} onClick={()=> setCategoria('todos')}>
                  TODOS
                </button>
                {cats.map(cat => (
                  <button key={cat.key} className={`px-3 py-1.5 text-xs rounded-full border ${categoria===cat.key ? 'border-orange-600 bg-orange-500/15 text-orange-300' : 'border-zinc-700 text-zinc-300 hover:bg-zinc-800'}`} onClick={()=> setCategoria(cat.key)}>
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Grid de itens */}
              {loadingCatalog ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-3">
                  {Array.from({ length: 6 }).map((_,i) => (
                    <div key={i} className="animate-pulse rounded-xl border theme-border overflow-hidden">
                      <div className="aspect-video bg-zinc-800/40" />
                      <div className="p-3 space-y-2">
                        <div className="h-4 bg-zinc-800 rounded w-2/3" />
                        <div className="h-3 bg-zinc-800 rounded w-1/2" />
                        <div className="h-5 bg-zinc-800 rounded w-1/3" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-3">
                {filteredCatalog.map(c => {
                  const Icon = c.icon;
                  const isInf = c.stock === 'inf';
                  return (
                    <button
                      key={c.id}
                      onMouseEnter={()=> playUiSound('hover')}
                      onClick={()=> addItem(c)}
                      className={`relative flex flex-col aspect-square rounded-xl border overflow-hidden text-left transition group ${flashIds[c.id] ? 'border-emerald-500 bg-emerald-600/10' : 'theme-border hover:bg-zinc-800/20'}`}
                    >
                      {/* Topo: ícone ocupando 2/5 da altura */}
                      <div className={`relative flex items-center justify-center basis-[40%] ${c.bg || 'bg-zinc-800/40'}`}>
                        <div className="absolute top-2 left-2 z-0 text-[10px] px-1.5 py-0.5 rounded-full border border-zinc-600 bg-zinc-900/70 text-zinc-300">
                          {isInf ? '∞' : c.stock ?? '—'}
                        </div>
                        <Icon className={`${c.cor} w-16 h-16 sm:w-20 sm:h-20 opacity-90`} />
                      </div>
                      {/* Base: conteúdo (3/5) */}
                      <div className="flex-1 p-3 pb-10 flex flex-col relative">
                        <div className="flex items-center justify-between mb-1">
                          <div className="font-semibold text-zinc-100 leading-tight truncate">{c.nome}</div>
                          <div className="flex items-center gap-1">
                            {c.combo && <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-yellow-500 text-yellow-400">COMBO</span>}
                            {c.promo && <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-rose-500 text-rose-400">PROMO</span>}
                          </div>
                        </div>
                        <div className="text-[11px] text-zinc-300/90 line-clamp-2">{c.desc}</div>
                        {/* Preço fixo no canto inferior direito */}
                        <div className="absolute bottom-3 right-3 text-sm text-right">
                          {c.promo ? (
                            <>
                              <span className="text-rose-400 font-bold mr-2">{currencyToInput(c.promo)}</span>
                              <span className="text-zinc-400 line-through text-xs">{currencyToInput(c.preco)}</span>
                            </>
                          ) : (
                            <span className="text-zinc-100 font-bold">{currencyToInput(c.preco)}</span>
                          )}
                        </div>
                        {/* CTA de adicionar no canto inferior esquerdo (aparece no hover) */}
                        <div className="absolute bottom-3 left-3 text-xs text-zinc-300/80 opacity-0 group-hover:opacity-100 transition">Adicionar</div>
                      </div>
                    </button>
                  );
                })}
              </div>
              )}
            </div>

            {/* Direita: Resumo */}
            <div className="border-l theme-border p-4 flex flex-col">
              <div className="text-sm font-semibold theme-text mb-2 flex items-center gap-2"><FaClipboardList className="opacity-80" /> Resumo</div>
              {trocoInsuficiente && (
                <div className="mb-2 px-3 py-2 rounded-lg border border-red-600/50 bg-red-500/10 text-red-300 text-xs">
                  Saldo negativo: <span className="font-mono">-{currencyToInput(total - valorRecebido)}</span>
                </div>
              )}
              <div className="flex-1 overflow-y-auto pr-1">
                {itens.length === 0 ? (
                  <div className="text-xs text-zinc-500">Nenhum item. Selecione no catálogo.</div>
                ) : (
                  itens.map(it => (
                    <div key={it.id} className="flex items-center justify-between py-2 border-b border-zinc-800/60">
                      <div>
                        <div className="text-zinc-200 text-sm font-medium">{it.nome}</div>
                        <div className="text-xs text-zinc-500">{currencyToInput(it.preco)} × {it.quantidade}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button className="w-7 h-7 rounded-md border theme-border text-zinc-200 hover:bg-zinc-800" onClick={()=> inc(it.id, -1)} aria-label="Diminuir">−</button>
                        <span className="min-w-6 text-center text-zinc-200 text-sm font-mono">{it.quantidade}</span>
                        <button className="w-7 h-7 rounded-md border theme-border text-zinc-200 hover:bg-zinc-800" onClick={()=> inc(it.id, +1)} aria-label="Aumentar">+</button>
                        <div className="w-16 text-right font-mono text-zinc-200 text-sm">{currencyToInput(it.preco * it.quantidade)}</div>
                        <button className="w-7 h-7 rounded-md border border-red-600 text-red-400 hover:bg-red-600/10" onClick={()=> remove(it.id)} title="Remover">×</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="mt-3 space-y-1 text-sm">
                <div className="flex items-center justify-between text-zinc-400"><span>Subtotal</span><span className="font-mono text-zinc-300">{currencyToInput(subtotal)}</span></div>
                <div className="flex items-center justify-between text-zinc-400"><span>Entrega</span><span className="font-mono text-zinc-300">{taxaOn ? currencyToInput(entregaValor) : currencyToInput(0)}</span></div>
                <div className="flex items-center justify-between text-zinc-400"><span>Total</span><span className="font-mono text-zinc-100">{currencyToInput(total)}</span></div>
                {precisaTroco && (
                  <div className="flex items-center justify-between text-zinc-400"><span>Recebido</span><span className="font-mono text-zinc-300">{currencyToInput(valorRecebido)}</span></div>
                )}
                {precisaTroco && (
                  trocoInsuficiente ? (
                    <div className="flex items-center justify-between text-red-400"><span>Saldo</span><span className="font-mono">-{currencyToInput(total - valorRecebido)}</span></div>
                  ) : (
                    <div className="flex items-center justify-between text-zinc-400"><span>Troco</span><span className="font-mono text-emerald-300">{currencyToInput(troco)}</span></div>
                  )
                )}
              </div>
              <div className="mt-3">
                <label className="text-xs text-zinc-400">Observações
                  <textarea className="mt-1 w-full rounded border theme-border bg-zinc-900/50 text-zinc-200 text-sm px-2 py-1.5" rows={2} value={observacoes} onChange={e=> setObservacoes(e.target.value)} />
                </label>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <button className="px-3 py-2 rounded border theme-border text-zinc-300 flex items-center gap-2" onClick={onClose}><FaTimes /> Cancelar</button>
                <button
                  className="flex-1 px-3 py-2 rounded brand-btn text-white disabled:opacity-50 flex items-center justify-center gap-2"
                  disabled={saving || itens.length===0 || trocoInsuficiente}
                  title={trocoInsuficiente ? 'Saldo negativo. Ajuste o valor recebido.' : undefined}
                  onClick={handleConfirmClick}
                >
                  {saving ? 'Salvando...' : (<><FaCheck /> Confirmar Pedido</>)}
                </button>
              </div>
            </div>
          </div>

          {/* Lista de Clientes (real) */}
          <ClientesModal open={showClientes && clientesLoaded} onClose={()=> setShowClientes(false)} onSelect={(c)=> { setCliente({ id: c.id, nick: c.nick, estrelas: c.estrelas, gasto: c.gasto, simpatia: c.simpatia, compras: c.compras }); setShowClientes(false); }} />
          <NovoClienteModal open={showNovoCliente} onClose={()=> setShowNovoCliente(false)} onCreated={(c)=> { setCliente({ id: c.uuid, nick: c.nick, estrelas: 0, gasto: 0, simpatia: 0, compras: 0 }); setShowNovoCliente(false); }} />

          {/* Step PIN */}
          {stepPin && (
            <div className="absolute inset-0 bg-black z-50 flex items-center justify-center p-4">
              <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5 w-full max-w-sm">
                <div className="text-sm font-semibold theme-text mb-1">Confirmar com PIN</div>
                <div className="text-xs text-zinc-500 mb-3">Digite seu PIN de 4 dígitos para confirmar o pedido.</div>
                <div className="flex items-center justify-center gap-3 mb-3">
                  {pin.map((d, idx) => (
                    <input
                      key={idx}
                      ref={(el)=> { pinInputs.current[idx] = el; }}
                      type="password"
                      aria-label={`Dígito ${idx+1} do PIN`}
                      maxLength={1}
                      inputMode="numeric"
                      value={d}
                      onKeyDown={(e)=>{
                        if (e.key === 'Backspace' && !pin[idx] && idx>0) {
                          pinInputs.current[idx-1]?.focus();
                        }
                        if (e.key === 'Enter') checkPinAndConfirm();
                      }}
                      onChange={(e)=>{
                        const v = e.target.value.replace(/\D/g,'').slice(0,1);
                        const arr = [...pin]; arr[idx] = v; setPin(arr);
                        if (v && idx < 3) pinInputs.current[idx+1]?.focus();
                      }}
                      className="w-12 h-12 text-2xl text-center rounded-lg border theme-border bg-zinc-800/60 text-white"
                    />
                  ))}
                </div>
                {pinErr && <div className="text-center text-red-400 text-sm mb-2">{pinErr}</div>}
                <div className="flex items-center justify-end gap-2">
                  <button className="px-3 py-1.5 rounded border theme-border text-zinc-300" onClick={()=> setStepPin(false)}>Voltar</button>
                  <button className="px-3 py-1.5 rounded brand-btn text-white" onClick={checkPinAndConfirm}>Confirmar</button>
                </div>
              </div>
            </div>
          )}

          {/* Confirmar fechamento */}
          {confirmClose && (
            <div className="absolute inset-0 bg-black z-50 flex items-center justify-center p-4">
              <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5 w-full max-w-sm">
                <div className="text-sm font-semibold theme-text mb-2">Deseja fechar o pedido?</div>
                <p className="text-xs text-zinc-500 mb-3">Itens não salvos serão perdidos.</p>
                <div className="flex items-center justify-end gap-2">
                  <button className="px-3 py-1.5 rounded border theme-border text-zinc-300" onClick={()=> setConfirmClose(false)}>Voltar</button>
                  <button className="px-3 py-1.5 rounded bg-red-600 text-white" onClick={onClose}>Fechar</button>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
