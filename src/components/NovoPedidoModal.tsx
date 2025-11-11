import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaTimes, FaPlus, FaUser, FaClipboardList, FaShoppingBag, FaCheck } from 'react-icons/fa';
import type { Pedido } from '@/utils/indexedDB';
import { playUiSound } from '@/utils/sound';

type CatalogItem = {
  id: string;
  nome: string;
  preco: number;
  promo?: number;
  categoria: 'burger'|'bebida'|'pizza'|'hotdog'|'sobremesa'|'frango'|'veg';
  icon: React.ComponentType<{ className?: string }>;
  cor: string; // classes de cor tailwind (ícone)
  bg: string;  // classes de fundo do topo (2/5)
  ativo?: boolean;
  combo?: boolean;
  desc: string;
  stock: number | 'inf';
};

import { FaHamburger, FaLeaf, FaGlassWhiskey, FaCoffee, FaPizzaSlice, FaHotdog, FaIceCream, FaDrumstickBite, FaCheese } from 'react-icons/fa';

const CATALOG: CatalogItem[] = [
  { id:'xb', nome:'X-Burger', preco: 18.9, categoria:'burger', icon: FaHamburger, cor:'text-orange-400', bg:'bg-orange-900/20', desc:'Pão, carne 120g, queijo e molho da casa.', stock: 12 },
  { id:'xd', nome:'X-Duplo', preco: 28.9, promo: 24.9, categoria:'burger', icon: FaHamburger, cor:'text-amber-400', bg:'bg-amber-900/20', combo:true, desc:'Dois hambúrgueres 120g com queijo duplo.', stock: 8 },
  { id:'veg', nome:'Veggie', preco: 22.9, categoria:'veg', icon: FaLeaf, cor:'text-emerald-400', bg:'bg-emerald-900/20', desc:'Grão-de-bico, alface, tomate e molho leve.', stock: 10 },
  { id:'coca', nome:'Refrigerante', preco: 6, categoria:'bebida', icon: FaGlassWhiskey, cor:'text-sky-400', bg:'bg-sky-900/20', desc:'Refrigerante gelado (lata 350ml).', stock: 'inf' },
  { id:'cafe', nome:'Café', preco: 4, categoria:'bebida', icon: FaCoffee, cor:'text-yellow-300', bg:'bg-yellow-900/20', desc:'Café expresso curto, fresco e encorpado.', stock: 'inf' },
  { id:'pizza', nome:'Pizza Fatia', preco: 9.9, categoria:'pizza', icon: FaPizzaSlice, cor:'text-pink-400', bg:'bg-pink-900/20', desc:'Fatia de pizza marguerita assada na hora.', stock: 20 },
  { id:'hotdog', nome:'Hot Dog', preco: 12.9, categoria:'hotdog', icon: FaHotdog, cor:'text-red-400', bg:'bg-red-900/20', desc:'Pão, salsicha, molho especial e batata palha.', stock: 18 },
  { id:'sorvete', nome:'Sorvete', preco: 7.5, categoria:'sobremesa', icon: FaIceCream, cor:'text-fuchsia-300', bg:'bg-fuchsia-900/20', desc:'Taça de sorvete cremoso (sabores do dia).', stock: 25 },
  { id:'frango', nome:'Chicken Crispy', preco: 16.9, categoria:'frango', icon: FaDrumstickBite, cor:'text-rose-300', bg:'bg-rose-900/20', desc:'Tiras de frango empanado, crocantes.', stock: 15 },
  { id:'cheese', nome:'Cheese Burger', preco: 21.9, categoria:'burger', icon: FaCheese, cor:'text-yellow-400', bg:'bg-yellow-900/20', desc:'Hambúrguer com cheddar cremoso.', stock: 14 },
];

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
  const [categoria, setCategoria] = useState<'todos'|CatalogItem['categoria']>('todos');
  const [itens, setItens] = useState<Array<{id:string; nome:string; preco:number; quantidade:number}>>([]);
  const [cliente, setCliente] = useState<{ id: string; nick: string }>({ id:'BALC', nick:'Balcão' });
  const [showNovoCliente, setShowNovoCliente] = useState(false);
  const [motoboy, setMotoboy] = useState('');
  const [pagamento, setPagamento] = useState<'DINHEIRO'|'CARTAO'|'PIX'|'ONLINE'|'PENDENTE'>('PENDENTE');
  const [valorRecebidoInput, setValorRecebidoInput] = useState('');
  const [precisaTroco, setPrecisaTroco] = useState(false);
  const [observacoes, setObservacoes] = useState('');
  const [fidelidadeOn, setFidelidadeOn] = useState(false);
  const [evento, setEvento] = useState('');
  const [toast, setToast] = useState<{ msg: string; type: 'info'|'warn'|'ok' }|null>(null);
  const [flashIds, setFlashIds] = useState<Record<string, number>>({});
  const [confirmClose, setConfirmClose] = useState(false);
  const [showClientes, setShowClientes] = useState(false);

  const subtotal = useMemo(() => itens.reduce((a, it) => a + it.preco*it.quantidade, 0), [itens]);
  const total = subtotal; // sem taxas por enquanto
  const valorRecebido = useMemo(() => currencyFromInput(valorRecebidoInput), [valorRecebidoInput]);
  const troco = useMemo(() => precisaTroco ? Math.max(0, valorRecebido - total) : 0, [valorRecebido, total, precisaTroco]);
  const trocoInsuficiente = precisaTroco && valorRecebido < total;

  const filteredCatalog = useMemo(() => CATALOG.filter(c => (categoria==='todos' ? true : c.categoria===categoria) && (c.ativo ?? true)), [categoria]);

  function addItem(c: CatalogItem) {
    setItens(prev => {
      const idx = prev.findIndex(p => p.id === c.id);
      const preco = c.promo ?? c.preco;
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], quantidade: Math.max(1, copy[idx].quantidade + 1) };
        return copy;
      }
      return [...prev, { id: c.id, nome: c.nome, preco, quantidade: 1 }];
    });
    playUiSound('click');
    setFlashIds((m: Record<string, number>) => ({ ...m, [c.id]: Date.now() }));
    setTimeout(() => setFlashIds((m: Record<string, number>) => { const cp = { ...m }; delete cp[c.id]; return cp; }), 220);
    setToast({ msg: 'Item adicionado ✅', type: 'ok' });
    setTimeout(() => setToast(null), 1000);
  }
  function inc(id: string, d=1) {
    setItens(prev => prev.map(it => it.id===id ? { ...it, quantidade: Math.max(1, it.quantidade + d) } : it));
  }
  function remove(id: string) {
    setItens(prev => prev.filter(it => it.id!==id));
  }

  async function confirmarPedido() {
    setSaving(true);
    try {
      const novo: Pedido = {
        id: Math.random().toString(36).slice(2,8).toUpperCase(),
        status: 'EM_AGUARDO',
        itens: itens.map(it => ({ nome: it.nome, quantidade: it.quantidade, preco: it.preco })),
        pagamento: pagamento,
        entrega: motoboy ? 'Delivery' : 'Balcão',
        troco: troco || 0,
        observacoes,
        cliente: { id: cliente.id, nick: cliente.nick, genero: 'O', estrelas: 3, gasto: 3, simpatia: 3 },
        fidelidade: { enabled: fidelidadeOn, evento: evento || undefined },
        motoboy: motoboy || undefined,
      } as unknown as Pedido;
      try { await fetch('/api/pedidos', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(novo) }); } catch {}
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
      confirmarPedido();
    } else {
      setPinErr('PIN inválido');
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
                    <button className="px-2.5 py-1.5 text-xs rounded border border-zinc-700 text-zinc-300 hover:bg-zinc-800 inline-flex items-center gap-2" onClick={()=> setShowClientes(true)}>
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
                        aria-checked={fidelidadeOn}
                        onClick={()=> setFidelidadeOn(v=>!v)}
                        className={`w-10 h-6 rounded-full border transition relative ${fidelidadeOn ? 'bg-emerald-600 border-emerald-500' : 'bg-zinc-700 border-zinc-600'}`}
                        aria-label="Alternar fidelidade"
                      >
                        <span className={`absolute top-0.5 ${fidelidadeOn ? 'left-5' : 'left-0.5'} w-5 h-5 rounded-full bg-white transition`}></span>
                      </button>
                    </div>
                    <select className="rounded border theme-border bg-zinc-900/50 text-zinc-200 text-sm px-2 py-1.5" value={evento} onChange={e=> setEvento(e.target.value)} disabled={!fidelidadeOn}>
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
                    <label className="text-xs text-zinc-400">Motoboy
                      <select className="mt-1 w-full rounded border theme-border bg-zinc-900/50 text-zinc-200 text-sm px-2 py-1.5" value={motoboy} onChange={e=> setMotoboy(e.target.value)}>
                        <option value="">—</option>
                        <option>Felipe</option>
                        <option>Joana</option>
                        <option>Rodrigo</option>
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

              {/* Filtros de categoria */}
              <div className="flex flex-wrap gap-2 mb-3">
                {(['todos','burger','bebida','pizza','hotdog','frango','sobremesa','veg'] as const).map(cat => (
                  <button key={cat} className={`px-3 py-1.5 text-xs rounded-full border ${categoria===cat ? 'border-orange-600 bg-orange-500/15 text-orange-300' : 'border-zinc-700 text-zinc-300 hover:bg-zinc-800'}`} onClick={()=> setCategoria(cat)}>
                    {cat.toUpperCase()}
                  </button>
                ))}
              </div>

              {/* Grid de itens */}
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

          {/* Mini modal: Novo Cliente */}
          {showNovoCliente && (
            <div className="absolute inset-0 bg-black z-50 flex items-center justify-center p-4">
              <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4 w-full max-w-sm">
                <div className="text-sm font-semibold theme-text mb-2">Novo Cliente</div>
                <label className="text-xs text-zinc-400 block mb-2">ID
                  <input className="mt-1 w-full rounded border theme-border bg-zinc-900/50 text-zinc-200 text-sm px-2 py-1.5" value={cliente.id} onChange={e=> setCliente(v=> ({...v, id: e.target.value.toUpperCase().slice(0,4)}))} />
                </label>
                <label className="text-xs text-zinc-400 block mb-3">Nick
                  <input className="mt-1 w-full rounded border theme-border bg-zinc-900/50 text-zinc-200 text-sm px-2 py-1.5" value={cliente.nick} onChange={e=> setCliente(v=> ({...v, nick: e.target.value}))} />
                </label>
                <div className="flex items-center justify-end gap-2">
                  <button className="px-3 py-1.5 rounded border theme-border text-zinc-300" onClick={()=> setShowNovoCliente(false)}>Fechar</button>
                  <button className="px-3 py-1.5 rounded bg-emerald-600 text-white" onClick={()=> setShowNovoCliente(false)}>Salvar</button>
                </div>
              </div>
            </div>
          )}

          {/* Lista de Clientes (simulada) */}
          {showClientes && (
            <div className="absolute inset-0 bg-black z-50 flex items-center justify-center p-4">
              <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4 w-full max-w-md max-h-[70vh] overflow-y-auto">
                <div className="text-sm font-semibold theme-text mb-2">Clientes</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {['ALFA','BETA','GAMA','DELTA','ECHO','FOXT','GOLF','HOTEL'].map((id, idx) => (
                    <button key={id} className="text-left p-2 rounded border theme-border hover:bg-zinc-800 text-zinc-200" onClick={()=> { setCliente({ id, nick: ['Lobo','Raposa','Tigre','Leão'][idx % 4] }); setShowClientes(false); }}>
                      <div className="font-mono text-sm">{id}</div>
                      <div className="text-xs text-zinc-400">{['Lobo','Raposa','Tigre','Leão'][idx % 4]}</div>
                    </button>
                  ))}
                </div>
                <div className="flex items-center justify-end mt-3">
                  <button className="px-3 py-1.5 rounded border theme-border text-zinc-300" onClick={()=> setShowClientes(false)}>Fechar</button>
                </div>
              </div>
            </div>
          )}

          {/* Step PIN */}
          {stepPin && (
            <div className="absolute inset-0 bg-black z-50 flex items-center justify-center p-4">
              <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5 w-full max-w-sm">
                <div className="text-sm font-semibold theme-text mb-3">Confirmar com PIN do funcionário</div>
                <div className="flex items-center justify-center gap-3 mb-3">
                  {pin.map((d, idx) => (
                    <input key={idx} type="password" aria-label={`Dígito ${idx+1} do PIN`} maxLength={1} inputMode="numeric" value={d} onChange={(e)=>{
                      const v = e.target.value.replace(/\D/g,'').slice(0,1);
                      const arr = [...pin]; arr[idx] = v; setPin(arr);
                    }} className="w-12 h-12 text-2xl text-center rounded-lg border theme-border bg-zinc-800/60 text-white" />
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
