import { FaCheckCircle, FaMotorcycle, FaClock, FaTimes, FaHamburger, FaGlassWhiskey, FaCoffee, FaBeer, FaUtensils, FaStar, FaDollarSign, FaHeart, FaMars, FaVenus, FaGenderless, FaShoppingBag, FaLink } from "react-icons/fa";
import { motion } from "framer-motion";
import React from "react";
import { Pedido } from "../utils/indexedDB";
import { calcularTempoDoPedido, formatarDuracao, pedidoEstaAtrasado } from "../utils/pedidoTempo";
import { playUiSound } from "../utils/sound";

interface PedidoCardProps {
  pedido: Pedido;
  status: string;
  onStatusChange: (id: string, novoStatus: string) => void;
  now: number;
  onOpenDetails?: (pedido: Pedido) => void;
}

export default function PedidoCard({ pedido, status, now, onStatusChange, onOpenDetails }: PedidoCardProps) {
  const tempoMs = calcularTempoDoPedido(pedido, now);
  const tempoFormatado =
    tempoMs !== null ? formatarDuracao(tempoMs) : pedido.tempo ?? "00:00";
  const atraso = pedidoEstaAtrasado(pedido, now);
  const showAtraso = atraso && status !== 'COMPLETO' && status !== 'CANCELADO';
  // helper types
  const tsCancelado = pedido.timestamps?.CANCELADO as string | undefined;
  const tsCompleto = pedido.timestamps?.COMPLETO as string | undefined;
  const muitoAtrasado = (tempoMs ?? 0) >= 60 * 60 * 1000 && (status === 'EM_AGUARDO' || status === 'EM_PREPARO' || status === 'PRONTO');
  
  const itensObjs = (pedido.itens || []).filter((i) => typeof i !== "string") as Array<{
    nome: string;
    quantidade?: number;
    preco?: number | string;
    icon?: string;
  }>;
  
  const totalItens = itensObjs.reduce((acc, it) => acc + (it.quantidade || 1), 0);
  const totalValor = itensObjs.reduce((acc, it) => {
    const precoNum = typeof it.preco === "number" ? it.preco : it.preco ? parseFloat(String(it.preco).toString().replace(/[^0-9.,]/g, '').replace(',', '.')) : 0;
    return acc + precoNum * (it.quantidade || 1);
  }, 0);
  
  // Gera avatar baseado no ID
  const avatar = (pedido.id?.[0] || "#").toUpperCase() + (pedido.id?.[1] || "").toUpperCase();
  
  const nomeCliente = `Pedido #${pedido.id}`;
  // PIN universal temporário
  const pinCode = '1111';

  const itemIcon = (nome: string, iconKey?: string) => {
    const key = (iconKey || nome).toLowerCase();
    if (key.includes('cafe') || key.includes('coffee')) return <FaCoffee className="text-xs" />;
    if (key.includes('coca') || key.includes('refrigerante') || key.includes('suco') || key.includes('guaran')) return <FaGlassWhiskey className="text-xs" />;
    if (key.includes('cerveja') || key.includes('beer')) return <FaBeer className="text-xs" />;
    if (key.includes('burger') || key.includes('x-') || key.includes('picanha') || key.includes('frango')) return <FaHamburger className="text-xs" />;
    return <FaUtensils className="text-xs" />;
  };

  // Cores por status
  const statusColors = {
    EM_AGUARDO: { bg: 'bg-gray-500/10', border: 'border-gray-500', text: 'text-gray-400', badge: 'bg-gray-500' },
    EM_PREPARO: { bg: 'bg-orange-500/10', border: 'border-orange-500', text: 'text-orange-500', badge: 'bg-orange-500' },
    PRONTO: { bg: 'bg-yellow-500/10', border: 'border-yellow-500', text: 'text-yellow-500', badge: 'bg-yellow-500' },
    EM_ROTA: { bg: 'bg-blue-500/10', border: 'border-blue-500', text: 'text-blue-500', badge: 'bg-blue-500' },
    COMPLETO: { bg: 'bg-green-500/10', border: 'border-green-500', text: 'text-green-500', badge: 'bg-green-500' },
    CANCELADO: { bg: 'bg-red-500/10', border: 'border-red-500', text: 'text-red-500', badge: 'bg-red-500' }
  } as const;

  const colors = statusColors[status as keyof typeof statusColors] || statusColors.EM_PREPARO;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={`backdrop-blur rounded-xl border ${colors.border} overflow-hidden hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 mb-3 cursor-grab active:cursor-grabbing theme-surface`}
    >
      <div
        draggable
        onDragStart={(e: React.DragEvent<HTMLDivElement>) => {
          try { e.dataTransfer.setData('application/x-pedido-id', pedido.id); } catch {}
        }}
      >
      {/* Header com avatar e tempo */}
      <div className={`${colors.bg} px-4 py-3 border-b border-zinc-800/30`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-full ${colors.bg} border-2 ${colors.border} flex items-center justify-center font-bold text-xs ${colors.text}`}>
              {avatar}
            </div>
            <div>
              <div className="font-semibold text-white text-sm leading-tight">{nomeCliente}</div>
              <div className="text-xs text-zinc-500 mt-0.5">
                {pedido.criadoEm ? new Date(pedido.criadoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
              </div>
            </div>
          </div>
          {status === 'CANCELADO' && tsCancelado ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-600/15 border border-red-600">
              <FaTimes className="text-xs text-red-400" />
              <span className="text-[11px] text-red-300 font-medium">{new Date(tsCancelado).toLocaleString('pt-BR', { hour:'2-digit', minute:'2-digit', day:'2-digit', month:'2-digit' })}</span>
            </div>
          ) : status === 'COMPLETO' && tsCompleto ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-600/15 border border-emerald-600">
              <FaCheckCircle className="text-xs text-emerald-400" />
              <span className="text-[11px] text-emerald-300 font-medium">{new Date(tsCompleto).toLocaleString('pt-BR', { hour:'2-digit', minute:'2-digit', day:'2-digit', month:'2-digit' })}</span>
            </div>
          ) : (
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${showAtraso ? 'bg-red-500/20 border border-red-500 animate-pulse' : 'bg-zinc-800/50'}`}>
              <FaClock className={`text-xs ${showAtraso ? 'text-red-400' : 'text-zinc-400'}`} />
              <span className={`text-xs font-mono font-semibold ${showAtraso ? 'text-red-400' : 'text-zinc-300'}`}>
                {tempoFormatado}
              </span>
            </div>
          )}
        </div>
        {/* PIN badge */}
        <div className="mt-2">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-zinc-800/60 border border-zinc-700 text-[11px] text-zinc-300 font-mono">
            PIN
            <span className="text-white font-bold">{pinCode}</span>
          </span>
        </div>
        {/* Cliente */}
        {pedido.cliente && (
          <div className="flex items-center gap-2 text-xs text-zinc-300 mt-1">
            {pedido.cliente.genero === 'M' ? <FaMars className="text-blue-400" />
              : pedido.cliente.genero === 'F' ? <FaVenus className="text-pink-400" />
              : <FaGenderless className="text-zinc-400" />}
            <span className="font-semibold">{pedido.cliente.nick}</span>
            <span className="text-zinc-500">•</span>
            <span className="font-mono text-zinc-400">{pedido.cliente.id}</span>
            <span className="text-zinc-500">•</span>
            <span className="flex items-center gap-1">
              <span className="font-mono text-yellow-400">{Math.min(5, Math.max(1, pedido.cliente.estrelas ?? 3))}</span>
              <FaStar className="text-yellow-400" />
            </span>
            <span className="flex items-center gap-1">
              <span className="font-mono text-emerald-400">{Math.min(5, Math.max(1, pedido.cliente.gasto ?? 3))}</span>
              <FaDollarSign className="text-emerald-400" />
            </span>
            <span className="flex items-center gap-1">
              <span className="font-mono text-rose-400">{Math.min(5, Math.max(1, pedido.cliente.simpatia ?? 3))}</span>
              <FaHeart className="text-rose-400" />
            </span>
            <span className="flex items-center gap-1">
              <span className="font-mono text-zinc-300">{(() => {
                const compras = pedido.cliente?.compras;
                if (typeof compras === 'number') return compras;
                const base = (pedido.cliente?.id || pedido.id || 'Z').split('').reduce((a,c)=> a + c.charCodeAt(0), 0);
                return (base % 20) + 1;
              })()}</span>
              <FaShoppingBag className="text-zinc-300" />
            </span>
          </div>
        )}
      </div>

      {/* Lista de itens */}
      <div className="p-4">
        <div className="space-y-2 mb-3">
          {pedido.itens && pedido.itens.map((item, idx) => (
            typeof item === 'string' ? (
              <div key={idx} className="flex items-center gap-2 text-sm">
                <span className={`min-w-6 h-6 rounded-md ${colors.bg} ${colors.text} flex items-center justify-center text-xs font-bold`}>
                  1x
                </span>
                <span className="text-zinc-200 font-medium flex-1">{item}</span>
              </div>
            ) : (
              (() => {
                const itemObj = item as { nome: string; quantidade?: number; preco?: number | string; icon?: string };
                const qty = itemObj.quantidade || 1;
                const preco = itemObj.preco ? (typeof itemObj.preco === 'number' ? itemObj.preco : parseFloat(String(itemObj.preco))) : 0;
                return (
                  <div key={idx} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 flex-1">
                      <span className={`min-w-6 h-6 rounded-md ${colors.bg} ${colors.text} flex items-center justify-center text-xs font-bold`}>
                        {qty}x
                      </span>
                      <span className={`w-7 h-7 rounded-full ${colors.bg} ${colors.text} flex items-center justify-center`}>{itemIcon(itemObj.nome, itemObj.icon)}</span>
                      <span className="text-zinc-200 font-medium">{itemObj.nome}</span>
                    </div>
                    {itemObj.preco && (
                      <span className="text-zinc-400 font-mono text-xs ml-2">
                        R$ {(preco * qty).toFixed(2)}
                      </span>
                    )}
                  </div>
                );
              })()
            )
          ))}
        </div>

        {/* Observações */}
        {pedido.observacoes && (
          <div className="bg-zinc-800/30 rounded-lg p-2.5 mb-3 border border-zinc-800">
            <div className="text-xs text-zinc-500 mb-1 font-semibold">Observações:</div>
            <div className="text-xs text-zinc-300 italic">{pedido.observacoes}</div>
          </div>
        )}

        {/* Informações de pagamento e entrega */}
        <div className="flex items-center justify-between pt-3 border-t border-zinc-800/30">
          <div className="space-y-1">
            {pedido.pagamento && (
              <div className="text-xs text-zinc-500">
                <span className="font-semibold text-zinc-400">Pagamento:</span> {pedido.pagamento}
              </div>
            )}
            {pedido.entrega && (
              <div className="text-xs text-zinc-500">
                <span className="font-semibold text-zinc-400">Entrega:</span> {pedido.entrega}
              </div>
            )}
          </div>
          <div className="text-right">
            <div className="text-xs text-zinc-500 mb-1">{totalItens} {totalItens === 1 ? 'item' : 'itens'}</div>
            <div className={`text-lg font-bold ${colors.text}`}>
              R$ {totalValor.toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      {/* Botões de ação */}
      <div className="px-4 pb-4 grid grid-cols-2 gap-2">
        {onOpenDetails && (
          <button
            className="py-2.5 px-3 rounded-lg font-semibold text-xs transition-all duration-200 bg-transparent border border-zinc-600/60 text-zinc-300 hover:bg-zinc-800/60 flex items-center justify-center gap-2"
            draggable={false}
            onMouseEnter={() => playUiSound('hover')}
            onClick={() => { playUiSound('click'); onOpenDetails(pedido); }}
          >
            Detalhes
          </button>
        )}
        <button
          className="py-2.5 px-3 rounded-lg font-semibold text-xs transition-all duration-200 bg-transparent border border-zinc-600/60 text-zinc-300 hover:bg-zinc-800/60 flex items-center justify-center gap-2"
          draggable={false}
          onMouseEnter={() => playUiSound('hover')}
          onClick={() => { playUiSound('click'); if (typeof window !== 'undefined') { window.open(`/pedido/${pedido.id}`, '_blank', 'noopener,noreferrer'); }}}
          title="Abrir página pública do pedido"
        >
          <FaLink className="text-sm" />
          Pedido Link
        </button>
        {status === "EM_AGUARDO" && (
          <>
            <button
              className="flex-1 py-2.5 px-3 rounded-lg font-semibold text-xs transition-all duration-200 bg-orange-500/10 text-orange-500 border border-orange-500 hover:bg-orange-500/20 flex items-center justify-center gap-2"
              draggable={false}
              onMouseEnter={() => playUiSound('hover')}
              onClick={() => { playUiSound('click'); onStatusChange(pedido.id, "EM_PREPARO"); }}
            >
              <FaClock className="text-sm" />
              Iniciar Preparo
            </button>
            <button
              className="flex-1 py-2.5 px-3 rounded-lg font-semibold text-xs transition-all duration-200 bg-transparent border border-red-500/50 text-red-400 hover:bg-red-500/10 hover:border-red-500 flex items-center justify-center gap-2"
              draggable={false}
              onMouseEnter={() => playUiSound('hover')}
              onClick={() => { playUiSound('click'); onStatusChange(pedido.id, "CANCELADO"); }}
            >
              <FaTimes className="text-sm" />
              Cancelar
            </button>
          </>
        )}
        {status === "EM_PREPARO" && (
          <>
            <button
              className="flex-1 py-2.5 px-3 rounded-lg font-semibold text-xs transition-all duration-200 bg-yellow-500/10 text-yellow-500 border border-yellow-500 hover:bg-yellow-500/20 flex items-center justify-center gap-2"
              draggable={false}
              onMouseEnter={() => playUiSound('hover')}
              onClick={() => { playUiSound('click'); onStatusChange(pedido.id, "PRONTO"); }}
            >
              <FaCheckCircle className="text-sm" />
              Pronto
            </button>
            <button
              className="flex-1 py-2.5 px-3 rounded-lg font-semibold text-xs transition-all duration-200 bg-transparent border border-red-500/50 text-red-400 hover:bg-red-500/10 hover:border-red-500 flex items-center justify-center gap-2"
              draggable={false}
              onMouseEnter={() => playUiSound('hover')}
              onClick={() => { playUiSound('click'); onStatusChange(pedido.id, "CANCELADO"); }}
            >
              <FaTimes className="text-sm" />
              Cancelar
            </button>
          </>
        )}
        {status === "PRONTO" && (
          <>
            <button
              className="flex-1 py-2.5 px-3 rounded-lg font-semibold text-xs transition-all duration-200 bg-blue-500/10 text-blue-500 border border-blue-500 hover:bg-blue-500/20 flex items-center justify-center gap-2"
              draggable={false}
              onMouseEnter={() => playUiSound('hover')}
              onClick={() => { playUiSound('click'); onStatusChange(pedido.id, "EM_ROTA"); }}
            >
              <FaMotorcycle className="text-sm" />
              Em Rota
            </button>
            <button
              className="flex-1 py-2.5 px-3 rounded-lg font-semibold text-xs transition-all duration-200 bg-transparent border border-red-500/50 text-red-400 hover:bg-red-500/10 hover:border-red-500 flex items-center justify-center gap-2"
              draggable={false}
              onMouseEnter={() => playUiSound('hover')}
              onClick={() => { playUiSound('click'); onStatusChange(pedido.id, "CANCELADO"); }}
            >
              <FaTimes className="text-sm" />
              Cancelar
            </button>
          </>
        )}
        {status === "EM_ROTA" && (
          <button
            className="col-span-2 py-2.5 px-3 rounded-lg font-semibold text-xs transition-all duration-200 bg-green-500/10 text-green-500 border border-green-500 hover:bg-green-500/20 flex items-center justify-center gap-2"
            onMouseEnter={() => playUiSound('hover')}
            onClick={() => { playUiSound('click'); onStatusChange(pedido.id, "COMPLETO"); }}
            draggable={false}
          >
            <FaCheckCircle className="text-sm" />
            Completar Entrega
          </button>
        )}
        {muitoAtrasado && (
          <button
            className="col-span-2 py-2.5 px-3 rounded-lg font-semibold text-xs transition-all duration-200 bg-red-600/20 text-red-300 border border-red-500 animate-pulse flex items-center justify-center gap-2"
            onMouseEnter={() => playUiSound('hover')}
            onClick={() => { playUiSound('click'); onStatusChange(pedido.id, 'CANCELADO'); }}
          >
            Muito atrasado, cancelar?
          </button>
        )}
      </div>
      </div>
    </motion.div>
  );
}
