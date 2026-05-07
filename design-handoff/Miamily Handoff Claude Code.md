# Miamily — Handoff Claude Code

**Cible :** intégrer la direction visuelle « Maison » et les 6 écrans V1 bêta dans l'app Next.js/PWA existante. Ne pas repartir de zéro. Migration progressive, écran par écran.

**Références projet :**
- `Miamily Charte Maison.html` — design system complet (tokens, composants, états, QA)
- `Miamily V1 hi-fi.html` — application visuelle des 6 écrans
- `Miamily Wireframes V1.html` — synthèse conserver / changer / supprimer

---

## 1. Résumé de la direction visuelle

**Nom :** Maison — *le carnet de famille moderne*.

**Intention :** sortir du look « app de cuisine vert vif générique ». Atmosphère carnet de cuisine familial, chaleureux et calme, sans tomber dans le rustique. Sage green + crème + serif Cormorant Garamond pour un caractère immédiatement reconnaissable.

**Différenciateurs :**
- Fond crème chaude (jamais blanc pur)
- Sage green sobre comme couleur d'action (pas de vert vif saturé)
- Serif élégante réservée aux titres (pas dans l'UI)
- Hiérarchie typographique forte : titres serif larges, UI sans-serif compacte
- Ombres très douces, jamais dures

**À éviter :** gradients agressifs, emojis dans les CTA, badges colorés multiples sur une carte, vert vif (#16a34a) résiduel.

---

## 2. Palette complète

### Surfaces & textes
| Token | Hex | Usage |
|---|---|---|
| `bg` | `#FAF7F0` | Fond app — crème chaude |
| `surface` | `#FFFFFF` | Cards, sheets, inputs |
| `surface-muted` | `#F4EFE4` | Surfaces secondaires |
| `line` | `#EAE3D2` | Bordures, séparateurs |
| `line-2` | `#D9D0BB` | Lignes plus marquées (drag handles, dashed) |
| `ink` | `#1F1B16` | Texte principal |
| `ink-2` | `#5C5447` | Texte secondaire |
| `ink-3` | `#8A8275` | Labels, captions |
| `ink-4` | `#C5BEAE` | Disabled |

### Couleur d'action
| Token | Hex | Usage |
|---|---|---|
| `primary` | `#3B7A57` | Sage — CTA, états actifs |
| `primary-dark` | `#2E6244` | Hover, pressed |
| `primary-soft` | `#E4EFE7` | Bg actif doux, badge succès |
| `primary-ink` | `#2E6244` | Texte sur primary-soft |

### Alertes & accent
| Token | Hex | Usage |
|---|---|---|
| `accent` | `#B97A1F` | Ambre — urgence douce (3-5j) |
| `accent-soft` | `#F8ECD4` | Bg badge warning |
| `accent-ink` | `#7A4F0F` | Texte sur accent-soft |
| `danger` | `#A93226` | Expiration urgente, erreur |
| `danger-soft` | `#F4DAD6` | Bg badge danger |
| `beta-bg` | `#EFE8D6` | Chip bêta |
| `beta-ink` | `#7A6433` | Texte chip bêta |

---

## 3. Typographies

**Serif (titres) :** Cormorant Garamond (Google Fonts), weights 400/500/600.
- Fallback : `"Iowan Old Style", Georgia, serif`
- Usage strict : h1, h2, titre de recette, hero display, valeurs stat (≥18px). **Jamais dans l'UI courant.**

**Sans-serif (UI) :** Helvetica Neue (système).
- Fallback : `-apple-system, BlinkMacSystemFont, system-ui, sans-serif`
- Usage : body, boutons, badges, navigation, formulaires.

**Mono (labels) :** SF Mono / ui-monospace.
- Fallback : `Menlo, Consolas, monospace`
- Usage : labels CAPS letter-spacing 1.4px (kickers, sections).

### Échelle (mobile-first)
| Token | Size / LH | Letter | Famille | Usage |
|---|---|---|---|---|
| `display` | 32 / 1.1 | -0.4 | serif | Hero accueil, écran feedback |
| `h1` | 26 / 1.15 | -0.2 | serif | Titre d'écran |
| `h2` | 22 / 1.2 | -0.1 | serif | Titre de section, recette |
| `h3` | 16 / 1.3 | 0 | sans 700 | Titre de bloc UI |
| `body` | 14 / 1.5 | 0 | sans 400 | Paragraphe |
| `body-strong` | 14 / 1.5 | 0 | sans 600 | Donnée mise en avant |
| `small` | 12 / 1.45 | 0 | sans 400 | Meta recette |
| `caption` | 11 / 1.4 | 0 | sans 500 | Quota, sous-CTA |
| `label` | 10 / 1.4 | 1.4 | mono 700 | Kicker, libellé section |

**Règle :** `font-serif` uniquement sur h1/h2 et `.recipe-title`. Tout le reste hérite de `font-sans`.

---

## 4. Tokens Tailwind

```js
// tailwind.config.js — extend
theme: {
  extend: {
    colors: {
      bg:        '#FAF7F0',
      surface:   '#FFFFFF',
      'surface-muted': '#F4EFE4',
      line:      '#EAE3D2',
      'line-2':  '#D9D0BB',
      ink:       '#1F1B16',
      'ink-2':   '#5C5447',
      'ink-3':   '#8A8275',
      'ink-4':   '#C5BEAE',
      primary:   { DEFAULT: '#3B7A57', dark: '#2E6244', soft: '#E4EFE7', ink: '#2E6244' },
      accent:    { DEFAULT: '#B97A1F', soft: '#F8ECD4', ink: '#7A4F0F' },
      danger:    { DEFAULT: '#A93226', soft: '#F4DAD6' },
      'beta-bg': '#EFE8D6',
      'beta-ink':'#7A6433',
    },
    fontFamily: {
      serif: ['"Cormorant Garamond"', 'Iowan Old Style', 'Georgia', 'serif'],
      sans:  ['"Helvetica Neue"', '-apple-system', 'system-ui', 'sans-serif'],
      mono:  ['ui-monospace', '"SF Mono"', 'Menlo', 'monospace'],
    },
    fontSize: {
      'display':  ['32px', { lineHeight: '1.1',  letterSpacing: '-0.4px' }],
      'h1':       ['26px', { lineHeight: '1.15', letterSpacing: '-0.2px' }],
      'h2':       ['22px', { lineHeight: '1.2',  letterSpacing: '-0.1px' }],
      'h3':       ['16px', { lineHeight: '1.3' }],
      'body':     ['14px', { lineHeight: '1.5' }],
      'small':    ['12px', { lineHeight: '1.45' }],
      'caption':  ['11px', { lineHeight: '1.4' }],
      'label':    ['10px', { lineHeight: '1.4', letterSpacing: '1.4px' }],
    },
    borderRadius: { sm: '8px', md: '12px', lg: '16px', xl: '20px' },
    boxShadow: {
      sm:  '0 1px 2px rgba(31,27,22,0.04)',
      md:  '0 4px 14px rgba(59,122,87,0.12)',
      lg:  '0 8px 24px rgba(31,27,22,0.08)',
      cta: '0 6px 20px rgba(59,122,87,0.28)',
    },
    spacing: {
      '4.5': '18px', '5.5': '22px',  // marges latérales standard
    },
  },
}
```

```css
/* globals.css — fallback CSS vars */
:root {
  --bg: #FAF7F0;        --surface: #FFFFFF;     --surface-muted: #F4EFE4;
  --line: #EAE3D2;      --line-2: #D9D0BB;
  --ink: #1F1B16;       --ink-2: #5C5447;       --ink-3: #8A8275;  --ink-4: #C5BEAE;
  --primary: #3B7A57;   --primary-dark: #2E6244; --primary-soft: #E4EFE7;
  --accent: #B97A1F;    --accent-soft: #F8ECD4;  --accent-ink: #7A4F0F;
  --danger: #A93226;    --danger-soft: #F4DAD6;
  --beta-bg: #EFE8D6;   --beta-ink: #7A6433;
  --r-sm: 8px; --r-md: 12px; --r-lg: 16px; --r-xl: 20px;
}
body { background: var(--bg); color: var(--ink); }
```

---

## 5. Composants à créer ou adapter

| Composant | Type | Variantes / Props |
|---|---|---|
| `<Button>` | atome | `kind: primary | secondary | dark | ghost | soft | disabled` · `size: sm | md | lg` · `fullWidth` · `loading` · `leftIcon` · `rightIcon` |
| `<Badge>` | atome | `tone: beta | danger | warning | success | neutral | solid` |
| `<BetaChip>` | atome | (figé, header uniquement) |
| `<BetaAlert>` | atome | `children` — banner inline pour zones IA |
| `<Toast>` | atome | `tone: success | danger | neutral` · `action?` · `duration` (3s défaut) |
| `<InlineBanner>` | atome | `tone: success | warning | danger` · `dismissible?` |
| `<Skeleton>` | atome | `variant: card | line | hero` · `count` |
| `<EmptyState>` | atome | `icon · title · subtitle · cta · tone: neutral | success | warning` |
| `<ProductCard>` | composé | `name · qty · location · expiresIn · tone · onClick` |
| `<RecipeCard>` | composé | `title · time · persons · available · src? · type: sale | sucre` |
| `<RecipePlaceholder>` | composé | `type · size: card | hero` — fallback sans photo |
| `<QuotaPill>` | composé | `used · total` — format unique « X / 10 ce mois » |
| `<TabBar>` | composé | `active: home | stock | family` (3 onglets) |
| `<BottomSheet>` | composé | `open · onClose · title · children` |
| `<SegmentedFilter>` | form | `options[] · value · onChange` (Tout/Frigo/Placard/Congélo) |
| `<TypeChoice>` | form | `value: sale | sucre` — 2 cartes plein cadre |
| `<OptionRow>` | form | `label · value · onClick` |
| `<EmojiRating>` | form | `value: 1..5 · onChange` |
| `<Tag>` | form | `on?` · checkbox visuel |
| `<PageHeader>` | layout | `title · kicker? · back? · action?` (toujours BetaChip à droite) |
| `<StickyCTA>` | layout | gradient + safe-area, padding-bottom 100/156px sur l'écran |

**Tous typés en TS, exportés depuis `components/ui/index.ts`.** Storybook recommandé sur Button, ProductCard, RecipeCard, EmptyState.

---

## 6. Variantes de composants

**Button :**
- `primary` — sage plein, ombre cta — un seul par écran
- `secondary` — surface + line, neutre
- `dark` — ink plein — confirmations finales (cuisiner, valider)
- `soft` — primary-soft + primary-ink — actions répétables (chips ajout)
- `ghost` — transparent + line — annulations
- `disabled` — surface-muted + ink-4 — état non-actionnable
- Tailles : sm 8/12, md 14/16, lg 16/18 (py/px)
- États : hover (primary-dark), pressed (scale .98), loading (spinner inline, libellé masqué)

**Badge :**
- `beta` — beta-bg + beta-ink, letter-spacing 1px
- `danger` / `warning` / `success` / `neutral` — fond soft + ink correspondant
- `solid` — primary plein + blanc — pour mises en avant exceptionnelles

**RecipeCard :**
- `compact` (liste 2 col, hauteur visuel 90px) — placeholder par défaut
- `hero` (résultat, hauteur 220px) — placeholder ou photo via `src`

---

## 7. États UI

| État | Composant | Comportement |
|---|---|---|
| **Vide stock** | `<EmptyState>` plein écran | CTA primaire « + Ajouter un produit » |
| **Vide recettes** | `<EmptyState>` inline | CTA vers /stock/add |
| **Loading IA** | `<Button loading>` | Libellé « Recherche… », bloque double-submit |
| **Loading liste** | `<Skeleton variant="card" count={3}>` | Fade-in 200ms à l'arrivée des données |
| **Erreur réseau** | `<InlineBanner tone="danger">` | Banner haut, ne bloque pas le reste |
| **Erreur IA** | `<EmptyState tone="warning">` | Quota IA non décrémenté |
| **Succès ajout** | `<Toast tone="success">` 3s top | aria-live="polite" |
| **Quota épuisé** | `<EmptyState>` plein /recipes/new | Bouton « Suggérer » disabled partout |
| **Quota bas (≤2)** | `<InlineBanner tone="warning">` | Discret, non bloquant |
| **Produit supprimé** | `<Toast tone="neutral" action>` 5s bas | Action « Annuler » → optimistic rollback |
| **Produit modifié** | `<Toast tone="success">` 2s | Si conflit → bascule danger |
| **Feedback envoyé** | `<EmptyState tone="success">` | Désactive le formulaire 24h |
| **Aucun produit urgent** | `<EmptyState tone="success" inline>` | « Tout est sous contrôle » sur Accueil + Stock |
| **Recette générée** | `<RecipeCard×3>` + animation -1 quota | Fade-in, scroll vers 1re recette |
| **Pas assez d'ingrédients** | `<EmptyState tone="warning">` | Bloque la génération AVANT appel IA (quota préservé) |

### Règle bêta
- Header : `<BetaChip />` discret partout
- Alerte complète : `<BetaAlert>` uniquement sur écrans IA (`/recipes/new`, `/recipes/[id]`)
- Onboarding : mention « Vous testez la version bêta » sur le 1er écran uniquement
- Pas de gros bandeau bêta permanent (donne une impression d'instabilité)
- Feedback : CTA accessible depuis `/family/feedback`. Pas de pop-up intrusif.

---

## 8. Microcopy

**Ton :** vouvoiement, court, direct, humain. Pas de jargon technique. Verbes à l'infinitif sur les CTA. Pas de point sur titres / CTA. Émojis avec parcimonie, jamais dans les CTA.

| Contexte | Texte | Sous-texte |
|---|---|---|
| Accueil greeting | Bonjour Thomas | Que prépare-t-on ce soir ? |
| CTA principal | Suggérer 3 recettes | 7 / 10 ce mois |
| Vide stock | Votre stock est vide. | Ajoutez vos premiers produits pour démarrer. |
| Vide recettes | Aucune suggestion pour l'instant. | Ajoutez quelques produits puis relancez. |
| Quota épuisé | Plus de générations ce mois. | Réinitialisation le 1er du mois prochain. |
| Quota bas | Plus que 2 ce mois. | — |
| Feedback recette | Cette suggestion vous plaît ? | 👍 / 👎 |
| Confirmation cuisine | Bon appétit ! | Les ingrédients ont été retirés du stock. |
| Erreur réseau | Connexion interrompue. | Réessayez dans un instant. |
| Tout est OK | Tout est sous contrôle. | Aucun produit à consommer dans les 7 jours. |

**Quota IA — format unique** dans `lib/copy.ts` :
```ts
export const quota = {
  normal: (n: number, total: number) => `${n} / ${total} ce mois`,
  low:    (n: number) => `Plus que ${n} ce mois.`,
  empty:  (resetAt: string) => `Plus de générations ce mois. Réinitialisation le ${resetAt}.`,
};
```

---

## 9. Description des 6 écrans

### 01 · Accueil (`/`)
- Greeting + display serif « Que prépare-t-on ce soir ? »
- Hero card sage : « 3 idées avec votre stock » + quota inline « 7 / 10 ce mois »
- Section « À utiliser bientôt · 3 » (3 ProductCard avec badge danger/warning)
- Stats 2 colonnes : « 24 produits / 12 recettes possibles »
- TabBar active = home

### 02 · Stock (`/stock`)
- PageHeader « Mon stock » + BetaChip
- Search inline + 4 pills filtres (Tout / Frigo / Placard / Congélo)
- Section danger « À UTILISER VITE · 3 » en haut
- Section neutre « FRIGO · 9 » en dessous
- FAB sage en bas-droite (au-dessus tab bar) → ouvre BottomSheet d'ajout
- TabBar active = stock

### 03 · Ajout produit (`/stock/add` — modal route)
- BottomSheet 70% hauteur
- Input « Nom du produit » + ligne Quantité / Emplacement
- Chips « Suggestions récentes » (Btn soft × 6)
- Zone dashed « 📷 Scanner un code-barres »
- CTA primaire sticky « Ajouter au stock »

### 04 · Génération (`/recipes/new`)
- PageHeader back + « Suggérer 3 recettes »
- Body : « On regarde votre stock et on vous propose 3 idées. »
- TypeChoice 2 cartes (Salé / Sucré)
- 4 OptionRow (Temps / Personnes / Difficulté / Régime)
- BetaAlert : « Privilégier les produits à utiliser bientôt »
- StickyCTA « Suggérer 3 recettes » + sub « 7 / 10 ce mois »

### 05 · Résultat (`/recipes/[id]`)
- Hero 220px : RecipePlaceholder (motif crème) ou photo
- Back + BetaChip overlay
- Badges (Anti-gaspi · Salé)
- Display serif « Gratin de jambon & pâtes »
- 3 stats (ingrédients dispo / kcal / déjà cuisiné)
- Liste ingrédients avec checkmarks dispo/manquants
- Bloc feedback 👍 / 👎 inline
- StickyCTA dark « Cuisiner ce repas » + sub « Les ingrédients seront retirés du stock »

### 06 · Feedback (`/family/feedback`)
- PageHeader « Votre avis » + kicker « BÊTA · MIAMILY »
- Body court d'intro
- Rating 5 emojis (😞 → 🤩)
- Tags multi-choix (« Qu'est-ce qui marche le mieux ? »)
- Textarea commentaire libre
- StickyCTA « Envoyer mon retour » + sub « Anonyme · facultatif »

---

## 10. Priorités d'intégration

1. **Tokens** (couleur + typo + radius + shadow) — bloquant pour tout le reste
2. **Atomes UI** (Button, Badge, BetaChip, Toast) — utilisés partout
3. **Layout shell** (PageHeader, TabBar 3 onglets, StickyCTA, BottomSheet)
4. **Cards** (ProductCard, RecipeCard + RecipePlaceholder, QuotaPill)
5. **Forms** (SegmentedFilter, TypeChoice, OptionRow, EmojiRating, Tag)
6. **EmptyState + Skeleton + InlineBanner** — pour tous les états UI
7. **Migration écrans** dans cet ordre : Accueil → Stock → Génération → Résultat → Feedback → Famille

---

## 11. Plan d'implémentation progressif

**Phase 0 — Préparation (½ jour)**
- Créer branche `feat/maison-design-system`
- Étendre `tailwind.config.js` avec les tokens
- Importer Cormorant Garamond via `next/font/google` (weights 400/500/600, display swap, subset latin, preload 500)
- Créer `lib/tokens.ts` et `lib/copy.ts`

**Phase 1 — Atomes (1 jour)**
- Implémenter Button, Badge, BetaChip, BetaAlert, Toast, InlineBanner, Skeleton, EmptyState
- Ajouter Storybook minimal sur Button + EmptyState

**Phase 2 — Composés + Layout (1 jour)**
- ProductCard, RecipeCard, RecipePlaceholder, QuotaPill
- PageHeader, TabBar (3 onglets — réduction depuis 5), StickyCTA, BottomSheet

**Phase 3 — Migration écrans (2 jours)**
- /accueil → /stock → /recipes/new → /recipes/[id] → /family/feedback
- 1 commit par écran. Tester sur device mobile à chaque étape.

**Phase 4 — QA + accessibilité (½ jour)**
- Audit contrastes (min 4.5:1 ink/ink-2)
- Vérifier safe-area iOS sur tab bar + sticky CTA
- Tester état offline / quota épuisé / erreur IA
- Vérifier tap targets ≥ 44×44px
- `grep -r "font-serif"` → ne touche que h1/h2/recipe-title
- `grep -r "#16a34a\|green-5\|green-6"` → 0 résultat

**Total estimé : 4 à 5 jours dev.**

---

## 12. Éléments à NE PAS casser

- **Auth + sessions** existantes : ne pas y toucher
- **API backend** : routes inchangées, formats de réponse inchangés
- **State management** existant (stock, produits) : seulement habiller, pas refactorer la logique
- **PWA manifest + service worker** : conserver tels quels (mettre à jour `theme_color: #FAF7F0` et `background_color: #FAF7F0`)
- **Routing Next.js existant** : si une route diffère du plan, garder l'existante et adapter le composant — ne pas renommer les routes pour matcher la maquette
- **Données utilisateur** locales (cache stock, préférences) : aucune migration nécessaire
- **Analytics events** existants : conserver, ajouter les nouveaux events feedback/quota

---

## 13. Risques techniques & UX à surveiller

**Techniques :**
- **Cormorant Garamond CLS** — bien charger via `next/font` avec `display: swap` + preload pour éviter le flash. Fallback metrics ajustés via `adjustFontFallback`.
- **Safe-area iOS** — la tab bar et le sticky CTA doivent intégrer `env(safe-area-inset-bottom)`. Tester en standalone PWA (différent de Safari mobile).
- **BottomSheet sur PWA Android** — `overscroll-behavior: contain` obligatoire sinon scroll page entière.
- **Toast aria-live** — pour l'accessibilité, utiliser `aria-live="polite"` (pas `assertive` qui interrompt le screen reader).
- **Quota IA race condition** — front et back peuvent désynchroniser. Toujours rafraîchir le quota après réponse API, pas avant.
- **Optimistic delete** — produit supprimé avec « Annuler » : prévoir endpoint qui accepte un rollback sous 5s.

**UX :**
- **Vert sage perçu comme « pâle »** — ne pas céder à la tentation de saturer. Si retours utilisateurs négatifs, augmenter ombre cta avant de toucher la couleur.
- **Serif Cormorant** sur petits écrans Android low-end — vérifier le rendu à 22px. Si peu lisible, monter à 24px h2.
- **3 onglets seulement** — Accueil / Stock / Famille. « Importer » devient route depuis Accueil et FAB du Stock. Si le métier impose un 4e onglet, le placer entre Stock et Famille.
- **Bandeau bêta retiré** — vérifier que le BetaChip header est suffisamment visible. Si feedback users « j'ignorais que c'était bêta », ajouter mention dans onboarding plutôt que remettre un bandeau permanent.
- **Quota bas** — l'avertissement doit rassurer plutôt qu'inquiéter. Le ton « Plus que 2 ce mois. » est volontairement neutre.
- **Photos de recettes** — en bêta, pas de photos = placeholder Maison partout. Quand les vraies photos arriveront, certaines seront de qualité hétérogène : prévoir un fallback automatique vers `<RecipePlaceholder>` si `src` retourne 404 ou si l'aspect ratio est incorrect.
- **Mode sombre** — hors scope V1 mais variables CSS prévues pour permettre l'ajout sans refacto.
- **Animations** — transitions 180ms `cubic-bezier(.2,.7,.3,1)`. Pas de spring, pas de Framer Motion en V1.

---

## Brief court à coller dans Claude Code

> Implémente la direction visuelle « Maison » dans l'app Miamily Next.js/PWA existante. Source unique de vérité : ce document. Ne réinterprète pas les valeurs : reprends les tokens Tailwind tels quels, les noms de composants exacts, et les microcopy mot pour mot.
>
> Phase par phase : tokens → atomes → composés → écrans dans l'ordre Accueil / Stock / Génération / Résultat / Feedback. 1 commit par écran. Ne touche pas à l'auth, à l'API backend ni au state management existant. La tab bar passe de 5 à 3 onglets. Le bandeau bêta orange permanent est remplacé par `<BetaChip>` en header.
>
> Avant chaque PR, vérifie :
> 1. `grep -r "#16a34a\|green-5\|green-6" src/` → 0 résultat
> 2. `grep -r "font-serif" src/` → uniquement h1/h2/recipe-title
> 3. Padding-bottom des écrans avec sticky : 100px (CTA seul) ou 156px (CTA + tab bar)
> 4. Safe-area iOS sur tab bar et sticky CTA
> 5. Quota IA formaté via `lib/copy.ts → quota.{normal|low|empty}`
