# Plan : Smart Discovery et Smart TV semantique

## Contexte technique

BlueJay contient deja les trois briques necessaires : `mixProfile` dans les highlights, `sequenceSmartTvCandidates` pour les sessions locales, et `SmartSearchBackend` pour les recherches internationales. Cette feature les relie sans endpoint ni dependance supplementaire.

## Architecture

1. Etendre le candidat Smart TV avec des labels de profil optionnels. Le sequencer privilegie une correspondance exacte entre labels canoniques, puis conserve sa similarite textuelle historique comme repli.
2. Lors du chargement des chapitres dans Home, transmettre `topics`, `relatedTopics` et `angleLabels` du highlight au candidat. Les groupes restent le filtre de source deja applique par Home.
3. Ajouter un utilitaire pur qui derive une requete courte d'un profil, ou du resume si le profil est absent, et deduplique les videos de resultat.
4. Remplacer l'action locale `Create Smart Mix` par une decouverte explicite qui reutilise `SmartSearchBackend.load`, les reglages `StateSmartSearch` et les videos retournees. Elle attend une consultation bornee, puis cree une file fixe de videos externes.

## Decisions

- Pas de nouvelle configuration : langues, traducteur et sources sont ceux de Smart Search pour eviter deux reglages divergents.
- Pas de session partielle : la file est remplacee seulement lorsque la recherche a produit des videos exploitables.
- Pas de recherche automatique dans Highlights : les Smart TV sont locaux et instantanes.
- Pas de profil persistant supplementaire : `mixProfile` est deja le contrat stable entre le generateur et le frontend.

## Verification

- Tests unitaires du sequencer : labels egaux avec titres differents, repli sans label.
- Tests unitaires de l'utilitaire de requete et deduplication.
- Tests TypeScript existants, puis build web et build ClientServer si les contrats changent.
- Verification manuelle : une ligne de groupe conserve son perimetre ; un mix inspire cree une file issue de la recherche internationale.
