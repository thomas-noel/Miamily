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
      stock:      (n: number) =>
        `Vos produits, c'est fait · ${n} utilisés`,
      tastes:     (list: string) =>
        `Vos goûts, c'est fait · ${list}`,
      family:     (a: number, k: number) =>
        `Votre famille, c'est fait · ${a} adulte${a > 1 ? 's' : ''}, ${k} enfant${k > 1 ? 's' : ''}`,
      generating: 'Création de vos recettes · presque prêt',
    },
    footer: 'Habituellement moins de 10 secondes',
    footerSlow: 'Encore quelques secondes…',
    footerRetry: 'Réessayer',
  },
}

export const quota = {
  normal: (remaining: number, total: number) => `${remaining} / ${total} ce mois`,
  low: (remaining: number) => `Plus que ${remaining} ce mois.`,
  empty: (resetAt: string) => `Plus de générations ce mois. Réinitialisation le ${resetAt}.`,
}
