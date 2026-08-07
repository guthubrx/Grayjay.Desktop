# Audit de reutilisation de l'existant - Echelle d'interet et profil editorial video

## Decision

**Statut**: PASS
**Date**: 2026-08-07
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
| Profil persistant | `VideoHighlightSet` et modeles highlights C#/TS | `Grayjay.ClientServer/Models/Highlights/VideoHighlightSet.cs`, `Grayjay.Desktop.Web/src/backend/models/highlights/IVideoHighlightSet.ts` | Ajouter une propriete optionnelle, sans nouveau store. |
| Classement | `recommendationRanking.ts` | `Grayjay.Desktop.Web/src/utils/recommendationRanking.ts` | Etendre avec un horizon de fraicheur optionnel ; conserver exactement le calcul historique en son absence. |
| Analyse LLM | `build_analysis_prompt`, `validate_analysis`, `analysis_cache` | `tools/generate_smart_chapters.py` | Ajouter le profil a la passe existante et reutiliser les highlights locaux pour le backfill. |

## Equivalents recherches et rejetes

| Candidat | Resultat | Justification |
|---|---|---|
| Nouveau store de notation | Absent et inutile | La note est derivee synchronement du signal existant. |
| Nouveau schema highlights | `VideoHighlightSet` existe | Une propriete optionnelle est necessaire pour transporter le profil entre le generateur, le backend et le frontend. |
| Nouveau moteur de classement | `recommendationRanking.ts` existe | Son extension optionnelle evite une seconde formule de fraicheur. |
| Filtres Smart Chapters du player | Existant mais hors scope | Ils utilisent le score relatif des chapitres, distinct de la note video. |

## Duplications evidentes

| Item propose | Doublon | Decision |
|---|---|---|
| Composant de demi-etoiles | Aucun composant actuel de demi-etoile ; trois rendus actuels du meme texte | Creer un seul rendu reutilisable, justifie par trois usages reels. |

## Risques et garde-fous

- Ne pas modifier `segment.score` ni les constantes de filtre du player.
- Ne pas utiliser la date, la popularite ni la pertinence semantique pour la note editoriale stable.
- Le backfill ne doit jamais appeler Whisper, yt-dlp ou modifier les chapitres existants.
- Le composant de rendu doit fournir une valeur textuelle ; aucune dependance d'icones ou SVG maison ne sera ajoutee.

## Gate avant tasks

- [x] Les composants et utilitaires existants ont ete identifies
- [x] Aucun doublon evident non arbitre n'a ete detecte
- [x] Le schema persistant optionnel est justifie et compatible avec les fichiers existants
- [x] Le classement existant est reutilise sans second moteur concurrent
- [x] Le nouveau composant est justifie par trois usages reels
- [x] Les regles Article XIX et XX ont ete appliquees
