import type { ProductPrepItem } from '@/types/product';
import type { IconKey } from '@/components/food-icons';

export type PrepTag =
  | 'COZINHA_GERAL'
  | 'COZINHA_QUENTE'
  | 'COZINHA_FRIA'
  | 'CHAPA'
  | 'FRITADEIRA'
  | 'FORNO'
  | 'MONTAGEM'
  | 'EMBALAGEM'
  | 'BEBIDAS_BAR'
  | 'PRONTO_ENTREGA';

type PrepTagMeta = {
  key: PrepTag;
  label: string;
  shortLabel: string;
  description: string;
  colorClass: string;
  kitchen: boolean;
};

export const PREP_TAGS: PrepTagMeta[] = [
  { key: 'COZINHA_GERAL', label: 'Cozinha geral', shortLabel: 'Cozinha', description: 'Preparos padrão de cozinha', colorClass: 'text-emerald-300 border-emerald-500 bg-emerald-500/10', kitchen: true },
  { key: 'COZINHA_QUENTE', label: 'Cozinha quente', shortLabel: 'Quente', description: 'Molhos, grelhados e fogão', colorClass: 'text-orange-300 border-orange-500 bg-orange-500/10', kitchen: true },
  { key: 'COZINHA_FRIA', label: 'Cozinha fria', shortLabel: 'Fria', description: 'Saladas, sobremesas frias', colorClass: 'text-sky-300 border-sky-500 bg-sky-500/10', kitchen: true },
  { key: 'CHAPA', label: 'Chapa/Grill', shortLabel: 'Chapa', description: 'Hambúrgueres e grelha direta', colorClass: 'text-amber-300 border-amber-500 bg-amber-500/10', kitchen: true },
  { key: 'FRITADEIRA', label: 'Fritadeira', shortLabel: 'Fritura', description: 'Batatas, empanados', colorClass: 'text-yellow-300 border-yellow-500 bg-yellow-500/10', kitchen: true },
  { key: 'FORNO', label: 'Forno/Pizza', shortLabel: 'Forno', description: 'Pizzas, assados, massas', colorClass: 'text-red-300 border-red-500 bg-red-500/10', kitchen: true },
  { key: 'MONTAGEM', label: 'Montagem/Expedição', shortLabel: 'Montagem', description: 'Finalização e embalagem', colorClass: 'text-purple-300 border-purple-500 bg-purple-500/10', kitchen: true },
  { key: 'EMBALAGEM', label: 'Embalagem/Delivery', shortLabel: 'Embalagem', description: 'Separação e despacho', colorClass: 'text-pink-300 border-pink-500 bg-pink-500/10', kitchen: true },
  { key: 'BEBIDAS_BAR', label: 'Bebidas/Bar', shortLabel: 'Bar', description: 'Bebidas, cafés, drinks', colorClass: 'text-blue-300 border-blue-500 bg-blue-500/10', kitchen: false },
  { key: 'PRONTO_ENTREGA', label: 'Pronto (sem preparo)', shortLabel: 'Pronto', description: 'Itens de pronta entrega/terceiros', colorClass: 'text-zinc-300 border-zinc-500 bg-zinc-500/10', kitchen: false },
];

export const DEFAULT_PREP_TAG: PrepTag = 'COZINHA_GERAL';

export const KITCHEN_PREP_TAGS: PrepTag[] = PREP_TAGS.filter((tag) => tag.kitchen).map((tag) => tag.key);

export function getPrepTagMeta(tag: PrepTag | undefined): PrepTagMeta {
  return PREP_TAGS.find((t) => t.key === tag) || PREP_TAGS[0];
}

const step = (nome: string, iconKey: IconKey, note?: string): ProductPrepItem => ({ nome, iconKey, note });

const PREP_TAG_DEFAULT_ITEMS: Record<PrepTag, ProductPrepItem[]> = {
  COZINHA_GERAL: [
    step('Separar mise en place', 'leaf', 'Folhas, frios e temperos'),
    step('Aquecer base', 'mug', 'Molhos ou caldos'),
    step('Finalizar montagem', 'utensils', 'Montar conforme cardápio'),
  ],
  COZINHA_QUENTE: [
    step('Pré-aquecer panela', 'mortar', 'Fogo médio'),
    step('Saltear proteínas', 'drumstick', 'Temperar antes'),
    step('Redução do molho', 'tint', 'Consistência cremosa'),
  ],
  COZINHA_FRIA: [
    step('Higienizar folhas', 'leaf', 'Secar bem'),
    step('Fatiar frios', 'cheese', 'Porções iguais'),
    step('Montar salada', 'tomato', 'Adicionar molhos na saída'),
  ],
  CHAPA: [
    step('Aquecer chapa', 'meatball', 'Untar com gordura'),
    step('Selar proteína', 'bacon', 'Ponto solicitado'),
    step('Descansar carne', 'bread', '1 minuto antes da montagem'),
  ],
  FRITADEIRA: [
    step('Pré-aquecer óleo', 'fries', '180ºC'),
    step('Fritar porções', 'fries', 'Virar na metade'),
    step('Escorrer e temperar', 'pepper', 'Sal imediato'),
  ],
  FORNO: [
    step('Pré-aquecer forno', 'pizza', '200ºC'),
    step('Assar produto', 'pizza', 'Tempo conforme ficha'),
    step('Finalizar cobertura', 'cheese', 'Adicionar toppings'),
  ],
  MONTAGEM: [
    step('Tostar pão/base', 'bread', 'Dourado leve'),
    step('Montar camadas', 'hamburger', 'Ordem padrão'),
    step('Conferir pedido', 'utensils', 'Comparar com ticket'),
  ],
  EMBALAGEM: [
    step('Separar embalagem', 'bread', 'Verificar integridade'),
    step('Identificar pedido', 'pepper', 'Etiqueta com ID'),
    step('Adicionar acompanhamentos', 'leaf', 'Guardanapos, molhos'),
  ],
  BEBIDAS_BAR: [
    step('Geladeira/copos', 'sodacan', 'Frescos'),
    step('Preparar bebida', 'cocktail', 'Dosagem correta'),
    step('Finalizar com topping', 'lemon', 'Gelo ou frutas'),
  ],
  PRONTO_ENTREGA: [],
};

export function getDefaultPrepItems(tag: PrepTag | undefined): ProductPrepItem[] {
  const key = tag || DEFAULT_PREP_TAG;
  return PREP_TAG_DEFAULT_ITEMS[key] || PREP_TAG_DEFAULT_ITEMS[DEFAULT_PREP_TAG];
}
