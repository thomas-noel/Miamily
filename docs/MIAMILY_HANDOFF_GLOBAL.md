# Miamily — Handoff global onboarding

**Cible :** flow onboarding v3 dans l'app Next.js/PWA existante. 6 écrans actifs, < 60 sec jusqu'à la première recette.

**Sources de vérité :**
- `Miamily Charte Maison.html` — design system (tokens, atomes)
- `Miamily Onboarding v2.html` — mockups écrans
- `Miamily Onboarding v3 emotion.html` — wording, image strategy, analytics
- `docs/MIAMILY_ONBOARDING_V3.md` — spec onboarding détaillée
- `docs/MIAMILY_IMAGES_STRATEGY.md` — stratégie images

---

## Contraintes absolues

Ces règles s'appliquent à tout code produit dans `/onboarding/**`. Aucune exception.

| Règle | Vérification |
|---|---|
| 0 string en dur dans les composants | `grep -r '"' src/app/onboarding/ \| grep -v 'copy\.'` → 0 résultat |
| 0 occurrence du mot "stock" | `grep -r '"stock"' src/app/onboarding/` → 0 résultat |
| `<BetaChip>` uniquement sur `/welcome` | `grep -r 'BetaChip' src/app/onboarding/` → 1 résultat |
| Tokens Maison stricts (pas de Tailwind hors config) | Pas de `text-[#abc]`, `bg-[#abc]`, `px-[37px]` |
| Profil flush à `/ready` uniquement — jamais avant | Aucun appel `/api/profile` dans welcome / household / tastes / allergies / fridge |
| Pas de Framer Motion sauf si déjà installé | Vérifier `package.json` avant d'importer |

---

## Conventions globales

### Wording
- Source unique : `lib/copy.ts`, objet `onboarding`
- Aucune string UI en dur dans les composants
- Vocabulaire côté utilisateur : **"frigo"**, **"produits"**, **"famille"** — jamais "stock", "inventaire", "utilisateur"

### Tokens de design
- Typo : Cormorant Garamond (titres), Helvetica Neue système (UI)
- Couleurs : tokens Tailwind Maison (`primary`, `surface`, `ink-3`, `accent`, etc.)
- Animations : 180 ms `cubic-bezier(.2,.7,.3,1)`
- Tap targets : ≥ 44 × 44 px

### Architecture
- État onboarding : Zustand store `useOnboardingStore`, persist `localStorage`
- Flush vers API : **uniquement à `/ready`** avant génération
- Si l'utilisateur quitte avant : état conservé en local, reprise au prochain lancement
- Si `profile.onboarded === true` : redirect direct `/home`, l'onboarding ne s'affiche pas

---

## Phases de développement

| Phase | Contenu | Durée |
|---|---|---|
| 1 — Squelette | `/app/onboarding/layout.tsx`, 7 routes, composants P1, Zustand store, `lib/copy.ts` | ½ jour |
| 2 — Écrans | Écran par écran dans l'ordre (welcome → cooking), 1 commit par écran | 1,5 jour |
| 3 — Images | Structure `/public/images/`, `<RecipeImage>`, `<RecipePlaceholder>`, 16 images V1 | ½ jour |
| 4 — Génération & analytics | Pré-fetch IA au tap S6, loading progressif, events Mixpanel/PostHog | ½ jour |
| 5 — QA | Checklist §QA, test 5 personnes minimum | ½ jour |

**Total estimé : 3,5 jours dev.**

---

## Brief à coller dans Claude Code

> Implémente l'onboarding Miamily v3 décrit dans `docs/MIAMILY_ONBOARDING_V3.md` et `docs/MIAMILY_IMAGES_STRATEGY.md`. Source unique de vérité : ces fichiers + `Miamily Handoff Claude Code.md` pour les tokens globaux.
>
> **Phase 1 — Squelette** (½ jour)
> Crée `/app/onboarding/layout.tsx` et les 7 routes (welcome / household / tastes / allergies / fridge / ready / cooking). Composants P1 dans `components/onboarding/`. Zustand store `useOnboardingStore` avec persist. `lib/copy.ts` complet.
>
> **Phase 2 — Écrans** (1,5 jour)
> Implémente écran par écran dans l'ordre : welcome → household → tastes → allergies → fridge → ready → cooking. 1 commit par écran. Match exact des maquettes `Miamily Onboarding v2.html`.
>
> **Phase 3 — Images** (½ jour)
> Crée la structure `/public/images/recipes/{sale,sucre}/{cuisineStyle}/`. Implémente `<RecipeImage>` avec chaîne fallback. Implémente `<RecipePlaceholder>` (SVG inline). Place les 16 images V1.
>
> **Phase 4 — Génération & analytics** (½ jour)
> Pré-fetch IA au tap CTA S6. Loading progressif avec 4 checks séquentiels. Configure les events analytics + funnel 8 marches.
>
> **Phase 5 — QA** (½ jour)
> Cocher la checklist QA. Test sur 5 personnes minimum.
>
> **Contraintes absolues :** voir `docs/MIAMILY_HANDOFF_GLOBAL.md`.
>
> Avant chaque PR :
> ```
> grep -r '"stock"' src/app/onboarding/
> grep -r 'BetaChip' src/app/onboarding/
> grep -r '"' src/app/onboarding/ | grep -v 'copy\.'
> ```

---

## Non-objectifs V1

Ce qui est **explicitement hors scope** pour la bêta. Ne pas implémenter, ne pas architecturer pour.

| Non-objectif | Raison |
|---|---|
| Génération d'images par IA | Coût, latence, complexité — banque statique suffisante en bêta |
| Blob storage (Vercel Blob / Cloudflare R2) | Pertinent seulement quand > 100 images ou repo > 500 MB |
| Plus de 16 images recettes | V1 couvre les fallbacks génériques ; curés post-bêta |
| Authentification obligatoire à l'entrée | S1 affiche "Sans création de compte" — flow guest autorisé |
| Personnalisation fine par membre à l'onboarding | Préférences par membre → écran Famille (post-onboarding) |
| Framer Motion | CSS transitions suffisent ; Framer Motion seulement si déjà installé |
| A/B testing du wording | Post-bêta, sur données réelles de funnel |
| Internationalisation (i18n) | App 100 % française en V1 |
| Mode sombre | Tokens Maison sont warm/light ; dark mode reporté |
| Reprise multi-device | `localStorage` suffit ; sync cross-device post-bêta |
| Analytics temps réel / dashboards | Funnel Mixpanel/PostHog suffit ; pas de dashboard custom |
