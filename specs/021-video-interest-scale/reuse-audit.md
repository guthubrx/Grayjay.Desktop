# Audit de reutilisation de l'existant - Echelle d'interet a dix paliers

## Decision

**Statut**: PASS
**Date**: 2026-08-06
**Feature dir**: `/Volumes/8TB2/50-repos-archives/11.Repositories/grayjay-session-021-video-interest-scale/specs/021-video-interest-scale`

La primitive automatisee `speckit-audit-existing` n'est pas fournie dans cette copie du runtime projet. Audit manuel applique selon le protocole : lecture des regles, extraction des elements du plan, recherche avec `rg`, puis verification des composants parents.

## Elements proposes et existants reutilises

| Element du plan | Existant reutilise | Preuve | Decision |
|---|---|---|---|
| Conversion de score | `highlightInterest.ts` | `Grayjay.Desktop.Web/src/utils/highlightInterest.ts` | Modifier le mapping local, pas de nouvel utilitaire concurrent. |
| Tests de conversion | `highlightInterest.test.ts` | `Grayjay.Desktop.Web/src/utils/highlightInterest.test.ts` | Completer le test existant. |
| Detail video | `VideoDetailView` | `Grayjay.Desktop.Web/src/components/contentDetails/VideoDetailView/index.tsx` | Remplacer seulement le texte d'etoiles. |
| Hero et overlay | `HeroBanner` | `Grayjay.Desktop.Web/src/components/home/HeroBanner/index.tsx` | Reutiliser le meme rendu d'etoiles dans les deux usages. |
| Styles d'integration | CSS modules existants | `VideoDetailView/index.module.css`, `HeroBanner/index.module.css` | Garder les conteneurs et styles de copie existants. |

## Equivalents recherches et rejetes

| Candidat | Resultat | Justification |
|---|---|---|
| Nouveau store de notation | Absent et inutile | La note est derivee synchronement du signal existant. |
| Nouveau schema highlights | Inutile | Le score brut et les chapitres restent inchanges. |
| `recommendationRanking.ts` | Existant mais hors scope | Il classe les recommandations ; le besoin ne demande pas de modifier leur ordre. |
| Filtres Smart Chapters du player | Existant mais hors scope | Ils utilisent le score relatif des chapitres, distinct de la note video. |

## Duplications evidentes

| Item propose | Doublon | Decision |
|---|---|---|
| Composant de demi-etoiles | Aucun composant actuel de demi-etoile ; trois rendus actuels du meme texte | Creer un seul rendu reutilisable, justifie par trois usages reels. |

## Risques et garde-fous

- Ne pas modifier `segment.score` ni les constantes de filtre du player.
- Ne pas appeler le generateur Python ni lancer de backfill.
- Le composant de rendu doit fournir une valeur textuelle ; aucune dependance d'icones ou SVG maison ne sera ajoutee.

## Gate avant tasks

- [x] Les composants et utilitaires existants ont ete identifies
- [x] Aucun doublon evident non arbitre n'a ete detecte
- [x] Le plan ne modifie ni schema persistant ni ordre de recommandation
- [x] Le nouveau composant est justifie par trois usages reels
- [x] Les regles Article XIX et XX ont ete appliquees
