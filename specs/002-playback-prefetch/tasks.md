# Tâches : Préchargement de lecture

**Entrée** : artefacts de `specs/002-playback-prefetch/`
**Prérequis** : `spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/`, `reuse-audit.md`

## Format

- `[P]` : tâche parallélisable sur un fichier distinct.
- `[USn]` : rattachement à une user story de la spécification.
- Chaque tâche possède un résultat observable et un chemin explicite.

## Phase 1 — Mise en place

- [x] T001 Vérifier le worktree, les fichiers ignorés et l'absence de nouvelle dépendance dans `.gitignore`, `Grayjay.ClientServer/Grayjay.ClientServer.csproj` et `Grayjay.Desktop.Web/package.json` ; résultat : aucun changement hors périmètre requis.
- [x] T002 Créer le journal d'implémentation dans `specs/002-playback-prefetch/implementation.md` ; résultat : commandes, statuts et fichiers modifiés traçables.

## Phase 2 — Fondations test-first

- [x] T003 [P] Écrire les tests unitaires initialement rouges de déduplication, sérialisation, remplacement, fraîcheur et consommation unique dans `Grayjay.Desktop.Tests/PlaybackPreparationTests.cs` ; résultat : les invariants FR-003/004/013 échouent avant implémentation.
- [x] T004 Implémenter l'état mono-entrée O(1) dans `Grayjay.ClientServer/Controllers/DetailsController.cs` ; résultat : T003 passe sans stockage global ni dépendance nouvelle.
- [x] T005 Extraire la résolution sans effet de bord du flux `VideoLoad` dans `Grayjay.ClientServer/Controllers/DetailsController.cs` ; résultat : FR-002 est garantie, préparation et chargement utilisent le même traitement d'erreurs, seul le chargement appelle `ChangeVideo`.

**Checkpoint** : cache isolé testable, aucune user story ne commence avant passage de T003.

## Phase 3 — User Story 1 : transition préparée générique (P1)

**Objectif** : toute file déterministe peut préparer et consommer sa prochaine vidéo sans donnée Smart.

**Test indépendant** : préparer une URL, charger cette URL, observer un hit unique et vérifier que la vidéo active précédente n'a pas été modifiée pendant la préparation.

- [x] T006 [US1] Ajouter les endpoints et résultats rétrocompatibles `VideoPrepare`, annulation et `VideoLoadResult` enrichi dans `Grayjay.ClientServer/Controllers/DetailsController.cs` ; résultat : FR-005/006/010/011 et le contrat `contracts/details-playback-prefetch.md` sont respectés, les échecs restent non bloquants.
- [x] T007 [P] [US1] Ajouter les appels et types frontend dans `Grayjay.Desktop.Web/src/backend/DetailsBackend.ts` ; résultat : préparation, annulation, indicateur de hit et source jointe sont typés.
- [x] T008 [US1] Déclencher la préparation depuis la prochaine entrée déterministe de `Grayjay.Desktop.Web/src/components/contentDetails/VideoDetailView/index.tsx` ; résultat : FR-001 est couverte, playlists/files standard préchargées, shuffle et absence de prochaine entrée ignorés.
- [x] T009 [US1] Réutiliser la source automatique jointe sur hit dans `Grayjay.Desktop.Web/src/components/contentDetails/VideoDetailView/index.tsx` et `Grayjay.Desktop.Web/src/components/player/VideoPlayerView/index.tsx` ; résultat : FR-005/014 sont couvertes et aucun appel `SourceAuto`/`SourceProxy` redondant n'est effectué pour une transition préparée.
- [x] T010 [US1] Ajouter les logs backend de statut/durée et le diagnostic frontend de transition dans `Grayjay.ClientServer/Controllers/DetailsController.cs` et `Grayjay.Desktop.Web/src/components/contentDetails/VideoDetailView/index.tsx` ; résultat : FR-012 est couverte, hit/miss/failed/superseded et délai vers lecture sont observables par URL.

**Checkpoint** : US1 fonctionne indépendamment avec le rendu de chargement historique.

## Phase 4 — User Story 2 : continuité visuelle (P2)

**Objectif** : remplacer l'écran noir par la miniature de la vidéo cible jusqu'à sa première image jouée.

**Test indépendant** : ralentir la source, changer de vidéo et vérifier que la miniature reste visible pendant le loader puis disparaît au premier état playing.

- [x] T011 [US2] Ajouter le contrat de poster et l'état « première image reçue » dans `Grayjay.Desktop.Web/src/components/player/VideoPlayerView/index.tsx` ; résultat : FR-007 est couverte, poster visible uniquement avant le premier playing de la source courante.
- [x] T012 [P] [US2] Ajouter le style de poster plein cadre non interactif dans `Grayjay.Desktop.Web/src/components/player/VideoPlayerView/index.module.css` ; résultat : image contenue, loader et contrôles restent au-dessus sans déplacement de layout.
- [x] T013 [US2] Fournir la miniature de la prochaine entrée depuis `Grayjay.Desktop.Web/src/components/contentDetails/VideoDetailView/index.tsx` ; résultat : le poster est disponible avant la fin de `VideoLoad` et le cas sans miniature conserve le comportement historique.

