import { useRouter } from 'next/router';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FaHourglassHalf, FaUtensils, FaClock, FaMotorcycle, FaCheckCircle, FaTimesCircle, 
  FaShoppingBag, FaDollarSign, FaMapMarkerAlt, FaFileAlt, FaShieldAlt, FaUser, FaRoad, FaHashtag, FaCity
} from 'react-icons/fa';
import { playUiSound } from '@/utils/sound';
import { obterPedido as idbObterPedido, salvarPedido as idbSalvarPedido, Pedido as PedidoDB } from '@/utils/indexedDB';

// Constantes estáticas fora do componente para evitar dependências em hooks
const NOMES = ['João', 'Maria', 'Carlos', 'Ana', 'Paula', 'Diego', 'Luiza', 'Bruno'] as const;
const RUAS = ['Av. Central', 'Rua das Flores', 'Rua 7 de Setembro', 'Av. Brasil', 'Rua da Praia'] as const;
const BAIRROS = ['Centro', 'Jardim América', 'Vila Nova', 'Bela Vista', 'São José'] as const;
const OBS_POOL = [
  'Sem cebola no burger, por favor.',
  'Molho extra à parte.',
  'Pouco gelo no refrigerante.',
  'Adicionar sachê de ketchup e maionese.',
  'Tocar o interfone ao chegar.',
  'Preferência: pão sem gergelim.'
] as const;

type PedidoItem = string | { nome: string; quantidade?: number; preco?: number|string; icon?: string };
type Cliente = { id?: string; nick?: string };
type Pedido = {
  id: string;
  status: 'EM_AGUARDO'|'EM_PREPARO'|'PRONTO'|'EM_ROTA'|'COMPLETO'|'CANCELADO'|string;
  code?: string;
  criadoEm?: string;
  timestamps?: Partial<Record<'EM_AGUARDO'|'EM_PREPARO'|'PRONTO'|'EM_ROTA'|'COMPLETO'|'CANCELADO', string>>;
  itens?: PedidoItem[];
  pagamento?: string;
  pagamentoStatus?: 'PAGO'|'PENDENTE'|'CANCELADO'|string;
  entrega?: string;
  observacoes?: string;
  cliente?: Cliente;
  troco?: number | string | null;
};

