# Complément handoff — Écran Ajouter au stock

Ce document complète le handoff principal généré par Claude Design.

## Objectif

Modifier la hiérarchie de l’écran “Ajouter au stock” pour rendre l’import du ticket de caisse central en V1, tout en conservant une interface simple, mobile-first et fidèle à la direction visuelle “Maison”.

## Principe produit

Le ticket de caisse est une fonctionnalité centrale de la V1, car c’est probablement celle qui fera gagner le plus de temps après les courses.

Mais Miamily ne doit pas promettre une reconnaissance parfaite.

Formulation à respecter :

> “Nous détectons les produits lisibles. Vous vérifiez avant ajout.”

Aucun produit ne doit être ajouté automatiquement au stock sans validation utilisateur.

## Hiérarchie de l’écran Ajouter au stock

L’écran doit s’inspirer de la variation “C — Liste choisie” produite par Claude Design, mais avec une hiérarchie modifiée.

### 1. Bloc principal — Importer un ticket de caisse

Ce bloc doit être le plus visible.

Contenu :
- Titre : “Importer un ticket de caisse”
- Sous-texte : “PDF, capture ou photo.”
- Message : “Nous détectons les produits lisibles. Vous vérifiez avant ajout.”
- CTA : “Importer un ticket”

Le ticket doit apparaître comme l’option principale d’ajout rapide.

### 2. Bloc secondaire — Taper ou coller une liste

Contenu :
- Titre : “Ajouter manuellement”
- Grand champ texte.
- Placeholder : “Tapez ou collez votre liste…”
- Exemple : “yaourts x4, riz, œufs, jambon”
- CTA : “Vérifier la liste”

Ce bloc couvre à la fois :
- l’ajout manuel rapide ;
- le copier-coller d’une liste de courses ;
- l’ajout de plusieurs produits d’un coup.

### 3. Méthodes rapides secondaires

Afficher deux actions secondaires :
- Scanner un code-barres
- Dicter une liste

Ces méthodes doivent être visibles, mais moins centrales que le ticket.

Le ticket ne doit pas être au même niveau visuel que scan et voix.

### 4. Habitudes / produits fréquents

Afficher des chips :
- Lait
- Pain
- Beurre
- Œufs
- Pâtes
- Riz
- Yaourt
- Tomates
- Oignons

### 5. Ajoutés récemment

Afficher une liste compacte avec bouton +.

Exemples :
- Crème fraîche — 20 cl
- Saumon fumé — 100 g

## Écran commun de validation

Toutes les méthodes d’import doivent mener au même écran de validation.

Titre :
“Produits détectés”

Sections :
1. Confirmés
2. À vérifier
3. Ignorés

Exemple :

Confirmés :
- Yaourts nature x4 — Frigo
- Riz basmati — Placard
- Œufs x6 — Frigo

À vérifier :
- “LEG BIO” — préciser le produit
- “FROM 250G” — probablement fromage

Ignorés :
- Total
- TVA
- Remise fidélité
- Carte bancaire

CTA principal :
“Ajouter les produits confirmés”
ou
“Ajouter 12 produits au stock”

## États spécifiques au ticket

Prévoir les états suivants :

- Ticket en analyse
- Ticket illisible
- Aucun produit détecté
- Format non supporté
- Analyse échouée
- Produits incertains à vérifier
- Produits confirmés
- Lignes ignorées

## Règles UX

- Ne jamais promettre une reconnaissance parfaite.
- Ne jamais ajouter automatiquement les produits sans validation.
- Toujours permettre la correction avant ajout.
- Présenter les produits incertains comme “À vérifier”.
- Ignorer les lignes non alimentaires ou inutiles.
- Garder une interface simple, respirable et fidèle à la charte “Maison”.
- Ne pas surcharger l’écran.