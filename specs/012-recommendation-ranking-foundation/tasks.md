# Taches : Socle de classement des recommandations

## Phase 1 - Fondations et tests

- [x] T001 Ajouter `Grayjay.Desktop.Web/src/utils/recommendationRanking.test.ts` : normalisation logarithmique des vues, absence de signaux, ordre stable et score editorial facultatif. Resultat observable : chaque classement est deterministe.
- [x] T002 Ajouter les tests de regression de `Grayjay.Desktop.Web/src/utils/highlightInterest.ts` dans `Grayjay.Desktop.Web/src/utils/highlightInterest.test.ts` : la valeur editoriale ne depend ni des vues ni de la fraicheur. Resultat observable : deux entrees identiques de chapitres gardent la meme note malgre des dates differentes.
- [x] T003 Ajouter un test dans `Grayjay.Desktop.Web/src/utils/smartTvSequencer.test.ts` : un rang video optionnel departage des chapitres de valeur comparable sans faire passer un chapitre sous le seuil. Resultat observable : les contraintes existantes restent respectees.

## Phase 2 - Noyau sans IA

- [x] T004 [US1] Creer `Grayjay.Desktop.Web/src/utils/recommendationRanking.ts` avec les candidats, les signaux normalises et le classement pur. Resultat observable : aucun import de backend Smart, de routeur ou de reseau.
- [x] T005 [US2] Ajuster `Grayjay.Desktop.Web/src/utils/highlightInterest.ts` afin que son score reste exclusivement editorial et fournir cette valeur au noyau comme signal optionnel. Resultat observable : les etoiles ne varient plus avec la date de publication.

## Phase 3 - Integration Home et Smart TV

- [x] T006 [US3] Integrer le classement dans `Grayjay.Desktop.Web/src/pages/Home/index.tsx` pour Hero, Watch now, les lignes de groupes et les sources Smart TV, sans modifier Continue watching, Watch later ou l'ordre de recherche standard. Resultat observable : chaque surface concernee reutilise le meme adaptateur local.
- [x] T007 [US3] Etendre `Grayjay.Desktop.Web/src/utils/smartTvSequencer.ts` pour consommer un rang video optionnel comme departage secondaire tout en conservant les seuils, limites et penalites de session. Resultat observable : les meilleurs chapitres restent prioritaires a rang video egal.

## Phase 4 - Verification et documentation

- [x] T008 Executer les tests unitaires cibles et le build Vite; documenter les baselines TypeScript existantes hors perimetre dans `specs/012-recommendation-ranking-foundation/implementation.md`. Resultat observable : commandes et resultats reproductibles.
- [x] T009 Relire le diff selon Articles XIX/XX et completer le journal `specs/012-recommendation-ranking-foundation/implementation.md`. Resultat observable : chaque abstraction ajoutee est justifiee et aucun fichier superflu ne reste.
