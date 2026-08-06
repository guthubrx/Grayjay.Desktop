# ADR 021 - Echelle d'interet video en demi-etoiles

**Statut**: Accepte
**Date**: 2026-08-06

## Contexte

L'echelle video actuelle condense un score d'interet derive dans cinq etoiles entieres et cinq libelles anglais. L'utilisateur veut disposer des cinq etoiles et de leurs demi-etoiles, soit dix paliers lisibles.

## Decision

Conserver le score brut d'interet existant et le convertir en dix demi-paliers stables. Afficher une note accessible avec cinq emplacements d'etoiles, une demi-etoile eventuelle et un libelle francais par palier.

Les scores de chapitre et le classement de recommandation restent hors scope. La feature ne presente pas la note comme une mesure editoriale calibree inter-videos.

## Consequences

### Positives

- Distinction visible entre videos auparavant arrondies au meme nombre d'etoiles.
- Aucune regeneration des highlights ni appel LLM.
- Aucun reclassement des listes Smart TV ou Watch now.

### Negatives

- La precision visible reste celle du signal derive actuel ; elle ne remplace pas une calibration editoriale future.
- Dix libelles demandent une documentation et des tests de frontiere explicites.
