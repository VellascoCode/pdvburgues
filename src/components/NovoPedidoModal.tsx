import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaTimes, FaPlus, FaUser, FaClipboardList, FaShoppingBag, FaCheck, FaSearch, FaMoneyBillWave, FaCreditCard, FaQrcode, FaGlobe, FaUtensils } from 'react-icons/fa';
import type { Pedido } from '@/utils/indexedDB';
import { createPedido } from '@/lib/pedidosClient';
import { playUiSound } from '@/utils/sound';
import { ICONS, type IconKey } from '@/components/food-icons';
import ClientesModal from '@/components/ClientesModal';
import NovoClienteModal from '@/components/NovoClienteModal';
import { generatePedidoId } from '@/utils/pedidoId';
import type { PrepTag } from '@/constants/prepTags';
import { DEFAULT_PREP_TAG, getPrepTagMeta, getDefaultPrepItems } from '@/constants/prepTags';
import type { ProductPrepItem } from '@/types/product';
import { formatCurrency, parseCurrencyInput } from '@/utils/currency';
import PinModal from '@/components/PinModal';

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
  prepTag: PrepTag;
  prepItems: ProductPrepItem[];
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
  prepTag?: PrepTag;
  prepItems?: ProductPrepItem[];
};

type ClienteLight = {
  id: string;
  nick: string;
  nome?: string;
  estrelas?: number;
  gasto?: number;
  simpatia?: number;
  compras?: number;
};

type ApiCliente = {
  uuid?: string;
  id?: string;
  nick?: string;
  nome?: string;
  estrelas?: number;
  gasto?: number;
  simpatia?: number;
  compras?: number;
};

const PAGAMENTO_METODOS: Array<{ key: 'DINHEIRO'|'CARTAO'|'PIX'|'ONLINE'; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { key: 'DINHEIRO', label: 'Dinheiro', icon: FaMoneyBillWave },
  { key: 'CARTAO', label: 'Cartão', icon: FaCreditCard },
  { key: 'PIX', label: 'PIX', icon: FaQrcode },
  { key: 'ONLINE', label: 'Online', icon: FaGlobe },
];

type Props = {
  onClose: () => void;
  onSaved: () => Promise<void> | void;
  existingIds?: string[];
};