**Checkpoint** : US2 fonctionne avec préchargement activé ou désactivé.

## Phase 5 — User Story 3 : contrôle utilisateur (P3)

**Objectif** : activer ou désactiver la résolution anticipée depuis les réglages Player.

**Test indépendant** : désactiver puis activer le toggle et vérifier l'absence puis la présence des événements `playback_prefetch started`.

- [x] T014 [US3] Ajouter le toggle `Prefetch next video` dans `Grayjay.ClientServer/Settings/GrayjaySettings.cs` ; résultat : FR-008 est couverte, réglage Player actif par défaut et sérialisé par le mécanisme existant.
- [x] T015 [US3] Respecter le toggle et annuler la cible obsolète dans `Grayjay.Desktop.Web/src/components/contentDetails/VideoDetailView/index.tsx` et `Grayjay.ClientServer/Controllers/DetailsController.cs` ; résultat : FR-004/013 sont couvertes, aucun appel anticipé quand désactivé et aucun résultat obsolète consommable.

**Checkpoint** : les trois user stories sont fonctionnelles sans dépendance Smart.

## Phase 6 — Validation et finition

- [x] T016 [P] Mettre à jour la documentation technique et le journal dans `docs/decisions/001-isolated-playback-prefetch.md`, `specs/002-playback-prefetch/quickstart.md` et `specs/002-playback-prefetch/implementation.md` ; résultat : invariants, limites et commandes reproductibles.
- [x] T017 Exécuter `dotnet test Grayjay.Desktop.Tests/Grayjay.Desktop.Tests.csproj` ; résultat : commande globale bloquée par les erreurs FUTO préexistantes de `ProxyTests.cs`, cinq tests ciblés exécutés avec succès dans un projet isolé temporaire.
- [x] T018 Exécuter `npm run build` dans `Grayjay.Desktop.Web` puis `dotnet build Grayjay.ClientServer/Grayjay.ClientServer.csproj` ; résultat : deux builds à code 0, avertissements préexistants distingués.
- [x] T019 Exécuter `git diff --check`, relire le diff complet et réaliser la self-review complexité/minimalisme/vertus LLM ; résultat : FR-009/015 sont vérifiées, aucun whitespace error, aucune abstraction ou ligne suppressible non justifiée.
- [x] T020 Exécuter le protocole manuel de `specs/002-playback-prefetch/quickstart.md` sur une build installée ; résultat : bloqué explicitement, car installer ce worktree FUTO isolé remplacerait la build Blue Jay active ; protocole prêt pour validation utilisateur sans changement de code restant.

## Phase 7 — Source et manifeste prêts avant transition

- [x] T021 Étendre les tests de préparation à la libération des valeurs remplacées, annulées et expirées, sans libérer une valeur consommée.
- [x] T022 Remplacer le résultat brut par un paquet de lecture préparé contenant les détails, la source automatique et l'état DASH isolé.
- [x] T023 Générer silencieusement la source et le manifeste pendant `VideoPrepare`, puis transférer atomiquement le cache et les exécuteurs lors de `VideoLoad`.
- [x] T024 Enrichir les diagnostics avec `sourceReady` et `manifestReady`, puis mettre à jour le contrat et l'ADR.
- [x] T025 Relancer les tests ciblés, les builds frontend/backend et le protocole manuel dans BlueJay ; résultat : tests ciblés 10/10, builds à code 0, premier passage Smart TV servi par un `hit`, puis préparation de N+1 en 1 317 ms avec source et manifeste prêts.

## Dépendances et ordre

```text
T001 -> T002 -> T003 -> T004 -> T005
T005 -> T006 -> T007 -> T008 -> T009 -> T010
T010 -> T011 -> T012 -> T013
T013 -> T014 -> T015
T015 -> T016 -> T017 -> T018 -> T019 -> T020
T020 -> T021 -> T022 -> T023 -> T024 -> T025
```

- T003 et la lecture des contrats frontend peuvent être préparées en parallèle, mais T004 attend le test rouge.
- T012 porte uniquement le CSS et peut être réalisé en parallèle de T011 après stabilisation du contrat de prop.
- Les user stories sont livrées séquentiellement car elles partagent `VideoDetailView` et le flux de transition.

## Critères indépendants par story

- **US1** : un hit de préparation évite la résolution plugin et l'aller-retour source automatique, sans modifier la lecture active.
- **US2** : le poster masque le noir jusqu'au premier playing, même sans hit de préparation.
- **US3** : le toggle désactive toute nouvelle préparation et invalide la cible prête.

## Stratégie d'implémentation

1. Tester puis construire le cache sans toucher au frontend.
2. Brancher l'API et la file standard pour obtenir le gain fonctionnel P1.
3. Ajouter la continuité visuelle indépendamment du cache.
4. Exposer le contrôle utilisateur.
5. Valider automatiquement, puis mesurer dans l'application réelle.

## Notes

- Aucun commit automatique dans ce pipeline.
- Aucun changement sur Smart Chapters, Smart TV, SponsorBlock ou les branches FUTO de correction.
- Le prébuffer de fragments média et le double lecteur sont explicitement hors périmètre.
