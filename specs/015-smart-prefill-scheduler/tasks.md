# Taches : Smart Prefill Scheduler

**Feature** : 015-smart-prefill-scheduler  
**Branche** : `pr/015-smart-prefill-scheduler`

## Phase 1 - Contrat et ordonnanceur serveur

- [x] T001 Ajouter les types de priorite, source et cooldown au job dans `Grayjay.ClientServer/States/StateHighlightsIndexer.cs`, en preservant les endpoints existants. Resultat observable : `QueueStatus` expose la priorite et la source d'un job.
- [x] T002 Ajouter `GeneratePrefill` et `ConfigurePrefill` dans `Grayjay.ClientServer/Controllers/HighlightsController.cs` avec validation des priorites et parallelisme 1..32. Resultat observable : une demande prefill est dedupliquee, une demande manuelle n'est pas refroidie.
- [x] T003 Verifier le build serveur par `dotnet build Grayjay.ClientServer/Grayjay.ClientServer.csproj`. Resultat observable : exit code 0.

## Phase 2 - Preferences et contrat front-end

- [x] T004 [P] Creer les utilitaires de normalisation et deduplication sessionnelle dans `Grayjay.Desktop.Web/src/utils/smartPrefill.ts` et leurs tests dans `Grayjay.Desktop.Web/src/utils/smartPrefill.test.ts`. Resultat observable : les bornes 1..32, 1..100 et les URLs dupliquees sont couvertes.
- [x] T005 Ajouter `StateSmartPrefill.ts` pour charger/persister les preferences, propager le parallelisme au serveur et emettre des demandes prefill bornees via `StateHighlightsIndexer.ts`. Resultat observable : aucune demande n'est envoyee quand la preference globale est inactive ou quand la commande est absente.
- [x] T006 Ajouter les contrats TypeScript dans `Grayjay.Desktop.Web/src/backend/HighlightsBackend.ts` et etendre le statut de job. Resultat observable : le frontend peut configurer et soumettre un job prefill type.

## Phase 3 - Reglages visibles

- [x] T007 Creer `Grayjay.Desktop.Web/src/components/settings/SmartPrefillSettings/index.tsx` et son style avec activation, plafond LLM, volume de candidats et cinq surfaces. Resultat observable : l'utilisateur peut modifier chaque preference sans voir de reglages IA dans les ecrans standards.
- [x] T008 Integrer l'entree **Smart Prefill** dans `Grayjay.Desktop.Web/src/pages/Settings/index.tsx` en respectant les patterns de navigation existants. Resultat observable : l'ecran est accessible et les sections existantes restent fonctionnelles.

## Phase 4 - Sources de prechargement

- [x] T009 Ajouter le prefill deduplique des candidats Smart Mix et de la prochaine video dans `Grayjay.Desktop.Web/src/components/contentDetails/VideoDetailView/index.tsx`. Resultat observable : le mix reste immediat, le prochain element est prioritaire et la file existante n'est pas modifiee par un resultat tardif.
- [x] T010 Ajouter le prefill deduplique aux demarrages Smart TV, a Watch now et aux groupes dans `Grayjay.Desktop.Web/src/pages/Home/index.tsx`. Resultat observable : seules les surfaces actives ajoutent les premiers candidats configures.
- [x] T011 Ajouter des mises a jour WebSocket/etat minimales pour que les jobs soient observables dans le menu Smart Chapters sans bloquer la lecture. Resultat observable : `queued`, `running`, `done` et `error` restent visibles pour une video.

## Phase 5 - Verification integree

- [x] T012 Executer les tests Node de `smartPrefill`, `smartDiscovery` et `recommendationRanking`. Resultat observable : tous passent.
- [x] T013 Executer le build frontend dans `Grayjay.Desktop.Web` puis le build serveur. Resultat observable : les deux commandes aboutissent.
- [x] T014 Construire BlueJay complet depuis cette branche basee sur `bluejay/all-features`, sans remplacer l'application ouverte. Resultat observable : l'app construite contient le menu Smart Prefill.
- [x] T015 Faire l'audit final spec/plan/taches/code, consigner les ecarts et les risques restants dans `specs/015-smart-prefill-scheduler/audit.md`. Resultat observable : aucun ecart critique non documente.

## Phase 6 - Prefill sous-titres uniquement et fenetre glissante

- [x] T016 Ajouter au serveur le sondage mis en cache des VTT exploitables, le plafond de jobs automatiques et l'etat `skipped` sans Whisper pour les traitements BlueJay. Resultat observable : une video sans VTT ne lance aucune commande et un job de lecture peut evincer un prefill catalogue encore en attente.
- [x] T017 Etendre les contrats HTTP et TypeScript avec le sondage de sous-titres, la priorite de video courante et les reglages `preparationDepth` / `maxQueuedJobs`. Resultat observable : le front-end peut filtrer un mix et configurer les nouvelles bornes sans casser les anciens reglages persistants.
- [x] T018 Implementer le filtrage progressif des candidats Smart Mix par VTT et la fenetre de prefill glissante de la file de lecture. Resultat observable : un mix actif ne met que des videos sous-titrees dans sa file lorsque Smart Prefill est actif, et prepare la video courante plus la profondeur demandee.
- [x] T019 Adapter l'ecran Smart Prefill avec les champs numeriques de profondeur et de plafond, en renommant la limite de source pour expliciter le sondage. Resultat observable : les bornes sont modifiables directement et les explications correspondent au comportement reel.
- [x] T020 Separer la passe Whisper dans un LaunchAgent nocturne borne aux groupes et chaines declares; desactiver Whisper dans la passe reguliere. Resultat observable : aucun passage regulier ne lance Whisper et la passe nocturne ciblee reste autonome.
- [ ] T021 Completer les tests, construire le front-end et le serveur, puis reconstruire et installer BlueJay all-features. Resultat observable : les tests cibles et builds passent, et l'app installee expose les nouveaux reglages.
