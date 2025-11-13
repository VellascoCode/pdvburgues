import { useRouter } from 'next/router';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FaHourglassHalf, FaUtensils, FaClock, FaMotorcycle, FaCheckCircle, FaTimesCircle, 
  FaShoppingBag, FaDollarSign, FaMapMarkerAlt, FaFileAlt, FaShieldAlt, FaUser, FaRoad, FaHashtag, FaCity, FaStar
} from 'react-icons/fa';
import { playUiSound } from '@/utils/sound';

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
  total?: number;
  // safe snapshot from public API
  clienteInfo?: { nick?: string; nome?: string; endereco?: { rua?: string; numero?: string; bairro?: string; cidade?: string; uf?: string; complemento?: string } };
  classificacao?: Record<'1'|'2'|'3', number>;
};

export default function PublicPedido() {
  const router = useRouter();
  const { id } = router.query as { id?: string };
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
  const [pinOk, setPinOk] = useState<string | null>(null);
  const [rated, setRated] = useState<Record<'1'|'2'|'3', number> | null>(() => {
    if (typeof window === 'undefined') return null;
    try { const v = localStorage.getItem('pedido:rate:'+String(id||'')); return v ? JSON.parse(v) as Record<'1'|'2'|'3', number> : null; } catch { return null; }
  });
  const [draft, setDraft] = useState<Partial<Record<'1'|'2'|'3', number>>>({});
  const [hover, setHover] = useState<Partial<Record<'1'|'2'|'3', number>>>({});

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
        // Expirado: COMPLETO há mais de 1h => indisponível
        try {
          const tsComp = fetched.timestamps?.COMPLETO ? Date.parse(String(fetched.timestamps.COMPLETO)) : undefined;
          if (String(fetched.status).toUpperCase() === 'COMPLETO' && tsComp && (Date.now() - tsComp) > 60 * 60 * 1000) {
            setErro('pedido cancelado ou inexistente');
            setPedido(null);
            setLoading(false);
            return;
          }
        } catch {}
        setPedido(fetched);
      }
      setLoading(false);
    });

    return () => { alive = false; };
  }, [id]);

  // Relógio estável no client para tempos relativos
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const it = setInterval(tick, 15000);
    return () => clearInterval(it);
  }, []);

  // Foca no primeiro input ao carregar + som de abertura/fechamento
  useEffect(() => {
    playUiSound('open');
    if (!blocked && !successPin) inputsRef.current[0]?.focus();
    return () => { playUiSound('close'); };
  }, [blocked, successPin]);

  // Preenche PIN via query (?code=1234) e tenta abrir automaticamente via API pública
  useEffect(() => {
    const code = typeof router.query?.code === 'string' ? router.query.code : undefined;
    if (id && code && /^\d{4}$/.test(code) && !successPin) {
      const t = setTimeout(() => {
        setPin(code.split(''));
        fetch(`/api/pedidos/public?id=${encodeURIComponent(String(id))}&code=${encodeURIComponent(code)}`)
          .then(async (r) => {
            if (r.ok) {
              const j = await r.json() as Pedido;
              setPedido(j);
              setSuccessPin(true);
              setPinOk(code);
              if (j.classificacao) { try { setRated(j.classificacao); } catch {} }
            }
          })
          .catch(() => {});
      }, 0);
      return () => clearTimeout(t);
    }
  }, [router.query, id, successPin]);

  // Auto-refresh do status enquanto não COMPLETO, para ativar avaliação assim que entregar
  useEffect(() => {
    if (!successPin || rated || !id || !(pedido && pedido.status && pedido.status !== 'COMPLETO')) return;
    const code = pinOk || (typeof router.query?.code === 'string' ? String(router.query.code) : null);
    if (!code) return;
    let stop = false;
    const tick = async () => {
      try {
        const r = await fetch(`/api/pedidos/public?id=${encodeURIComponent(String(id))}&code=${encodeURIComponent(String(code))}`);
        if (r.ok) {
          const j = await r.json();
          if (!stop) setPedido(j as Pedido);
        }
      } catch {}
    };
    const iv = setInterval(tick, 15000);
    // primeira batida leve para acelerar
    setTimeout(tick, 3000);
    return () => { stop = true; clearInterval(iv); };
  }, [successPin, rated, pedido?.status, id, pinOk, router.query]);

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

  const canRate = !!(successPin && pedido?.status === 'COMPLETO' && !rated);

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
  const awards = (pedido as any)?.awards as Array<{ ev?: string; v?: number; at?: string }> | undefined;

  // Handlers PIN (agora validando no backend público)
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
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (blocked || successPin) return;
    if (pin.some(d => d === '')) {
      setErrorPin('Preencha todos os dígitos');
      setShake(true); setTimeout(() => setShake(false), 500);
      playSubmitSound('error');
      return;
    }
    const pinStr = pin.join('');
    try {
      const r = await fetch(`/api/pedidos/public?id=${encodeURIComponent(String(id||''))}&code=${encodeURIComponent(pinStr)}`);
      if (r.status === 410) {
        setErrorPin('Pedido expirado.'); setShake(true); setTimeout(() => setShake(false), 500); playSubmitSound('error'); return;
      }
      if (!r.ok) { setErrorPin('PIN incorreto.'); setShake(true); setTimeout(() => setShake(false), 500); playSubmitSound('error'); return; }
      const j = await r.json();
      setPedido(j as Pedido);
      setSuccessPin(true);
      setPinOk(pinStr);
      if ((j as any)?.classificacao) { try { setRated((j as any).classificacao); } catch {} }
      playSubmitSound('success');
    } catch {
      setErrorPin('Falha ao validar PIN.'); setShake(true); setTimeout(() => setShake(false), 500); playSubmitSound('error');
    }
  };

  const currIdx = steps.findIndex(x => x.key === pedido?.status);

  // Endereço real (sem simulação)
  const addr = useMemo(() => {
    const info: any = (pedido as any)?.cliente || (pedido as any)?.clienteInfo;
    const e = info?.endereco;
    const nomeReal = info?.nome || info?.nick;
    if (e) return { nome: nomeReal || 'Cliente', rua: e.rua || '—', numero: e.numero || '—', bairro: e.bairro || '—', cidade: e.cidade || '—', uf: e.uf || '—' } as const;
    const ent = String(pedido?.entrega || '').toUpperCase();
    if (ent === 'RETIRADA' || ent === 'BALCÃO' || (pedido as any)?.cliente?.id === 'BALC') return { nome: 'Em loja', rua: '—', numero: '—', bairro: '—', cidade: '—', uf: '—' } as const;
    return { nome: '—', rua: '—', numero: '—', bairro: '—', cidade: '—', uf: '—' } as const;
  }, [pedido]);

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
                className="text-center flex flex-col items-center gap-3"
              >
                <motion.div
                  animate={{ scale: [1, 1.06, 1] }}
                  transition={{ duration: 1.2, repeat: 2, ease: 'easeInOut' }}
                  onViewportEnter={() => playUiSound('error')}
                >
                  <FaTimesCircle className="text-3xl text-orange-400" />
                </motion.div>
                <p className="font-semibold text-orange-300">Obrigado por acompanhar!</p>
                <p className="text-zinc-300 text-sm max-w-md">
                  Este link não está disponível no momento. Entre em contato com a loja/empresa para verificar as informações do seu pedido.
                </p>
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
                            aria-label={`Dígito ${idx+1} do PIN`}
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
                    {/* shimmer removido */}
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
                      {pedido?.pagamento && (
                        <span className="ml-2 text-xs px-2.5 py-1 rounded-full border border-zinc-700 text-zinc-300 bg-zinc-800/40">
                          <span className="inline-flex items-center gap-1"><FaDollarSign className="text-zinc-400" /> {pedido.pagamento}</span>
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
                      {Array.isArray(awards) && awards.length > 0 && (
                        <div className="mt-2 text-xs text-emerald-300/90">
                          Ganhou {awards.reduce((a,b)=> a + (Number(b.v||1)), 0)} ponto(s){awards[0]?.ev ? ` — ${awards[0].ev}` : ''}
                        </div>
                      )}
                      {pedido?.pagamento && (
                        <div className="mt-1 text-sm text-zinc-300"><span className="text-zinc-400">Pagamento:</span> {pedido.pagamento}</div>
                      )}
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
                        <div className="flex items-center gap-2"><FaCity className="text-zinc-400" /><span>Cidade: {addr.cidade || '—'}</span></div>
                        <div className="flex items-center gap-2"><FaCity className="text-zinc-400" /><span>UF: {addr.uf || '—'}</span></div>
                      </div>
                    </div>

                    {/* Observações (w-full) */}
                    <div className="bg-zinc-800/40 border border-zinc-700 rounded-xl p-4 mb-2" onMouseEnter={() => playUiSound('hover')}>
                      <div className="flex items-center gap-2 text-zinc-300 mb-1"><FaFileAlt className="text-cyan-400" /><span className="font-semibold">Observações</span></div>
                      <div className="text-sm text-zinc-200 whitespace-pre-wrap break-words">{pedido?.observacoes?.trim() ? pedido.observacoes : 'Sem descrição'}</div>
                    </div>

                    {/* Avaliação (uma vez / 3 categorias) */}
                    <div className="bg-zinc-800/40 border border-zinc-700 rounded-xl p-4 mb-2" onMouseEnter={() => playUiSound('hover')}>
                      <div className="text-sm text-zinc-300 mb-2">Como foi sua experiência?</div>
                      {(['1','2','3'] as const).map((key) => (
                        <div key={key} className="flex items-center gap-2 mb-2">
                          <div className="min-w-24 text-xs text-zinc-400 capitalize">{key==='1'?'pedido':key==='2'?'atendimento':'entrega'}</div>
                          <div className="flex items-center gap-1">
                            {[1,2,3,4,5].map((h) => {
                              // prioridade: salvo (rated) > rascunho (draft) > hover
                              const current = (rated as any)?.[key] ?? (draft as any)?.[key] ?? (hover as any)?.[key] ?? 0;
                              const filled = current >= h;
                              const color = key==='1' ? (filled ? 'text-emerald-400' : 'text-zinc-600') : key==='2' ? (filled ? 'text-yellow-400' : 'text-zinc-600') : (filled ? 'text-orange-400' : 'text-zinc-600');
                              const Icon = key==='1' ? FaShoppingBag : key==='2' ? FaStar : FaMotorcycle;
                              return (
                                <button
                                  key={h}
                                  type="button"
                                  disabled={!canRate}
                                  onClick={async()=>{
                                    if (!canRate) return;
                                    const next = { ...(draft as any), [key]: h } as Record<'1'|'2'|'3', number>;
                                    setDraft(next);
                                    const ready = next['1'] && next['2'] && next['3'];
                                    if (ready && pinOk && !rated) {
                                      try {
                                        const r = await fetch('/api/pedidos/feedback', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id, code: pinOk, classificacao: next }) });
                                        if (r.ok) { const j = await r.json(); const saved = (j.classificacao || next) as Record<'1'|'2'|'3', number>; setRated(saved); try { localStorage.setItem('pedido:rate:'+String(id||''), JSON.stringify(saved)); } catch {}; playUiSound('success'); }
                                      } catch {}
                                    }
                                  }}
                                  onMouseEnter={()=> { if (!rated && canRate) setHover(prev => ({ ...prev, [key]: h })); }}
                                  onMouseLeave={()=> { if (!rated && canRate) setHover(prev => { const cp: any = { ...prev }; delete cp[key]; return cp; }); }}
                                  className={`text-xl sm:text-2xl transition-transform ${(!rated && canRate) ? 'hover:scale-110 cursor-pointer' : 'cursor-default'} ${color}`}
                                  aria-label={`${key==='1'?'pedido':key==='2'?'atendimento':'entrega'} ${h} de 5`}
                                >
                                  <Icon />
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                      {!rated && pedido?.status !== 'COMPLETO' && (
                        <div className="text-xs text-zinc-400">Você poderá avaliar quando o pedido for entregue.</div>
                      )}
                      {rated ? (
                        <div className="text-xs text-zinc-400 mt-1">Obrigado pelo feedback!</div>
                      ) : null}
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
                                <div
                                  className={`w-9 h-9 rounded-full border flex items-center justify-center ${done ? 'border-orange-500 bg-orange-500/10' : 'border-zinc-700 bg-zinc-900'}`}
                                >
                                  <Icon className={`${done ? 'text-orange-400' : 'text-zinc-500'} text-sm`} />
                                </div>
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
