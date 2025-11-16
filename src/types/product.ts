import type { IconKey } from "@/components/food-icons";

export type ProductPrepItem = {
  nome: string;
  iconKey?: IconKey;
  note?: string;
  externo?: boolean;
};
