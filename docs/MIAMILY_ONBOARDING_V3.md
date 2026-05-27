# Miamily Onboarding V3 — Spec détaillée

**Dépendances :** lire `docs/MIAMILY_HANDOFF_GLOBAL.md` d'abord pour les contraintes et conventions.

---

## Routes Next.js

```
/onboarding              → redirect /onboarding/welcome
/onboarding/welcome      → S1 — Bienvenue
/onboarding/household    → S2 — Composition du foyer
/onboarding/tastes       → S3 — Goûts & styles
/onboarding/allergies    → S4 — Allergies
/onboarding/fridge       → S5 — Premiers produits (intro + checklist fusionnés)
/onboarding/ready        → S6 — Pré-génération (moment WOW)
/onboarding/cooking      → S7 — Loading génération
```

À la fin de `/cooking` : redirect `/home` avec les 3 recettes déjà chargées en state.

### Redirection auto

Si `profile.onboarded === true` au chargement de n'importe quelle route `/onboarding/**` → redirect direct `/home`.

---

## État partagé — Zustand store

```ts
// store/onboarding.ts
interface OnboardingState {
  householdSize: 1|2|3|4|'5+';
  hasKids: boolean;
  kidsAges: string[];
  cuisineStyles: string[];
  openToDiscovery: 'classic'|'mix'|'curious';
  allergies: string[];
  fridgeItems: string[];          // canonical_names cochés
  generationPromise: Promise<Recipe[]> | null;
}
```

- **Persist :** `localStorage` via plugin Zustand `persist`
- **Flush API :** uniquement à `/ready`, avant la génération — appel `POST /api/profile`
- **Reprise :** si l'utilisateur quitte avant `/ready`, l'état local est conservé et rechargé au prochain lancement
- **Reset :** après `onboarding_completed`, vider le store

---

## Composants

### P0 — Réutilisés depuis la charte Maison

| Composant | Path | Notes |
|---|---|---|
| `<Button>` | `components/ui/Button.tsx` | Variants `primary \| secondary \| dark \| ghost`. Taille `lg` pour onboarding. |
| `<BetaChip>` | `components/ui/BetaChip.tsx` | **1 seule occurrence** : header de S1 `/welcome`. |
| `<Type>` | `components/ui/Type.tsx` | Variants `display \| h1 \| h2 \| h3 \| body \| small \| caption \| label`. |
| Tokens Tailwind | `tailwind.config.ts` | Source : `Miamily Handoff Claude Code.md`. |

### P1 — Spécifiques onboarding (à créer)

| Composant | Path | Specs |
|---|---|---|
| `<OnboardingLayout>` | `app/onboarding/layout.tsx` | Sans tab bar. Header transparent. `padding-bottom: safe-area-inset-bottom`. |
| `<ProgressDots>` | `components/onboarding/ProgressDots.tsx` | Props `current: number, total: number`. Label `01 / 05` + barre fine. |
| `<TopBar>` | `components/onboarding/TopBar.tsx` | Props `back?: boolean, skip?: string \| null`. |
| `<StickyCTA>` | `components/onboarding/StickyCTA.tsx` | Props `children, sub?, secondary?`. Gradient de fond + `safe-area-inset-bottom`. |
| `<NumberPicker>` | `components/onboarding/NumberPicker.tsx` | Props `value: 1\|2\|3\|4\|'5+', onChange`. 5 boutons grand format, variant `primary` sur l'actif. |
| `<YesNo>` | `components/onboarding/YesNo.tsx` | Props `value: 'Oui'\|'Non'\|undefined, onChange`. 2 boutons pleine largeur. |
| `<Chip>` | `components/onboarding/Chip.tsx` | Props `on?: boolean, large?: boolean, children`. Pré-sélection visuelle avec ✓. |
| `<MoodCard>` | `components/onboarding/MoodCard.tsx` | Props `title, sub, on?, onClick`. Radio visuel pleine ligne. |

### P2 — Génération et finalisation

| Composant | Path | Specs |
|---|---|---|
| `<LoadingRow>` | `components/onboarding/LoadingRow.tsx` | Props `status: 'done' \| 'current' \| 'pending', label, detail`. Icône ✓ (vert) ou spinner. |
| `<RecipePlaceholder>` | `components/ui/RecipePlaceholder.tsx` | SVG inline, zéro requête réseau. Voir `docs/MIAMILY_IMAGES_STRATEGY.md §Fallback`. |
| `<RecipeImage>` | `components/ui/RecipeImage.tsx` | `next/image` + chaîne fallback. Voir `docs/MIAMILY_IMAGES_STRATEGY.md §Mapping`. |
| `<TeaserCard>` | `components/onboarding/TeaserCard.tsx` | Card floutée 2-3 px, emoji catégorie net, halo sage green. |

