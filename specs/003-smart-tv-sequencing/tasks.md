# Taches : Sequencement editorial Smart TV

**Entree** : artefacts de `specs/003-smart-tv-sequencing/`
**Prerequis** : `spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/`, `reuse-audit.md`

## Format

- `[P]` : tache paralleisable sur un fichier distinct.
- `[USn]` : rattachement a une user story de la specification.
- Chaque tache possede un resultat observable et un chemin explicite.

## Phase 1 - Mise en place

- [x] T001 Verifier le worktree, les fichiers ignores et l'absence de dependance nouvelle dans `.gitignore` et `Grayjay.Desktop.Web/package.json` ; resultat : aucun changement hors perimetre requis.
- [x] T002 Creer le journal d'implementation dans `specs/003-smart-tv-sequencing/implementation.md` ; resultat : decisions, commandes, validations et fichiers modifies tracables.

## Phase 2 - Fondations test-first

- [x] T003 [P] Ecrire les tests initialement rouges de score dominant, plafonds durs, exclusion de chapitre joue, diversite de createur, intentions de transition, repli et determinisme dans `Grayjay.Desktop.Web/src/utils/smartTvSequencer.test.ts` ; resultat : le runner Node echoue avant que le sequenceur existe.
- [x] T004 Implementer le sequenceur pur et type dans `Grayjay.Desktop.Web/src/utils/smartTvSequencer.ts` ; resultat : T003 passe, aucune dependance nouvelle ni effet de bord, et chaque entree apres l'ancrage porte une transition.

**Checkpoint** : le calcul est verifie hors Home ; aucune user story ne branche le lecteur avant le passage de T003 et T004.

## Phase 3 - User Story 1 : lancer un parcours editorial coherent (P1)

**Objectif** : une session fixe est une suite explicable d'ancrage, continuite, decouverte ou changement d'angle, sans cycle arbitraire.

**Test independant** : partir de six chapitres analyses sur plusieurs videos, lancer Global mix et observer les labels de transition persistés dans la session construite.

- [x] T005 [US1] Etendre les types Smart TV et convertir les ensembles `IVideoHighlightSet` en candidats editoriaux dans `Grayjay.Desktop.Web/src/pages/Home/index.tsx` ; resultat : titre, resume, these, date, createur, groupe source optionnel et signal d'angle sont fournis au sequenceur sans nouvelle requete IA.
- [x] T006 [US1] Remplacer `capSmartTvEntries` par l'appel au sequenceur dans `Grayjay.Desktop.Web/src/pages/Home/index.tsx` ; resultat : FR-001 a FR-009 et FR-013 sont respectees, la session fixe persiste son snapshot et les anciennes sessions restent lisibles.

**Checkpoint** : l'utilisateur peut lancer une session utile et ordonnee, meme avec le profil par defaut.

## Phase 4 - User Story 2 : eviter la repetition sans perdre les bons passages (P1)

**Objectif** : ne jamais rejouer un chapitre historique, respecter les plafonds et limiter souplement la monotonie de video, createur, sujet et groupe connu.

**Test independant** : jouer des chapitres, recalculer puis verifier que leurs cles sont exclues, alors qu'un autre chapitre non joue de la meme video reste potentiellement selectionnable.

- [x] T007 [US2] Preserver l'historique existant et propager la provenance de groupe lors de la creation des sources Smart TV dans `Grayjay.Desktop.Web/src/pages/Home/index.tsx` ; resultat : FR-010 a FR-012 sont couverts sans creer de seconde persistance ni exclure une video entiere.
- [x] T008 [US2] Completer les fixtures de `Grayjay.Desktop.Web/src/utils/smartTvSequencer.test.ts` pour verifier les repli quand les limites rendent une intention impossible ; resultat : le meilleur candidat encore eligible est choisi avec `Best available` et les limites restent inviolables.

**Checkpoint** : la diversite est une preference souple, mais le deja-joue et les plafonds restent des garde-fous fiables.

## Phase 5 - User Story 3 : garder une session stable et controlable (P2)

**Objectif** : regler le mix du prochain calcul et voir la raison de chaque passage dans le contexte de lecture existant.