export default function PublicPedido() {
  const router = useRouter();
  const { id } = router.query;
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [now, setNow] = useState<number | null>(null);

  // PIN state (igual ao index: 4 inputs)
  const [pin, setPin] = useState(['', '', '', '']);
  const [blocked] = useState(false);
  const [errorPin, setErrorPin] = useState('');
  const [successPin, setSuccessPin] = useState(false);
  const [shake, setShake] = useState(false);
  const inputsRef = useRef<Array<HTMLInputElement | null>>([null, null, null, null]);
  const formRef = useRef<HTMLFormElement>(null);

  // Som sutil de submit (sucesso/erro)
  const playSubmitSound = (type: 'success' | 'error') => {
    if (typeof window === 'undefined') return;
    type WinAudio = Window & { webkitAudioContext?: typeof AudioContext; AudioContext?: typeof AudioContext };
    const AudioCtx = (window as WinAudio).AudioContext || (window as WinAudio).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    if (type === 'success') {
      osc.type = 'sine'; osc.frequency.value = 480; osc.start();
      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.005, ctx.currentTime + 0.25);
      osc.stop(ctx.currentTime + 0.26);
    } else {
      osc.type = 'triangle'; osc.frequency.value = 260; osc.start();
      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.005, ctx.currentTime + 0.18);
      osc.stop(ctx.currentTime + 0.19);
    }
  };

  useEffect(() => {
    if (!id || typeof id !== 'string') return;
    // loading já inicia como true; evitamos setState síncrono no effect
    // cache local IndexedDB: carrega imediatamente se existir
    (async () => {
      try {
        const p = await idbObterPedido(id as string);
        if (p) setPedido(p as unknown as Pedido);
      } catch {}
    })();
    let alive = true;
    let fetched: Pedido | null = null;
    let errorFlag = '';

    const sleep = new Promise<void>((res) => setTimeout(res, 3000));
    const get = fetch(`/api/pedidos/${id}`)
      .then(async (r) => {
        if (!r.ok) throw new Error('notfound');
        return (await r.json()) as Pedido;
      })
      .then((p) => { fetched = p; })
      .catch(() => { errorFlag = 'pedido cancelado ou inexistente'; });

    Promise.all([sleep, get]).then(async () => {
      if (!alive) return;
      if (errorFlag) {
        setErro('pedido cancelado ou inexistente');
        setPedido(null);
        setLoading(false);
        return;
      }
      if (fetched) {
        // Cancelado => indisponível
        if (String(fetched.status).toUpperCase() === 'CANCELADO') {
          setErro('pedido cancelado ou inexistente');
          setPedido(null);
          setLoading(false);
          return;
        }
        // Completo há mais de 6h => indisponível
        const tsComp = fetched.timestamps?.COMPLETO ? Date.parse(fetched.timestamps.COMPLETO) : undefined;
        if (String(fetched.status).toUpperCase() === 'COMPLETO' && tsComp && (Date.now() - tsComp) > 6 * 60 * 60 * 1000) {
          setErro('pedido cancelado ou inexistente');
          setPedido(null);
          setLoading(false);
          return;
        }
        // salva em IndexedDB
        try { await idbSalvarPedido(fetched as unknown as PedidoDB); } catch {}
        setPedido(fetched);
      }
      setLoading(false);
    });

    const handleOnline = () => {
      // ao reconectar, tenta atualizar silenciosamente
      fetch(`/api/pedidos/${id}`).then(async r => {
        if (!r.ok) return;
        const p = await r.json();
        try { await idbSalvarPedido(p as unknown as PedidoDB); } catch {}
        setPedido(p);
      }).catch(()=>{});
    };
    window.addEventListener('online', handleOnline);
    return () => { alive = false; window.removeEventListener('online', handleOnline); };
  }, [id]);

  // Relógio estável no client para tempos relativos
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const it = setInterval(tick, 15000);
    return () => clearInterval(it);
  }, []);

  // Foca no primeiro input ao carregar
  useEffect(() => {
    if (!blocked && !successPin) {
      inputsRef.current[0]?.focus();
    }
  }, [blocked, successPin]);

  const steps = [
    { key:'EM_AGUARDO', label:'Recebido', icon: FaHourglassHalf },
    { key:'EM_PREPARO', label:'Em Preparo', icon: FaUtensils },
    { key:'PRONTO', label:'Pronto', icon: FaClock },
    { key:'EM_ROTA', label:'Em Rota', icon: FaMotorcycle },
    { key:'COMPLETO', label:'Entregue', icon: FaCheckCircle },
  ] as const;

  const rel = (ts?: string) => {
    if (!ts || !now) return '';
    const ms = now - Date.parse(ts);
    const min = Math.floor(ms/60000);
    if (min < 1) return 'agora';
    if (min < 60) return `há ${min}min`;
    const h = Math.floor(min/60); const rm = min%60;
    return `há ${h}h${rm?` ${rm}min`:''}`;
  };

  // Normalização de itens e totais
  const itens = useMemo(() => (pedido?.itens || []).filter(Boolean) as PedidoItem[], [pedido]);
  const itensObjs = useMemo(() => itens
    .map((i) => typeof i === 'string' ? { nome: i, quantidade: 1, preco: 0 } : i)
    .map((i) => ({
      nome: i.nome,
      quantidade: i.quantidade ?? 1,
      preco: typeof i.preco === 'number' ? i.preco : i.preco ? parseFloat(String(i.preco).toString().replace(/[^0-9.,]/g, '').replace(',', '.')) : 0
    })), [itens]);
  const totalItens = useMemo(() => itensObjs.reduce((acc, it) => acc + (it.quantidade || 1), 0), [itensObjs]);
  const totalValor = useMemo(() => itensObjs.reduce((acc, it) => acc + (Number(it.preco) || 0) * (it.quantidade || 1), 0), [itensObjs]);

  // Handlers PIN
  const handleChange = (idx: number, value: string) => {
    if (blocked || successPin) return;
    if (!/^[0-9]?$/.test(value)) return;
    const newPin = [...pin];
    newPin[idx] = value;
    setPin(newPin);
    setErrorPin('');
    if (value && idx < 3) inputsRef.current[idx + 1]?.focus();
    if (!value && idx > 0) inputsRef.current[idx - 1]?.focus();
  };
  const handleKeyDown = (idx:number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (blocked || successPin) return;
    if (e.key === 'Backspace' && !pin[idx] && idx > 0) inputsRef.current[idx - 1]?.focus();
    if (e.key === 'Enter' && pin.every(d => d !== '')) formRef.current?.requestSubmit();
  };
  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0,4);
    const newPin = [...pin];
    for (let i=0; i<pasted.length; i++) newPin[i] = pasted[i];
    setPin(newPin);
    const nextEmpty = newPin.findIndex((d) => d === '');
    if (nextEmpty !== -1) inputsRef.current[nextEmpty]?.focus(); else inputsRef.current[3]?.focus();
  };
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (blocked || successPin) return;
    if (pin.some(d => d === '')) {
      setErrorPin('Preencha todos os dígitos');
      setShake(true); setTimeout(() => setShake(false), 500);
      playSubmitSound('error');
      return;
    }
    const pinStr = pin.join('');
    // Universal PIN: 1111
    if (pinStr === '1111') {
      setSuccessPin(true);
      playSubmitSound('success');
    } else {
      setErrorPin('PIN incorreto. Tente 1111.');
      setShake(true); setTimeout(() => setShake(false), 500);
      playSubmitSound('error');
    }
  };

  const currIdx = steps.findIndex(x => x.key === pedido?.status);

  // Dados auxiliares (endereços e observações simuladas)
  const seed = useMemo(() => (typeof id === 'string' ? id : 'X').split('').reduce((a,c)=> a + c.charCodeAt(0), 0), [id]);
  const addr = useMemo(() => ({
    nome: NOMES[seed % NOMES.length],
    rua: RUAS[seed % RUAS.length],
    numero: 100 + (seed % 900),
    bairro: BAIRROS[(seed >> 1) % BAIRROS.length]
  }), [seed]);
  const obsAuto = useMemo(() => (pedido?.observacoes ? pedido.observacoes : OBS_POOL[seed % OBS_POOL.length]), [pedido, seed]);

  return (
    <div className="min-h-screen app-gradient-bg p-6 flex items-center justify-center relative">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-2xl relative">
        {/* Card principal */}
        <div className="backdrop-blur-xl rounded-2xl border shadow-2xl overflow-hidden theme-surface theme-border">
          <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
            <div className="flex items-center gap-2 text-zinc-400 text-sm">
              <FaShieldAlt className="text-zinc-500" />
              <span>Acompanhe seu pedido</span>
            </div>
            <span className="text-zinc-400 text-sm">#{id}</span>
          </div>

          <div className="p-6">
            {loading ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-zinc-400 text-center py-8"
              >
                Carregando seu pedido...
              </motion.div>
            ) : erro ? (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className="text-center text-red-400 flex flex-col items-center gap-3"
              >
                <motion.div animate={{ scale: [1, 1.06, 1] }} transition={{ duration: 1.2, repeat: 2, ease: 'easeInOut' }}>
                  <FaTimesCircle className="text-3xl" />
                </motion.div>
                <p className="font-semibold">{erro}</p>
                <p className="text-zinc-400 text-sm max-w-md">
                  Obrigado por acompanhar. Este link não está disponível no momento.
                </p>
                <div className="flex items-center gap-2 mt-1 flex-wrap justify-center">
                  <Link href="/" className="px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-300 hover:bg-zinc-800/60 transition">Voltar ao início</Link>
                  <button onClick={() => typeof window !== 'undefined' && window.location.reload()} className="px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-300 hover:bg-zinc-800/60 transition">Tentar novamente</button>
                  <a href="mailto:suporte@pdvburguer.app" className="px-3 py-1.5 rounded-lg border border-orange-600 text-orange-300 hover:bg-orange-600/10 transition">Contato/Suporte</a>
                </div>
              </motion.div>
            ) : (
              <>
                {/* GATE PIN */}
                {!successPin && (
                  <motion.form
                    ref={formRef}
                    onSubmit={handleSubmit}
                    className="flex flex-col items-center justify-center bg-zinc-900/60 rounded-2xl border border-zinc-800 p-8"
                    animate={shake ? { x: [-10, 10, -10, 10, 0] } : {}}
                    transition={{ duration: 0.35 }}
                    onMouseEnter={() => playUiSound('hover')}
                  >
                    <motion.h2 className="text-xl font-semibold text-white mb-2">Digite seu PIN</motion.h2>
                    <p className="text-zinc-400 text-sm mb-6">PIN de 4 dígitos para visualizar detalhes</p>
                    <div className="flex gap-3 mb-4">
                      {pin.map((d, idx) => (
                        <motion.div key={idx} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + idx*0.05 }}>
                          <input
                            ref={(el) => { inputsRef.current[idx] = el; }}
                            type="password"
                            maxLength={1}
                            inputMode="numeric"
                            disabled={blocked || successPin}
                            value={d}
                            onChange={(e) => handleChange(idx, e.target.value)}
                            onKeyDown={(e) => handleKeyDown(idx, e)}
                            onPaste={idx === 0 ? handlePaste : undefined}
                            className={`w-14 h-14 text-2xl text-center rounded-xl border-2 bg-zinc-800/50 text-white outline-none transition-all font-mono backdrop-blur
                              ${blocked || successPin ? 'opacity-50 cursor-not-allowed' : 'hover:bg-zinc-800/70'}
                              ${d ? 'border-orange-500 bg-zinc-800/70' : 'border-zinc-700'}
                              ${errorPin && !blocked ? 'border-red-500/50' : ''}
                              focus:border-orange-500 focus:bg-zinc-800 focus:scale-105 focus:shadow-lg focus:shadow-orange-500/20
                            `}
                          />
                        </motion.div>
                      ))}
                    </div>
                    <AnimatePresence mode="wait">
                      {errorPin && (
                        <motion.div
                          key="error"
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="text-red-400 text-sm mb-4 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2"
                        >
                          {errorPin}
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <motion.button
                      type="submit"
                      disabled={blocked || successPin}
                      className={`w-full py-3 rounded-xl font-bold text-base transition-all relative overflow-hidden
                        ${blocked || successPin 
                          ? 'bg-zinc-700 cursor-not-allowed opacity-50' 
                          : 'brand-btn hover:brightness-110 shadow-lg hover:shadow-xl active:scale-95'}
                      `}
                      whileHover={!blocked && !successPin ? { scale: 1.01 } : {}}
                      whileTap={!blocked && !successPin ? { scale: 0.99 } : {}}
                    >
                      <span className="relative z-10 text-white">Ver pedido</span>
                      {!blocked && !successPin && (
                        <motion.div
                          className="absolute inset-0 bg-linear-to-r from-transparent via-white/20 to-transparent"
                          initial={{ x: '-100%' }}
                          animate={{ x: '200%' }}
                          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                        />
                      )}
                    </motion.button>
                  </motion.form>
                )}

                {/* DADOS DO PEDIDO */}
                {successPin && pedido && (
                  <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
                    {/* Resumo topo */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-11 h-11 rounded-full border-2 flex items-center justify-center 
                          ${currIdx < 0 ? 'border-zinc-700 text-zinc-500' : currIdx < 2 ? 'border-orange-500 text-orange-400' : currIdx < 4 ? 'border-yellow-500 text-yellow-400' : 'border-green-500 text-green-400'}`}
                        >
                          <FaShoppingBag />
                        </div>
                        <div>
                          <div className="text-white font-semibold">Pedido #{pedido.id}</div>
                          <div className="text-xs text-zinc-500">{pedido?.criadoEm ? `Criado ${rel(pedido.criadoEm)}` : ''}</div>
                        </div>
                      </div>
                      {pedido?.pagamentoStatus && (
                        <span className={`text-xs px-2.5 py-1 rounded-full border ${
                          pedido.pagamentoStatus === 'PAGO'
                            ? 'border-green-500 text-green-400 bg-green-500/10'
                            : pedido.pagamentoStatus === 'CANCELADO'
                            ? 'border-red-500 text-red-400 bg-red-500/10'
                            : 'border-yellow-500 text-yellow-400 bg-yellow-500/10'
                        }`}>
                          {pedido.pagamentoStatus === 'PAGO'
                            ? `PAGO: ${pedido?.pagamento || '—'}`
                            : pedido.pagamentoStatus}
                        </span>
                      )}
                    </div>

                    {/* Itens e totais */}
                    <div className="bg-zinc-800/40 border border-zinc-700 rounded-xl p-4 mb-4" onMouseEnter={() => playUiSound('hover')}>
                      <div className="flex items-center gap-2 text-zinc-300 mb-3"><FaUtensils className="text-zinc-400" /><span className="font-semibold">Itens ({totalItens})</span></div>
                      <div className="space-y-2">
                        {itensObjs.length === 0 ? (
                          <div className="text-zinc-500 text-sm">Sem itens cadastrados</div>
                        ) : itensObjs.map((it, i) => (
                          <div key={i} className="flex items-center justify-between text-sm text-zinc-300">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded bg-zinc-700/50 text-zinc-200 font-mono text-xs">x{it.quantidade || 1}</span>
                              <span>{it.nome}</span>
                            </div>
                            <div className="text-zinc-400">{(Number(it.preco)||0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                          </div>
                        ))}
                      </div>
                      <div className="border-t border-zinc-700 mt-3 pt-3 flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 text-zinc-400"><FaDollarSign />Total</div>
                        <div className="text-white font-semibold">{totalValor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                      </div>
                      <div className="mt-2 text-sm text-zinc-300"><span className="text-zinc-400">Troco:</span> {pedido?.troco ? Number(pedido.troco).toLocaleString('pt-BR',{style:'currency', currency:'BRL'}) : 'Não'}</div>
                    </div>

                    {/* Entrega (w-full) */}
                    <div className="bg-zinc-800/40 border border-zinc-700 rounded-xl p-4 mb-4" onMouseEnter={() => playUiSound('hover')}>
                      <div className="flex items-center gap-2 text-zinc-300 mb-2"><FaMapMarkerAlt className="text-rose-400" /><span className="font-semibold">Entrega</span></div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-zinc-200">
                        <div className="flex items-center gap-2"><FaUser className="text-zinc-400" /><span>Nome: {addr.nome}</span></div>
                        <div className="flex items-center gap-2"><FaRoad className="text-zinc-400" /><span>Rua: {addr.rua}</span></div>
                        <div className="flex items-center gap-2"><FaHashtag className="text-zinc-400" /><span>Número: {addr.numero}</span></div>
                        <div className="flex items-center gap-2"><FaCity className="text-zinc-400" /><span>Bairro: {addr.bairro}</span></div>
                      </div>
                    </div>

                    {/* Observações (w-full) */}
                    <div className="bg-zinc-800/40 border border-zinc-700 rounded-xl p-4 mb-2" onMouseEnter={() => playUiSound('hover')}>
                      <div className="flex items-center gap-2 text-zinc-300 mb-1"><FaFileAlt className="text-cyan-400" /><span className="font-semibold">Observações</span></div>
                      <div className="text-sm text-zinc-200 whitespace-pre-wrap wrap-break-word">{obsAuto}</div>
                    </div>

                    {/* TIMELINE */}
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.05 }} className="bg-zinc-800/40 border border-zinc-700 rounded-xl p-4" onMouseEnter={() => playUiSound('hover')}>
                      <div className="text-zinc-300 font-semibold mb-4">Status do pedido</div>
                      <div className="flex items-center gap-0 justify-between">
                        {steps.map((s, idx) => {
                          const Icon = s.icon;
                          const done = idx <= currIdx;
                          const ts = pedido?.timestamps?.[s.key];
                          return (
                            <div key={s.key} className="flex-1 flex items-center">
                              <div className="flex flex-col items-center w-20">
                                <motion.div
                                  className={`w-9 h-9 rounded-full border flex items-center justify-center ${done ? 'border-orange-500 bg-orange-500/10' : 'border-zinc-700 bg-zinc-900'}`}
                                  animate={done ? { scale: [1, 1.05, 1] } : {}}
                                  transition={done ? { duration: 1.2, repeat: Infinity, ease: 'easeInOut' } : {}}
                                >
                                  <Icon className={`${done ? 'text-orange-400' : 'text-zinc-500'} text-sm`} />
                                </motion.div>
                                <div className="text-[11px] text-zinc-400 mt-2 text-center">
                                  <div className="font-medium text-zinc-300">{s.label}</div>
                                  <div className="text-zinc-500">{rel(ts)}</div>
                                </div>
                              </div>
                              {idx < steps.length - 1 && (
                                <motion.div
                                  className={`h-0.5 flex-1 ${idx < currIdx ? 'bg-orange-500' : 'bg-zinc-700'}`}
                                  initial={{ scaleX: 0 }}
                                  animate={{ scaleX: 1 }}
                                  transition={{ duration: 0.5, delay: idx * 0.1 }}
                                  style={{ transformOrigin: 'left center' }}
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>

                    {/* Mensagem por status */}
                    <div className="text-center text-zinc-300 mt-4">
                      {pedido?.status === 'EM_AGUARDO' && <p>Seu pedido foi recebido e aguarda preparo.</p>}
                      {pedido?.status === 'EM_PREPARO' && <p>Estamos preparando seu pedido com carinho.</p>}
                      {pedido?.status === 'PRONTO' && <p>Pedido pronto! Aguardando o motoboy.</p>}
                      {pedido?.status === 'EM_ROTA' && <p>Pedido em rota, chegando em breve!</p>}
                      {pedido?.status === 'COMPLETO' && <p>Pedido entregue. Obrigado!</p>}
                    </div>
                  </motion.div>
                )}
              </>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