### P3 — Post-onboarding (ne pas créer ici)

`<Toast>`, `<InlineBanner>`, `<EmptyState>` — déjà couverts par le handoff global.

---

## Wording figé — `lib/copy.ts`

Aucune string UI en dur dans les composants. Tout passe par cet objet.

```ts
export const onboarding = {
  welcome: {
    title: 'Le dîner ce soir, déjà réglé.',
    body: '3 idées de repas pour votre famille, prêtes en 1 minute.',
    cta: 'Démarrer',
    subCta: 'Sans création de compte',
  },
  household: {
    kicker: '01 · VOTRE FOYER',
    title: 'Combien êtes-vous à table ?',
    sub: 'Pour adapter les portions. Modifiable à tout moment.',
    kidsQ: 'DES ENFANTS PARMI EUX ?',
    agesQ: 'QUEL ÂGE ? · OPTIONNEL',
    agesNote: 'Pour proposer des recettes adaptées aux plus jeunes.',
    cta: 'Continuer',
  },
  tastes: {
    kicker: '02 · GOÛTS',
    title: "Qu'est-ce qui vous fait plaisir ?",
    sub: '3 styles suffisent. Modifiable plus tard.',
    moreLink: 'Voir plus de styles · optionnel',
    discoveryLabel: 'OUVERT AUX NOUVEAUTÉS ?',
    cta: 'Continuer',
    subCta: 'Modifiable à tout moment dans Famille',
  },
  allergies: {
    kicker: '03 · ALLERGIES',
    title: 'Des allergies à signaler ?',
    sub: "On évitera ces ingrédients dans vos recettes.",
    otherLink: '+ Autre allergie',
    privacy: '🔒 Vos données restent privées.',
    cta: 'Continuer',
  },
  fridge: {
    kicker: '04 · PREMIERS PRODUITS',
    title: "Qu'est-ce qu'on a dans le frigo ?",
    sub: 'Cochez ce que vous avez. ~ 20 secondes.',
    heroKicker: '⚡ DÉMARRAGE EXPRESS',
    heroTitle: 'Démarrage express',
    heroSub: '10 essentiels à cocher · 20 secondes',
    promises: [
      '✓ Suffit pour vos 3 premières idées de repas',
      '✓ On a deviné les essentiels pour vous',
      '✓ Vous compléterez quand vous voulez',
    ],
    altList: "J'ai déjà ma liste",
    skipLink: 'Plus tard',
    cta: (count: number) => `Démarrer avec ces ${count} produits`,
    subCta: 'Quelques produits suffisent pour démarrer.',
  },
  ready: {
    kicker: '✨ TOUT EST PRÊT',
    title: 'Vos 3 recettes vous attendent.',
    sub: 'Adaptées à votre famille, à partir de vos produits.',
    summaryLabels: {
      household: 'foyer',
      tastes: 'goûts',
      allergies: 'allergies',
      fridge: 'frigo',
    },
    teaserKicker: 'BIENTÔT SUR VOTRE TABLE',
    cta: 'Découvrir mes 3 recettes ✨',
    subCta: '⏱ Environ 10 secondes',
    editLink: 'Modifier mes réponses',
  },
  cooking: {
    kicker: 'EN CUISINE',
    title: 'On prépare vos recettes…',
    titleDone: 'Et voilà !',
    checks: {
      stock:      (n: number)              => `Vos produits, c'est fait · ${n} utilisés`,
      tastes:     (list: string)           => `Vos goûts, c'est fait · ${list}`,
      family:     (a: number, k: number)   => `Votre famille, c'est fait · ${a} adulte${a > 1 ? 's' : ''}, ${k} enfant${k > 1 ? 's' : ''}`,
      generating: 'Création de vos recettes · presque prêt',
    },
    footer: 'Habituellement moins de 10 secondes',
    footerSlow: 'Encore quelques secondes…',
    footerRetry: 'Réessayer',
  },
}
```

---

## Comportements clés

### Pré-fetch IA — déclenché à S6, pas à S7

L'appel `/api/recipes/generate` part **au tap du CTA de `/ready`**, pas au démarrage de `/cooking`. La promesse est stockée dans le store ; `/cooking` la consomme. Cela cache 13 sec de latence (5 sec d'écran `/ready` + 8 sec d'écran `/cooking`).

```ts
// app/onboarding/ready/page.tsx
const handleStart = () => {
  saveProfile(state)                // flush vers /api/profile
  generateRecipes(state)            // promesse stockée dans le store
  router.push('/onboarding/cooking')
}
```

### Loading progressif — `/cooking`

```ts
const steps = [
  { delay: 0,    status: 'current' },
  { delay: 400,  step: 'stock',      status: 'done' },
  { delay: 800,  step: 'tastes',     status: 'done' },
  { delay: 1200, step: 'family',     status: 'done' },
  { delay: 1600, step: 'generating', status: 'current' },
]
```

Transitions à la fin :
- À 80 % de progression réelle (recettes prêtes **ou** 8 sec écoulées) :
  - Titre → `cooking.titleDone`
  - Première card recette fade-in
  - 300 ms après → redirect `/home`
- Si génération > 10 sec → footer → `cooking.footerSlow`
- Si génération > 20 sec → bouton `cooking.footerRetry` (nouvelle tentative + reset progress)

### Progressive disclosure — `/household`

Chaque sous-question apparaît avec un fade-in 250 ms après réponse à la précédente.

- Si Framer Motion est installé : `<AnimatePresence>`
- Sinon : CSS `transition: opacity 250ms, transform 250ms` + `translateY(8px) → 0`

### Image S1 — preload obligatoire

```tsx
// app/onboarding/welcome/page.tsx
<Image
  src="/images/onboarding/welcome-hero.webp"
  alt=""
  width={1080} height={720}
  priority           // preload pendant l'écran splash
  placeholder="blur"
  blurDataURL={WELCOME_BLUR_DATA_URL}
