export type FoodCategoryId =
  | 'viande_rouge'
  | 'volaille'
  | 'poisson'
  | 'fruits_mer'
  | 'oeufs'
  | 'fromage'
  | 'produits_laitiers'
  | 'legumes'
  | 'feculents'
  | 'legumineuses'
  | 'epices'

export type FoodCategory = {
  id: FoodCategoryId
  label: string
  emoji: string
}

export const FOOD_CATEGORIES: FoodCategory[] = [
  { id: 'viande_rouge',     label: 'Viande rouge',         emoji: '🥩' },
  { id: 'volaille',         label: 'Volaille',             emoji: '🍗' },
  { id: 'poisson',          label: 'Poisson',              emoji: '🐟' },
  { id: 'fruits_mer',       label: 'Fruits de mer',        emoji: '🦐' },
  { id: 'oeufs',            label: 'Œufs',                 emoji: '🥚' },
  { id: 'fromage',          label: 'Fromage',              emoji: '🧀' },
  { id: 'produits_laitiers',label: 'Produits laitiers',    emoji: '🥛' },
  { id: 'legumes',          label: 'Légumes',              emoji: '🥦' },
  { id: 'feculents',        label: 'Féculents',            emoji: '🍝' },
  { id: 'legumineuses',     label: 'Légumineuses',         emoji: '🫘' },
  { id: 'epices',           label: 'Épices & condiments',  emoji: '🌶️' },
]

export const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  FOOD_CATEGORIES.map((c) => [c.id, c.label])
)
