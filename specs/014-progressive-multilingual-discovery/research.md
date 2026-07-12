# Recherche : Decouverte progressive multilingue

## Constat de l'existant

`StatePlatform.SearchLazy` construit un pager distribue puis lance immediatement une tache par plugin actif. Une simple boucle qui cree plusieurs recherches ne limite donc pas le volume de requetes externes. La limite doit entourer l'appel plugin dans `CreateDistributedLazyPager` et etre partagee par les variantes d'une meme session.

Le premier lot de recherche est deja observable via le polling de `SmartSearchBackend.get`. Il est donc possible de lancer une queue des qu'un resultat arrive, puis de mettre a jour uniquement sa fin avec une garde de session.

## Decision

Le contrat de recherche reste unique mais ajoute des variantes optionnelles. La decouverte evite toute traduction quand le `discoveryProfile` contient la langue cible. Si des langues sont absentes, le traducteur existant recoit un lot de quatre requetes anglaises, ce qui evite quatre allers-retours Routr.

## Limites assumees

Les plateformes restent libres de limiter leurs propres requetes. La limite locale borne le nombre de recherches plugin simultanees d'une session, sans contourner les mecanismes de rate limit des plateformes.
