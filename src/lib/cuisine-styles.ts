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

const STYLE_OPPOSITES: Record<string, string[]> = {
  wok:       ['gratin', 'quiche', 'tarte salée', 'béchamel', 'gratiné'],
  asiatique: ['gratin', 'quiche', 'tarte salée', 'béchamel', 'dauphinois'],
  bowl:      ['gratin', 'quiche', 'tarte salée'],
  salade:    ['gratin', 'plat mijoté lourd'],
}

export function cuisineStylesPromptLine(styleIds: string[]): string {
  if (styleIds.length === 0) return ''
  const labels = styleIds.map((id) => STYLE_LABEL[id] ?? id).join(', ')
  const toAvoid = [...new Set(styleIds.flatMap((id) => STYLE_OPPOSITES[id] ?? []))]
  const avoidLine = toAvoid.length > 0
    ? `\nÉvite autant que possible ces types contraires aux styles demandés, sauf si le stock ne permet pas de recette cohérente dans les styles choisis : ${toAvoid.join(', ')}.`
    : ''
  return `STYLES CUISINE DEMANDÉS (DEMANDE EXPLICITE) : ${labels}.
Propose AU MOINS 2 recettes sur 3 dans ces styles si le stock le permet. Ce n'est pas une préférence vague, c'est une demande explicite de la famille.${avoidLine}`
}
