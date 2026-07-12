# Plan : Decouverte progressive multilingue

## Architecture

1. Etendre le contrat Smart Search avec des variantes identifiees, un axe, une etape et une limite de parallelisme optionnels.
2. Construire sur le serveur les variantes depuis `discoveryProfile`; reutiliser les requetes deja precalculees et grouper les traductions manquantes dans le traducteur existant.
3. Conserver une session serveur : l'etape utilisateur est lancee immediatement, puis les etapes anglais et autres langues sont demarrees explicitement par le client.
4. Passer un `SemaphoreSlim` partage a la creation des pagers de recherche afin de limiter les appels plugin reels de cette session.
5. Demarrer la file Smart Mix des le premier resultat puis remplacer seulement sa queue non lue, sous garde d'identifiant de session.
6. Classer les candidats externes avec le ranker generique de la PR 012 et un signal de pertinence fourni par l'axe.

## Compatibilite

- La requete Smart Search actuelle (`query` + `languages`) reste inchangee et conserve sa traduction historique.
- Les champs de decouverte sont optionnels dans les contrats C# et TypeScript.
- Sans `discoveryProfile`, Create Smart Mix garde la requete historique et ne depend pas d'une analyse supplementaire.

## Verification

- Tests Python du traducteur de lots.
- Tests TypeScript du plan de langues, de la deduplication et du classement des videos Smart Mix.
- Tests TypeScript de la protection de queue non lue.
- Build web et build ClientServer.
