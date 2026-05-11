type CookingMethod = 'saute' | 'mijote' | 'four' | 'cru'
type Heaviness = 'light' | 'normal' | 'heavy'

export type DishTemplate = {
  id: string
  name: string
  example: string
  styles: string[]
  moments: string[]     // empty = ['dejeuner', 'diner'] par défaut
  method: CookingMethod
  heaviness: Heaviness
}

const DEFAULT_MOMENTS = ['dejeuner', 'diner']

function isCompatibleMoment(t: DishTemplate, mealMoment: string): boolean {
  const valid = t.moments.length > 0 ? t.moments : DEFAULT_MOMENTS
  return valid.includes(mealMoment)
}

function isCompatibleMode(t: DishTemplate, mode: string): boolean {
  if (mode === 'rapide') return t.method !== 'four' && t.method !== 'mijote'
  if (mode === 'leger') return t.heaviness !== 'heavy'
  return true
}

// ── Familles de secours — toujours disponibles pour déjeuner/dîner ───────────
export const FALLBACK_TEMPLATES: DishTemplate[] = [
  { id: 'omelette',      name: 'Omelette garnie',   example: 'Omelette aux légumes et fromage',          styles: [], moments: [], method: 'saute',  heaviness: 'light'  },
  { id: 'poelee',        name: 'Poêlée de légumes', example: 'Poêlée de légumes sautés',                 styles: [], moments: [], method: 'saute',  heaviness: 'light'  },
  { id: 'riz-legumes',   name: 'Riz aux légumes',   example: 'Riz aux légumes de saison',                styles: [], moments: [], method: 'saute',  heaviness: 'normal' },
  { id: 'pates-simples', name: 'Pâtes simples',     example: 'Pâtes à la tomate et herbes',              styles: [], moments: [], method: 'saute',  heaviness: 'normal' },
  { id: 'soupe-legumes', name: 'Soupe de légumes',  example: 'Soupe de légumes du frigo',                styles: [], moments: [], method: 'mijote', heaviness: 'light'  },
  { id: 'salade',        name: 'Salade composée',   example: 'Salade composée au thon et légumes',       styles: [], moments: [], method: 'cru',    heaviness: 'light'  },
]