export default function NovoPedidoModal({ onClose, onSaved, existingIds = [] }: Props) {
  const [saving, setSaving] = useState(false);
  const [categoria, setCategoria] = useState<'todos'|string>('todos');
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  type CatChip = { key: string; label: string };
  const [cats, setCats] = useState<CatChip[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState<boolean>(true);
  const [itens, setItens] = useState<Array<{id:string; nome:string; preco:number; quantidade:number; categoria?: string; prepItems?: ProductPrepItem[]; prepTag?: PrepTag }>>([]);
  const [cliente, setCliente] = useState<{ id: string; nick: string; estrelas?: number; gasto?: number; simpatia?: number; compras?: number }>({ id:'BALC', nick:'Balcão', estrelas: 0, gasto: 0, simpatia: 0, compras: 0 });
  const [clienteQuery, setClienteQuery] = useState('');
  const [clienteSuggestions, setClienteSuggestions] = useState<ClienteLight[]>([]);
  const [clienteSuggestionsOpen, setClienteSuggestionsOpen] = useState(false);
  const [clienteSuggestionsLoading, setClienteSuggestionsLoading] = useState(false);
  const [entregaTipo, setEntregaTipo] = useState<'MOTOBOY'|'RETIRADA'|'TRANSPORTADORA'|'OUTRO'>('RETIRADA');
  const [pagamentoStatus, setPagamentoStatus] = useState<'PENDENTE'|'PAGO'>('PENDENTE');
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
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const clienteSearchRef = useRef<HTMLDivElement | null>(null);
  const pedidoIdRef = useRef('');
  if (!pedidoIdRef.current) {
    pedidoIdRef.current = generatePedidoId(existingIds);
  }

  const subtotal = useMemo(() => itens.reduce((a, it) => a + it.preco*it.quantidade, 0), [itens]);
  const entregaValor = useMemo(() => parseCurrencyInput(entregaValorInput), [entregaValorInput]);
  const total = useMemo(() => subtotal + (taxaOn && isFinite(entregaValor) ? entregaValor : 0), [subtotal, entregaValor, taxaOn]);
  const valorRecebido = useMemo(() => parseCurrencyInput(valorRecebidoInput), [valorRecebidoInput]);
  const showTroco = pagamentoStatus === 'PAGO' && pagamento === 'DINHEIRO';
  const troco = useMemo(() => (showTroco && precisaTroco) ? Math.max(0, valorRecebido - total) : 0, [showTroco, precisaTroco, valorRecebido, total]);
  const trocoInsuficiente = showTroco && precisaTroco && valorRecebido < total;

  // Carrega catálogo real da API ao abrir o modal
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoadingCatalog(true);
      try {
        const [rp, rc] = await Promise.all([
          fetch('/api/produtos?ativo=1&pageSize=200'),
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
          const prepTag = (p.prepTag as PrepTag) || DEFAULT_PREP_TAG;
          const prepItems =
            Array.isArray(p.prepItems) && p.prepItems.length
              ? p.prepItems
              : getDefaultPrepItems(prepTag);
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
            prepTag,
            prepItems,
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

  useEffect(() => {
    const term = clienteQuery.trim();
    if (term.length < 2) {
      setClienteSuggestions([]);
      setClienteSuggestionsOpen(false);
      setClienteSuggestionsLoading(false);
      return;
    }
    setClienteSuggestionsLoading(true);
    setClienteSuggestionsOpen(true);
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const r = await fetch(`/api/clientes?q=${encodeURIComponent(term)}&pageSize=5`, { signal: controller.signal });
        const j = r.ok ? await r.json() : { items: [] };
        const rawItems: ApiCliente[] = Array.isArray(j.items) ? j.items as ApiCliente[] : [];
        const mapped: ClienteLight[] = rawItems.map((c) => ({
          id: c.uuid || c.id || '',
          nick: c.nick || c.nome || 'Cliente',
          nome: c.nome,
          estrelas: c.estrelas,
          gasto: c.gasto,
          simpatia: c.simpatia,
          compras: c.compras,
        })).filter((c) => Boolean(c.id));
        if (!controller.signal.aborted) {
          setClienteSuggestions(mapped);
        }
      } catch {
        if (!controller.signal.aborted) setClienteSuggestions([]);
      } finally {
        if (!controller.signal.aborted) setClienteSuggestionsLoading(false);
      }
    }, 240);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [clienteQuery]);

  useEffect(() => {
    if (!clienteSuggestionsOpen) return;
    const handleClick = (event: MouseEvent) => {
      if (!clienteSearchRef.current) return;
      if (!clienteSearchRef.current.contains(event.target as Node)) {
        setClienteSuggestionsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [clienteSuggestionsOpen]);

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
      return [
        ...prev,
        {
          id: c.id,
          nome: c.nome,
          preco,
          quantidade: 1,
          categoria: c.categoria,
          prepItems: c.prepItems,
          prepTag: c.prepTag,
        },
      ];
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

  const handleClienteSelect = React.useCallback((data: ClienteLight) => {
    setCliente({
      id: data.id,
      nick: data.nick,
      estrelas: data.estrelas,
      gasto: data.gasto,
      simpatia: data.simpatia,
      compras: data.compras,
    });
    setClienteQuery('');
    setClienteSuggestions([]);
    setClienteSuggestionsOpen(false);
    setFidelidadeOn(false);
    setEvento('');
  }, []);

  useEffect(() => {
    if (pagamentoStatus === 'PENDENTE') {
      setPagamento((prev) => (prev === 'PENDENTE' ? prev : 'PENDENTE'));
      setPrecisaTroco(false);
      setValorRecebidoInput('');
    } else {
      setPagamento((prev) => (prev === 'PENDENTE' ? 'DINHEIRO' : prev));
    }
  }, [pagamentoStatus]);

  useEffect(() => {
    if (pagamento !== 'DINHEIRO') {
      if (precisaTroco) setPrecisaTroco(false);
      if (valorRecebidoInput) setValorRecebidoInput('');
    }
  }, [pagamento, precisaTroco, valorRecebidoInput]);

  async function confirmarPedido(): Promise<boolean> {
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
      const pagamentoPayload = pagamentoStatus === 'PENDENTE' ? 'PENDENTE' : pagamento;
      const novo: Pedido = {
        id: pedidoIdRef.current,
        status: 'EM_AGUARDO',
        itens: itens.map(it => ({ pid: it.id, id: it.id, nome: it.nome, quantidade: it.quantidade, preco: it.preco, categoria: it.categoria } as ApiPedidoItem)),
        pagamento: pagamentoPayload,
        pagamentoStatus,
        entrega: entregaTipo,
        troco: showTroco ? troco : 0,
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
        return false;
      }
      await onSaved();
      onClose();
      return true;
    } finally {
      setSaving(false);
    }
  }

  const handleConfirmClick = React.useCallback(() => {
    if (pagamentoStatus === 'PAGO' && pagamento === 'PENDENTE') {
      setToast({ msg: 'Defina o método de pagamento antes de confirmar.', type: 'warn' });
      setTimeout(() => setToast(null), 2000);
      return;
    }
    if (pagamentoStatus === 'PAGO' && trocoInsuficiente) {
      setToast({ msg: 'Valor recebido menor que o total.', type: 'warn' });
      setTimeout(() => setToast(null), 2000);
      return;
    }
    setPinModalOpen(true);
  }, [pagamentoStatus, pagamento, trocoInsuficiente]);

  // Atalhos: Enter confirma, Esc cancela, Ctrl+1..9 troca categoria
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (showNovoCliente || pinModalOpen) return;
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
  }, [showNovoCliente, pinModalOpen, handleConfirmClick, onClose]);

  return (
    <AnimatePresence>
      <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />
        <motion.div className="relative w-full max-w-6xl h-[min(90vh,900px)] flex flex-col overflow-hidden ds-modal" initial={{ y: 20, scale: 0.98 }} animate={{ y:0, scale:1 }}>
          {toast && (
            <div className={`absolute right-4 top-4 z-10 px-3 py-2 rounded-lg text-sm border ${toast.type==='ok' ? 'bg-emerald-600/15 text-emerald-300 border-emerald-600/40' : toast.type==='warn' ? 'bg-yellow-600/15 text-yellow-300 border-yellow-600/40' : 'bg-zinc-700/30 text-zinc-300 border-zinc-600'}`}>{toast.msg}</div>
          )}
          {/* Header */}
          <div className="ds-modal-header flex items-center justify-between px-6 py-4 border-b">
            <div>
              <h3 className="theme-text font-bold flex items-center gap-2 text-lg"><FaShoppingBag className="opacity-80" /> Novo Pedido</h3>
              <p className="text-xs text-zinc-500">Simulação com catálogo e resumo</p>
            </div>
            <button onClick={() => setConfirmClose(true)} className="p-2 rounded-lg border theme-border hover:bg-white/5 text-zinc-300 transition" aria-label="Fechar"><FaTimes /></button>
          </div>

          <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-0">
            {/* Esquerda: Catálogo e filtros */}
            <div className="p-4 overflow-y-auto min-h-0">
              {/* Seções: Cliente / Pedido */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                {/* Cliente (com fidelidade) */}
                <div className="ds-card p-4">
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
                  <div className="relative" ref={clienteSearchRef}>
                    <label className="text-xs text-zinc-400 flex flex-col gap-1">
                      Buscar cliente
                      <div className="relative">
                        <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-xs" />
                        <input
                          className="ds-input pl-8 pr-8 w-full"
                          placeholder="Digite nome, apelido ou ID"
                          value={clienteQuery}
                          onChange={(e)=> setClienteQuery(e.target.value)}
                          onFocus={()=> { if (clienteSuggestions.length) setClienteSuggestionsOpen(true); }}
                        />
                        {clienteQuery && (
                          <button
                            type="button"
                            aria-label="Limpar busca"
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-zinc-500 hover:text-zinc-200"
                            onClick={()=> { setClienteQuery(''); setClienteSuggestions([]); }}
                          >
                            ×
                          </button>
                        )}
                      </div>
                    </label>
                    {clienteSuggestionsOpen && (
                      <div className="absolute left-0 right-0 mt-1 ds-card shadow-2xl max-h-52 overflow-y-auto z-20">
                        {clienteSuggestionsLoading ? (
                          <div className="px-3 py-2 text-xs text-zinc-500">Buscando clientes...</div>
                        ) : clienteSuggestions.length === 0 ? (
                          <div className="px-3 py-2 text-xs text-zinc-500">Nenhum cliente encontrado.</div>
                        ) : (
                          clienteSuggestions.map((c) => (
                            <button
                              key={c.id}
                              className="w-full text-left px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800 flex flex-col gap-0.5"
                              onClick={()=> handleClienteSelect(c)}
                            >
                              <span className="font-mono text-[11px] text-zinc-400">{c.id}</span>
                              <span>{c.nick}{c.nome ? ` — ${c.nome}` : ''}</span>
                              {(c.estrelas || c.gasto || c.simpatia) && (
                                <span className="text-[11px] text-zinc-500">{c.estrelas || 0}★ {c.gasto || 0}$ {c.simpatia || 0}♥</span>
                              )}
                            </button>
                          ))
                        )}
                      </div>
                    )}
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
                    <select className="ds-input text-sm" value={evento} onChange={e=> setEvento(e.target.value)} disabled={!fidelidadeOn || cliente.id==='BALC'}>
                      <option value="">Evento</option>
                      <option value="primeira_compra">Primeira compra</option>
                      <option value="combo">Combo</option>
                      <option value="aniversario">Aniversário</option>
                    </select>
                  </div>
                </div>
                {/* Pedido */}
                <div className="ds-card p-4">
                  <div className="text-sm font-semibold theme-text mb-2 flex items-center gap-2"><FaClipboardList className="opacity-80" /> Pedido</div>
                  <div className="space-y-3">
                    <label className="text-xs text-zinc-400 block">Entrega
                      <select className="mt-1 w-full ds-input" value={entregaTipo} onChange={(e: React.ChangeEvent<HTMLSelectElement>)=> setEntregaTipo(e.target.value as 'MOTOBOY'|'RETIRADA'|'TRANSPORTADORA'|'OUTRO')}>
                        <option value="MOTOBOY">Motoboy</option>
                        <option value="RETIRADA">Retirada</option>
                        <option value="TRANSPORTADORA">Transportadora</option>
                        <option value="OUTRO">Outro</option>
                      </select>
                    </label>
                    <div>
                      <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
                        <span>Status do pagamento</span>
                        <span className={`px-2 py-0.5 rounded-full border ${pagamentoStatus === 'PAGO' ? 'border-emerald-500 text-emerald-300 bg-emerald-500/10' : 'border-yellow-500 text-yellow-300 bg-yellow-500/10'}`}>
                          {pagamentoStatus === 'PAGO' ? 'Pago' : 'Pendente'}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className={`px-3 py-1.5 rounded border text-xs ${pagamentoStatus === 'PENDENTE' ? 'border-yellow-500 text-yellow-300 bg-yellow-500/10' : 'border-zinc-700 text-zinc-300 hover:bg-zinc-800'}`}
                          onClick={()=> setPagamentoStatus('PENDENTE')}
                        >
                          Marcar como pendente
                        </button>
                        <button
                          type="button"
                          className={`px-3 py-1.5 rounded border text-xs ${pagamentoStatus === 'PAGO' ? 'border-emerald-500 text-emerald-300 bg-emerald-500/10' : 'border-zinc-700 text-zinc-300 hover:bg-zinc-800'}`}
                          onClick={()=> setPagamentoStatus('PAGO')}
                        >
                          Marcar como pago
                        </button>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-zinc-400 mb-1">Forma de pagamento</div>
                      <div className="flex flex-wrap gap-2">
                        {PAGAMENTO_METODOS.map((method) => {
                          const Icon = method.icon;
                          const active = pagamentoStatus === 'PAGO' && pagamento === method.key;
                          return (
                            <button
                              key={method.key}
                              type="button"
                              disabled={pagamentoStatus !== 'PAGO'}
                              className={`px-3 py-1.5 rounded border text-xs inline-flex items-center gap-2 transition ${
                                active ? 'border-emerald-500 text-emerald-300 bg-emerald-500/10' : 'border-zinc-700 text-zinc-300 hover:bg-zinc-800'
                              } ${pagamentoStatus !== 'PAGO' ? 'opacity-50 cursor-not-allowed' : ''}`}
                              onClick={()=> setPagamento(method.key)}
                            >
                              <Icon className="text-sm" /> {method.label}
                            </button>
                          );
                        })}
                      </div>
                      {pagamentoStatus === 'PENDENTE' && (
                        <p className="text-[11px] text-zinc-500 mt-1">Selecione “Marcar como pago” para definir a forma.</p>
                      )}
                    </div>
                    {showTroco && (
                      <>
                        <label className="text-xs text-zinc-400 block">Valor recebido (dinheiro)
                          <input
                            className="mt-1 w-full ds-input"
                            placeholder="R$ 0,00"
                            value={valorRecebidoInput}
                            onChange={(e)=> {
                              const v = parseCurrencyInput(e.target.value);
                              setValorRecebidoInput(v ? formatCurrency(v) : '');
                            }}
                          />
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
                          <label className="text-xs text-zinc-400">Precisa de troco?
                            <button
                              type="button"
                              role="switch"
                              aria-checked={precisaTroco}
                              onClick={()=> setPrecisaTroco(v=>!v)}
                              className={`mt-1 w-12 h-7 rounded-full border transition relative ${precisaTroco ? 'bg-emerald-600 border-emerald-500' : 'bg-zinc-700 border-zinc-600'}`}
                              aria-label="Alternar troco"
                            >
                              <span className={`absolute top-0.5 ${precisaTroco ? 'left-5' : 'left-0.5'} w-5 h-5 rounded-full bg-white transition`}></span>
                            </button>
                          </label>
                          <div className={`text-xs ${trocoInsuficiente ? 'text-red-400' : 'text-zinc-400'} sm:col-span-2`}>
                            {trocoInsuficiente ? (
                              <>Saldo: <span className="font-mono">-{formatCurrency(total - valorRecebido)}</span></>
                            ) : (
                              <>Troco: <span className="font-mono text-zinc-200">{formatCurrency(troco)}</span></>
                            )}
                          </div>
                        </div>
                      </>
                    )}
                    <div className="grid grid-cols-3 gap-2 items-end">
                      <label className="text-xs text-zinc-400">Cobrar taxa?
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
                          className="mt-1 w-full ds-input disabled:opacity-50"
                          placeholder="R$ 0,00"
                          value={entregaValorInput}
                          onChange={(e)=> {
                            const v = parseCurrencyInput(e.target.value);
                            setEntregaValorInput(v ? formatCurrency(v) : '');
                          }}
                          disabled={!taxaOn}
                        />
                      </label>
                      <div className="col-span-3 text-xs text-zinc-500">
                        A taxa é registrada como saída no caixa atual quando maior que R$0.
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
                    <div key={i} className="animate-pulse ds-card overflow-hidden">
                      <div className="aspect-video bg-zinc-800/40" />
                      <div className="p-3 space-y-2">
                        <div className="h-4 bg-zinc-800 rounded w-2/3" />
                        <div className="h-3 bg-zinc-800 rounded w-1/2" />
                        <div className="h-5 bg-zinc-800 rounded w-1/3" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredCatalog.length === 0 ? (
                <div className="border border-dashed border-zinc-700 rounded-xl p-6 text-center text-sm text-zinc-400">
                  Nenhum produto disponível nesta categoria.
                  <div className="mt-3">
                    <button className="px-3 py-1.5 rounded border border-zinc-600 text-zinc-200 hover:bg-zinc-800 text-xs" onClick={()=> setCategoria('todos')}>
                      Mostrar todos os itens
                    </button>
                  </div>
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
                              <span className="text-rose-400 font-bold mr-2">{formatCurrency(c.promo)}</span>
                              <span className="text-zinc-400 line-through text-xs">{formatCurrency(c.preco)}</span>
                            </>
                          ) : (
                            <span className="text-zinc-100 font-bold">{formatCurrency(c.preco)}</span>
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
            <div className="border-t lg:border-t-0 lg:border-l theme-border p-4 flex flex-col min-h-0 theme-surface">
              <div className="text-sm font-semibold theme-text mb-2 flex items-center gap-2"><FaClipboardList className="opacity-80" /> Resumo</div>
              <div className="flex flex-wrap items-center gap-2 text-xs mb-2">
                <span className={`px-2 py-0.5 rounded-full border ${pagamentoStatus === 'PAGO' ? 'border-emerald-500 text-emerald-300 bg-emerald-500/10' : 'border-yellow-500 text-yellow-300 bg-yellow-500/10'}`}>
                  {pagamentoStatus === 'PAGO' ? 'Pago' : 'Pendente'}
                </span>
                {pagamentoStatus === 'PAGO' && pagamento !== 'PENDENTE' && (
                  <span className="px-2 py-0.5 rounded-full border border-zinc-700 text-zinc-300 bg-zinc-800/40">
                    {pagamento}
                  </span>
                )}
              </div>
              {showTroco && trocoInsuficiente && (
                <div className="mb-2 px-3 py-2 rounded-lg border border-red-600/50 bg-red-500/10 text-red-300 text-xs">
                  Saldo negativo: <span className="font-mono">-{formatCurrency(total - valorRecebido)}</span>
                </div>
              )}
              <div className="flex-1 overflow-y-auto pr-1">
                {itens.length === 0 ? (
                  <div className="text-xs text-zinc-500">Nenhum item. Selecione no catálogo.</div>
                ) : (
                  itens.map(it => {
                    const meta = getPrepTagMeta(it.prepTag || DEFAULT_PREP_TAG);
                    const previewSteps = (it.prepItems || []).slice(0, 3);
                    const extraSteps = (it.prepItems || []).length - previewSteps.length;
                    return (
                      <div key={it.id} className="py-2 border-b border-zinc-800/60">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-zinc-200 text-sm font-medium">{it.nome}</div>
                            <div className="text-xs text-zinc-500 flex items-center gap-2">
                              <span>{formatCurrency(it.preco)} × {it.quantidade}</span>
                              {meta && (
                                <span className={`px-1.5 py-0.5 rounded-full border text-[10px] ${meta.colorClass}`}>
                                  {meta.shortLabel}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                        <button className="w-7 h-7 rounded-md border theme-border text-zinc-200 hover:bg-zinc-800" onClick={()=> inc(it.id, -1)} aria-label="Diminuir">−</button>
                        <span className="min-w-6 text-center text-zinc-200 text-sm font-mono">{it.quantidade}</span>
                        <button className="w-7 h-7 rounded-md border theme-border text-zinc-200 hover:bg-zinc-800" onClick={()=> inc(it.id, +1)} aria-label="Aumentar">+</button>
                        <div className="w-16 text-right font-mono text-zinc-200 text-sm">{formatCurrency(it.preco * it.quantidade)}</div>
                        <button className="w-7 h-7 rounded-md border border-red-600 text-red-400 hover:bg-red-600/10" onClick={()=> remove(it.id)} title="Remover">×</button>
                          </div>
                        </div>
                        {previewSteps.length > 0 && (
                          <div className="mt-1 pl-2 text-[11px] text-zinc-500 space-y-0.5">
                            <div className="flex items-center gap-1 text-zinc-400">
                              <FaUtensils className="text-[10px]" />
                              <span>Preparo</span>
                            </div>
                            <ul className="space-y-0.5">
                              {previewSteps.map((step, idx) => (
                                <li key={`${it.id}-step-${idx}`} className="flex items-center gap-1">
                                  <span className="font-semibold text-zinc-300">{idx + 1}.</span>
                                  <span className="text-zinc-300">{step.nome}</span>
                                  {step.note && <span className="text-zinc-500">— {step.note}</span>}
                                </li>
                              ))}
                            </ul>
                            {extraSteps > 0 && (
                              <div className="text-[10px] text-zinc-600">
                                +{extraSteps} etapa(s) adicional(is)
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
              <div className="mt-3 space-y-1 text-sm">
                <div className="flex items-center justify-between text-zinc-400"><span>Subtotal</span><span className="font-mono text-zinc-300">{formatCurrency(subtotal)}</span></div>
                <div className="flex items-center justify-between text-zinc-400"><span>Entrega</span><span className="font-mono text-zinc-300">{taxaOn ? formatCurrency(entregaValor) : formatCurrency(0)}</span></div>
                <div className="flex items-center justify-between text-zinc-400"><span>Total</span><span className="font-mono text-zinc-100">{formatCurrency(total)}</span></div>
                {showTroco && precisaTroco && (
                  <div className="flex items-center justify-between text-zinc-400"><span>Recebido</span><span className="font-mono text-zinc-300">{formatCurrency(valorRecebido)}</span></div>
                )}
                {showTroco && precisaTroco && (
                  trocoInsuficiente ? (
                    <div className="flex items-center justify-between text-red-400"><span>Saldo</span><span className="font-mono">-{formatCurrency(total - valorRecebido)}</span></div>
                  ) : (
                    <div className="flex items-center justify-between text-zinc-400"><span>Troco</span><span className="font-mono text-emerald-300">{formatCurrency(troco)}</span></div>
                  )
                )}
              </div>
              <div className="mt-3">
                <label className="text-xs text-zinc-400">Observações
                  <textarea className="mt-1 w-full ds-input" rows={2} value={observacoes} onChange={e=> setObservacoes(e.target.value)} />
                </label>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <button className="px-3 py-2 rounded border theme-border text-zinc-300 flex items-center gap-2" onClick={onClose}><FaTimes /> Cancelar</button>
                <button
                  className="flex-1 px-3 py-2 rounded brand-btn text-white disabled:opacity-50 flex items-center justify-center gap-2"
                  disabled={
                    saving ||
                    itens.length === 0 ||
                    (pagamentoStatus === 'PAGO' && pagamento === 'PENDENTE') ||
                    (pagamentoStatus === 'PAGO' && trocoInsuficiente)
                  }
                  title={
                    pagamentoStatus === 'PAGO' && pagamento === 'PENDENTE'
                      ? 'Selecione a forma de pagamento.'
                      : pagamentoStatus === 'PAGO' && trocoInsuficiente
                      ? 'Saldo negativo. Ajuste o valor recebido.'
                      : undefined
                  }
                  onClick={handleConfirmClick}
                >
                  {saving ? 'Salvando...' : (<><FaCheck /> Confirmar Pedido</>)}
                </button>
              </div>
            </div>
          </div>

          {/* Lista de Clientes (real) */}
          <ClientesModal open={showClientes && clientesLoaded} onClose={()=> setShowClientes(false)} onSelect={(c)=> { handleClienteSelect(c); setShowClientes(false); }} />
          <NovoClienteModal open={showNovoCliente} onClose={()=> setShowNovoCliente(false)} onCreated={(c)=> { handleClienteSelect({ id: c.uuid, nick: c.nick, estrelas: 0, gasto: 0, simpatia: 0, compras: 0 }); setShowNovoCliente(false); }} />
          <PinModal
            open={pinModalOpen}
            title="Confirmar pedido"
            message="Digite o PIN do admin para registrar o pedido."
            onClose={() => setPinModalOpen(false)}
            onConfirm={async (code) => {
              if (code !== '1234') return false;
              return confirmarPedido();
            }}
          />

          {/* Confirmar fechamento */}
          {confirmClose && (
            <div className="absolute inset-0 bg-black z-50 flex items-center justify-center p-4">
              <div className="ds-card p-5 w-full max-w-sm">
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
