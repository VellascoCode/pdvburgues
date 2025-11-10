import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FaInfoCircle, FaEye, FaDollarSign, FaCog, FaPlus, FaPalette } from 'react-icons/fa';
import { ICONS, FOOD_KEYS, IconKey } from './food-icons';

type Categoria = 'burger' | 'bebida' | 'pizza' | 'hotdog' | 'sobremesa' | 'frango' | 'veg';

export type NewProductData = {
  nome: string;
  categoria: Categoria;
  preco: number;
  promo?: number;
  promoAtiva?: boolean;
  ativo: boolean;
  combo?: boolean;
  desc: string;
  stock: number | 'inf';
  iconKey: IconKey;
  cor: string;
  bg: string;
};

interface ProdutoModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (data: NewProductData) => void;
}

const CATEGORIAS: readonly Categoria[] = ['burger', 'bebida', 'pizza', 'hotdog', 'sobremesa', 'frango', 'veg'];

const CORES_ICONE = [
  'text-orange-400',
  'text-amber-400',
  'text-yellow-400',
  'text-lime-400',
  'text-emerald-400',
  'text-sky-400',
  'text-indigo-400',
  'text-purple-400',
  'text-pink-400',
  'text-fuchsia-300',
  'text-red-400',
  'text-rose-300',
  'text-zinc-200',
  'text-zinc-400',
];

const CORES_FUNDO = [
  'bg-orange-900/20',
  'bg-amber-900/20',
  'bg-yellow-900/20',
  'bg-lime-900/20',
  'bg-emerald-900/20',
  'bg-sky-900/20',
  'bg-indigo-900/20',
  'bg-purple-900/20',
  'bg-pink-900/20',
  'bg-fuchsia-900/20',
  'bg-red-900/20',
  'bg-rose-900/20',
  'bg-zinc-800/40',
  'bg-zinc-700/30',
];

