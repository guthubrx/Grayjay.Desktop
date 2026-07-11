# Audit de reutilisation de l'existant — playback-prefetch

## Decision

Statut: PASS
Date: 2026-07-11
Feature dir: `specs/002-playback-prefetch`

Conclusion courte: Le plan étend les frontières déjà responsables de la lecture et ne recrée aucun service existant. Le cache DASH courant et l'ancien réglage `VideoCache` commenté sont des concepts voisins mais ne couvrent pas la résolution anticipée isolée d'une prochaine entrée. Aucun arbitrage utilisateur n'est requis avant les tâches.

## Synthese

| Metrique | Valeur |
|---|---:|
| Items extraits du plan | 8 |
| Items audites | 8 |
| Reutilisations deja prevues | 7 |
| Existants potentiellement pertinents | 2 |
| Duplications evidentes | 0 |
| Regles/memoires applicables | 7 |
| Specs existantes applicables | 1 |

## Reutilisations correctement identifiees

| Item du plan | Existant reutilise | Preuve | Commentaire |
|---|---|---|---|
| Cache mono-entrée par fenêtre | `DetailsController.DetailsState` | `Grayjay.ClientServer/Controllers/DetailsController.cs:47` | L'état est déjà possédé et libéré par fenêtre. |
| Résolution sans activation | `StatePlatform.GetContentDetails` et `VideoLoad` | `Grayjay.ClientServer/States/StatePlatform.cs:168`, `Grayjay.ClientServer/Controllers/DetailsController.cs:309` | Extraction ciblée du début du flux existant. |
| Activation atomique | `ChangeVideo` | `Grayjay.ClientServer/Controllers/DetailsController.cs:129` | Les effets d'historique et de tracker restent centralisés. |
| Contrat HTTP local | `DetailsController` et `DetailsBackend` | `Grayjay.ClientServer/Controllers/DetailsController.cs:309`, `Grayjay.Desktop.Web/src/backend/DetailsBackend.ts:23` | Deux opérations locales ajoutées à la frontière existante. |
| Détection de prochaine entrée | `VideoProvider.queue/index` et `nextVideoIndex` | `Grayjay.Desktop.Web/src/contexts/VideoProvider.tsx:140`, `Grayjay.Desktop.Web/src/components/contentDetails/VideoDetailView/index.tsx:269` | Aucun modèle de file parallèle. |
| Poster de transition | `thumbnailUrl`, loader et état de lecture du lecteur | `Grayjay.Desktop.Web/src/components/player/VideoPlayerView/index.tsx:41`, `Grayjay.Desktop.Web/src/components/player/VideoPlayerView/index.tsx:1330`, `Grayjay.Desktop.Web/src/components/player/VideoPlayerView/index.tsx:1419` | Extension du rendu existant. |
| Réglage utilisateur | `GrayjaySettings.PlaybackSettings` | `Grayjay.ClientServer/Settings/GrayjaySettings.cs:122` | Toggle ajouté au groupe Player existant. |
| Tests backend | projet MSTest existant | `Grayjay.Desktop.Tests/Grayjay.Desktop.Tests.csproj:1` | Aucun nouveau framework de test. |

## Existant potentiellement pertinent non mentionne

| Item du plan | Existant proche | Preuve | Decision attendue |
|---|---|---|---|
| Préparation de détails | `CachedDashTask` | `Grayjay.ClientServer/Controllers/DetailsController.cs:65` | Ne pas réutiliser : ce cache prépare un manifeste pour la vidéo déjà active et dépend de ses indices. |
| Toggle de préchargement | `Browsing.VideoCache` commenté | `Grayjay.ClientServer/Settings/GrayjaySettings.cs:261` | Ne pas réactiver : aucun comportement ni consommateur n'existe derrière ce réglage. Utiliser le groupe Player actif. |

## Duplications evidentes

| Item propose | Doublon existant | Preuve | Action requise |
|---|---|---|---|
| Aucun | Aucun | Recherche nominale et conceptuelle | Aucune |

## Memoires et regles applicables

| Source | Regle | Impact sur le plan |
|---|---|---|
| `.specify/memory/constitution.md` | Constitution globale prioritaire | Pipeline SpecKit complet et ADR. |
| `/Users/moi/.speckit/constitution.md` Article XVI | Worktree dédié | Implémentation isolée dans `.worktrees/002-playback-prefetch`. |
| `/Users/moi/.speckit/constitution.md` Article XVIII | Complexité explicite | Cache et lookup O(1), une cible par fenêtre. |
| `/Users/moi/.speckit/constitution.md` Article XIX | Réutiliser avant de créer | Extension de cinq composants existants, aucun service global. |
| `/Users/moi/.speckit/constitution.md` Article XX | Charge cognitive future | Séparation résolution/activation documentée et testée. |
| `.specify/memory/standards.md` | Tests et observabilité pertinents | MSTest, build Vite et logs locaux ciblés. |
| `AGENTS.md` | Plan courant obligatoire | Référence vers `specs/002-playback-prefetch/plan.md`. |

## Specs livrees applicables

| Spec | Pattern deja etabli | Impact |
|---|---|---|
| `specs/001-sponsorblock-smart-chapters` (autre worktree) | Fonctionnalité optionnelle et dégradation propre | Le préchargement ne doit dépendre d'aucune donnée Smart et doit rester désactivable. |

## Journal de recherche

| Requete | Portee | Resultat |
|---|---|---|
| `rg "GetContentDetails|VideoLoad|DetailsState"` | backend C# | Résolution et activation actuellement couplées dans `DetailsController`. |
| `rg "CachedDash|SourceAuto|GenerateSourceProxy"` | backend C# | Cache existant limité à la source active. |
| `rg "currentVideo|nextVideoIndex|videoLoad"` | frontend TSX | Orchestration de file déjà localisée dans `VideoDetailView`. |
| `rg "thumbnailUrl|isLoading|onIsPlayingChanged"` | lecteur TSX/CSS | Tous les signaux nécessaires au poster sont présents. |
| `rg "PlaybackSettings|VideoCache"` | settings C# | Groupe Player actif ; ancien toggle de cache commenté. |
| `rg "prefetch|preload"` | code, tests, specs | Aucun préchargement de prochaine vidéo existant. |

## Arbitrages

| Sujet | Decision | Justification | Date |
|---|---|---|---|
| Cache DASH existant | conserver séparé | Responsabilité liée au manifeste de la vidéo active. | 2026-07-11 |
| Ancien `VideoCache` commenté | ne pas réactiver | Absence d'implémentation et mauvais groupe fonctionnel. | 2026-07-11 |
| Double lecteur/prébuffer média | ne pas créer | Hors périmètre, coût architectural disproportionné. | 2026-07-11 |

## Gate avant tasks

- [x] Aucune duplication evidente non arbitree
- [x] Chaque item extrait du plan a une ligne d'audit
- [x] Les regles projet applicables ont ete lues
- [x] Les specs existantes proches ont ete verifiees
- [x] Le plan.md a ete refactore ou les divergences sont justifiees
