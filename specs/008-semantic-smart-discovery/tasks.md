# Taches : Smart Discovery et Smart TV semantique

## Phase 1 - Fondations

- [x] T001 Ajouter les tests de similarite par profil dans `Grayjay.Desktop.Web/src/utils/smartTvSequencer.test.ts` ; les labels identiques doivent relier deux sujets textuellement differents.
- [x] T002 Ajouter les tests de requete et deduplication dans `Grayjay.Desktop.Web/src/utils/smartDiscovery.test.ts`.

## Phase 2 - Smart TV semantique

- [x] T003 [US1] Etendre `Grayjay.Desktop.Web/src/utils/smartTvSequencer.ts` avec les labels optionnels et la similarite semantique, avec repli textuel conserve.
- [x] T004 [US1] Transmettre le `mixProfile` existant aux candidats dans `Grayjay.Desktop.Web/src/pages/Home/index.tsx`, sans modifier le filtrage par groupe.

## Phase 3 - Smart Discovery

- [x] T005 [US2] Creer `Grayjay.Desktop.Web/src/utils/smartDiscovery.ts` pour deriver une requete concise et dedupliquer les videos externes par URL.
- [x] T006 [US2] Integrer SmartSearch dans `Grayjay.Desktop.Web/src/components/contentDetails/VideoDetailView/index.tsx` afin que `Create Smart Mix` attende les resultats, cree une file fixe bornee et preserve la file actuelle en cas d'echec.
- [x] T007 [US3] Reutiliser les dialogues et messages de degradation Smart Search dans `VideoDetailView` pour les traducteurs ou resultats absents.

## Phase 4 - Verification

- [ ] T008 Lancer les tests Smart TV et Smart Discovery, puis le build frontend ; verifier manuellement un Smart TV de groupe et un mix inspire par une video analysee.
