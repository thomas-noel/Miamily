# Miamily — Stratégie images

Couvre : mapping recette → image, structure `/public/images/`, volume V1, stockage, conventions, fallback SVG.

---

## Mapping image → recette

Chaque recette affiche une image **déterministe** (toujours la même pour la même recette) sans appel externe.

### Type Recipe (côté DB)

```ts
type Recipe = {
  id: string
  slug: string                    // ex: 'gratin-jambon-mozza'
  category: 'sale' | 'sucre'
  cuisineStyle: 'italien' | 'asiatique' | 'classique' | 'rapide' | 'reconfortant' | 'leger'
  mainIngredient?: string         // 'poulet', 'pates', 'oeufs'...
  imageSlug?: string              // override explicite si curé manuellement
}
```

### Chaîne de résolution (du plus spécifique au fallback)

| Priorité | Condition | Chemin |
|---|---|---|
| 1 | `imageSlug` défini | `/images/recipes/{imageSlug}.webp` |
| 2 | Slug recette | `/images/recipes/{category}/{cuisineStyle}/{slug}.webp` |
| 3 | Générique cuisineStyle | `/images/recipes/{category}/{cuisineStyle}/_generic.webp` |
| 4 | Générique category | `/images/recipes/{category}/_generic.webp` |
| 5 | **Fallback final** | `<RecipePlaceholder category={category} />` (SVG inline) |

### Implémentation `resolveRecipeImage`

```ts
function resolveRecipeImage(recipe: Recipe): string | null {
  const candidates = [
    recipe.imageSlug && `/images/recipes/${recipe.imageSlug}.webp`,
    `/images/recipes/${recipe.category}/${recipe.cuisineStyle}/${recipe.slug}.webp`,
    `/images/recipes/${recipe.category}/${recipe.cuisineStyle}/_generic.webp`,
    `/images/recipes/${recipe.category}/_generic.webp`,
  ].filter(Boolean)
  return candidates[0]
}
```

`<RecipeImage>` gère `onError` sur `next/image` pour passer au candidat suivant. Si tous échouent → rendre `<RecipePlaceholder>`.

---

## Volume images — V1

**Total V1 : 16 images** — réalisables en 1 séance photo ou sélection banque.

| Usage | Fichier | Qté |
|---|---|---|
| Hero S1 (Bienvenue) | `/images/onboarding/welcome-hero.webp` | 1 |
| Teasers S6 (Pré-gen) | `/images/onboarding/teaser-{1,2,3}.webp` | 3 |
| Générique category — salé | `/images/recipes/sale/_generic.webp` | 1 |
| Générique category — sucré | `/images/recipes/sucre/_generic.webp` | 1 |
| Génériques cuisineStyle salé (6 styles) | `/images/recipes/sale/{italien,asiatique,classique,rapide,reconfortant,leger}/_generic.webp` | 6 |
| Génériques cuisineStyle sucré (2 styles) | `/images/recipes/sucre/{classique,rapide}/_generic.webp` | 2 |
| Recette vedette pour démo | `/images/recipes/sale/italien/gratin-jambon-mozza.webp` | 1 |
| Placeholder démo | `/images/onboarding/placeholder.webp` | 1 |

**V2 (post-bêta) :** monter à 50-80 images pour couvrir les 15 recettes les plus générées par cuisineStyle.

---

## Stockage

### V1 — Statique dans le repo

Dossier : `/public/images/` — servi par Next.js, optimisé automatiquement par Vercel/Netlify CDN.

Avantages :
- `next/image` optimise (WebP, srcset, lazy loading)
- Pas de dépendance externe pendant la bêta
- Versionné avec le code — rollback trivial

### Quand migrer vers blob storage (V2/V3)

| Signal | Seuil |
|---|---|
| Volume d'images | > 100 images |
| Génération dynamique (IA image) | Dès le premier usage |
| Taille du repo | > 500 MB |

Cibles V2 : **Vercel Blob** (intégration native Next.js) ou **Cloudflare R2** (moins cher au To).

---

## Convention de nommage

```
/public/images/
├── onboarding/
│   ├── welcome-hero.webp          # S1 — hero principal
│   ├── teaser-1.webp              # S6 — card 1
│   ├── teaser-2.webp              # S6 — card 2
│   ├── teaser-3.webp              # S6 — card 3
│   └── placeholder.webp           # démo / bench
└── recipes/
    ├── sale/
    │   ├── _generic.webp          # fallback category salé
    │   ├── italien/
    │   │   ├── _generic.webp
    │   │   ├── gratin-jambon-mozza.webp
    │   │   └── pates-pesto-tomates.webp
    │   ├── asiatique/
    │   │   └── _generic.webp
    │   ├── classique/_generic.webp
    │   ├── rapide/_generic.webp
    │   ├── reconfortant/_generic.webp
    │   └── leger/_generic.webp
    └── sucre/
        ├── _generic.webp          # fallback category sucré
        ├── classique/_generic.webp
        └── rapide/_generic.webp
```

### Règles strictes

- Tout en `kebab-case`, sans accent, sans majuscule
- Pas d'espaces, pas d'underscore — sauf préfixe `_generic` (réservé aux fallbacks)
- Format unique : `.webp`
- Qualité : 80 pour les heros, 75 pour les cards
- Dimensions max :
  - Hero : 1080 × 720 (ratio 3:2)
  - Card : 480 × 480 (ratio 1:1)
- Le préfixe `_` est réservé aux génériques — jamais sur une vraie recette

---

## Fallback SVG — `<RecipePlaceholder>`

Composant SVG inline — **zéro requête réseau**, hérite des tokens Maison.

```tsx
// components/ui/RecipePlaceholder.tsx

type Props = {
  category: 'sale' | 'sucre'
  size?: 'card' | 'hero'
  className?: string
}

const EMOJI = { sale: '🥘', sucre: '🍰' }

export function RecipePlaceholder({ category, size = 'card', className }: Props) {
  const dim = size === 'hero'
    ? { w: 1080, h: 720, fontSize: 120 }
    : { w: 480, h: 480, fontSize: 80 }

  return (
    <div
      className={className}
      style={{ width: '100%', aspectRatio: size === 'hero' ? '3/2' : '1/1', position: 'relative' }}
      aria-label={`Placeholder recette ${category === 'sale' ? 'salée' : 'sucrée'}`}
    >
      <svg
        viewBox={`0 0 ${dim.w} ${dim.h}`}
        width="100%" height="100%"
        style={{ display: 'block' }}
      >
        <defs>
          <pattern
            id={`p-${category}-${size}`}
            width="20" height="20"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <rect width="20" height="20" fill="#EAE3D2" />
            <rect width="10" height="20" fill="#F4EFE4" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#p-${category}-${size})`} />
        <text
          x="50%" y="50%"
          textAnchor="middle" dominantBaseline="central"
          fontSize={dim.fontSize}
          opacity="0.85"
        >
          {EMOJI[category]}
        </text>
      </svg>
    </div>
  )
}
```

### Quand l'utiliser

- Recette sans image résolue (tous les candidats de la chaîne ont échoué)
- Pendant le chargement de l'image (skeleton)
- Tous les `_generic` non encore peuplés
- Vue offline (PWA sans cache image)

### Ne jamais faire

- Placeholder gris uni
- Icône Lucide ou avatar à la place
- Fond blanc vide (rupture brutale avec le fond crème Maison)
