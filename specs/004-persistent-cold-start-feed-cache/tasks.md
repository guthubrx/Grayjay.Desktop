# Taches: Snapshot de Feed au Demarrage

**Entree**: artefacts de `specs/004-persistent-cold-start-feed-cache/`
**Statut**: In Progress
**Tests**: 7/8 (88%)

## Phase 1 - Contrat Et Tests

- [x] T001 Ajouter un test C# de round-trip, borne, lecture invalide et filtrage d'un `SubscriptionFeedSnapshot` dans `Grayjay.Desktop.Tests/SubscriptionFeedSnapshotTests.cs`.
- [x] T002 Ajouter un test frontend cible pour la priorite `bootstrap -> cache -> live` dans `Grayjay.Desktop.Web/src/utils/subscriptionBootstrap.test.ts`.

## Phase 2 - Snapshot Backend

- [x] T003 Creer le modele et le store de snapshot testable dans `Grayjay.ClientServer/Models/Subscriptions/SubscriptionFeedSnapshot.cs` et `Grayjay.ClientServer/States/SubscriptionFeedSnapshotStore.cs` ; resultat : ecriture atomique, lecture tolerante, taille bornee.
- [x] T004 Integrer le store a `Grayjay.ClientServer/States/StateCache.cs` avec `Debouncer` ; resultat : les mises a jour du cache demandent une reconstruction hors du chemin de rendu, les purges invalident le snapshot.
- [x] T005 Ajouter `SubscriptionsBootstrapLoad` dans `Grayjay.ClientServer/Controllers/SubscriptionsController.cs` et le client dans `Grayjay.Desktop.Web/src/backend/SubscriptionsBackend.ts` ; resultat : l'endpoint lit le snapshot sans construire un pager ni contacter une source.

## Phase 3 - Rendu Stale-While-Revalidate

- [x] T006 Exposer une ressource bootstrap unique dans `Grayjay.Desktop.Web/src/state/StateGlobal.tsx` ; resultat : Souscriptions et Highlights reutilisent le meme chargement applicatif.
- [x] T007 Adapter `Grayjay.Desktop.Web/src/pages/Subscriptions/index.tsx` ; resultat : les vignettes bootstrap apparaissent avant le pager cache/livre et les autres filtres gardent leur comportement actuel.
- [x] T008 Adapter `Grayjay.Desktop.Web/src/pages/Home/index.tsx` ; resultat : le hero de repli et les lignes de groupes peuvent etre graines par le bootstrap avant les flux lents.

## Phase 4 - Validation

- [ ] T009 Executer les tests C# cibles, les tests Node, `npm run build`, `dotnet build Grayjay.ClientServer/Grayjay.ClientServer.csproj --no-restore` et `git diff --check` ; resultat : aucun echec introduit.
- [ ] T010 Construire BlueJay puis executer `quickstart.md` avec un snapshot reel ; resultat : Souscriptions et Highlights affichent des vignettes avant la fin d'un refresh volontairement lent.

## Ordre Et Dependances

- T001 et T002 avant T003.
- T003 avant T004 et T005.
- T005 avant T006.
- T006 avant T007 et T008.
- T007 et T008 avant T009.
- T009 avant T010.

## Verification D'Analyse Croisee

- [x] Les exigences FR-001 a FR-009 ont une tache de couverture.
- [x] Les scenarios P1 Souscriptions, Highlights et absence de snapshot sont couverts.
- [x] Les exclusions de confidentialite sont portees par T003 a T006.
- [x] Le protocole manuel est explicite et reste la derniere tache.