/>
```

Toutes les autres images onboarding : `loading="lazy"`, sans `priority`.

---

## Analytics — events à tracker

```ts
// lib/analytics.ts
type OnboardingEvent =
  | { name: 'onboarding_started' }
  | { name: 'onboarding_screen_viewed';    screen: 1|2|3|4|5|6|7 }
  | { name: 'household_size_selected';     size: number }
  | { name: 'kids_yes_no';                 value: 'yes'|'no' }
  | { name: 'kids_age_selected';           age: string }
  | { name: 'cuisine_style_selected';      count: number }
  | { name: 'more_options_clicked' }
  | { name: 'mood_selected';               value: 'classic'|'mix'|'curious' }
  | { name: 'allergies_kept_default' }
  | { name: 'allergies_modified';          allergies: string[] }
  | { name: 'fridge_screen_viewed' }
  | { name: 'fridge_item_toggled';         item: string; on: boolean }
  | { name: 'fridge_paste_list_clicked' }
  | { name: 'fridge_skip_clicked' }
  | { name: 'fridge_continued';            count: number }
  | { name: 'pregen_viewed' }
  | { name: 'pregen_edit_clicked' }
  | { name: 'generation_started' }
  | { name: 'loading_completed';           duration_ms: number }
  | { name: 'loading_error';               reason: string }
  | { name: 'onboarding_completed';        time_to_first_recipe_ms: number; recipes_count: number }
```

**Funnel :** 8 marches — `onboarding_started` → `screen_viewed` 1 à 7 → `onboarding_completed`.

**Règle d'alerte :** aucune marche ne doit perdre > 12 % d'une semaine à l'autre.

---

## QA acceptance — checklist avant bêta

- [ ] 5 personnes test → TTFR médian < 60 sec
- [ ] Test 3G simulé → loading < 15 sec
- [ ] Test "parent pressé sans lecture" → parcours complet < 75 sec
- [ ] Audit vocabulaire : 0 occurrence de "stock" dans `/onboarding/**`
- [ ] `<BetaChip>` uniquement sur `/welcome` (grep)
- [ ] 16 images V1 présentes dans `/public/images/`
- [ ] `<RecipePlaceholder>` rendu si image manquante (test : supprimer 1 image, vérifier)
- [ ] Image S1 marquée `priority` (Lighthouse LCP < 1,8 sec)
- [ ] Funnel 8 étapes opérationnel dans Mixpanel/PostHog
- [ ] `lib/copy.ts` est l'unique source des textes (grep des strings en dur)
- [ ] `useOnboardingStore` persiste après refresh
- [ ] Profil flush UNIQUEMENT à `/ready` (pas avant)
- [ ] Skip / back préservent l'état Zustand
- [ ] `profile.onboarded === true` → redirect direct `/home`
- [ ] Safe-area iOS sur tous les `<StickyCTA>`
- [ ] Tap targets ≥ 44 × 44 px
- [ ] Animations 180 ms `cubic-bezier(.2,.7,.3,1)`
- [ ] Lighthouse mobile : Performance > 85, Accessibility > 95