function formatCurrency(value: string): string {
  const num = Number(value.replace(/\D/g, '') || '0') / 100;
  return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseCurrency(value: string): number {
  if (!value) return 0;
  const num = Number(value.replace(/\./g, '').replace(',', '.'));
  return isNaN(num) ? 0 : num;
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-zinc-400">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`w-12 h-7 rounded-full border transition-all relative shrink-0 ${
          checked ? 'bg-emerald-600 border-emerald-500' : 'bg-zinc-700 border-zinc-600'
        }`}
      >
        <span
          className={`absolute top-0.5 w-6 h-6 rounded-full bg-white transition-all ${
            checked ? 'left-[22px]' : 'left-0.5'
          }`}
        />
      </button>
    </div>
  );
}

function PinModal({
  onClose,
  onConfirm,
}: {
  onClose: () => void;
  onConfirm: () => void;
}) {
  const [pin, setPin] = useState(['', '', '', '']);
  const [error, setError] = useState('');

  const handlePinChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(0, 1);
    const newPin = [...pin];
    newPin[index] = digit;
    setPin(newPin);
  };

  const handleConfirm = () => {
    if (pin.join('') === '1234') {
      onConfirm();
      onClose();
    } else {
      setError('PIN inválido');
      setTimeout(() => setError(''), 1200);
    }
  };

  return (
    <motion.div
      className="fixed inset-0 z-60 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <motion.div
        className="relative w-full max-w-sm rounded-2xl border theme-border theme-surface bg-zinc-900 p-6 shadow-2xl"
        initial={{ y: 20, scale: 0.95 }}
        animate={{ y: 0, scale: 1 }}
        exit={{ y: 20, scale: 0.95 }}
      >
        <div className="flex items-center gap-2 mb-2">
          <FaInfoCircle className="text-zinc-400" />
          <h3 className="text-sm font-semibold theme-text">Aprovação Admin</h3>
        </div>
        <p className="text-xs text-zinc-500 mb-4">
          Digite o PIN do admin para confirmar o cadastro.
        </p>
        <div className="flex items-center justify-center gap-3 mb-4">
          {pin.map((digit, idx) => (
            <input
              key={idx}
              type="password"
              aria-label={`Dígito ${idx + 1} do PIN`}
              maxLength={1}
              inputMode="numeric"
              value={digit}
              onChange={(e) => handlePinChange(idx, e.target.value)}
              className="w-12 h-12 text-2xl text-center rounded-lg border theme-border bg-zinc-800/60 text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          ))}
        </div>
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center text-red-400 text-sm mb-3"
          >
            {error}
          </motion.div>
        )}
        <div className="flex items-center justify-end gap-2">
          <button
            className="px-4 py-2 rounded-lg border theme-border text-zinc-300 hover:bg-zinc-800 transition-colors"
            onClick={onClose}
          >
            Voltar
          </button>
          <button
            className="px-4 py-2 rounded-lg brand-btn text-white hover:opacity-90 transition-opacity"
            onClick={handleConfirm}
          >
            Confirmar
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function ProdutoModalContent({ onClose, onConfirm }: { onClose: () => void; onConfirm: (data: NewProductData) => void }) {
  const [nome, setNome] = useState('');
  const [categoria, setCategoria] = useState<Categoria>('burger');
  const [preco, setPreco] = useState('');
  const [promo, setPromo] = useState('');
  const [promoAtiva, setPromoAtiva] = useState(false);
  const [ativo, setAtivo] = useState(true);
  const [combo, setCombo] = useState(false);
  const [desc, setDesc] = useState('');
  const [stockInfinito, setStockInfinito] = useState(false);
  const [stock, setStock] = useState('');
  const [iconKey, setIconKey] = useState<IconKey>('hamburger');
  const [cor, setCor] = useState('text-orange-400');
  const [bg, setBg] = useState('bg-orange-900/20');
  const [pinModalOpen, setPinModalOpen] = useState(false);

  const handleSave = () => {
    onConfirm({
      nome,
      categoria,
      preco: parseCurrency(preco),
      promo: promo ? parseCurrency(promo) : undefined,
      promoAtiva: promoAtiva || undefined,
      ativo,
      combo: combo || undefined,
      desc,
      stock: stockInfinito ? 'inf' : Math.max(0, Math.floor(Number(stock || '0'))),
      iconKey,
      cor,
      bg,
    });
    onClose();
  };

  const isSaveDisabled = !nome.trim() || !preco;
  const IconComponent = ICONS[iconKey];

  return (
    <>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div className="absolute inset-0 bg-black/70" onClick={onClose} />
        <motion.div
          className="relative w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-2xl border theme-border theme-surface bg-zinc-900 shadow-2xl"
          initial={{ y: 20, scale: 0.95 }}
          animate={{ y: 0, scale: 1 }}
          exit={{ y: 20, scale: 0.95 }}
        >
          <div className="sticky top-0 z-10 theme-surface bg-zinc-900 border-b theme-border px-6 py-4">
            <div className="flex items-center gap-2">
              <FaPlus className="text-zinc-400" />
              <h2 className="text-white font-semibold text-xl">Adicionar Produto</h2>
            </div>
          </div>

          <div className="p-6">
            {/* Primeira linha: Preview + Informações Básicas */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Preview */}
              <div className="lg:col-span-4 lg:sticky lg:top-24">
                <div className="flex items-center gap-2 text-xs text-zinc-500 mb-3">
                  <FaEye className="text-zinc-400" />
                  <span>Pré-visualização</span>
                </div>
                <div className="rounded-xl border theme-border overflow-hidden w-full max-w-sm mx-auto">
                  <div className={`flex items-center justify-center py-12 ${bg}`}>
                    <IconComponent className={`${cor} w-16 h-16`} />
                  </div>
                  <div className="p-4 bg-zinc-900">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-semibold theme-text text-base truncate flex-1">
                        {nome || 'Novo produto'}
                      </h3>
                      <span className="text-xs px-2 py-1 rounded-full border theme-border text-zinc-300 whitespace-nowrap">
                        {categoria.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 line-clamp-2 mb-3">
                      {desc || 'Descrição do produto'}
                    </p>
                    <div className="flex items-center justify-between">
                      <div>
                        {promoAtiva && promo ? (
                          <div className="flex items-center gap-2">
                            <span className="text-rose-400 font-semibold">
                              R$ {promo || '0,00'}
                            </span>
                            <span className="text-zinc-500 line-through text-xs">
                              R$ {preco || '0,00'}
                            </span>
                          </div>
                        ) : (
                          <span className="theme-text font-semibold">R$ {preco || '0,00'}</span>
                        )}
                      </div>
                      <div className="text-xs text-zinc-400">
                        {stockInfinito ? '∞' : `Est: ${stock || 0}`}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Formulário - Informações Básicas */}
              <div className="lg:col-span-8 space-y-4">
                {/* Informações Básicas */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <FaInfoCircle className="text-zinc-400" />
                    <h3 className="text-sm font-semibold text-zinc-300">Informações Básicas</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="flex flex-col gap-1.5 sm:col-span-2">
                      <span className="text-xs text-zinc-400">Nome do Produto</span>
                      <input
                        type="text"
                        className="w-full rounded-lg border theme-border bg-zinc-900 text-zinc-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
                        value={nome}
                        onChange={(e) => setNome(e.target.value)}
                        placeholder="Ex: X-Burger Especial"
                      />
                    </label>

                    <label className="flex flex-col gap-1.5">
                      <span className="text-xs text-zinc-400">Categoria</span>
                      <select
                        className="w-full rounded-lg border theme-border bg-zinc-900 text-zinc-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
                        value={categoria}
                        onChange={(e) => setCategoria(e.target.value as Categoria)}
                      >
                        {CATEGORIAS.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat.charAt(0).toUpperCase() + cat.slice(1)}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="flex flex-col gap-1.5">
                      <span className="text-xs text-zinc-400 flex items-center gap-1.5">
                        <FaDollarSign className="text-zinc-400" />
                        Preço
                      </span>
                      <input
                        type="text"
                        className="w-full rounded-lg border theme-border bg-zinc-900 text-zinc-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
                        placeholder="0,00"
                        value={preco}
                        onChange={(e) => setPreco(formatCurrency(e.target.value))}
                      />
                    </label>

                    <label className="flex flex-col gap-1.5 sm:col-span-2">
                      <span className="text-xs text-zinc-400">Descrição</span>
                      <textarea
                        className="w-full rounded-lg border theme-border bg-zinc-900 text-zinc-200 px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-orange-500"
                        rows={3}
                        value={desc}
                        onChange={(e) => setDesc(e.target.value)}
                        placeholder="Descreva o produto..."
                      />
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Segunda linha: seções em largura total */}
            <div className="mt-8 space-y-8">
              {/* Promoção */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <FaDollarSign className="text-zinc-400" />
                  <h3 className="text-sm font-semibold text-zinc-300">Promoção</h3>
                </div>
                <div className="flex items-end gap-3">
                  <label className="flex flex-col gap-1.5 flex-1">
                    <span className="text-xs text-zinc-400 flex items-center gap-1.5">
                      <FaDollarSign className="text-zinc-400" />
                      Preço Promocional
                    </span>
                    <input
                      type="text"
                      className="w-full rounded-lg border theme-border bg-zinc-900 text-zinc-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
                      placeholder="0,00"
                      value={promo}
                      onChange={(e) => setPromo(formatCurrency(e.target.value))}
                    />
                  </label>
                  <Toggle
                    checked={promoAtiva}
                    onChange={setPromoAtiva}
                    label="Ativar"
                  />
                </div>
              </div>

              {/* Configurações */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <FaCog className="text-zinc-400" />
                  <h3 className="text-sm font-semibold text-zinc-300">Configurações</h3>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <Toggle checked={ativo} onChange={setAtivo} label="Ativo" />
                  <Toggle checked={combo} onChange={setCombo} label="Combo" />
                  <label className="flex flex-col gap-1.5 sm:col-span-2">
                    <span className="text-xs text-zinc-400">Estoque</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        disabled={stockInfinito}
                        className="flex-1 rounded-lg border theme-border bg-zinc-900 text-zinc-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50"
                        placeholder="0"
                        value={stock}
                        onChange={(e) => setStock(e.target.value)}
                      />
                      <button
                        type="button"
                        role="switch"
                        aria-checked={stockInfinito}
                        aria-label="Estoque infinito"
                        onClick={() => setStockInfinito(!stockInfinito)}
                        className={`w-12 h-9 rounded-lg border transition-all relative shrink-0 ${
                          stockInfinito
                            ? 'bg-emerald-600 border-emerald-500'
                            : 'bg-zinc-700 border-zinc-600'
                        }`}
                        title="Infinito"
                      >
                        <span
                          className={`absolute top-1 w-7 h-7 rounded-md bg-white transition-all flex items-center justify-center text-xs font-bold ${
                            stockInfinito ? 'left-[17px]' : 'left-1'
                          }`}
                        >
                          ∞
                        </span>
                      </button>
                    </div>
                  </label>
                </div>
              </div>

              {/* Ícone */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <FaPalette className="text-zinc-400" />
                  <h3 className="text-sm font-semibold text-zinc-300">Ícone</h3>
                </div>
                <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-2 p-3 rounded-lg border theme-border bg-zinc-900 max-h-48 overflow-y-auto">
                  {FOOD_KEYS.map((key) => {
                    const Icon = ICONS[key];
                    return (
                      <button
                        key={key}
                        type="button"
                        className={`aspect-square rounded-lg border flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 transition-all ${
                          iconKey === key
                            ? 'border-orange-500 ring-2 ring-orange-500/40'
                            : 'theme-border'
                        }`}
                        onClick={() => setIconKey(key)}
                        aria-label={`Selecionar ícone ${key}`}
                      >
                        <Icon className={`${cor} w-6 h-6`} />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Cores */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-zinc-400">Cor do Ícone</h3>
                  <div className="grid grid-cols-7 gap-1.5">
                    {CORES_ICONE.map((color) => (
                      <button
                        key={color}
                        type="button"
                        title={color}
                        className={`h-8 rounded-lg border flex items-center justify-center transition-all ${
                          cor === color ? 'ring-2 ring-orange-500 scale-110' : 'theme-border'
                        }`}
                        onClick={() => setCor(color)}
                        aria-label={`Selecionar cor ${color}`}
                      >
                        <span className={`${color} text-xl`}>●</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-zinc-400">Cor de Fundo</h3>
                  <div className="grid grid-cols-7 gap-1.5">
                    {CORES_FUNDO.map((bgColor) => (
                      <button
                        key={bgColor}
                        type="button"
                        title={bgColor}
                        className={`h-8 rounded-lg border transition-all overflow-hidden ${
                          bg === bgColor ? 'ring-2 ring-orange-500 scale-110' : 'theme-border'
                        }`}
                        onClick={() => setBg(bgColor)}
                        aria-label={`Selecionar fundo ${bgColor}`}
                      >
                        <span className={`block w-full h-full ${bgColor}`} />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

                {/* Footer */}
                <div className="sticky bottom-0 theme-surface bg-zinc-900 border-t theme-border px-6 py-4 flex items-center justify-end gap-3">
                  <button
                    className="px-5 py-2 rounded-lg border theme-border text-zinc-300 hover:bg-zinc-800 transition-colors"
                    onClick={onClose}
                  >
                    Cancelar
                  </button>
                  <button
                    className="px-5 py-2 rounded-lg brand-btn text-white disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
                    onClick={() => setPinModalOpen(true)}
                    disabled={isSaveDisabled}
                  >
                    Salvar Produto
                  </button>
                </div>
              </div>
        </motion.div>
      </motion.div>

      <AnimatePresence>
        {pinModalOpen && (
          <PinModal onClose={() => setPinModalOpen(false)} onConfirm={handleSave} />
        )}
      </AnimatePresence>
    </>
  );
}

export default function ProdutoModal({ open, onClose, onConfirm }: ProdutoModalProps) {
  return (
    <AnimatePresence>
      {open && <ProdutoModalContent onClose={onClose} onConfirm={onConfirm} />}
    </AnimatePresence>
  );
}
