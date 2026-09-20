# Plan d'implementation : Smart Prefill Scheduler

**Branche** : `pr/015-smart-prefill-scheduler` | **Date** : 2026-07-13 | **Spec** : [spec.md](spec.md)

## Resume

Smart Prefill enrichit en arriere-plan les videos les plus susceptibles d'etre lues. Il reutilise le moteur existant `StateHighlightsIndexer` comme ordonnanceur unique : une file dedupliquee, des priorites explicites, une limite de travailleurs et un plafond de file configurables. L'interface persiste des preferences opt-in et alimente cette file depuis Smart Mix, la suite de lecture, Smart TV, Watch now et les groupes d'abonnements.

Le mix commence avec les premiers resultats de plateforme qui exposent des sous-titres VTT verifies. Une fenetre glissante prepare la video lue et un nombre configurable de suivantes, sans bloquer la lecture. Les nouveaux Smart Chapters restent disponibles a leur ouverture suivante ; la file Smart Mix n'est jamais remplacee retroactivement par cette fonctionnalite.

## Contexte technique

**Langages** : C# / .NET 8 ; TypeScript / SolidJS.  
**Dependances principales** : ASP.NET Core, WebSocket BlueJay existant, commandes externes configurees par l'utilisateur.  
**Stockage** : preferences dans le store persistant Grayjay ; donnees d'enrichissement dans les fichiers `highlights/*.json` existants.  
**Tests** : tests unitaires C# existants lorsque disponibles, tests Node pour utilitaires TypeScript, builds `dotnet` et frontend.  
**Cible** : application desktop macOS BlueJay ; code portable avec les conventions Grayjay existantes.  
**Contraintes** : aucun appel LLM automatique sans opt-in ; pas de secret dans BlueJay ; la lecture ne depend jamais de la fin d'un prefill.  
**Portee** : orchestration applicative seulement. Les scripts de backfill autonomes deja en cours ne partagent pas de semaphore inter-processus avec BlueJay.

## Decisions de conception

1. **Etendre `StateHighlightsIndexer`, ne pas creer un nouveau service.** Il contient deja la deduplication URL, l'execution de la commande externe, les notifications WebSocket et le controle de parallelisme. Cela garde un seul point de verite pour les travaux demarres par BlueJay ou par `refresh-highlights.py` lorsqu'il utilise l'API BlueJay.
2. **Modeliser une intention de file (`manual`, `next`, `smart-mix`, `smart-tv`, `watch-now`, `priority-group`, `catalog`).** La priorite est determininiste et visible dans l'etat du job. Une action explicite reste toujours devant les prefills.
3. **Exiger un VTT plateforme dans BlueJay.** Le prefill n'analyse rien lui-meme : il passe par `gen-chapters.sh` uniquement apres materialisation d'un sous-titre VTT par Grayjay. L'absence de VTT rend le job `skipped`, sans invocation de Whisper.
4. **Preferences front-end, enforcement serveur.** Le front-end decide quelles surfaces sont activees et quels candidats limiter ; le serveur impose la limite de travailleurs commune et deduplique les jobs actifs.
5. **Fenetre de prefill borne et sessionnelle.** Les surfaces catalogue sondent un nombre borne de candidats. Les sessions de lecture maintiennent une fenetre glissante : video courante et nombre configure de suivantes. Un plafond serveur evite que les sources passives accumulent des jobs; un travail plus prioritaire peut evincer un travail automatique encore en attente.
6. **Whisper est hors du parcours interactif.** La passe reguliere reste sous-titres uniquement. Un second LaunchAgent nocturne, limite aux groupes ou chaines explicitement listes, execute la passe Whisper de rattrapage avec ses propres limites de temps et de volume.
7. **Degradation gracieuse.** Sans commande de generation, sans Smart Chapters, sans sous-titres ou avec Routr indisponible, les videos, recherches, Smart Mix et carrousels conservent leur comportement actuel.

## Verification constitutionnelle

| Gate | Resultat | Justification |
|---|---|---|
| Francais pour les artefacts SpecKit | Passe | Tous les artefacts de cette feature sont en francais. |
| Recherche IA/automatisation | Passe | Baselines lues et validation live documentee dans `research.md`. |
| Charge cognitive | Passe | Une section de reglages dediee et courte evite de surcharger Smart Search et Smart Mix. |
| Une abstraction necessaire | Passe | L'ordonnanceur existe deja ; aucune nouvelle couche de service n'est creee. |
| Degradation sans IA | Passe | L'opt-in est desactive par defaut et chaque integration quitte sans commande configuree. |

## Structure cible

```text
Grayjay.ClientServer/
├── Controllers/HighlightsController.cs                 # endpoints de prefill, sondage VTT et etat de file
└── States/StateHighlightsIndexer.cs                    # file priorisee, VTT, cooldown, parallelisme

Grayjay.Desktop.Web/src/
├── backend/HighlightsBackend.ts                         # contrat HTTP TypeScript
├── state/StateHighlightsIndexer.ts                     # emission de jobs prefill
├── state/StateSmartPrefill.ts                           # preferences, fenetre glissante et deduplication sessionnelle
├── components/settings/SmartPrefillSettings/            # ecran de reglages opt-in
├── pages/Settings/index.tsx                             # entree Smart Prefill
├── components/contentDetails/VideoDetailView/index.tsx # Smart Mix et prochaine video
└── pages/Home/index.tsx                                 # Smart TV, Watch now, groupes

specs/015-smart-prefill-scheduler/
├── research.md
├── data-model.md
├── contracts/smart-prefill-api.md
├── quickstart.md
└── reuse-audit.md

docs/decisions/015-smart-prefill-scheduler.md
```

## Strategie de verification

- Tests unitaires de priorite, deduplication et cooldown de l'indexeur.
- Tests unitaires de normalisation des profondeurs, plafonds et fenetres glissantes.
- Tests utilitaires TypeScript de normalisation des preferences et deduplication sessionnelle.
- Build du serveur et du front-end.
- Build complet BlueJay apres integration dans `bluejay/all-features` et test manuel : Smart Prefill desactive puis actif, generation d'un Smart Mix, observation des jobs et de la file.

## Complexite

Aucune exception de complexite. La feature reutilise les primitives deja presentes et ajoute seulement l'etat minimal necessaire aux priorites et preferences.
