import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FaInfoCircle, FaEye, FaDollarSign, FaCog, FaPlus, FaPalette, FaClipboardList } from 'react-icons/fa';
import { ICONS, FOOD_KEYS, IconKey } from './food-icons';
import { PREP_TAGS, PrepTag, DEFAULT_PREP_TAG, getPrepTagMeta, getDefaultPrepItems } from '@/constants/prepTags';
import type { ProductPrepItem } from '@/types/product';
import PinModal from '@/components/PinModal';

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
  prepTag: PrepTag;
  prepItems: ProductPrepItem[];
};

interface ProdutoModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (data: NewProductData, pin: string) => void;
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

// Removido PinModal local; usando componente compartilhado

function ProdutoModalContent({ onClose, onConfirm }: { onClose: () => void; onConfirm: (data: NewProductData, pin: string) => void }) {
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
  const [prepTag, setPrepTag] = useState<PrepTag>(DEFAULT_PREP_TAG);
  const [prepItems, setPrepItems] = useState<ProductPrepItem[]>(getDefaultPrepItems(DEFAULT_PREP_TAG));
  const [prepTouched, setPrepTouched] = useState(false);
  type CatOption = { key: Categoria; label: string; iconKey?: string; active?: boolean };
  const [catOptions, setCatOptions] = useState<CatOption[]>([]);
  const [openCat, setOpenCat] = useState(false);
  const catRef = React.useRef<HTMLDivElement | null>(null);
  const isPronto = prepTag === 'PRONTO_ENTREGA';
  const handlePrepTagChange = (tag: PrepTag) => {
    setPrepTag(tag);
    if (tag === 'PRONTO_ENTREGA') {
      setPrepItems([]);
      setPrepTouched(false);
      return;
    }
    if (!prepTouched || prepItems.length === 0) {
      setPrepItems(getDefaultPrepItems(tag));
      setPrepTouched(false);
    }
  };

  const addPrepItem = () => {
    setPrepTouched(true);
    setPrepItems((prev) => [...prev, { nome: '', iconKey: 'utensils', note: '' }]);
  };
  const updatePrepItem = (index: number, patch: Partial<ProductPrepItem>) => {
    setPrepTouched(true);
    setPrepItems((prev) => prev.map((item, idx) => (idx === index ? { ...item, ...patch } : item)));
  };
  const removePrepItem = (index: number) => {
    setPrepTouched(true);
    setPrepItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Fecha dropdown de categoria com clique fora/ESC
  useEffect(() => {
    if (!openCat) return;
    const onClick = (e: MouseEvent) => {
      if (!catRef.current) return;
      if (!catRef.current.contains(e.target as Node)) setOpenCat(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenCat(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [openCat]);

  useEffect(() => {
    fetch('/api/categorias')
      .then(r => r.ok ? r.json() : [])
      .then((list: CatOption[]) => {
        if (Array.isArray(list) && list.length) setCatOptions(list);
      })
      .catch(() => {});
  }, []);

  const handleSave = (pin: string) => {
    const normalizedPrepItems =
      prepTag === 'PRONTO_ENTREGA'
        ? []
        : prepItems
            .map((item) => ({
              nome: item.nome.trim(),
              iconKey: item.iconKey,
              note: item.note?.trim() || undefined,
              externo: item.externo,
            }))
            .filter((item) => item.nome.length > 0)
            .slice(0, 10);
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
      prepTag,
      prepItems: normalizedPrepItems,
    }, pin);
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
        <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />
        <motion.div
          className="relative w-full max-w-5xl max-h-[90vh] overflow-y-auto ds-modal"
          initial={{ y: 20, scale: 0.95 }}
          animate={{ y: 0, scale: 1 }}
          exit={{ y: 20, scale: 0.95 }}
        >
          <div className="sticky top-0 z-10 ds-modal-header px-6 py-4 border-b backdrop-blur">
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
                <div className="p-4 ds-card">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex flex-col gap-1 flex-1 min-w-0">
                        <h3 className="font-semibold theme-text text-base truncate">
                          {nome || 'Novo produto'}
                        </h3>
                        <span className="text-[11px] px-2 py-0.5 rounded-full border theme-border text-zinc-300 w-fit">
                          {categoria.toUpperCase()}
                        </span>
                      </div>
                      <span className={`text-[11px] px-2 py-1 rounded-full border ${getPrepTagMeta(prepTag).colorClass} whitespace-nowrap`}>
                        {getPrepTagMeta(prepTag).shortLabel}
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
                        className="w-full ds-input"
                        value={nome}
                        onChange={(e) => setNome(e.target.value)}
                        placeholder="Ex: X-Burger Especial"
                      />
                    </label>

                    <div className="flex flex-col gap-1.5">
                      <span className="text-xs text-zinc-400">Categoria</span>
                    <div className="relative" ref={catRef}>
                      <button type="button" className="w-full ds-input text-left flex items-center justify-between" onClick={()=> setOpenCat(v=>!v)}>
                        <span className="flex items-center gap-2">
                          {(() => { const opt = (catOptions.find(c=> c.key===categoria)); const Icon = opt?.iconKey ? ICONS[opt.iconKey as IconKey] : null; return Icon ? <Icon className="w-4 h-4 text-zinc-400" /> : null; })()}
                          {(catOptions.find(c=> c.key===categoria)?.label) || (categoria.charAt(0).toUpperCase()+categoria.slice(1))}
                        </span>
                        <span className="text-zinc-500">▾</span>
                      </button>
                        {openCat && (
                          <div className="absolute z-20 mt-1 w-full max-h-56 overflow-auto ds-card shadow-xl">
                            {(catOptions.length ? catOptions.filter(c=> c.active !== false) : CATEGORIAS.map((k)=> ({ key: k as Categoria, label: k.charAt(0).toUpperCase()+k.slice(1) }))).map((c) => {
                              const Icon = (c as CatOption).iconKey ? ICONS[(c as CatOption).iconKey as IconKey] : null;
                              return (
                                <button key={(c as CatOption).key} className="w-full text-left px-3 py-2 text-sm hover:bg-white/5 rounded-lg" onClick={()=> { setCategoria((c as CatOption).key); setOpenCat(false); }}>
                                  {Icon && <Icon className="w-4 h-4 text-zinc-400" />}
                                  {(c as CatOption).label}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      <span className="text-[11px] text-zinc-500">Selecione a categoria ativa do catálogo</span>
                    </div>

                    <label className="flex flex-col gap-1.5">
                      <span className="text-xs text-zinc-400 flex items-center gap-1.5">
                        <FaDollarSign className="text-zinc-400" />
                        Preço
                      </span>
                      <input
                        type="text"
                        className="w-full ds-input"
                        placeholder="0,00"
                        value={preco}
                        onChange={(e) => setPreco(formatCurrency(e.target.value))}
                      />
                    </label>

                    <label className="flex flex-col gap-1.5 sm:col-span-2">
                      <span className="text-xs text-zinc-400">Descrição</span>
                      <textarea
                        className="w-full ds-input resize-none"
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

            {/* Tag de preparo */}
            <div className="mt-8 space-y-5">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2 text-zinc-300">
                  <FaEye className="text-zinc-400" />
                  <h3 className="text-sm font-semibold">Tag de preparo</h3>
                </div>
                <p className="text-xs text-zinc-500">
                  Selecione onde o item será preparado para organizar a fila da cozinha.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {PREP_TAGS.map((tag) => (
                  <button
                    key={tag.key}
                    type="button"
                    className={`text-left px-4 py-3 rounded-2xl border transition flex flex-col gap-1 shadow-inner ${
                      prepTag === tag.key
                        ? `${tag.colorClass} shadow-[0_0_0_1px_rgba(16,185,129,0.3)]`
                        : 'theme-border theme-surface text-zinc-300 hover:bg-white/5'
                    }`}
                    onClick={() => handlePrepTagChange(tag.key)}
                  >
                    <span className="text-sm font-semibold">{tag.label}</span>
                    <span className="text-[12px] text-zinc-400">{tag.description}</span>
                  </button>
                ))}
              </div>
              <div className={`space-y-3 ${isPronto ? 'opacity-60 pointer-events-none' : ''}`}>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2 text-zinc-300">
                    <FaClipboardList className="text-zinc-400" />
                    <h4 className="text-sm font-semibold">Itens de preparo</h4>
                  </div>
                  <button
                    type="button"
                    onClick={addPrepItem}
                    className="px-3 py-1.5 text-xs rounded-lg border theme-border text-zinc-300 hover:bg-white/5 transition disabled:opacity-30 disabled:cursor-not-allowed"
                    disabled={prepItems.length >= 10 || isPronto}
                  >
                    + Adicionar item
                  </button>
                </div>
                {prepItems.length === 0 ? (
                  <p className="text-xs text-zinc-500">
                    Nenhum item cadastrado. {isPronto ? 'Itens desabilitados para produtos prontos.' : 'Use o botão acima para listar as etapas na cozinha.'}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {prepItems.map((item, idx) => {
                      const StepIcon = item.iconKey ? ICONS[item.iconKey] : ICONS.utensils;
                      return (
                        <div key={`prep-item-${idx}`} className="ds-card p-3 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl border theme-border theme-surface flex items-center justify-center">
                                <StepIcon className="text-amber-300 text-xl" />
                              </div>
                              <div>
                                <label className="text-[11px] text-zinc-500 block mb-1">Ícone</label>
                                <select
                                  className="ds-input text-xs"
                                  value={item.iconKey || 'utensils'}
                                  onChange={(e) => updatePrepItem(idx, { iconKey: e.target.value as IconKey })}
                                >
                                  {FOOD_KEYS.map((key) => (
                                    <option key={key} value={key}>
                                      {key}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                            <button
                              type="button"
                              className="text-xs text-red-400 hover:text-red-300"
                              onClick={() => removePrepItem(idx)}
                            >
                              Remover
                            </button>
                          </div>
                          <label className="flex flex-col gap-1">
                            <span className="text-[11px] text-zinc-500">Nome do preparo</span>
                            <input
                              type="text"
                              className="ds-input text-sm"
                              value={item.nome}
                              onChange={(e) => updatePrepItem(idx, { nome: e.target.value })}
                              placeholder="Montar pão, fritar burger..."
                              disabled={isPronto}
                            />
                          </label>
                          <label className="flex flex-col gap-1">
                            <span className="text-[11px] text-zinc-500">Observação opcional</span>
                            <input
                              type="text"
                              className="ds-input text-sm"
                              value={item.note || ''}
                              onChange={(e) => updatePrepItem(idx, { note: e.target.value })}
                              placeholder="Ex.: usar pão brioche torrado"
                              disabled={isPronto}
                            />
                          </label>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              {isPronto && (
                <p className="text-xs text-amber-400">
                  Produtos marcados como “Pronto (sem preparo)” não exibem itens para a cozinha.
                </p>
              )}
            </div>

            {/* Segunda linha: seções em largura total */}
            <div className="mt-8 grid grid-cols-1 lg:grid-cols-5 gap-8">
              {/* Promoção */}
              <div className="space-y-3 md:pr-4 col-span-5 md:col-span-2">
                <div className="flex items-center gap-2 mb-2">
                  <FaDollarSign className="text-zinc-400" />
                  <h3 className="text-sm font-semibold text-zinc-300">Promoção</h3>
                </div>
                <div className="flex flex-col md:flex-row md:items-end gap-3">
                  <label className="flex flex-col gap-1.5 flex-1">
                    <span className="text-xs text-zinc-400 flex items-center gap-1.5">
                      <FaDollarSign className="text-zinc-400" />
                      Preço Promocional
                    </span>
                    <input
                      type="text"
                      className="w-full ds-input"
                      placeholder="0,00"
                      value={promo}
                      onChange={(e) => setPromo(formatCurrency(e.target.value))}
                    />
                  </label>
                  <div className="flex flex-row items-center gap-2 md:gap-3 mt-2 md:mt-0">
                    <Toggle
                      checked={promoAtiva}
                      onChange={setPromoAtiva}
                      label="Ativar"
                    />
                  </div>
                </div>
              </div>

              {/* Configurações */}
              <div className="space-y-3 px-0 md:px-2 mt-4 col-span-5 md:col-span-3">
                <div className="flex items-center gap-2 mb-2">
                  <FaCog className="text-zinc-400" />
                  <h3 className="text-sm font-semibold text-zinc-300">Configurações</h3>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 items-end">
                  <div>
                    <Toggle checked={ativo} onChange={setAtivo} label="Ativo" />
                  </div>
                  <div>
                    <Toggle checked={combo} onChange={setCombo} label="Combo" />
                  </div>
                  <label className="flex flex-col gap-1.5 md:col-span-3">
                    <span className="text-xs text-zinc-400">Estoque</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        disabled={stockInfinito}
                        className="flex-1 ds-input disabled:opacity-50"
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
              <div className="space-y-3 col-span-5">
                <div className="flex items-center gap-2">
                  <FaPalette className="text-zinc-400" />
                  <h3 className="text-sm font-semibold text-zinc-300">Ícone</h3>
                </div>
                <div className="grid  grid-cols-12 gap-2 p-3 ds-card overflow-y-auto">
                  {FOOD_KEYS.map((key) => {
                    const Icon = ICONS[key];
                    return (
                      <button
                        key={key}
                        type="button"
                        className={`aspect-square rounded-lg border flex items-center justify-center theme-border theme-surface hover:bg-white/5 transition-all ${
                          iconKey === key ? 'border-orange-500 ring-2 ring-orange-500/40' : ''
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 col-span-5">
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-zinc-400">Cor do Ícone</h3>
                  <div className="grid grid-cols-7 gap-1.5">
                    {CORES_ICONE.map((color) => (
                      <button
                        key={color}
                        type="button"
                        title={color}
                        className={`h-8 rounded-lg border flex items-center justify-center transition-all theme-border theme-surface ${
                          cor === color ? 'ring-2 ring-orange-500 scale-110' : ''
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
                        className={`h-8 rounded-lg border transition-all overflow-hidden theme-border theme-surface ${
                          bg === bgColor ? 'ring-2 ring-orange-500 scale-110' : ''
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
              <div className="border-t theme-border px-6 py-4 grid grid-cols-1 md:grid-cols-2 items-center justify-end gap-3 col-span-5 theme-surface rounded-2xl">
                <button
                  className="px-5 py-2 rounded-lg border theme-border text-zinc-300 hover:bg-white/5 transition-colors"
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

                {/* Footer */}
                
              </div>
        </motion.div>
      </motion.div>

      <PinModal open={pinModalOpen} title="Confirmação Admin" message="Digite o PIN do admin para confirmar o cadastro." onClose={() => setPinModalOpen(false)} onConfirm={async (p)=> { handleSave(p); return true; }} />
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
