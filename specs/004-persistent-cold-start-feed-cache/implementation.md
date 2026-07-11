# Etat D'Implementation

## Realise

- Le cache complet existant reste la source de verite.
- Un snapshot borne de 120 videos maximum est ecrit atomiquement dans le repertoire applicatif backend apres les mises a jour de cache, avec debounce.
- Le snapshot est filtre contre les abonnements et sources actifs au moment de la lecture.
- `SubscriptionsBootstrapLoad` lit uniquement ce snapshot. Il ne construit pas de pager et ne lance pas de requete source.
- `StateGlobal` charge ce bootstrap une seule fois.
- Souscriptions selectionne successivement bootstrap, pager cache puis pager live selon leur disponibilite effective.
- Highlights utilise le bootstrap pour les lignes et le hero tant que les flux plus riches ne sont pas prets.

## Verifications Effectuees

- Test Node `subscriptionBootstrap.test.ts`: 5/5 reussis.
- `dotnet build Grayjay.ClientServer/Grayjay.ClientServer.csproj --no-restore`: reussi, 0 erreur.
- `npm run build`: reussi.
- `git diff --check`: reussi.
- Le projet MSTest est lance avec le filtre du nouveau test. Aucun diagnostic ne concerne `SubscriptionFeedSnapshotTests.cs`.

## Limite Connue De Test

`dotnet test Grayjay.Desktop.Tests/Grayjay.Desktop.Tests.csproj` reste en echec avant execution des tests car des `ProxyTests` existants utilisent l'ancienne representation `Dictionary<string, string>` des headers, alors que le sous-module courant expose `HttpHeaders`. Cette PR ne modifie ni ces tests ni les headers. Le nouveau test reste present et compile dans le projet jusqu'a ce point de blocage.

## A Valider Dans BlueJay

- T009 reste ouvert car la suite MSTest globale ne peut pas etre executee proprement.
- T010 reste ouvert: construire BlueJay, laisser le snapshot etre produit, relancer puis verifier l'affichage avant la fin du refresh selon `quickstart.md`.