// ── Familles principales ──────────────────────────────────────────────────────
export const DISH_TEMPLATES: DishTemplate[] = [
  // Pâtes
  { id: 'pates-sauce-tomate', name: 'Pâtes sauce tomate',       example: 'Pâtes à la sauce tomate maison',           styles: ['pates'],                                     moments: [], method: 'saute',  heaviness: 'normal' },
  { id: 'pates-legumes',      name: 'Pâtes aux légumes sautés', example: 'Pâtes aux courgettes et tomates',           styles: ['pates'],                                     moments: [], method: 'saute',  heaviness: 'normal' },
  { id: 'pates-creameuses',   name: 'Pâtes crémeuses',          example: 'Pâtes crémeuses aux champignons et lardons', styles: ['pates'],                                    moments: [], method: 'saute',  heaviness: 'heavy'  },
  { id: 'lasagnes',           name: 'Lasagnes',                 example: 'Lasagnes bolognaise maison',                styles: ['pates', 'gratin'],                            moments: [], method: 'four',   heaviness: 'heavy'  },
  // Riz & Céréales
  { id: 'riz-saute-wok',      name: 'Riz sauté style wok',      example: 'Riz sauté au poulet et légumes',           styles: ['wok', 'asiatique', 'risotto'],                moments: [], method: 'saute',  heaviness: 'normal' },
  { id: 'bowl-riz',           name: 'Bowl de riz',              example: 'Bowl de riz aux légumes et protéine',       styles: ['bowl', 'asiatique'],                          moments: [], method: 'saute',  heaviness: 'normal' },
  { id: 'risotto',            name: 'Risotto crémeux',          example: 'Risotto aux champignons et parmesan',       styles: ['risotto'],                                    moments: [], method: 'mijote', heaviness: 'heavy'  },
  // Wok & Asiatique
  { id: 'wok-legumes',        name: 'Wok de légumes et protéine', example: 'Wok de légumes et poulet sauce soja',    styles: ['wok', 'asiatique'],                           moments: [], method: 'saute',  heaviness: 'normal' },
  { id: 'nouilles-sautees',   name: 'Nouilles sautées',          example: 'Nouilles sautées aux légumes et œuf',     styles: ['wok', 'asiatique'],                           moments: [], method: 'saute',  heaviness: 'normal' },
  { id: 'curry-doux',         name: 'Curry doux',                example: 'Curry doux de poulet aux légumes',        styles: ['curry', 'asiatique'],                         moments: [], method: 'mijote', heaviness: 'normal' },
  { id: 'bol-asiatique',      name: 'Bol asiatique',             example: 'Bol de riz au sésame et légumes sautés',  styles: ['asiatique', 'bowl'],                          moments: [], method: 'saute',  heaviness: 'light'  },
  { id: 'pois-chiches',       name: 'Pois chiches sautés',       example: 'Pois chiches sautés aux épices douces',   styles: ['curry', 'mediterraneen'],                     moments: [], method: 'saute',  heaviness: 'normal' },
  // Gratins
  { id: 'gratin-legumes',     name: 'Gratin de légumes',         example: 'Gratin de courgettes et fromage',         styles: ['gratin'],                                     moments: [], method: 'four',   heaviness: 'heavy'  },
  { id: 'gratin-dauphinois',  name: 'Gratin dauphinois',         example: 'Gratin dauphinois à la crème',            styles: ['gratin', 'traditionnel'],                     moments: [], method: 'four',   heaviness: 'heavy'  },
  // Tartes & Pizzas
  { id: 'quiche-tarte',       name: 'Quiche / tarte salée',      example: 'Quiche aux légumes et fromage',           styles: ['pizza', 'traditionnel'],                      moments: [], method: 'four',   heaviness: 'heavy'  },
  { id: 'pizza-maison',       name: 'Pizza maison',              example: 'Pizza maison aux légumes',                styles: ['pizza'],                                      moments: [], method: 'four',   heaviness: 'heavy'  },
  // Viande
  { id: 'poulet-saute',       name: 'Poulet sauté aux légumes',  example: 'Poulet sauté aux courgettes',             styles: ['wok', 'proteine'],                            moments: [], method: 'saute',  heaviness: 'normal' },
  { id: 'poulet-four',        name: 'Poulet rôti au four',       example: 'Poulet rôti aux herbes et légumes',       styles: ['traditionnel', 'proteine'],                   moments: [], method: 'four',   heaviness: 'heavy'  },
  { id: 'steak-legumes',      name: 'Steak haché et légumes',    example: 'Steak haché maison et légumes poêlés',    styles: ['burger', 'proteine'],                         moments: [], method: 'saute',  heaviness: 'normal' },
  { id: 'boeuf-mijote',       name: 'Bœuf mijoté',              example: 'Bœuf mijoté aux légumes et vin',          styles: ['traditionnel'],                               moments: [], method: 'mijote', heaviness: 'heavy'  },
  { id: 'lentilles',          name: 'Lentilles mijotées',        example: 'Lentilles mijotées aux carottes',         styles: ['traditionnel', 'mediterraneen', 'proteine'],  moments: [], method: 'mijote', heaviness: 'normal' },
  // Poisson
  { id: 'poisson-poele',      name: 'Poisson à la poêle',        example: 'Filet de saumon poêlé et légumes',       styles: ['leger', 'proteine'],                          moments: [], method: 'saute',  heaviness: 'light'  },
  { id: 'salade-thon',        name: 'Salade de thon',            example: 'Salade de thon composée et crudités',    styles: ['salade', 'leger'],                            moments: [], method: 'cru',    heaviness: 'light'  },
  // Soupes
  { id: 'veloute',            name: 'Velouté de légumes',        example: 'Velouté de courgettes maison',           styles: ['soupe', 'leger'],                             moments: [], method: 'mijote', heaviness: 'light'  },
  { id: 'minestrone',         name: 'Minestrone',                example: 'Minestrone de légumes et haricots',      styles: ['soupe', 'mediterraneen'],                     moments: [], method: 'mijote', heaviness: 'normal' },
  // Méditerranéen
  { id: 'ratatouille',        name: 'Ratatouille',               example: 'Ratatouille provençale',                 styles: ['mediterraneen'],                              moments: [], method: 'mijote', heaviness: 'light'  },
  { id: 'frittata',           name: 'Frittata aux légumes',      example: 'Frittata aux courgettes et fromage',     styles: ['mediterraneen'],                              moments: [], method: 'four',   heaviness: 'normal' },
  // Petit-déjeuner / Goûter
  { id: 'oeufs-brouilles',   name: 'Œufs brouillés et toast',   example: 'Œufs brouillés et toast au fromage',    styles: [], moments: ['petit-dej', 'gouter'], method: 'saute', heaviness: 'light' },
  { id: 'crepes',             name: 'Crêpes / pancakes',         example: 'Crêpes au sucre et beurre',             styles: [], moments: ['petit-dej', 'gouter'], method: 'saute', heaviness: 'light' },
  { id: 'pain-perdu',         name: 'Pain perdu',                example: 'Pain perdu au miel et cannelle',        styles: [], moments: ['petit-dej', 'gouter'], method: 'saute', heaviness: 'light' },
]

