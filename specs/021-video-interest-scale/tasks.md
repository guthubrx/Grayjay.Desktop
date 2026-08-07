# Tasks: Echelle d'interet a dix paliers

**Input**: Design documents from `specs/021-video-interest-scale/`
**Prerequisites**: `spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/video-interest-rating.md`, `reuse-audit.md`

**Tests**: Les tests sont obligatoires car les seuils et le rendu se propagent a plusieurs surfaces de l'interface.

## Phase 1: Preparation

**Purpose**: Verifier le point d'extension et le comportement de reference.

- [X] T001 Verifier dans `Grayjay.Desktop.Web/src/utils/highlightInterest.ts` les seuils entiers existants, les trois consommateurs et l'absence d'impact sur `recommendationRanking.ts` et les filtres de chapitres.

---

## Phase 2: User Story 1 - Lire un interet gradue (Priority: P1)

**Goal**: Produire et rendre les dix demi-paliers de note video.

**Independent Test**: Executer les tests de conversion sur les dix bornes et verifier un rendu avec une demi-etoile.

### Tests pour User Story 1

- [X] T002 [US1] Etendre `Grayjay.Desktop.Web/src/utils/highlightInterest.test.ts` avec les dix seuils, les valeurs exactes de frontiere et les textes de note visibles.

### Implementation pour User Story 1

- [X] T003 [US1] Mettre a jour `Grayjay.Desktop.Web/src/utils/highlightInterest.ts` pour retourner un des dix demi-paliers, son libelle francais et sa valeur textuelle sans modifier le calcul du score brut.
- [X] T004 [US1] Creer `Grayjay.Desktop.Web/src/components/highlights/InterestRatingStars/index.tsx` et son module CSS pour afficher cinq positions fixes, dont au plus une demi-etoile, avec un nom accessible.
- [X] T005 [US1] Integrer le rendu commun dans `Grayjay.Desktop.Web/src/components/contentDetails/VideoDetailView/index.tsx` et son CSS sans modifier le conteneur Smart Analysis.
- [X] T006 [US1] Integrer le rendu commun dans les deux usages de `Grayjay.Desktop.Web/src/components/home/HeroBanner/index.tsx` et ajuster uniquement les styles locaux necessaires.

**Checkpoint**: Les trois emplacements d'interet affichent les dix paliers possibles sans changer les scores Smart Chapters.

---

## Phase 3: User Story 2 - Comprendre la note en francais (Priority: P2)

**Goal**: Rendre chaque palier explicite en francais et conserver une sortie accessible.

**Independent Test**: Verifier les dix couples note/libelle et l'attribut accessible du composant.

- [X] T007 [US2] Ajouter dans `Grayjay.Desktop.Web/src/utils/highlightInterest.test.ts` les assertions des dix libelles francais et de la valeur textuelle avec virgule.
- [X] T008 [US2] Verifier dans `InterestRatingStars` et dans les consommateurs que la note textuelle et le libelle restent exposes sans texte anglais residuel.

**Checkpoint**: La note est lisible graphiquement, textuellement et par lecteur d'ecran.

---

## Phase 4: User Story 3 - Conserver les donnees et usages existants (Priority: P3)

**Goal**: Ne pas lancer de travail supplementaire et conserver les anciens highlights fonctionnels.

**Independent Test**: Calculer l'interet depuis un ancien resume, un set de chapitres et une entree absente.

- [X] T009 [US3] Ajouter dans `Grayjay.Desktop.Web/src/utils/highlightInterest.test.ts` les cas d'anciens highlights, de score invalide et d'absence de signal.
- [X] T010 [US3] Verifier par revue ciblee que `Grayjay.Desktop.Web/src/components/player/VideoPlayerView/index.tsx`, `Grayjay.Desktop.Web/src/utils/recommendationRanking.ts` et les models highlights ne sont pas modifies.

**Checkpoint**: Aucun JSON, appel LLM, appel reseau ou ordre de recommandation ne depend de la nouvelle echelle.

---

## Phase 5: Verification et documentation

**Purpose**: Verifier le comportement complet et documenter les limites de calibration.

- [X] T011 Executer les tests TypeScript cibles de `Grayjay.Desktop.Web/src/utils/highlightInterest.test.ts` et corriger les regressions eventuelles.
- [X] T012 Executer `npm run build` dans `Grayjay.Desktop.Web` et verifier que le bundle frontend est construit sans nouvelle dependance.
- [X] T013 Mettre a jour `specs/021-video-interest-scale/implementation.md` avec les commandes, resultats de tests, fichiers modifies et revue Article XIX/XX.
- [X] T014 Realiser une revue finale spec/plan/tasks/code, verifier `git diff --check` et confirmer que toutes les taches sont cochees uniquement apres leur verification.

---

## Phase 6: User Story 4 - Voir la note dans les cartes (Priority: P1)

**Goal**: Rendre la note sur toutes les cartes videos deja indexees, sans appel par carte ni retention de resume textuel.

**Independent Test**: Charger une grille avec une video indexee puis publier un highlight pour une autre video et verifier que les badges apparaissent sans recharger la page.

- [X] T015 [US4] Etendre `Grayjay.Desktop.Web/src/state/StateIndexedHighlights.ts` pour indexer les seuls champs numeriques de resume utiles a l'interet.
- [X] T016 [US4] Integrer `InterestRatingStars` a `Grayjay.Desktop.Web/src/components/content/VideoThumbnailView/index.tsx` et reserver le coin superieur gauche dans son module CSS.
- [ ] T017 [US4] Executer les tests cibles et le build frontend, puis verifier manuellement une carte avec et sans Smart Chapters.

## Dependencies & Execution Order

- T001 precede toutes les autres taches.
- T002 doit echouer ou ne pas couvrir les nouveaux paliers avant T003.
- T003 precede T004 a T008.
- T004 precede les integrations T005 et T006.
- T007 et T008 suivent T003 et T004.
- T009 et T010 suivent T003.
- T011 a T014 suivent toutes les taches de stories.

## Implementation Strategy

1. Verifier le contrat actuel et ecrire les cas de seuils.
2. Modifier le mapping de score sans changer le calcul.
3. Introduire un seul rendu d'etoiles pour les trois usages reels.
4. Integrer, tester et construire le frontend.
5. Documenter les limites : l'echelle est plus fine, mais pas une calibration LLM inter-videos.

## Notes

- Aucun commit automatique.
- Aucun build complet de BlueJay ni installation dans `/Applications` ne sont necessaires pour valider cette PR frontend ; ils seront une etape de livraison distincte.
