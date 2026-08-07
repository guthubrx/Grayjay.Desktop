# Implementation Plan: Echelle d'interet a dix paliers

**Branch**: `pr/021-video-interest-scale` | **Date**: 2026-08-06 | **Spec**: [spec.md](spec.md)
**Input**: Specification de l'echelle video en cinq etoiles et demi-etoiles.

## Summary

Remplacer la conversion de score d'interet video en etoiles entieres par une conversion deterministe vers les dix demi-paliers de `0,5` a `5,0`, avec dix libelles francais. Exposer ce meme signal sur les cartes videos indexees a partir d'un etat partage qui ne conserve que les champs numeriques necessaires. Les scores de chapitres et le classement des recommandations restent hors perimetre. Les interfaces de detail video, Hero Banner et cartes reutilisent un rendu d'etoiles accessible unique, sans nouvelle dependance ni migration de highlights.

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: TypeScript 5.9, SolidJS 1.9, CSS modules
**Primary Dependencies**: SolidJS et Vite existants ; aucune dependance ajoutee
**Storage**: N/A, conversion derivee en memoire a partir du score d'interet deja calcule
**Testing**: `node --test` avec support TypeScript de Node, build Vite existant
**Target Platform**: Grayjay Desktop / BlueJay local
**Project Type**: Application desktop avec frontend web embarque
**Performance Goals**: Conversion O(1), aucun appel reseau, aucune regeneration Smart Chapters et aucun recalcul de liste
**Constraints**: Compatibilite avec tous les highlights existants, rendu lisible et accessible, aucune modification du score brut ni des filtres de chapitres
**Scale/Scope**: Un utilitaire, un composant de rendu reutilise dans les details, les heroes et les cartes, un etat d'index compact, trois styles d'integration et leurs tests

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- SpecKit: les artefacts restent dans `specs/021-video-interest-scale/`.
- Article XIX: reutiliser le calcul `highlightInterest.ts` et les deux composants deja consommateurs ; pas de nouveau service, store, preference ou schema persistant.
- Article XX: le nom du signal reste un interet derive et n'est pas presente comme une probabilite, une note utilisateur ou une qualite absolue.
- Accessibilite: fournir une valeur textuelle et un libelle en plus du rendu graphique de demi-etoile.
- Performance: aucune operation asynchrone, aucune requete et aucun changement de classement.
- Git anonymat: aucun commit automatique et aucun trailer IA.

## Project Structure

### Documentation (this feature)

```text
specs/021-video-interest-scale/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```text
Grayjay.Desktop.Web/src/
├── utils/
│   ├── highlightInterest.ts
│   └── highlightInterest.test.ts
├── components/highlights/
│   └── InterestRatingStars/
├── components/content/VideoThumbnailView/
├── components/contentDetails/VideoDetailView/
├── components/home/HeroBanner/
└── state/StateIndexedHighlights.ts

docs/decisions/
└── 021-half-star-video-interest.md
```

**Structure Decision**: Extraire seulement le rendu d'etoiles qui est effectivement utilise trois fois. Le calcul et les seuils restent dans l'utilitaire existant. Les composants parents conservent leurs conteneurs, libelles et details existants.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Aucune | N/A | N/A |
