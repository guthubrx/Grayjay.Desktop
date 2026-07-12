# Implementation 014

## Realisation

- `StateSmartSearch` accepte des axes de decouverte, conserve une session par etapes et expose `StartNextDiscoveryStage`.
- Les variantes de requetes partagent un `SemaphoreSlim` transmis a `StatePlatform.SearchLazy`; le reglage Smart Mix va de 1 a 32 et vaut 3 par defaut.
- `translate-query-variants` traduit les axes manquants vers toutes les langues dans un seul appel Routr.
- Create Smart Mix commence avec le premier lot disponible, puis enrichit seulement la queue non lue du meme `sessionId`.
- Les videos sont dedupliquees, la source est exclue et le classement reutilise `rankRecommendationCandidates` avec la pertinence de l'axe, la fraicheur et la popularite.

## Verification

- `python3 -m unittest tools/test_smart_search_translator.py tools/test_generate_smart_chapters.py` : succes, 7 tests.
- Tests TypeScript : 38 tests Node existants et nouveaux, plus 7 tests `smartDiscovery` executes dans un bundle esbuild : succes.
- `npx vite build` : succes.
- `dotnet build Grayjay.ClientServer/Grayjay.ClientServer.csproj --no-restore` : succes avec les avertissements preexistants du depot.
- `npx tsc --noEmit` reste en echec sur le baseline existant (194 lignes, notamment des erreurs anterieures de `VideoDetailView` et des tests avec imports `.ts`); aucun diagnostic ne pointe les nouvelles lignes de cette PR.

## Revue

- Les champs additionnels sont optionnels et le flux standard n'utilise pas le nouveau controleur d'etapes.
- La limite de parallelisme est partagee entre toutes les variantes de la session, au niveau du lancement des recherches plugin.
- Les mutations de queue sont refusees si l'utilisateur a ferme le lecteur ou a bascule vers une autre session.
