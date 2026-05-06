export type CuisineStyleId = string

export const CUISINE_STYLES: { id: string; label: string; emoji: string }[] = [
  { id: 'gratin',        label: 'Gratins',           emoji: '🧀' },
  { id: 'pates',         label: 'Pâtes crémeuses',   emoji: '🍝' },
  { id: 'curry',         label: 'Curry doux',        emoji: '🍛' },
  { id: 'wok',           label: 'Wok & sauté',       emoji: '🥘' },
  { id: 'bowl',          label: 'Bowls healthy',     emoji: '🥗' },
  { id: 'asiatique',     label: 'Cuisine asiatique', emoji: '🥢' },
  { id: 'mediterraneen', label: 'Méditerranéen',     emoji: '🫒' },
  { id: 'burger',        label: 'Burgers maison',    emoji: '🍔' },
  { id: 'pizza',         label: 'Pizzas & tartes',   emoji: '🍕' },
  { id: 'soupe',         label: 'Soupes',            emoji: '🍲' },
  { id: 'risotto',       label: 'Risotto & riz',     emoji: '🍚' },
  { id: 'proteine',      label: 'Plats protéinés',   emoji: '💪' },
  { id: 'salade',        label: 'Salades composées', emoji: '🥬' },
  { id: 'traditionnel',  label: 'Cuisine tradi',     emoji: '🇫🇷' },
  { id: 'enfant',        label: 'Plats enfants',     emoji: '👦' },
]

const STYLE_LABEL: Record<string, string> = Object.fromEntries(
  CUISINE_STYLES.map((s) => [s.id, s.label])
)

export function cuisineStylesPromptLine(styleIds: string[]): string {
  if (styleIds.length === 0) return ''
  const labels = styleIds.map((id) => STYLE_LABEL[id] ?? id).join(', ')
  return `STYLES APPRÉCIÉS : ${labels}. Propose en priorité des recettes dans ces styles quand le stock le permet.`
}
