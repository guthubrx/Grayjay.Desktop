# Implementation Plan: Echelle d'interet et profil editorial video

**Branch**: `pr/021-video-interest-scale` | **Date**: 2026-08-06 | **Spec**: [spec.md](spec.md)
**Input**: Specification de l'echelle video en cinq etoiles et demi-etoiles.

## Summary

Conserver l'echelle visible a dix demi-paliers et faire evoluer sa source vers un profil editorial versionne. Les cinq dimensions stables sont evaluees par le generateur et agregees localement ; la fraicheur et la pertinence restent des signaux separes de classement. Les analyses existantes peuvent etre enrichies a partir de leurs fichiers locaux, sans transcription ni media.

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: TypeScript 5.9, SolidJS 1.9, CSS modules
**Primary Dependencies**: SolidJS et Vite existants ; aucune dependance ajoutee
**Storage**: JSON highlights versionne, compatible avec les fichiers existants ; caches transcript et analyse existants en lecture pour le backfill
**Testing**: `node --test` avec support TypeScript de Node, `unittest` Python cible, build Vite et publication .NET existants
**Target Platform**: Grayjay Desktop / BlueJay local
**Project Type**: Application desktop avec frontend web embarque
**Performance Goals**: Calcul O(1) sur le frontend, aucune requete par carte, aucune transcription durant le backfill, ecritures atomiques de highlights
**Constraints**: Compatibilite avec tous les highlights existants, note editoriale independante de la date, scores de chapitres et filtres player inchanges, absence de Smart Chapters sans regression
**Scale/Scope**: Modeles highlights C#/TypeScript, utilitaire de calcul, moteur de classement optionnel, generateur et backfill de profils, index compact, tests et ADR

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- SpecKit: les artefacts restent dans `specs/021-video-interest-scale/`.
- Article XIX: reutiliser `highlightInterest.ts`, les modeles highlights et `recommendationRanking.ts` ; le schema persistant est justifie car le profil doit etre partage entre le generateur, le backend et le frontend.
- Article XX: la note est une valeur editoriale estimee pour un spectateur interesse par le sujet, pas une probabilite de satisfaction, une opinion personnelle ou une verite universelle.
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
├── backend/models/highlights/
│   └── IVideoHighlightEditorialProfile.ts
├── components/highlights/
│   └── InterestRatingStars/
├── components/content/VideoThumbnailView/
├── components/contentDetails/VideoDetailView/
├── components/home/HeroBanner/
└── state/StateIndexedHighlights.ts

Grayjay.ClientServer/Models/Highlights/
└── VideoHighlightEditorialProfile.cs

tools/
└── generate_smart_chapters.py

docs/decisions/
├── 021-half-star-video-interest.md
└── 022-editorial-video-value.md
```

**Structure Decision**: Le profil est stocke avec le highlight car il est genere en dehors de l'application web et doit survivre au redemarrage. Le calcul de note reste dans `highlightInterest.ts`; le classement ne recoit qu'un horizon optionnel de fraicheur. Aucun service, store global ou dependance n'est ajoute.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Aucune | N/A | N/A |
