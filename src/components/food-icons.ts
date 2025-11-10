import React from 'react';
import {
  FaHamburger, FaLeaf, FaGlassWhiskey, FaCoffee, FaPizzaSlice, FaHotdog, FaIceCream,
  FaDrumstickBite, FaCheese, FaAppleAlt, FaBacon, FaBreadSlice, FaCarrot, FaFish,
  FaLemon, FaPepperHot, FaWineBottle, FaMugHot, FaBeer, FaCocktail, FaCookie,
  FaCookieBite, FaEgg, FaSeedling, FaUtensils, FaTint, FaWineGlass,
  FaWineGlassAlt, FaGlassMartiniAlt, FaGlassCheers, FaStroopwafel, FaBirthdayCake,
  FaCandyCane, FaMortarPestle, FaCloudMeatball
} from 'react-icons/fa';
import {
  GiStrawberry, GiBanana, GiGrapes, GiWatermelon, GiPineapple, GiCheeseWedge,
  GiMushroom, GiGarlic, GiTomato, GiNoodles, GiDonut, GiChocolateBar, GiFrenchFries,
  GiSodaCan, GiCupcake
} from 'react-icons/gi';

export type IconKey =
  | 'hamburger'|'leaf'|'whiskey'|'coffee'|'pizza'|'hotdog'|'icecream'|'drumstick'|'cheese'|'apple'|'bacon'|'bread'|'carrot'|'fish'|'lemon'|'pepper'
  | 'wine'|'mug'|'beer'|'cocktail'|'cookie'|'cookiebite'|'egg'|'seedling'|'utensils'|'tint'|'wineglass'|'wineglassalt'|'glassmartini'|'glasscheers'
  | 'stroopwafel'|'birthdaycake'|'candycane'|'mortar'|'meatball'
  | 'strawberry'|'banana'|'grapes'|'watermelon'|'pineapple'|'cheesewedge'|'mushroom'|'garlic'|'tomato'|'noodles'|'donut'|'chocolate'|'fries'|'sodacan'|'cupcake';

export const ICONS: Record<IconKey, React.ComponentType<{ className?: string }>> = {
  hamburger: FaHamburger,
  leaf: FaLeaf,
  whiskey: FaGlassWhiskey,
  coffee: FaCoffee,
  pizza: FaPizzaSlice,
  hotdog: FaHotdog,
  icecream: FaIceCream,
  drumstick: FaDrumstickBite,
  cheese: FaCheese,
  apple: FaAppleAlt,
  bacon: FaBacon,
  bread: FaBreadSlice,
  carrot: FaCarrot,
  fish: FaFish,
  lemon: FaLemon,
  pepper: FaPepperHot,
  wine: FaWineBottle,
  mug: FaMugHot,
  beer: FaBeer,
  cocktail: FaCocktail,
  cookie: FaCookie,
  cookiebite: FaCookieBite,
  egg: FaEgg,
  // blender removido da grade (mantido o import comentado para referência)
  seedling: FaSeedling,
  utensils: FaUtensils,
  tint: FaTint,
  wineglass: FaWineGlass,
  wineglassalt: FaWineGlassAlt,
  glassmartini: FaGlassMartiniAlt,
  glasscheers: FaGlassCheers,
  stroopwafel: FaStroopwafel,
  birthdaycake: FaBirthdayCake,
  candycane: FaCandyCane,
  mortar: FaMortarPestle,
  meatball: FaCloudMeatball,
  strawberry: GiStrawberry,
  banana: GiBanana,
  grapes: GiGrapes,
  watermelon: GiWatermelon,
  pineapple: GiPineapple,
  cheesewedge: GiCheeseWedge,
  mushroom: GiMushroom,
  garlic: GiGarlic,
  tomato: GiTomato,
  noodles: GiNoodles,
  donut: GiDonut,
  chocolate: GiChocolateBar,
  fries: GiFrenchFries,
  sodacan: GiSodaCan,
  cupcake: GiCupcake,
};

// Apenas ícones de alimentos/bebidas
export const FOOD_KEYS: Readonly<IconKey[]> = [
  'hamburger','pizza','hotdog','icecream','drumstick','cheese','apple','bacon','bread','carrot','fish','lemon','pepper',
  'coffee','mug','beer','cocktail','whiskey','wineglass','wineglassalt','wine','glassmartini','glasscheers',
  'cookie','cookiebite','egg','stroopwafel','birthdaycake','candycane','meatball','leaf','seedling','mortar',
  'strawberry','banana','grapes','watermelon','pineapple','cheesewedge','mushroom','garlic','tomato','noodles','donut','chocolate','fries','sodacan','cupcake'
] as const;