**Test independant** : changer le profil dans Settings, recalculer une session, puis verifier que la session deja jouee ne change pas et que l'overlay affiche le label du nouveau passage.

- [x] T009 [P] [US3] Ajouter les dropdowns `Editorial mix` et `Creator variety` dans `Grayjay.ClientServer/Settings/GrayjaySettings.cs` ; resultat : les valeurs par defaut sont retrocompatibles et sauvegardees par le mecanisme de reglages existant.
- [x] T010 [US3] Resoudre les nouveaux reglages et les transmettre au sequenceur dans `Grayjay.Desktop.Web/src/pages/Home/index.tsx` ; resultat : FR-015 est applique uniquement aux nouveaux calculs, sans muter une session existante.
- [x] T011 [P] [US3] Etendre `VideoQueueItemMeta` dans `Grayjay.Desktop.Web/src/contexts/VideoProvider.tsx` et afficher le label de transition optionnel dans `Grayjay.Desktop.Web/src/components/contentDetails/VideoDetailView/index.tsx` ; resultat : FR-014 est visible au changement de chapitre et les files non Smart TV restent inchangees.

**Checkpoint** : le controle utilisateur est explicite et la raison de chaque enchainement est visible au moment utile.

## Phase 6 - Validation et finition

- [x] T012 [P] Mettre a jour l'ADR et le journal dans `docs/decisions/002-local-smart-tv-editorial-sequencing.md` et `specs/003-smart-tv-sequencing/implementation.md` ; resultat : les limites lexicales, l'absence d'appel IA et le contrat de compatibilite sont tracables.
- [x] T013 Executer `node --test src/utils/smartTvSequencer.test.ts` depuis `Grayjay.Desktop.Web` ; resultat : les invariants du sequenceur et les cas de repli passent.
- [x] T014 Executer `npm run build` dans `Grayjay.Desktop.Web` puis `dotnet build Grayjay.ClientServer/Grayjay.ClientServer.csproj` ; resultat : les builds passent et tout avertissement preexistant est distingue.
- [x] T015 Executer `git diff --check`, relire le diff complet et documenter la self-review Article XIX/XX dans `specs/003-smart-tv-sequencing/implementation.md` ; resultat : aucune erreur de whitespace, aucun wrapper ou reglages non justifies.
- [ ] T016 Executer le protocole de `specs/003-smart-tv-sequencing/quickstart.md` sur une build BlueJay installee ; resultat : session fixe stable, labels visibles, reglages effectifs et degradation gracieuse constates.

## Dependances et ordre

```text
T001 -> T002 -> T003 -> T004
T004 -> T005 -> T006 -> T007 -> T008
T004 -> T009 -> T010
T006 -> T011
T008 + T010 + T011 -> T012 -> T013 -> T014 -> T015 -> T016
```

- T003 et T009 peuvent etre prepares en parallele apres T002, mais T004 attend le test rouge et T010 attend le contrat de reglages de T009.
- T010 et T011 sont paralleles apres T006 et T009 : ils touchent respectivement Home, puis VideoProvider et VideoDetailView.
- Les stories restent sequentielles car elles partagent `Home/index.tsx` et le constructeur de session.

## Criteres independants par story

- **US1** : une session fixe contient un ancrage puis des intentions explicites sans perturber la file standard.
- **US2** : les chapitres joues n'apparaissent plus apres recalcul et les contraintes de session gagnent toujours sur la diversification.
- **US3** : modifier les dropdowns change seulement le prochain recalcul et l'overlay rend la raison de transition sans toucher aux autres files.

## Strategie d'implementation

1. Ecrire et faire passer les tests du sequenceur pur.
2. Remplacer le capping score-only de Smart TV et verifier la session fixe par defaut.
3. Propager proprement l'historique et la provenance de groupe disponible.
4. Ajouter les controles et l'explication au lecteur.
5. Executer builds, self-review et test manuel BlueJay.

## Notes

- Aucun commit automatique dans ce pipeline.
- Le mode Smart TV en continu et les changements du generateur Smart Chapters sont explicitement hors perimetre.
- Aucun changement n'est prevu dans les PR FUTO de corrections ou dans les autres fonctionnalites Smart quand Smart Chapters est absent.