// ── API publique ──────────────────────────────────────────────────────────────
export function getTemplatesForContext({
  mode,
  mealMoment,
  cuisineStyleIds,
}: {
  mode: string
  mealMoment: string
  cuisineStyleIds: string[]
}): { mainTemplates: DishTemplate[]; fallbackTemplates: DishTemplate[] } {
  // Filtre par moment et mode
  let main = DISH_TEMPLATES.filter(
    (t) => isCompatibleMoment(t, mealMoment) && isCompatibleMode(t, mode)
  )

  // Filtre par styles si des styles sont sélectionnés
  if (cuisineStyleIds.length > 0) {
    main = main.filter(
      (t) => t.styles.length === 0 || t.styles.some((s) => cuisineStyleIds.includes(s))
    )
  }

  // Fallbacks compatibles avec le moment et le mode
  const fallbacks = FALLBACK_TEMPLATES.filter(
    (t) => isCompatibleMoment(t, mealMoment) && isCompatibleMode(t, mode)
  )

  // Si la liste principale est trop courte, les fallbacks fusionnent dedans
  if (main.length < 3) {
    const mainIds = new Set(main.map((t) => t.id))
    const extra = fallbacks.filter((t) => !mainIds.has(t.id))
    return { mainTemplates: [...main, ...extra], fallbackTemplates: [] }
  }

  return { mainTemplates: main, fallbackTemplates: fallbacks }
}

export function buildTemplatesBlock(
  mainTemplates: DishTemplate[],
  fallbackTemplates: DishTemplate[]
): string {
  if (mainTemplates.length === 0) return ''

  const mainList = mainTemplates.map((t) => `- ${t.name}`).join('\n')
  const examples = mainTemplates
    .slice(0, 2)
    .map((t) => `"${t.example}"`)
    .join(', ')

  const lines = [
    `FAMILLES DE PLATS AUTORISÉES :`,
    mainList,
    ``,
    `Choisis en priorité une famille de plat dans cette liste avant d'adapter la recette au stock.`,
    `Le nom de la recette doit être une variante reconnaissable d'une famille plausible (ex : ${examples}).`,
  ]

  if (fallbackTemplates.length > 0) {
    const fallbackList = fallbackTemplates.map((t) => `- ${t.name}`).join('\n')
    lines.push(
      ``,
      `FAMILLES DE SECOURS (uniquement si aucune famille principale n'est réalisable avec le stock) :`,
      fallbackList,
      `Si aucune famille ne correspond correctement au stock, propose une recette simple et réaliste de dernier recours, mais sans association expérimentale.`
    )
  }

  return lines.join('\n')
}
